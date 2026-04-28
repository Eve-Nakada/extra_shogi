const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" }
];

export class RtcGameSession {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.peerConnection = null;
    this.channel = null;
    this.role = null;
    this.localPlayer = null;
    this.gameId = null;
    this.status = "idle";
  }

  getSnapshot() {
    return {
      status: this.status,
      role: this.role,
      localPlayer: this.localPlayer,
      gameId: this.gameId,
      connected: this.isConnected()
    };
  }

  isConnected() {
    return this.channel?.readyState === "open";
  }

  isOnlineMode() {
    return this.status !== "idle";
  }

  async createHost() {
    this.disconnect({ silent: true });
    this.role = "host";
    this.localPlayer = "black";
    this.gameId = createId();
    this.setStatus("creating-offer");

    this.peerConnection = this.createPeerConnection();
    this.channel = this.peerConnection.createDataChannel("shogi-html-v05", {
      ordered: true
    });
    this.setupDataChannel(this.channel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(this.peerConnection);

    this.emitSignal(createSignalEnvelope({
      type: "offer",
      gameId: this.gameId,
      description: this.peerConnection.localDescription
    }));
    this.setStatus("waiting-answer");
  }

  async createGuestAnswer(signalText) {
    const offer = parseSignal(signalText, "offer");

    this.disconnect({ silent: true });
    this.role = "guest";
    this.localPlayer = "white";
    this.gameId = offer.gameId;
    this.setStatus("creating-answer");

    this.peerConnection = this.createPeerConnection();
    this.peerConnection.ondatachannel = event => {
      this.channel = event.channel;
      this.setupDataChannel(this.channel);
    };

    await this.peerConnection.setRemoteDescription(offer.description);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await waitForIceGatheringComplete(this.peerConnection);

    this.emitSignal(createSignalEnvelope({
      type: "answer",
      gameId: this.gameId,
      description: this.peerConnection.localDescription
    }));
    this.setStatus("waiting-connect");
  }

  async acceptAnswer(signalText) {
    if (!this.peerConnection || this.role !== "host") {
      throw new Error("ホスト開始後に回答コードを読み込んでください。");
    }

    const answer = parseSignal(signalText, "answer");
    if (answer.gameId !== this.gameId) {
      throw new Error("対局IDが一致しません。別の回答コードの可能性があります。");
    }

    await this.peerConnection.setRemoteDescription(answer.description);
    this.setStatus("waiting-connect");
  }

  send(message) {
    if (!this.isConnected()) {
      throw new Error("通信が接続されていません。");
    }

    this.channel.send(JSON.stringify({
      ...message,
      gameId: this.gameId,
      sentAt: new Date().toISOString()
    }));
  }

  disconnect(options = {}) {
    this.channel?.close();
    this.peerConnection?.close();
    this.channel = null;
    this.peerConnection = null;
    this.role = null;
    this.localPlayer = null;
    this.gameId = null;
    this.status = "idle";

    if (!options.silent) {
      this.callbacks.onStatus?.(this.getSnapshot());
    }
  }

  createPeerConnection() {
    if (typeof RTCPeerConnection === "undefined") {
      throw new Error("このブラウザはRTCPeerConnectionに対応していません。HTTPSまたはlocalhostで開いてください。");
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: DEFAULT_ICE_SERVERS
    });

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === "connected") {
        this.setStatus("connected");
      } else if (state === "failed") {
        this.setStatus("failed");
      } else if (state === "disconnected") {
        this.setStatus("disconnected");
      } else if (state === "closed") {
        this.setStatus("idle");
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      this.callbacks.onStatus?.(this.getSnapshot());
    };

    return peerConnection;
  }

  setupDataChannel(channel) {
    channel.onopen = () => {
      this.setStatus("connected");
      this.callbacks.onOpen?.(this.getSnapshot());
    };

    channel.onclose = () => {
      if (this.status !== "idle") {
        this.setStatus("disconnected");
      }
      this.callbacks.onClose?.(this.getSnapshot());
    };

    channel.onerror = () => {
      this.setStatus("failed");
    };

    channel.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        this.callbacks.onMessage?.(message, this.getSnapshot());
      } catch (error) {
        this.callbacks.onError?.(new Error("通信メッセージをJSONとして読めません。"));
      }
    };
  }

  emitSignal(signal) {
    this.callbacks.onSignal?.(JSON.stringify(signal, null, 2));
  }

  setStatus(status) {
    this.status = status;
    this.callbacks.onStatus?.(this.getSnapshot());
  }
}

export function parseSignal(text, expectedType = null) {
  let signal;
  try {
    signal = JSON.parse(text);
  } catch (error) {
    throw new Error("接続コードをJSONとして読み込めません。");
  }

  if (!signal || signal.app !== "shogi-html" || signal.kind !== "webrtc-signal") {
    throw new Error("このアプリ用の接続コードではありません。");
  }

  if (expectedType && signal.type !== expectedType) {
    throw new Error(`${expectedType}コードが必要ですが、${signal.type ?? "不明"}コードが入力されています。`);
  }

  if (!signal.gameId || !signal.description?.type || !signal.description?.sdp) {
    throw new Error("接続コードの形式が不正です。コピー内容を確認してください。");
  }

  return signal;
}

function createSignalEnvelope({ type, gameId, description }) {
  return {
    app: "shogi-html",
    kind: "webrtc-signal",
    version: 1,
    type,
    gameId,
    description: {
      type: description.type,
      sdp: description.sdp
    },
    createdAt: new Date().toISOString()
  };
}

function waitForIceGatheringComplete(peerConnection) {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const timeoutId = window.setTimeout(finish, 5000);

    function finish() {
      window.clearTimeout(timeoutId);
      peerConnection.removeEventListener("icegatheringstatechange", handleStateChange);
      resolve();
    }

    function handleStateChange() {
      if (peerConnection.iceGatheringState === "complete") {
        finish();
      }
    }

    peerConnection.addEventListener("icegatheringstatechange", handleStateChange);
  });
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `game-${Date.now()}-${random}`;
}
