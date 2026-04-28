import { applyMove } from "../core/applyMove.js";
import { getSquare } from "../core/coordinates.js";
import { createStatusText, isCurrentTurnInCheck, resign, updateGameStatus } from "../core/gameStatus.js";
import { getLegalMoves } from "../core/legalMoveFilter.js";
import { parseGameRecord, restoreGameRecord, serializeGameRecord } from "../core/record.js";
import { replayHistory } from "../core/replay.js";
import { playerName } from "../core/state.js";
import { undoLastMove } from "../core/undo.js";
import { renderBoard } from "./renderBoard.js";
import { renderHands } from "./renderHands.js";
import { renderHistory } from "./renderHistory.js";

const LOCAL_SAVE_KEY = "shogi-html:last-game";

export function initController({ createState, elements, rulesets, rulesetsById, defaultRulesetId }) {
  let currentRulesetId = defaultRulesetId ?? rulesets[0].id;
  let state = createState(currentRulesetId);

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
    const button = event.target.closest(".history-button");
    if (!button) return;
    setReplayIndex(Number(button.dataset.index) + 1);
  });

  elements.rulesetSelect.addEventListener("change", () => {
    currentRulesetId = elements.rulesetSelect.value;
    state = createState(currentRulesetId);
    clearSelection();
    clearReplay();
    renderAll();
  });

  elements.resignButton.addEventListener("click", () => {
    if (state.status.type !== "playing" || isReplayMode()) return;
    resign(state, state.turn);
    clearSelection();
    renderAll();
  });

  elements.resetButton.addEventListener("click", () => {
    state = createState(currentRulesetId);
    clearSelection();
    clearReplay();
    renderAll();
  });

  elements.undoButton.addEventListener("click", () => {
    if (state.history.length === 0) return;
    undoLastMove(state);
    clearSelection();
    clearReplay();
    renderAll();
  });

  elements.replayStartButton.addEventListener("click", () => setReplayIndex(0));
  elements.replayPrevButton.addEventListener("click", () => setReplayIndex(Math.max(0, getReplayIndex() - 1)));
  elements.replayNextButton.addEventListener("click", () => setReplayIndex(Math.min(state.history.length, getReplayIndex() + 1)));
  elements.replayEndButton.addEventListener("click", () => {
    clearReplay();
    clearSelection();
    renderAll();
  });

  elements.saveLocalButton.addEventListener("click", () => {
    window.localStorage.setItem(LOCAL_SAVE_KEY, serializeGameRecord(state));
    setMessage("ローカル保存しました。ブラウザ内のlocalStorageに保存されています。");
  });

  elements.loadLocalButton.addEventListener("click", () => {
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
    if (state.status.type !== "playing" || isReplayMode()) return;

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
    if (state.status.type !== "playing" || isReplayMode()) return;

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

  function setMessage(message) {
    elements.message.textContent = message;
  }

  function renderAll() {
    const displayState = getDisplayState();
    uiState.readonly = isReplayMode();

    renderBoard(elements.board, displayState, uiState);
    renderHands(elements.whiteHand, displayState, "white", uiState);
    renderHands(elements.blackHand, displayState, "black", uiState);
    renderHistory(elements.historyList, state, uiState);

    elements.status.textContent = createDisplayStatusText(displayState);
    elements.status.classList.toggle("check", isCurrentTurnInCheck(displayState));

    elements.resignButton.disabled = state.status.type !== "playing" || isReplayMode();
    elements.resignButton.textContent = `${playerName(state.turn)} 投了`;
    elements.undoButton.disabled = state.history.length === 0 || isReplayMode();

    const replayIndex = getReplayIndex();
    elements.replayStartButton.disabled = state.history.length === 0 || replayIndex === 0;
    elements.replayPrevButton.disabled = state.history.length === 0 || replayIndex === 0;
    elements.replayNextButton.disabled = state.history.length === 0 || replayIndex === state.history.length;
    elements.replayEndButton.disabled = state.history.length === 0 || !isReplayMode();
  }

  function createDisplayStatusText(displayState) {
    if (!isReplayMode()) {
      return createStatusText(displayState);
    }

    return `${createStatusText(displayState)} / 再生 ${uiState.replayIndex}/${state.history.length}`;
  }
}
