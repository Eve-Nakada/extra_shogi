import { applyMove } from "../core/applyMove.js";
import { getSquare } from "../core/coordinates.js";
import { createStatusText, isCurrentTurnInCheck, resign, updateGameStatus } from "../core/gameStatus.js";
import { getLegalMoves } from "../core/legalMoveFilter.js";
import { parseGameRecord, restoreGameRecord, serializeGameRecord } from "../core/record.js";
import { replayHistory } from "../core/replay.js";
import { playerName } from "../core/state.js";
import { undoLastMove } from "../core/undo.js";
import { applyIncomingMove, applyIncomingResign, createMoveMessage, createResignMessage, createSyncMessage } from "../net/gameSync.js";
import { RtcGameSession } from "../net/rtcSession.js";
import { renderBoard } from "./renderBoard.js";
import { renderHands } from "./renderHands.js";
import { renderHistory } from "./renderHistory.js";

const LOCAL_SAVE_KEY = "shogi-html:last-game";

export function initController({ createState, elements, rulesets, rulesetsById, defaultRulesetId }) {
  let currentRulesetId = defaultRulesetId ?? rulesets[0].id;
  let state = createState(currentRulesetId);

  const onlineSession = new RtcGameSession({
    onSignal: text => {
      elements.signalOutput.value = text;
      setMessage("接続コードを作成しました。相手へコピーして渡してください。");
      renderAll();
    },
    onStatus: () => {
      renderAll();
    },
    onOpen: snapshot => {
      if (snapshot.role === "host") {
        sendSyncMessage();
      }
      setMessage("通信接続が開きました。");
      renderAll();
    },
    onClose: () => {
      setMessage("通信接続が閉じました。必要なら再接続してください。");
      clearSelection();
      renderAll();
    },
    onMessage: handleOnlineMessage,
    onError: error => {
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

  elements.board.addEventListener("click", event => {
    const square = event.target.closest(".square");
    if (!square) return;

    const x = Number(square.dataset.x);
    const y = Number(square.dataset.y);
    handleBoardClick(x, y);
  });

  elements.blackHand.addEventListener("click", handleHandClick);
  elements.whiteHand.addEventListener("click", handleHandClick);

  elements.historyList.addEventListener("click", event => {
    if (onlineSession.isOnlineMode()) return;

    const button = event.target.closest(".history-button");
    if (!button) return;
    setReplayIndex(Number(button.dataset.index) + 1);
  });

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

  elements.resignButton.addEventListener("click", () => {
    if (state.status.type !== "playing" || isReplayMode()) return;
    if (onlineSession.isOnlineMode() && !onlineSession.isConnected()) return;

    const resigningPlayer = getLocalResigningPlayer();
    const message = onlineSession.isConnected()
      ? createResignMessage(state, resigningPlayer)
      : null;

    resign(state, resigningPlayer);

    if (message) {
      sendOnlineMessage(message);
    }

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
    if (onlineSession.isOnlineMode()) return;
    if (state.history.length === 0) return;

    undoLastMove(state);
    clearSelection();
    clearReplay();
    renderAll();
  });

  elements.replayStartButton.addEventListener("click", () => {
    if (!onlineSession.isOnlineMode()) setReplayIndex(0);
  });
  elements.replayPrevButton.addEventListener("click", () => {
    if (!onlineSession.isOnlineMode()) setReplayIndex(Math.max(0, getReplayIndex() - 1));
  });
  elements.replayNextButton.addEventListener("click", () => {
    if (!onlineSession.isOnlineMode()) setReplayIndex(Math.min(state.history.length, getReplayIndex() + 1));
  });
  elements.replayEndButton.addEventListener("click", () => {
    if (onlineSession.isOnlineMode()) return;

    clearReplay();
    clearSelection();
    renderAll();
  });

  elements.saveLocalButton.addEventListener("click", () => {
    window.localStorage.setItem(LOCAL_SAVE_KEY, serializeGameRecord(state));
    setMessage("ローカル保存しました。ブラウザ内のlocalStorageに保存されています。");
  });

  elements.loadLocalButton.addEventListener("click", () => {
    if (onlineSession.isOnlineMode()) return;

    const saved = window.localStorage.getItem(LOCAL_SAVE_KEY);
    if (!saved) {
      window.alert("ローカル保存データがありません。");
      return;
    }

    loadRecordText(saved);
  });

  elements.exportButton.addEventListener("click", () => {
    exportCurrentGame();
  });

  elements.importButton.addEventListener("click", () => {
    if (onlineSession.isOnlineMode()) return;
    elements.importInput.click();
  });

  elements.importInput.addEventListener("change", async () => {
    const file = elements.importInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      loadRecordText(text);
    } finally {
      elements.importInput.value = "";
    }
  });

  elements.hostOfferButton.addEventListener("click", () => {
    runOnlineAction(async () => {
      await onlineSession.createHost();
    });
  });

  elements.guestAnswerButton.addEventListener("click", () => {
    runOnlineAction(async () => {
      await onlineSession.createGuestAnswer(elements.signalInput.value);
    });
  });

  elements.hostAcceptAnswerButton.addEventListener("click", () => {
    runOnlineAction(async () => {
      await onlineSession.acceptAnswer(elements.signalInput.value);
    });
  });

  elements.copySignalButton.addEventListener("click", () => {
    copySignalOutput();
  });

  elements.disconnectButton.addEventListener("click", () => {
    onlineSession.disconnect();
    clearSelection();
    clearReplay();
    setMessage("通信モードを終了しました。");
    renderAll();
  });

  elements.syncButton.addEventListener("click", () => {
    sendSyncMessage();
  });

  renderAll();

  return {
    getState: () => state,
    render: renderAll
  };

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
    if (selectedMove) {
      applySelectedMove(x, y);
      return;
    }

    const piece = getSquare(state, x, y);
    if (piece?.owner === state.turn) {
      selectBoardPiece(x, y);
      return;
    }

    clearSelection();
    renderAll();
  }

  function handleHandClick(event) {
    const button = event.target.closest(".hand-piece");
    if (!button) return;
    if (!canActOnCurrentTurn()) return;

    const owner = button.dataset.owner;
    const pieceId = button.dataset.pieceId;
    if (owner !== state.turn) return;

    selectHandPiece(owner, pieceId);
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
      applyMove(state, move);
      updateGameStatus(state);

      if (onlineSession.isConnected()) {
        sendOnlineMessage(createMoveMessage(state));
      }
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

    if (promoted && normal) {
      const answer = window.confirm("成りますか？");
      return answer ? promoted : normal;
    }

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

    if (!onlineSession.isOnlineMode()) {
      return true;
    }

    const snapshot = onlineSession.getSnapshot();
    return snapshot.connected && snapshot.localPlayer === state.turn;
  }

  function getLocalResigningPlayer() {
    const snapshot = onlineSession.getSnapshot();
    return snapshot.localPlayer ?? state.turn;
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

  function exportCurrentGame() {
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

    if (message.gameId && onlineSession.getSnapshot().gameId && message.gameId !== onlineSession.getSnapshot().gameId) {
      setMessage("別対局の通信メッセージを無視しました。");
      return;
    }

    if (message.type === "sync") {
      receiveSyncMessage(message);
      return;
    }

    if (message.type === "move") {
      receiveMoveMessage(message);
      return;
    }

    if (message.type === "resign") {
      receiveResignMessage(message);
      return;
    }
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
      setMessage(createIncomingErrorText(result));
      return;
    }

    clearSelection();
    clearReplay();
    renderAll();
    setMessage("相手の指し手を反映しました。");
  }

  function receiveResignMessage(message) {
    const result = applyIncomingResign(state, message);
    if (!result.ok) {
      setMessage(createIncomingErrorText(result));
      return;
    }

    clearSelection();
    clearReplay();
    renderAll();
    setMessage("相手の投了を反映しました。");
  }

  function sendSyncMessage() {
    if (!onlineSession.isConnected()) return;
    sendOnlineMessage(createSyncMessage(state));
    setMessage("現在局面を相手へ送信しました。");
  }

  function sendOnlineMessage(message) {
    try {
      onlineSession.send(message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
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

  function createIncomingErrorText(result) {
    if (result.reason === "sequence") {
      return `通信同期ずれ：期待手数 ${result.expectedSeq} / 受信手数 ${result.actualSeq}`;
    }

    if (result.reason === "illegal_move") {
      return "通信で受信した指し手が現在局面の合法手ではありません。局面同期を実行してください。";
    }

    if (result.reason === "turn") {
      return `通信手番ずれ：期待 ${playerName(result.expectedPlayer)} / 受信 ${playerName(result.actualPlayer)}`;
    }

    return `通信メッセージを反映できません: ${result.reason}`;
  }

  function setMessage(message) {
    elements.message.textContent = message;
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

    renderActionButtons();
    renderOnlinePanel();
  }

  function renderActionButtons() {
    const onlineMode = onlineSession.isOnlineMode();
    const onlineConnected = onlineSession.isConnected();
    const canResign = state.status.type === "playing" && !isReplayMode() && (!onlineMode || onlineConnected);

    elements.rulesetSelect.disabled = onlineMode;
    elements.resetButton.disabled = onlineMode;
    elements.undoButton.disabled = onlineMode || state.history.length === 0 || isReplayMode();
    elements.loadLocalButton.disabled = onlineMode;
    elements.importButton.disabled = onlineMode;

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

    elements.hostOfferButton.disabled = onlineMode || isReplayMode();
    elements.guestAnswerButton.disabled = onlineMode || isReplayMode();
    elements.hostAcceptAnswerButton.disabled = !(snapshot.role === "host" && (snapshot.status === "waiting-answer" || snapshot.status === "waiting-connect"));
    elements.copySignalButton.disabled = !elements.signalOutput.value;
    elements.disconnectButton.disabled = !onlineMode;
    elements.syncButton.disabled = !snapshot.connected;
  }

  function createDisplayStatusText(displayState) {
    const base = isReplayMode()
      ? `${createStatusText(displayState)} / 再生 ${uiState.replayIndex}/${state.history.length}`
      : createStatusText(displayState);

    if (!onlineSession.isOnlineMode()) {
      return base;
    }

    const snapshot = onlineSession.getSnapshot();
    if (!snapshot.connected) {
      return `${base} / 通信準備中`;
    }

    if (state.status.type !== "playing") {
      return `${base} / 通信対局`;
    }

    return snapshot.localPlayer === state.turn
      ? `${base} / あなたの手番`
      : `${base} / 相手の手番`;
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
    const role = snapshot.role === "host" ? "ホスト" : "ゲスト";
    return `${role} / ${playerName(snapshot.localPlayer)}`;
  }
}
