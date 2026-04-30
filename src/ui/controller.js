import { applyMove } from "../core/applyMove.js";
import { createClock, formatClockMs, getDisplayRemainingMs, pauseClock, startClock, switchClockAfterMove, updateClock } from "../core/clock.js";
import { getSquare } from "../core/coordinates.js";
import { createStatusText, declareImpasse, isCurrentTurnInCheck, resign, updateGameStatus } from "../core/gameStatus.js";
import { getLegalMoves } from "../core/legalMoveFilter.js";
import { parseGameRecord, restoreGameRecord, serializeGameRecord } from "../core/record.js";
import { createKifLikeGameRecord } from "../core/notation.js";
import { completeGameMeta, normalizeGameMeta } from "../core/meta.js";
import { replayHistory } from "../core/replay.js";
import { opposite, playerName } from "../core/state.js";
import { undoLastMove } from "../core/undo.js";
import { applyIncomingClock, applyIncomingMove, applyIncomingResign, createClockMessage, createMoveMessage, createPingMessage, createPongMessage, createResignMessage, createSyncMessage, createSyncRequestMessage } from "../net/gameSync.js";
import { createConnectionLog, addConnectionLog, clearConnectionLog, createSnapshotText, summarizeMessage } from "../net/connectionLog.js";
import { RtcGameSession } from "../net/rtcSession.js";
import { renderBoard } from "./renderBoard.js";
import { renderHands } from "./renderHands.js";
import { renderHistory } from "./renderHistory.js";
import { renderConnectionLog } from "./renderConnectionLog.js";

const LOCAL_SAVE_KEY = "shogi-html:last-game";

export function initController({ createState, elements, rulesets, rulesetsById, defaultRulesetId }) {
  let currentRulesetId = defaultRulesetId ?? rulesets[0].id;
  let state = createState(currentRulesetId);
  const connectionLog = createConnectionLog({ maxEntries: 120 });
  let lastOnlineSnapshotText = "";

  const onlineSession = new RtcGameSession({
    onSignal: text => {
      elements.signalOutput.value = text;
      addLog("local", "signal", "接続コードを作成しました。");
      setMessage("接続コードを作成しました。相手へコピーして渡してください。");
      renderAll();
    },
    onStatus: snapshot => {
      const nextText = createSnapshotText(snapshot);
      if (nextText !== lastOnlineSnapshotText) {
        lastOnlineSnapshotText = nextText;
        addLog("local", "status", nextText);
      }
      renderAll();
    },
    onOpen: snapshot => {
      addLog("local", "open", snapshot.spectating ? "観戦接続が開きました。" : "通信接続が開きました。");
      sendSyncMessage();
      setMessage(snapshot.spectating ? "観戦接続が開きました。" : "通信接続が開きました。");
      renderAll();
    },
    onClose: snapshot => {
      addLog("local", "close", createSnapshotText(snapshot));
      setMessage("通信接続が閉じました。必要なら再接続してください。");
      clearSelection();
      renderAll();
    },
    onMessage: handleOnlineMessage,
    onError: error => {
      addLog("error", "error", error.message);
      setMessage(error.message);
    }
  });

  const uiState = {
    selected: null,
    legalMoves: [],
    replayIndex: null,
    readonly: false
  };

  initializeRulesetSelect();
  bindEvents();
  window.setInterval(() => {
    updateRunningClock();
    renderAll();
  }, 1000);
  renderAll();

  return {
    getState: () => state,
    render: renderAll
  };

  function bindEvents() {
    elements.board.addEventListener("click", event => {
      const square = event.target.closest(".square");
      if (!square) return;
      handleBoardClick(Number(square.dataset.x), Number(square.dataset.y));
    });

    elements.blackHand.addEventListener("click", handleHandClick);
    elements.whiteHand.addEventListener("click", handleHandClick);

    elements.historyList.addEventListener("click", event => {
      if (onlineSession.isOnlineMode()) return;
      const button = event.target.closest(".history-button");
      if (button) setReplayIndex(Number(button.dataset.index) + 1);
    });

    for (const input of getMetaInputs()) {
      input.addEventListener("input", () => {
        syncMetaFromInputs();
        renderTextRecordPreview();
      });
    }

    elements.exportTextButton.addEventListener("click", exportTextRecord);
    elements.copyTextButton.addEventListener("click", copyTextRecord);

    elements.rulesetSelect.addEventListener("change", () => {
      if (onlineSession.isOnlineMode()) {
        elements.rulesetSelect.value = currentRulesetId;
        return;
      }
      currentRulesetId = elements.rulesetSelect.value;
      state = createState(currentRulesetId);
      clearSelection();
      clearReplay();
      renderAll();
    });

    elements.impasseButton.addEventListener("click", () => {
      if (state.status.type !== "playing" || isReplayMode()) return;
      if (onlineSession.isOnlineMode() && !onlineSession.isConnected()) return;

      const result = declareImpasse(state);
      if (result.type === "rejected") {
        const scores = result.detail?.scores ?? {};
        setMessage(`持将棋判定はまだ成立しません。先手${scores.black ?? "-"}点 / 後手${scores.white ?? "-"}点。双方の玉が敵陣に入っている必要があります。`);
        renderAll();
        return;
      }

      if (onlineSession.isConnected()) sendSyncMessage();
      clearSelection();
      clearReplay();
      renderAll();
      setMessage("持将棋判定を反映しました。");
    });

    elements.resignButton.addEventListener("click", () => {
      if (state.status.type !== "playing" || isReplayMode()) return;
      if (onlineSession.isOnlineMode() && !onlineSession.isConnected()) return;
      const resigningPlayer = getLocalResigningPlayer();
      const message = onlineSession.isConnected() ? createResignMessage(state, resigningPlayer) : null;
      resign(state, resigningPlayer);
      if (message) sendOnlineMessage(message);
      clearSelection();
      renderAll();
    });

    elements.resetButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode()) return;
      state = createState(currentRulesetId);
      clearSelection();
      clearReplay();
      renderAll();
    });

    elements.undoButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode() || state.history.length === 0) return;
      undoLastMove(state);
      clearSelection();
      clearReplay();
      renderAll();
    });

    elements.replayStartButton.addEventListener("click", () => { if (!onlineSession.isOnlineMode()) setReplayIndex(0); });
    elements.replayPrevButton.addEventListener("click", () => { if (!onlineSession.isOnlineMode()) setReplayIndex(Math.max(0, getReplayIndex() - 1)); });
    elements.replayNextButton.addEventListener("click", () => { if (!onlineSession.isOnlineMode()) setReplayIndex(Math.min(state.history.length, getReplayIndex() + 1)); });
    elements.replayEndButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode()) return;
      clearReplay();
      clearSelection();
      renderAll();
    });

    elements.saveLocalButton.addEventListener("click", () => {
      syncMetaFromInputs();
      window.localStorage.setItem(LOCAL_SAVE_KEY, serializeGameRecord(state));
      setMessage("ローカル保存しました。ブラウザ内のlocalStorageに保存されています。");
    });

    elements.loadLocalButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode()) return;
      const saved = window.localStorage.getItem(LOCAL_SAVE_KEY);
      if (!saved) return window.alert("ローカル保存データがありません。");
      loadRecordText(saved);
    });

    elements.exportButton.addEventListener("click", exportCurrentGame);
    elements.importButton.addEventListener("click", () => { if (!onlineSession.isOnlineMode()) elements.importInput.click(); });
    elements.importInput.addEventListener("change", async () => {
      const file = elements.importInput.files?.[0];
      if (!file) return;
      try { loadRecordText(await file.text()); } finally { elements.importInput.value = ""; }
    });

    elements.clockApplyButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode()) return;
      state.clock = createClock(readClockConfig(), state.ruleset.players);
      if (state.clock.config.enabled && state.status.type === "playing") {
        startClock(state.clock, state.turn);
      }
      clearSelection();
      renderAll();
      setMessage("時計設定を反映しました。");
    });

    elements.clockPauseButton.addEventListener("click", () => {
      pauseClock(state.clock);
      if (onlineSession.isConnected()) sendOnlineMessage(createClockMessage(state));
      renderAll();
      setMessage("時計を停止しました。");
    });

    elements.hostOfferButton.addEventListener("click", () => runOnlineAction(() => onlineSession.createHost()));
    elements.guestAnswerButton.addEventListener("click", () => runOnlineAction(() => onlineSession.createGuestAnswer(elements.signalInput.value)));
    elements.spectatorAnswerButton.addEventListener("click", () => runOnlineAction(() => onlineSession.createGuestAnswer(elements.signalInput.value, { spectator: true })));
    elements.hostAcceptAnswerButton.addEventListener("click", () => runOnlineAction(() => onlineSession.acceptAnswer(elements.signalInput.value)));
    elements.reconnectOfferButton.addEventListener("click", () => runOnlineAction(() => onlineSession.createReconnectOffer()));
    elements.copySignalButton.addEventListener("click", copySignalOutput);
    elements.disconnectButton.addEventListener("click", () => {
      onlineSession.disconnect({ keepIdentity: true });
      clearSelection();
      clearReplay();
      setMessage("通信を切断しました。再接続できます。");
      renderAll();
    });
    elements.syncButton.addEventListener("click", sendSyncMessage);
    elements.syncRequestButton.addEventListener("click", () => {
      if (!onlineSession.isConnected()) return;
      sendOnlineMessage(createSyncRequestMessage(state, "manual"));
      setMessage("相手へ局面同期要求を送信しました。");
    });
    elements.pingButton.addEventListener("click", () => {
      if (!onlineSession.isConnected()) return;
      sendOnlineMessage(createPingMessage(state));
      setMessage("疎通確認を送信しました。");
    });
    elements.clearConnectionLogButton.addEventListener("click", () => {
      clearConnectionLog(connectionLog);
      renderAll();
    });
  }

  function initializeRulesetSelect() {
    elements.rulesetSelect.innerHTML = "";
    for (const ruleset of rulesets) {
      const option = document.createElement("option");
      option.value = ruleset.id;
      option.textContent = ruleset.name;
      elements.rulesetSelect.appendChild(option);
    }
    elements.rulesetSelect.value = currentRulesetId;
  }

  function handleBoardClick(x, y) {
    if (!canActOnCurrentTurn()) return;
    const selectedMove = findSelectedMoveTo(x, y);
    if (selectedMove) return applySelectedMove(x, y);
    const piece = getSquare(state, x, y);
    if (piece?.owner === state.turn) return selectBoardPiece(x, y);
    clearSelection();
    renderAll();
  }

  function handleHandClick(event) {
    const button = event.target.closest(".hand-piece");
    if (!button || !canActOnCurrentTurn()) return;
    const owner = button.dataset.owner;
    const pieceId = button.dataset.pieceId;
    if (owner === state.turn) selectHandPiece(owner, pieceId);
  }

  function selectBoardPiece(x, y) {
    uiState.selected = { kind: "board", x, y };
    uiState.legalMoves = getLegalMoves(state, uiState.selected);
    renderAll();
  }

  function selectHandPiece(owner, pieceId) {
    uiState.selected = { kind: "hand", owner, pieceId };
    uiState.legalMoves = getLegalMoves(state, uiState.selected);
    renderAll();
  }

  function applySelectedMove(x, y) {
    const move = chooseMoveForTarget(x, y);
    if (!move) return;

    try {
      const mover = state.turn;
      applyMove(state, move);
      switchClockAfterMove(state.clock, mover, state.ruleset);
      updateGameStatus(state);
      applyFlagFallStatus();
      if (onlineSession.isConnected()) sendOnlineMessage(createMoveMessage(state));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }

    clearSelection();
    clearReplay();
    renderAll();
  }

  function chooseMoveForTarget(x, y) {
    const candidates = uiState.legalMoves.filter(move => move.to.x === x && move.to.y === y);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const promoted = candidates.find(move => move.promoteTo);
    const normal = candidates.find(move => !move.promoteTo);
    if (promoted && normal) return window.confirm("成りますか？") ? promoted : normal;
    return candidates[0];
  }

  function findSelectedMoveTo(x, y) {
    return uiState.legalMoves.find(move => move.to.x === x && move.to.y === y);
  }

  function clearSelection() {
    uiState.selected = null;
    uiState.legalMoves = [];
  }

  function clearReplay() {
    uiState.replayIndex = null;
    uiState.readonly = false;
  }

  function setReplayIndex(index) {
    uiState.replayIndex = Math.max(0, Math.min(index, state.history.length));
    uiState.readonly = isReplayMode();
    clearSelection();
    renderAll();
  }

  function getReplayIndex() {
    return uiState.replayIndex ?? state.history.length;
  }

  function isReplayMode() {
    return uiState.replayIndex !== null && uiState.replayIndex !== state.history.length;
  }

  function getDisplayState() {
    if (!isReplayMode()) return state;
    return replayHistory(state.ruleset, state.history, uiState.replayIndex);
  }

  function canActOnCurrentTurn() {
    if (state.status.type !== "playing" || isReplayMode()) return false;
    if (!onlineSession.isOnlineMode()) return true;
    const snapshot = onlineSession.getSnapshot();
    if (snapshot.spectating) return false;
    return snapshot.connected && snapshot.localPlayer === state.turn;
  }

  function getLocalResigningPlayer() {
    const snapshot = onlineSession.getSnapshot();
    return snapshot.localPlayer === "spectator" ? state.turn : (snapshot.localPlayer ?? state.turn);
  }

  function loadRecordText(text) {
    try {
      const record = parseGameRecord(text);
      const restored = restoreGameRecord(record, rulesetsById);
      state = restored;
      currentRulesetId = restored.rulesetId;
      elements.rulesetSelect.value = currentRulesetId;
      clearSelection();
      clearReplay();
      renderAll();
      setMessage("保存データを読み込みました。");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  }

  function getMetaInputs() {
    return [
      elements.metaTitle,
      elements.metaBlackName,
      elements.metaWhiteName,
      elements.metaEventName,
      elements.metaLocation,
      elements.metaNotes
    ];
  }

  function syncMetaFromInputs() {
    state.meta = normalizeGameMeta({
      ...state.meta,
      title: elements.metaTitle.value,
      blackName: elements.metaBlackName.value,
      whiteName: elements.metaWhiteName.value,
      eventName: elements.metaEventName.value,
      location: elements.metaLocation.value,
      notes: elements.metaNotes.value
    });
  }

  function renderMetaPanel() {
    const meta = normalizeGameMeta(state.meta);
    if (document.activeElement !== elements.metaTitle) elements.metaTitle.value = meta.title;
    if (document.activeElement !== elements.metaBlackName) elements.metaBlackName.value = meta.blackName;
    if (document.activeElement !== elements.metaWhiteName) elements.metaWhiteName.value = meta.whiteName;
    if (document.activeElement !== elements.metaEventName) elements.metaEventName.value = meta.eventName;
    if (document.activeElement !== elements.metaLocation) elements.metaLocation.value = meta.location;
    if (document.activeElement !== elements.metaNotes) elements.metaNotes.value = meta.notes;
  }

  function renderTextRecordPreview() {
    elements.textRecordOutput.value = createKifLikeGameRecord(state);
  }

  function exportTextRecord() {
    syncMetaFromInputs();
    if (state.status.type === "ended") {
      state.meta = completeGameMeta(state.meta);
    }
    const text = createKifLikeGameRecord(state);
    elements.textRecordOutput.value = text;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    const title = safeFileName(state.meta?.title || state.rulesetId);
    anchor.href = url;
    anchor.download = "shogi-html-" + title + "-" + date + ".kif.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("棋譜テキストを書き出しました。");
  }

  async function copyTextRecord() {
    syncMetaFromInputs();
    const text = createKifLikeGameRecord(state);
    elements.textRecordOutput.value = text;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("棋譜テキストをクリップボードへコピーしました。");
    } catch (error) {
      elements.textRecordOutput.select();
      setMessage("クリップボードコピーに失敗しました。棋譜テキスト欄を手動コピーしてください。");
    }
  }

  function safeFileName(value) {
    return String(value || "game").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "game";
  }
  function exportCurrentGame() {
    syncMetaFromInputs();
    const text = serializeGameRecord(state);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `shogi-html-${state.rulesetId}-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleOnlineMessage(message) {
    if (!message || typeof message !== "object") return;
    addLog("in", message.type ?? "message", summarizeMessage(message), message);
    if (message.gameId && onlineSession.getSnapshot().gameId && message.gameId !== onlineSession.getSnapshot().gameId) {
      setMessage("別対局の通信メッセージを無視しました。");
      return;
    }
    if (message.type === "sync") return receiveSyncMessage(message);
    if (message.type === "move") return receiveMoveMessage(message);
    if (message.type === "resign") return receiveResignMessage(message);
    if (message.type === "clock") return receiveClockMessage(message);
    if (message.type === "sync-request") return receiveSyncRequestMessage(message);
    if (message.type === "ping") return receivePingMessage(message);
    if (message.type === "pong") return receivePongMessage(message);
  }

  function receiveSyncMessage(message) {
    try {
      const restored = restoreGameRecord(message.record, rulesetsById);
      state = restored;
      currentRulesetId = restored.rulesetId;
      elements.rulesetSelect.value = currentRulesetId;
      clearSelection();
      clearReplay();
      renderAll();
      setMessage("相手から局面を同期しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function receiveMoveMessage(message) {
    const result = applyIncomingMove(state, message);
    if (!result.ok) {
      const text = createIncomingErrorText(result);
      if (onlineSession.isConnected()) sendOnlineMessage(createSyncRequestMessage(state, result.reason));
      setMessage(`${text} 同期要求を送信しました。`);
      return;
    }
    clearSelection();
    clearReplay();
    renderAll();
    setMessage("相手の指し手を反映しました。");
  }

  function receiveResignMessage(message) {
    const result = applyIncomingResign(state, message);
    if (!result.ok) return setMessage(createIncomingErrorText(result));
    clearSelection();
    clearReplay();
    renderAll();
    setMessage("相手の投了を反映しました。");
  }

  function receiveClockMessage(message) {
    const result = applyIncomingClock(state, message);
    if (!result.ok) return setMessage(createIncomingErrorText(result));
    renderAll();
  }

  function receiveSyncRequestMessage(message) {
    if (!onlineSession.isConnected()) return;
    sendSyncMessage();
    setMessage(`相手から局面同期要求を受け取りました: ${message.reason ?? "manual"}`);
  }

  function receivePingMessage(message) {
    if (!onlineSession.isConnected()) return;
    sendOnlineMessage(createPongMessage(state, message));
    setMessage("疎通確認へ応答しました。");
  }

  function receivePongMessage(message) {
    setMessage(message.pingSentAt ? `疎通応答を受信しました。ping送信時刻: ${message.pingSentAt}` : "疎通応答を受信しました。");
  }

  function sendSyncMessage() {
    if (!onlineSession.isConnected()) return;
    sendOnlineMessage(createSyncMessage(state));
    setMessage("現在局面を相手へ送信しました。");
  }

  function sendOnlineMessage(message) {
    try {
      onlineSession.send(message);
      addLog("out", message.type ?? "message", summarizeMessage(message), message);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      addLog("error", "send", text, message);
      setMessage(text);
    }
  }

  async function runOnlineAction(action) {
    try {
      await action();
      clearSelection();
      clearReplay();
      renderAll();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      renderAll();
    }
  }

  async function copySignalOutput() {
    if (!elements.signalOutput.value) return;
    try {
      await navigator.clipboard.writeText(elements.signalOutput.value);
      setMessage("接続コードをクリップボードへコピーしました。");
    } catch (error) {
      elements.signalOutput.select();
      setMessage("クリップボードコピーに失敗しました。接続コード欄を手動コピーしてください。");
    }
  }

  function updateRunningClock() {
    if (state.clock?.config?.enabled && state.status.type === "playing") {
      updateClock(state.clock);
      applyFlagFallStatus();
    }
  }

  function applyFlagFallStatus() {
    if (!state.clock?.flagFallPlayer || state.status.type !== "playing") return;
    state.status = {
      type: "ended",
      winner: opposite(state, state.clock.flagFallPlayer),
      reason: "time"
    };
    if (onlineSession.isConnected()) sendOnlineMessage(createClockMessage(state));
  }

  function readClockConfig() {
    return {
      enabled: elements.clockEnabled.checked,
      initialMs: Number(elements.clockMinutes.value) * 60 * 1000,
      incrementMs: Number(elements.clockIncrement.value) * 1000
    };
  }

  function renderAll() {
    const displayState = getDisplayState();
    uiState.readonly = isReplayMode() || (onlineSession.isOnlineMode() && !canActOnCurrentTurn());

    renderBoard(elements.board, displayState, uiState);
    renderHands(elements.whiteHand, displayState, "white", uiState);
    renderHands(elements.blackHand, displayState, "black", uiState);
    renderHistory(elements.historyList, state, uiState);

    elements.status.textContent = createDisplayStatusText(displayState);
    elements.status.classList.toggle("check", isCurrentTurnInCheck(displayState));
    renderTurnBar(displayState);

    renderMetaPanel();
    renderTextRecordPreview();
    renderClockPanel();
    renderActionButtons();
    renderOnlinePanel();
    renderConnectionLog(elements.connectionLog, connectionLog);
  }


  function renderTurnBar(displayState) {
    if (!elements.turnBar) return;

    const snapshot = onlineSession.getSnapshot();
    const isEnded = displayState.status.type === "ended";
    const inCheck = isCurrentTurnInCheck(displayState);
    const ply = state.history.length;
    const turnLabel = playerName(displayState.turn);

    elements.turnBar.classList.toggle("black-turn", !isEnded && displayState.turn === "black");
    elements.turnBar.classList.toggle("white-turn", !isEnded && displayState.turn === "white");
    elements.turnBar.classList.toggle("ended", isEnded);
    elements.turnBar.classList.toggle("check", inCheck);
    elements.turnBar.classList.toggle("replay", isReplayMode());

    const summary = elements.turnBar.querySelector("#turn-summary");
    const side = elements.turnBar.querySelector("#turn-side");

    if (summary) {
      const mode = isReplayMode() ? `再生 ${getReplayIndex()}/${state.history.length}` : `手数 ${ply}`;
      const online = onlineSession.isOnlineMode()
        ? snapshot.spectating
          ? "観戦中"
          : snapshot.connected
            ? (snapshot.localPlayer === state.turn ? "あなたの手番" : "相手の手番")
            : "通信準備中"
        : "ローカル対局";
      summary.textContent = `${mode} / ${online}${inCheck ? " / 王手" : ""}`;
    }

    if (side) {
      side.textContent = isEnded ? "終局" : `${turnLabel}番`;
    }
  }

  function renderClockPanel() {
    const clock = state.clock;
    if (clock?.config) {
      elements.clockEnabled.checked = clock.config.enabled;
      elements.clockMinutes.value = String(Math.max(1, Math.round(clock.config.initialMs / 60000)));
      elements.clockIncrement.value = String(Math.round(clock.config.incrementMs / 1000));
    }

    if (!clock?.config?.enabled) {
      elements.clockDisplay.textContent = "先手 --:-- / 後手 --:--";
      return;
    }

    const black = formatClockMs(getDisplayRemainingMs(clock, "black"));
    const white = formatClockMs(getDisplayRemainingMs(clock, "white"));
    const active = clock.running ? ` / 計測中: ${playerName(clock.activePlayer)}` : " / 停止中";
    elements.clockDisplay.textContent = `先手 ${black} / 後手 ${white}${active}`;
  }

  function renderActionButtons() {
    const onlineMode = onlineSession.isOnlineMode();
    const onlineConnected = onlineSession.isConnected();
    const snapshot = onlineSession.getSnapshot();
    const canResign = state.status.type === "playing" && !isReplayMode() && (!onlineMode || (onlineConnected && !snapshot.spectating));

    elements.rulesetSelect.disabled = onlineMode;
    elements.resetButton.disabled = onlineMode;
    elements.undoButton.disabled = onlineMode || state.history.length === 0 || isReplayMode();
    elements.loadLocalButton.disabled = onlineMode;
    elements.importButton.disabled = onlineMode;
    elements.clockApplyButton.disabled = onlineMode || isReplayMode();
    elements.clockPauseButton.disabled = !state.clock?.config?.enabled;

    elements.impasseButton.disabled = state.status.type !== "playing" || isReplayMode() || (onlineMode && !onlineConnected);
    elements.resignButton.disabled = !canResign;
    elements.resignButton.textContent = `${playerName(getLocalResigningPlayer())} 投了`;

    const replayIndex = getReplayIndex();
    const disableReplay = onlineMode || state.history.length === 0;
    elements.replayStartButton.disabled = disableReplay || replayIndex === 0;
    elements.replayPrevButton.disabled = disableReplay || replayIndex === 0;
    elements.replayNextButton.disabled = disableReplay || replayIndex === state.history.length;
    elements.replayEndButton.disabled = disableReplay || !isReplayMode();
  }

  function renderOnlinePanel() {
    const snapshot = onlineSession.getSnapshot();
    const onlineMode = onlineSession.isOnlineMode();
    elements.onlineStatus.textContent = createOnlineStatusText(snapshot);
    elements.onlineRole.textContent = createOnlineRoleText(snapshot);
    elements.onlineGameId.textContent = snapshot.gameId ? snapshot.gameId.slice(0, 8) : "-";
    elements.connectionDetail.textContent = createSnapshotText(snapshot);

    elements.hostOfferButton.disabled = onlineMode || isReplayMode();
    elements.guestAnswerButton.disabled = onlineMode || isReplayMode();
    elements.spectatorAnswerButton.disabled = onlineMode || isReplayMode();
    elements.hostAcceptAnswerButton.disabled = !(snapshot.role && (snapshot.status === "waiting-answer" || snapshot.status === "waiting-connect"));
    elements.reconnectOfferButton.disabled = !(snapshot.gameId && (snapshot.status === "disconnected" || snapshot.status === "failed"));
    elements.copySignalButton.disabled = !elements.signalOutput.value;
    elements.disconnectButton.disabled = !onlineMode;
    elements.syncButton.disabled = !snapshot.connected;
    elements.syncRequestButton.disabled = !snapshot.connected;
    elements.pingButton.disabled = !snapshot.connected;
  }

  function createDisplayStatusText(displayState) {
    let base;
    base = isReplayMode()
      ? `${createStatusText(displayState)} / 再生 ${uiState.replayIndex}/${state.history.length}`
      : createStatusText(displayState);

    if (!onlineSession.isOnlineMode()) return base;
    const snapshot = onlineSession.getSnapshot();
    if (snapshot.spectating) return `${base} / 観戦中`;
    if (!snapshot.connected) return `${base} / 通信準備中`;
    if (state.status.type !== "playing") return `${base} / 通信対局`;
    return snapshot.localPlayer === state.turn ? `${base} / あなたの手番` : `${base} / 相手の手番`;
  }

  function createOnlineStatusText(snapshot) {
    const labels = {
      idle: "未接続",
      "creating-offer": "オファー作成中",
      "waiting-answer": "回答待ち",
      "creating-answer": "回答作成中",
      "waiting-connect": "接続待ち",
      connected: "接続済み",
      disconnected: "切断",
      failed: "接続失敗"
    };
    return labels[snapshot.status] ?? snapshot.status;
  }

  function createOnlineRoleText(snapshot) {
    if (!snapshot.localPlayer) return "未設定";
    if (snapshot.spectating) return "観戦者 / 読み取り専用";
    const role = snapshot.role === "host" || snapshot.role === "spectator-host" ? "ホスト" : "ゲスト";
    return `${role} / ${playerName(snapshot.localPlayer)}`;
  }

  function createIncomingErrorText(result) {
    if (result.reason === "sequence") return `通信同期ずれ：期待手数 ${result.expectedSeq} / 受信手数 ${result.actualSeq}`;
    if (result.reason === "illegal_move") return "通信で受信した指し手が現在局面の合法手ではありません。局面同期を実行してください。";
    if (result.reason === "turn") return `通信手番ずれ：期待 ${playerName(result.expectedPlayer)} / 受信 ${playerName(result.actualPlayer)}`;
    return `通信メッセージを反映できません: ${result.reason}`;
  }

  function addLog(direction, type, text, detail = null) {
    addConnectionLog(connectionLog, { direction, type, text, detail });
  }

  function setMessage(message) {
    elements.message.textContent = message;
  }
}
