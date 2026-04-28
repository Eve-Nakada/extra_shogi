import { applyMove } from "../core/applyMove.js";
import { getSquare } from "../core/coordinates.js";
import { createStatusText, isCurrentTurnInCheck, resign, updateGameStatus } from "../core/gameStatus.js";
import { getLegalMoves } from "../core/legalMoveFilter.js";
import { playerName } from "../core/state.js";
import { renderBoard } from "./renderBoard.js";
import { renderHands } from "./renderHands.js";

export function initController({ createState, elements }) {
  let state = createState();

  const uiState = {
    selected: null,
    legalMoves: []
  };

  elements.board.addEventListener("click", event => {
    const square = event.target.closest(".square");
    if (!square) return;

    const x = Number(square.dataset.x);
    const y = Number(square.dataset.y);
    handleBoardClick(x, y);
  });

  elements.blackHand.addEventListener("click", handleHandClick);
  elements.whiteHand.addEventListener("click", handleHandClick);

  elements.resignButton.addEventListener("click", () => {
    if (state.status.type !== "playing") return;
    resign(state, state.turn);
    clearSelection();
    renderAll();
  });

  elements.resetButton.addEventListener("click", () => {
    state = createState();
    clearSelection();
    renderAll();
  });

  renderAll();

  return {
    getState: () => state,
    render: renderAll
  };

  function handleBoardClick(x, y) {
    if (state.status.type !== "playing") return;

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
    if (state.status.type !== "playing") return;

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

  function renderAll() {
    renderBoard(elements.board, state, uiState);
    renderHands(elements.whiteHand, state, "white", uiState);
    renderHands(elements.blackHand, state, "black", uiState);

    elements.status.textContent = createStatusText(state);
    elements.status.classList.toggle("check", isCurrentTurnInCheck(state));

    elements.resignButton.disabled = state.status.type !== "playing";
    elements.resignButton.textContent = `${playerName(state.turn)} 投了`;
  }
}
