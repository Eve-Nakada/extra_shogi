import { cloneMove, cloneState, opposite } from "./state.js";
import { getSquare, setSquare } from "./coordinates.js";

export function applyMove(state, move, options = {}) {
  const { updateTurn = true, updateHistory = true } = options;
  const mover = state.turn;
  let captured = null;

  if (move.kind === "move") {
    captured = applyBoardMove(state, mover, move);
  } else if (move.kind === "drop") {
    applyDropMove(state, mover, move);
  } else {
    throw new Error(`未知の指し手種別です: ${move.kind}`);
  }

  if (updateHistory) {
    state.history.push({
      turn: mover,
      move: cloneMove(move),
      captured: captured ? { ...captured } : null
    });
  }

  if (updateTurn) {
    state.turn = opposite(state, mover);
  }

  return {
    turn: mover,
    move: cloneMove(move),
    captured
  };
}

export function applyMoveToClone(state, move, options = {}) {
  const next = cloneState(state);
  applyMove(next, move, options);
  return next;
}

function applyBoardMove(state, mover, move) {
  const piece = getSquare(state, move.from.x, move.from.y);
  if (!piece || piece.owner !== mover) {
    throw new Error("移動元に手番側の駒がありません。");
  }

  const target = getSquare(state, move.to.x, move.to.y);
  if (target && target.owner === mover) {
    throw new Error("移動先に自分の駒があります。");
  }

  if (target) {
    addCapturedPieceToHand(state, mover, target);
  }

  setSquare(state, move.from.x, move.from.y, null);
  setSquare(state, move.to.x, move.to.y, {
    owner: mover,
    id: move.promoteTo ?? piece.id
  });

  return target ? { ...target } : null;
}

function applyDropMove(state, mover, move) {
  const count = state.hands[mover][move.pieceId] ?? 0;
  if (count <= 0) {
    throw new Error("持ち駒が足りません。");
  }

  if (getSquare(state, move.to.x, move.to.y)) {
    throw new Error("駒打ちは空きマスにしかできません。");
  }

  state.hands[mover][move.pieceId] = count - 1;
  if (state.hands[mover][move.pieceId] <= 0) {
    delete state.hands[mover][move.pieceId];
  }

  setSquare(state, move.to.x, move.to.y, {
    owner: mover,
    id: move.pieceId
  });
}

function addCapturedPieceToHand(state, owner, capturedPiece) {
  const capturedDef = state.ruleset.pieces[capturedPiece.id];
  const handPieceId = capturedDef?.capturedAs;

  if (!handPieceId) return;

  state.hands[owner][handPieceId] = (state.hands[owner][handPieceId] ?? 0) + 1;
}
