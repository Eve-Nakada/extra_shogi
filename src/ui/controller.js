 
import { applyAction, getAvailableTriggeredActions, getLegalActions } from "../core/action.js";
import { createClock, formatClockMs, getDisplayRemainingMs, pauseClock, startClock, switchClockAfterMove, updateClock } from "../core/clock.js";
import { getSquare } from "../core/coordinates.js";
import { chooseNpcAction } from "../core/npc.js";
import { createStatusText, declareImpasse, isCurrentTurnInCheck, resign, updateGameStatus } from "../core/gameStatus.js";
import { parseGameRecord, restoreGameRecord, serializeGameRecord } from "../core/record.js";
import { createKifLikeGameRecord } from "../core/notation.js";
import { completeGameMeta, normalizeGameMeta } from "../core/meta.js";
import { replayHistory } from "../core/replay.js";
import { isExtraActionTurnState, opposite, playerName } from "../core/state.js";
import { addSetupPiece, applyPlacement, finalizeSetupPlayer, generateRandomPacks, getLegalPlacements, getSetupPlayer, isSetupActive, removeSetupPiece, removeSetupPlacementAt, selectFixedPack, selectGeneratedPack } from "../core/setup.js";
import { undoLastMove } from "../core/undo.js";
import { applyIncomingClock, applyIncomingMove, applyIncomingResign, applyIncomingSetup, createClockMessage, createMoveMessage, createPingMessage, createPongMessage, createResignMessage, createSetupMessage, createSyncMessage, createSyncRequestMessage } from "../net/gameSync.js";
import { createConnectionLog, addConnectionLog, clearConnectionLog, createSnapshotText, summarizeMessage } from "../net/connectionLog.js";
import { RtcGameSession } from "../net/rtcSession.js";
import { renderBoard } from "./renderBoard.js";
import { renderHands } from "./renderHands.js";
import { renderHistory } from "./renderHistory.js";
import { renderConnectionLog } from "./renderConnectionLog.js";
import { renderPieceGuide, renderSelectedPieceGuide } from "./renderPieceGuide.js";
import { renderSetupPanel } from "./renderSetupPanel.js";
import { loadViewPreferences, saveViewPreferences } from "./viewPreferences.js";

const LOCAL_SAVE_KEY = "shogi-html:last-game";

export function initController({ createState, elements, rulesets, rulesetsById, defaultRulesetId }) {
  let currentRulesetId = defaultRulesetId ?? rulesets[0].id;
  let state = createState(currentRulesetId);
  const connectionLog = createConnectionLog({ maxEntries: 120 });
  let lastOnlineSnapshotText = "";
  let pendingPromotionChoice = null;
  let npcConfig = { player: "none", delayMs: 450, timerId: null };

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
    specialActions: [],
    displayedSpecialActions: [],
    setupSelectedPieceId: null,
    setupPlacements: [],
    multiMoveCompounds: [],
    multiMovePlan: null,
    targetActionPlan: null,
    inspected: null,
    replayIndex: null,
    readonly: false,
    view: loadViewPreferences()
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
    elements.promotionPromoteButton.addEventListener("click", () => confirmPromotionChoice(true));
    elements.promotionNormalButton.addEventListener("click", () => confirmPromotionChoice(false));
    elements.promotionCancelButton.addEventListener("click", cancelPromotionChoice);
    elements.specialActions.addEventListener("click", handleSpecialActionClick);
    elements.setupContent.addEventListener("click", handleSetupClick);
    elements.npcPlayerSelect.addEventListener("change", () => {
      npcConfig.player = elements.npcPlayerSelect.value;
      clearSelection();
      renderAll();
      scheduleNpcMove();
    });
    elements.boardPerspectiveSelect.addEventListener("change", () => {
      uiState.view.perspective = elements.boardPerspectiveSelect.value === "white" ? "white" : "black";
      saveCurrentViewPreferences();
      clearSelection();
      renderAll();
    });
    elements.flipBoardButton.addEventListener("click", () => {
      uiState.view.perspective = uiState.view.perspective === "black" ? "white" : "black";
      saveCurrentViewPreferences();
      clearSelection();
      renderAll();
    });
    elements.legalHighlightEnabled.addEventListener("change", () => {
      uiState.view.showLegalMoves = elements.legalHighlightEnabled.checked;
      saveCurrentViewPreferences();
      renderAll();
    });
    elements.confirmResignEnabled.addEventListener("change", () => {
      uiState.view.confirmResign = elements.confirmResignEnabled.checked;
      saveCurrentViewPreferences();
    });
    elements.confirmResetEnabled.addEventListener("change", () => {
      uiState.view.confirmReset = elements.confirmResetEnabled.checked;
      saveCurrentViewPreferences();
    });

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
      scheduleNpcMove();
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
      if (uiState.view.confirmResign && !window.confirm(playerName(resigningPlayer) + "が投了します。よろしいですか？")) return;
      const message = onlineSession.isConnected() ? createResignMessage(state, resigningPlayer) : null;
      resign(state, resigningPlayer);
      if (message) sendOnlineMessage(message);
      clearSelection();
      renderAll();
    });

    elements.resetButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode()) return;
      if (uiState.view.confirmReset && !window.confirm("現在の対局を初期化します。よろしいですか？")) return;
      state = createState(currentRulesetId);
      clearSelection();
      clearReplay();
      renderAll();
      scheduleNpcMove();
    });

    elements.undoButton.addEventListener("click", () => {
      if (onlineSession.isOnlineMode() || state.history.length === 0) return;
      undoLastMove(state);
      clearSelection();
      clearReplay();
      renderAll();
      scheduleNpcMove();
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
    if (isSetupActive(state)) return handleSetupBoardClick(x, y);
    if (uiState.targetActionPlan && canActOnCurrentTurn()) return handleTargetActionPlanBoardClick(x, y);
    if (uiState.multiMovePlan && canActOnCurrentTurn()) return handleMultiMovePlanBoardClick(x, y);
    if (canActOnCurrentTurn()) {
      const selectedMove = findSelectedMoveTo(x, y);
      if (selectedMove) return applySelectedMove(x, y);
    }

    const piece = getSquare(state, x, y);
    if (piece?.owner === state.turn && canActOnCurrentTurn()) return selectBoardPiece(x, y);
    if (piece) return inspectBoardPiece(x, y);
    clearSelection();
    renderAll();
  }

  function handleHandClick(event) {
    const button = event.target.closest(".hand-piece");
    if (!button) return;
    const owner = button.dataset.owner;
    const pieceId = button.dataset.pieceId;
    if (owner === state.turn && canActOnCurrentTurn()) return selectHandPiece(owner, pieceId);
    inspectHandPiece(owner, pieceId);
  }

  function selectBoardPiece(x, y) {
    uiState.selected = { kind: "board", x, y };
    uiState.inspected = null;
    setActionsForSelection(uiState.selected);
    renderAll();
  }

  function inspectBoardPiece(x, y) {
    uiState.selected = { kind: "board", x, y };
    uiState.inspected = { kind: "board", x, y };
    uiState.legalMoves = [];
    uiState.specialActions = [];
    uiState.displayedSpecialActions = [];
    uiState.multiMoveCompounds = [];
    uiState.multiMovePlan = null;
    uiState.targetActionPlan = null;
    renderAll();
  }

  function selectHandPiece(owner, pieceId) {
    uiState.selected = { kind: "hand", owner, pieceId };
    uiState.inspected = null;
    setActionsForSelection(uiState.selected);
    renderAll();
  }

  function inspectHandPiece(owner, pieceId) {
    uiState.selected = { kind: "hand", owner, pieceId };
    uiState.inspected = { kind: "hand", owner, pieceId };
    uiState.legalMoves = [];
    uiState.specialActions = [];
    uiState.displayedSpecialActions = [];
    uiState.multiMoveCompounds = [];
    uiState.multiMovePlan = null;
    uiState.targetActionPlan = null;
    renderAll();
  }

  function applySelectedMove(x, y) {
    const multiMoveFirst = chooseMultiMoveFirstMove(x, y);
    if (multiMoveFirst) return startMultiMovePlan(multiMoveFirst);

    const choice = chooseMoveForTarget(x, y);
    if (!choice) return;

    if (choice.kind === "promotion-choice") {
      showPromotionChoice(choice);
      return;
    }

    executeMove(choice);
  }

  function chooseMoveForTarget(x, y) {
    const candidates = uiState.legalMoves.filter(move => move.to.x === x && move.to.y === y);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const promoted = candidates.find(move => move.promoteTo);
    const normal = candidates.find(move => !move.promoteTo);
    if (promoted && normal) {
      return { kind: "promotion-choice", promoted, normal };
    }
    return candidates[0];
  }

  function showPromotionChoice(choice) {
    pendingPromotionChoice = choice;
    const piece = choice.promoted.kind === "move" ? getSquare(state, choice.promoted.from.x, choice.promoted.from.y) : null;
    const beforeDef = piece ? state.ruleset.pieces[piece.id] : null;
    const promotedDef = state.ruleset.pieces[choice.promoted.promoteTo];
    const pieceLabel = beforeDef?.display ?? beforeDef?.name ?? "この駒";
    const promotedLabel = promotedDef?.display ?? promotedDef?.name ?? "成駒";
    elements.promotionText.textContent = pieceLabel + "を" + promotedLabel + "に成りますか？";
    elements.promotionDialog.hidden = false;
    elements.promotionPromoteButton.focus();
  }

  function confirmPromotionChoice(promote) {
    if (!pendingPromotionChoice) return;
    const move = promote ? pendingPromotionChoice.promoted : pendingPromotionChoice.normal;
    closePromotionChoice();
    executeMove(move);
  }

  function cancelPromotionChoice() {
    closePromotionChoice();
    clearSelection();
    renderAll();
  }

  function closePromotionChoice() {
    pendingPromotionChoice = null;
    elements.promotionDialog.hidden = true;
  }

  function executeMove(move) {
    try {
      const mover = state.turn;
      const wasExtraAction = isExtraActionTurnState(state.turnState);
      applyAction(state, move);
      if (!isExtraActionTurnState(state.turnState) && !wasExtraAction) switchClockAfterMove(state.clock, mover, state.ruleset);
      if (wasExtraAction) switchClockAfterMove(state.clock, mover, state.ruleset);
      updateGameStatus(state);
      applyFlagFallStatus();
      if (onlineSession.isConnected()) sendOnlineMessage(createMoveMessage(state));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }

    clearSelection();
    clearReplay();
    renderAll();
    scheduleNpcMove();
  }

  function findSelectedMoveTo(x, y) {
    return uiState.legalMoves.find(move => move.to.x === x && move.to.y === y);
  }

  function clearSelection() {
    uiState.selected = null;
    uiState.inspected = null;
    uiState.legalMoves = [];
    uiState.specialActions = [];
    uiState.displayedSpecialActions = [];
    uiState.multiMoveCompounds = [];
    uiState.multiMovePlan = null;
    uiState.targetActionPlan = null;
    uiState.setupSelectedPieceId = null;
    uiState.setupPlacements = [];
    if (pendingPromotionChoice) closePromotionChoice();
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
    return replayHistory(state.ruleset, state.history, uiState.replayIndex, { initialPosition: state.initialPosition ?? state.setup?.initialPosition });
  }

  function canActOnCurrentTurn() {
    if (isSetupActive(state)) return false;
    if (state.status.type !== "playing" || isReplayMode()) return false;
    if (isNpcTurn()) return false;
    if (!onlineSession.isOnlineMode()) return true;
    const snapshot = onlineSession.getSnapshot();
    if (snapshot.spectating) return false;
    return snapshot.connected && snapshot.localPlayer === state.turn;
  }

  function canEditSetupPlayer(player) {
    if (!isSetupActive(state) || isReplayMode()) return false;
    if (!onlineSession.isOnlineMode()) return true;
    const snapshot = onlineSession.getSnapshot();
    if (snapshot.spectating) return false;
    return snapshot.connected && snapshot.localPlayer === player;
  }

  function getEditableSetupPlayer() {
    const snapshot = onlineSession.getSnapshot();
    if (onlineSession.isOnlineMode() && snapshot.localPlayer && snapshot.localPlayer !== "spectator") return snapshot.localPlayer;
    return getSetupPlayer(state);
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
    if (message.type === "setup") return receiveSetupMessage(message);
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

  function receiveSetupMessage(message) {
    const result = applyIncomingSetup(message, rulesetsById);
    if (!result.ok) {
      const text = createIncomingErrorText(result);
      if (onlineSession.isConnected()) sendOnlineMessage(createSyncRequestMessage(state, result.reason));
      setMessage(`${text} 同期要求を送信しました。`);
      return;
    }
    state = result.state;
    currentRulesetId = state.rulesetId;
    elements.rulesetSelect.value = currentRulesetId;
    clearSelection();
    clearReplay();
    renderAll();
    setMessage("相手の編成操作を反映しました。");
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
    renderPerspectiveHands(displayState);
    renderHistory(elements.historyList, state, uiState);
    if (elements.historyCount) elements.historyCount.textContent = String(state.history.length) + "手";

    elements.status.textContent = createDisplayStatusText(displayState);
    elements.status.classList.toggle("check", isCurrentTurnInCheck(displayState));
    renderTurnBar(displayState);

    renderMetaPanel();
    renderTextRecordPreview();
    renderClockPanel();
    renderViewOptions();
    renderActionButtons();
    renderOnlinePanel();
    renderNpcPanel();
    renderConnectionLog(elements.connectionLog, connectionLog);
    renderPieceGuide(elements.pieceGuideContent, displayState.ruleset);
    renderSelectedPieceGuide(elements.selectedPieceGuide, displayState, uiState.selected);
    uiState.setupPlayer = isSetupActive(state) ? getEditableSetupPlayer() : null;
    uiState.setupReadonly = isSetupActive(state) && !canEditSetupPlayer(uiState.setupPlayer);
    renderSetupPanel(elements.setupPanel, elements.setupContent, displayState, uiState);
    renderSpecialActions(displayState);
  }

  function renderPerspectiveHands(displayState) {
    const topOwner = uiState.view.perspective === "white" ? "black" : "white";
    const bottomOwner = uiState.view.perspective === "white" ? "white" : "black";

    renderHands(elements.whiteHand, displayState, topOwner, uiState, { position: "top" });
    renderHands(elements.blackHand, displayState, bottomOwner, uiState, { position: "bottom" });
  }

  function saveCurrentViewPreferences() {
    saveViewPreferences(uiState.view);
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
      const mode = isSetupActive(displayState)
        ? `${playerName(getSetupPlayer(displayState))}の編成中`
        : isReplayMode()
          ? `再生 ${getReplayIndex()}/${state.history.length}`
          : isExtraActionTurnState(displayState.turnState)
            ? `${ply}手目まで / 追加行動中`
            : `${ply}手目まで / 次は第${ply + 1}手`;
      const online = onlineSession.isOnlineMode()
        ? snapshot.spectating
          ? "観戦中"
          : snapshot.connected
            ? (snapshot.localPlayer === state.turn ? "あなたの手番" : "相手の手番")
            : "通信準備中"
        : isNpcTurn() ? "NPC思考中" : "ローカル対局";
      summary.textContent = `${mode} / ${online}${inCheck ? " / 王手" : ""}`;
    }

    if (side) {
      side.textContent = isSetupActive(displayState) ? `編成：${playerName(getSetupPlayer(displayState))}` : (isEnded ? "終局" : `次の手番：${turnLabel}`);
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

  function renderViewOptions() {
    elements.boardPerspectiveSelect.value = uiState.view.perspective;
    elements.legalHighlightEnabled.checked = uiState.view.showLegalMoves;
    elements.confirmResignEnabled.checked = uiState.view.confirmResign;
    elements.confirmResetEnabled.checked = uiState.view.confirmReset;
    elements.flipBoardButton.textContent = uiState.view.perspective === "black"
      ? "後手視点に切替"
      : "先手視点に切替";
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

    elements.impasseButton.disabled = state.status.type !== "playing" || state.phase === "setup" || isReplayMode() || (onlineMode && !onlineConnected);
    elements.resignButton.disabled = !canResign;
    elements.resignButton.textContent = `${playerName(getLocalResigningPlayer())} 投了`;

    const replayIndex = getReplayIndex();
    const disableReplay = onlineMode || state.history.length === 0;
    elements.replayStartButton.disabled = disableReplay || replayIndex === 0;
    elements.replayPrevButton.disabled = disableReplay || replayIndex === 0;
    elements.replayNextButton.disabled = disableReplay || replayIndex === state.history.length;
    elements.replayEndButton.disabled = disableReplay || !isReplayMode();
  }

  function renderNpcPanel() {
    if (!elements.npcPlayerSelect) return;
    elements.npcPlayerSelect.value = npcConfig.player;
    elements.npcPlayerSelect.disabled = onlineSession.isOnlineMode() || isReplayMode();
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


  function setActionsForSelection(selection) {
    const actions = getLegalActions(state, selection);
    uiState.legalMoves = actions.filter(action => action.kind === "move" || action.kind === "drop");
    uiState.multiMoveCompounds = actions.filter(action => action.kind === "compound");
    uiState.specialActions = actions.filter(action => action.kind === "transform" || action.kind === "buildBase");
    uiState.multiMovePlan = null;
    uiState.targetActionPlan = null;
  }

  function handleSpecialActionClick(event) {
    const button = event.target.closest(".special-action-button");
    if (!button || !canActOnCurrentTurn()) return;
    const index = Number(button.dataset.actionIndex);
    const action = uiState.displayedSpecialActions[index] ?? uiState.specialActions[index];
    if (!action) return;
    if (action.kind === "multiMoveStop") return executeMove(action.move);
    if (action.kind === "targetPlanCancel") {
      clearSelection();
      renderAll();
      return;
    }
    if (action.kind === "targetPlan") return startTargetActionPlan(action);
    executeMove(action);
  }

  function renderSpecialActions(displayState) {
    if (!elements.specialActions) return;
    elements.specialActions.innerHTML = "";

    if (!canActOnCurrentTurn() || displayState !== state) {
      const empty = document.createElement("p");
      empty.className = "special-action-empty";
      empty.textContent = "特殊アクションはありません。";
      elements.specialActions.appendChild(empty);
      return;
    }

    const actions = createDisplayedSelectedActions(displayState);
    uiState.displayedSpecialActions = actions;

    if (actions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "special-action-empty";
      empty.textContent = "特殊アクションはありません。";
      elements.specialActions.appendChild(empty);
      return;
    }

    actions.forEach((action, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "special-action-button";
      button.dataset.actionIndex = String(index);
      button.textContent = createSpecialActionLabel(state, action);
      elements.specialActions.appendChild(button);
    });
  }

  function createDisplayedSelectedActions(displayState) {
    if (uiState.targetActionPlan) {
      return [{ kind: "targetPlanCancel", label: uiState.targetActionPlan.kind === "buildBase" ? "建設をキャンセル" : "昇格をキャンセル" }];
    }

    const actions = [];
    actions.push(...uiState.specialActions.filter(action => action.kind === "transform"));

    const buildBaseActions = uiState.specialActions.filter(action => action.kind === "buildBase");
    if (buildBaseActions.length > 0) {
      const baseType = buildBaseActions[0].baseType;
      actions.push({ kind: "targetPlan", targetKind: "buildBase", actions: buildBaseActions, baseType });
    }

    actions.push(...uiState.specialActions.filter(action => action.kind === "multiMoveStop"));

    if (!uiState.multiMovePlan && uiState.selected?.kind === "board") {
      const triggered = getAvailableTriggeredActions(displayState, displayState.turn)
        .filter(action => action.kind === "triggerEffect" && action.source?.x === uiState.selected.x && action.source?.y === uiState.selected.y);
      if (triggered.length > 0) {
        actions.push({ kind: "targetPlan", targetKind: "triggerEffect", effectKind: "promoteNearby", actions: triggered });
      }
    }

    return actions;
  }

  function createSpecialActionLabel(state, action) {
    if (action.kind === "targetPlanCancel") return action.label;
    if (action.kind === "targetPlan" && action.targetKind === "triggerEffect") return "周囲の駒を昇格させる";
    if (action.kind === "targetPlan" && action.targetKind === "buildBase") {
      const baseDef = state.ruleset.baseDefs?.[action.baseType] ?? state.ruleset.bases?.[action.baseType];
      return `${baseDef?.display ?? action.baseType}を建設する`;
    }

    if (action.kind === "transform") {
      const before = getSquare(state, action.from.x, action.from.y);
      const beforeDef = before ? state.ruleset.pieces[before.id] : null;
      const afterDef = state.ruleset.pieces[action.toPieceId];
      return `${beforeDef?.display ?? before?.id ?? "駒"} → ${afterDef?.display ?? action.toPieceId} に変身`;
    }

    if (action.kind === "triggerEffect" && action.effectKind === "promoteNearby") {
      const target = getSquare(state, action.target.x, action.target.y);
      const beforeDef = target ? state.ruleset.pieces[target.id] : null;
      const afterDef = state.ruleset.pieces[action.promoteTo];
      return `${beforeDef?.display ?? target?.id ?? "駒"} → ${afterDef?.display ?? action.promoteTo} に効果成り`;
    }

    if (action.kind === "multiMoveStop") {
      return `ここで停止 ${formatActionPath(action.move)}`;
    }

    if (action.kind === "compound") {
      const first = action.actions[0];
      const last = action.actions.at(-1);
      return `2回行動 ${formatActionPath(first)} → ${formatActionPath(last)}`;
    }

    if (action.kind === "buildBase") {
      const baseDef = state.ruleset.baseDefs?.[action.baseType] ?? state.ruleset.bases?.[action.baseType];
      return `${baseDef?.display ?? action.baseType}を${action.to.x + 1},${action.to.y + 1}に建設`;
    }

    return "特殊アクション";
  }

  function startTargetActionPlan(planAction) {
    if (planAction.targetKind === "buildBase") {
      uiState.targetActionPlan = { kind: "buildBase", actions: planAction.actions };
      uiState.legalMoves = planAction.actions;
      uiState.specialActions = [{ kind: "targetPlanCancel", label: "建設をキャンセル" }];
      setMessage("建設するマスを盤面で選んでください。キャンセルもできます。");
      renderAll();
      return;
    }

    if (planAction.targetKind === "triggerEffect") {
      const actions = planAction.actions.map(action => ({ ...action, to: { ...action.target } }));
      uiState.targetActionPlan = { kind: "triggerEffect", actions };
      uiState.legalMoves = actions;
      uiState.specialActions = [{ kind: "targetPlanCancel", label: "昇格をキャンセル" }];
      setMessage("昇格させる対象の駒を盤面で選んでください。キャンセルもできます。");
      renderAll();
    }
  }

  function handleTargetActionPlanBoardClick(x, y) {
    const action = uiState.targetActionPlan?.actions?.find(candidate => {
      const target = candidate.kind === "triggerEffect" ? candidate.target : candidate.to;
      return target?.x === x && target?.y === y;
    });
    if (!action) {
      const piece = getSquare(state, x, y);
      if (piece) return inspectBoardPiece(x, y);
      return;
    }

    const executable = action.kind === "triggerEffect"
      ? { kind: "triggerEffect", effectKind: action.effectKind, source: { ...action.source }, target: { ...action.target }, promoteTo: action.promoteTo }
      : action;
    executeMove(executable);
  }

  function formatActionPath(action) {
    if (action?.kind === "move") return `${action.from.x + 1},${action.from.y + 1}-${action.to.x + 1},${action.to.y + 1}${action.promoteTo ? "成" : ""}`;
    return action?.kind ?? "?";
  }

  function createDisplayStatusText(displayState) {
    if (isSetupActive(displayState)) return `${playerName(getSetupPlayer(displayState))}の編成フェーズ`;
    let base;
    base = isReplayMode()
      ? `${createStatusText(displayState)} / 再生 ${uiState.replayIndex}/${state.history.length}`
      : createStatusText(displayState);

    if (isExtraActionTurnState(displayState.turnState)) {
      base += " / 追加行動中";
    }

    if (!onlineSession.isOnlineMode()) return isNpcTurn() ? `${base} / NPC思考中` : base;
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

  function handleSetupClick(event) {
    const button = event.target.closest("[data-setup-action]");
    if (!button || !isSetupActive(state)) return;
    const player = getEditableSetupPlayer();
    if (!canEditSetupPlayer(player)) return;

    try {
      const action = button.dataset.setupAction;
      const pieceId = button.dataset.pieceId;
      let changed = true;
      if (action === "add-piece") addSetupPiece(state, pieceId, player);
      else if (action === "remove-piece") removeSetupPiece(state, pieceId, player);
      else if (action === "select-fixed-pack") selectFixedPack(state, button.dataset.packId, player);
      else if (action === "generate-random-packs") generateRandomPacks(state);
      else if (action === "select-random-pack") selectGeneratedPack(state, button.dataset.packId, player);
      else if (action === "select-placement-piece") {
        changed = false;
        uiState.setupSelectedPieceId = pieceId;
        uiState.setupPlacements = getLegalPlacements(state, pieceId, player);
      }
      else if (action === "finalize") {
        finalizeSetupPlayer(state, player);
        uiState.setupSelectedPieceId = null;
        uiState.setupPlacements = [];
        if (!isSetupActive(state) && state.clock?.config?.enabled) startClock(state.clock, state.turn);
      }
      if (changed && onlineSession.isConnected()) sendOnlineMessage(createSetupMessage(state, action, player));
      renderAll();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      renderAll();
    }
  }

  function handleSetupBoardClick(x, y) {
    if (isReplayMode()) return;

    try {
      const player = getEditableSetupPlayer();
      if (!canEditSetupPlayer(player)) return;
      if (removeSetupPlacementAt(state, x, y, player)) {
        uiState.setupPlacements = uiState.setupSelectedPieceId ? getLegalPlacements(state, uiState.setupSelectedPieceId, player) : [];
        if (onlineSession.isConnected()) sendOnlineMessage(createSetupMessage(state, "removePlacement", player));
        renderAll();
        return;
      }

      if (!uiState.setupSelectedPieceId) {
        setMessage("配置する駒を編成パネルで選んでください。");
        renderAll();
        return;
      }

      const placement = { kind: "placement", player, pieceId: uiState.setupSelectedPieceId, to: { x, y } };
      applyPlacement(state, placement);
      if (onlineSession.isConnected()) sendOnlineMessage(createSetupMessage(state, "placePiece", player));
      uiState.setupPlacements = getLegalPlacements(state, uiState.setupSelectedPieceId, player);
      if (uiState.setupPlacements.length === 0) uiState.setupSelectedPieceId = null;
      renderAll();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      renderAll();
    }
  }

  function chooseMultiMoveFirstMove(x, y) {
    if (!uiState.multiMoveCompounds.length) return null;
    const candidates = uiState.multiMoveCompounds.filter(action => action.actions?.[0]?.to?.x === x && action.actions?.[0]?.to?.y === y);
    return candidates[0]?.actions?.[0] ?? null;
  }

  function startMultiMovePlan(firstMove) {
    const secondMoves = uiState.multiMoveCompounds
      .filter(action => sameFirstAction(action.actions?.[0], firstMove))
      .map(action => action.actions?.[1])
      .filter(Boolean);
    uiState.multiMovePlan = { firstMove, secondMoves };
    uiState.legalMoves = secondMoves;
    uiState.specialActions = [{ kind: "multiMoveStop", move: firstMove }];
    setMessage("2回行動中です。2回目の移動先を盤面で選ぶか、停止してください。");
    renderAll();
  }

  function handleMultiMovePlanBoardClick(x, y) {
    const second = uiState.multiMovePlan.secondMoves.find(move => move.to.x === x && move.to.y === y);
    if (!second) {
      clearSelection();
      renderAll();
      return;
    }
    executeMove({ kind: "compound", actions: [uiState.multiMovePlan.firstMove, second] });
  }

  function sameFirstAction(a, b) {
    return Boolean(a && b && a.kind === b.kind && a.from?.x === b.from?.x && a.from?.y === b.from?.y && a.to?.x === b.to?.x && a.to?.y === b.to?.y && (a.promoteTo ?? null) === (b.promoteTo ?? null));
  }

  function createIncomingErrorText(result) {
    if (result.reason === "sequence") return `通信同期ずれ：期待手数 ${result.expectedSeq} / 受信手数 ${result.actualSeq}`;
    if (result.reason === "illegal_move") return "通信で受信した指し手が現在局面の合法手ではありません。局面同期を実行してください。";
    if (result.reason === "turn") return `通信手番ずれ：期待 ${playerName(result.expectedPlayer)} / 受信 ${playerName(result.actualPlayer)}`;
    return `通信メッセージを反映できません: ${result.reason}`;
  }

  function isNpcTurn() {
    if (onlineSession.isOnlineMode() || isReplayMode() || isSetupActive(state)) return false;
    if (state.status.type !== "playing") return false;
    return npcConfig.player === state.turn || npcConfig.player === "both";
  }

  function scheduleNpcMove() {
    if (npcConfig.timerId) {
      window.clearTimeout(npcConfig.timerId);
      npcConfig.timerId = null;
    }
    if (!isNpcTurn()) return;
    npcConfig.timerId = window.setTimeout(runNpcMove, npcConfig.delayMs);
  }

  function runNpcMove() {
    npcConfig.timerId = null;
    if (!isNpcTurn()) return;
    const action = chooseNpcAction(state, state.turn);
    if (!action) {
      updateGameStatus(state);
      renderAll();
      return;
    }
    const mover = state.turn;
    const wasExtraAction = isExtraActionTurnState(state.turnState);
    try {
      applyAction(state, action);
      if (!isExtraActionTurnState(state.turnState) && !wasExtraAction) switchClockAfterMove(state.clock, mover, state.ruleset);
      if (wasExtraAction) switchClockAfterMove(state.clock, mover, state.ruleset);
      updateGameStatus(state);
      applyFlagFallStatus();
      clearSelection();
      clearReplay();
      renderAll();
      setMessage(`NPC（${playerName(mover)}）が指しました。`);
      scheduleNpcMove();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      renderAll();
    }
  }

  function addLog(direction, type, text, detail = null) {
    addConnectionLog(connectionLog, { direction, type, text, detail });
  }

  function setMessage(message) {
    elements.message.textContent = message;
  }
}
 
 
