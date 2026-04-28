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
    this.reconnectToken = null;
  }

  getSnapshot() {
    return {
      status: this.status,
      role: this.role,
      localPlayer: this.localPlayer,
      gameId: this.gameId,
      reconnectToken: this.reconnectToken,
      connected: this.isConnected(),
      spectating: this.localPlayer === "spectator",
      connectionState: this.peerConnection?.connectionState ?? null,
      iceConnectionState: this.peerConnection?.iceConnectionState ?? null,
      iceGatheringState: this.peerConnection?.iceGatheringState ?? null,
      channelState: this.channel?.readyState ?? null,
      peerCount: this.peerConnection ? 1 : 0
    };
  }

  isConnected() {
    return this.channel?.readyState === "open";
  }

  isOnlineMode() {
    return this.status !== "idle";
  }

  async createHost(options = {}) {
    this.disconnect({ silent: true, keepIdentity: false });
    this.role = options.spectatorHost ? "spectator-host" : "host";
    this.localPlayer = options.spectatorHost ? "black" : "black";
    this.gameId = options.gameId ?? createId();
    this.reconnectToken = options.reconnectToken ?? createId();
    this.setStatus("creating-offer");

    this.peerConnection = this.createPeerConnection();
    this.channel = this.peerConnection.createDataChannel("shogi-html-v07", {
      ordered: true
    });
    this.setupDataChannel(this.channel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(this.peerConnection);

    this.emitSignal(createSignalEnvelope({
      type: options.reconnect ? "reconnect-offer" : "offer",
      gameId: this.gameId,
      reconnectToken: this.reconnectToken,
      roleHint: this.role,
      description: this.peerConnection.localDescription
    }));
    this.setStatus("waiting-answer");
  }

  async createReconnectOffer() {
    if (!this.gameId || !this.localPlayer) {
      throw new Error("再接続する対局情報がありません。先に通常接続を開始してください。");
    }

    const gameId = this.gameId;
    const reconnectToken = this.reconnectToken ?? createId();
    const localPlayer = this.localPlayer;
    const role = this.role ?? "host";
    this.disconnect({ silent: true, keepIdentity: true });
    this.role = role;
    this.localPlayer = localPlayer;
    this.gameId = gameId;
    this.reconnectToken = reconnectToken;
    await this.createOfferWithIdentity("reconnect-offer");
  }

  async createGuestAnswer(signalText, options = {}) {
    const offer = parseSignal(signalText, null);
    if (offer.type !== "offer" && offer.type !== "reconnect-offer") {
      throw new Error("オファーコードまたは再接続オファーコードが必要です。");
    }

    this.disconnect({ silent: true, keepIdentity: false });
    this.role = options.spectator ? "spectator" : "guest";
    this.localPlayer = options.spectator ? "spectator" : "white";
    this.gameId = offer.gameId;
    this.reconnectToken = offer.reconnectToken ?? createId();
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
      type: offer.type === "reconnect-offer" ? "reconnect-answer" : "answer",
      gameId: this.gameId,
      reconnectToken: this.reconnectToken,
      roleHint: this.role,
      description: this.peerConnection.localDescription
    }));
    this.setStatus("waiting-connect");
  }

  async acceptAnswer(signalText) {
    if (!this.peerConnection || !this.role) {
      throw new Error("ホスト開始後に回答コードを読み込んでください。");
    }

    const answer = parseSignal(signalText, null);
    if (answer.type !== "answer" && answer.type !== "reconnect-answer") {
      throw new Error("回答コードまたは再接続回答コードが必要です。");
    }
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
    const keepIdentity = Boolean(options.keepIdentity);
    const identity = keepIdentity ? {
      role: this.role,
      localPlayer: this.localPlayer,
      gameId: this.gameId,
      reconnectToken: this.reconnectToken
    } : null;

    this.channel?.close();
    this.peerConnection?.close();
    this.channel = null;
    this.peerConnection = null;
    this.role = identity?.role ?? null;
    this.localPlayer = identity?.localPlayer ?? null;
    this.gameId = identity?.gameId ?? null;
    this.reconnectToken = identity?.reconnectToken ?? null;
    this.status = keepIdentity ? "disconnected" : "idle";

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
        this.setStatus(this.gameId ? "disconnected" : "idle");
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

  async createOfferWithIdentity(type) {
    this.setStatus("creating-offer");
    this.peerConnection = this.createPeerConnection();
    this.channel = this.peerConnection.createDataChannel("shogi-html-v07", { ordered: true });
    this.setupDataChannel(this.channel);
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(this.peerConnection);
    this.emitSignal(createSignalEnvelope({
      type,
      gameId: this.gameId,
      reconnectToken: this.reconnectToken,
      roleHint: this.role,
      description: this.peerConnection.localDescription
    }));
    this.setStatus("waiting-answer");
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

  const allowedTypes = ["offer", "answer", "reconnect-offer", "reconnect-answer"];
  if (!allowedTypes.includes(signal.type)) {
    throw new Error("接続コードの種別が不正です。");
  }

  if (!signal.gameId || !signal.description?.type || !signal.description?.sdp) {
    throw new Error("接続コードの形式が不正です。コピー内容を確認してください。");
  }

  return signal;
}

function createSignalEnvelope({ type, gameId, reconnectToken, roleHint, description }) {
  return {
    app: "shogi-html",
    kind: "webrtc-signal",
    version: 3,
    type,
    gameId,
    reconnectToken,
    roleHint,
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


export function summarizeSignal(signal) {
  const parsed = typeof signal === "string" ? parseSignal(signal, null) : signal;
  const type = parsed.type ?? "unknown";
  const role = parsed.roleHint ?? "unknown";
  const gameId = parsed.gameId ? String(parsed.gameId).slice(0, 8) : "-";
  return `${type} / ${role} / ${gameId}`;
}

export function canAcceptSignalForCurrentSession(signal, snapshot = {}) {
  const parsed = typeof signal === "string" ? parseSignal(signal, null) : signal;
  if (!snapshot.gameId) return true;
  if (parsed.type === "offer") return true;
  return parsed.gameId === snapshot.gameId;
}
