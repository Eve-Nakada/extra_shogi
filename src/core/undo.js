import { getSquare, setSquare } from "./coordinates.js";

export function undoLastMove(state) {
  const entry = state.history.pop();
  if (!entry) return false;

  state.status = {
    type: "playing",
    winner: null,
    reason: null
  };
  state.turn = entry.turn;

  if (entry.move.kind === "move") {
    undoBoardMove(state, entry);
    return true;
  }

  if (entry.move.kind === "drop") {
    undoDropMove(state, entry);
    return true;
  }

  throw new Error(`未知の指し手種別です: ${entry.move.kind}`);
}

function undoBoardMove(state, entry) {
  const { move, turn } = entry;
  const currentPiece = getSquare(state, move.to.x, move.to.y);

  const pieceBefore = entry.pieceBefore
    ? { ...entry.pieceBefore }
    : inferPieceBefore(state, entry, currentPiece);

  if (entry.captured) {
    removeCapturedPieceFromHand(state, turn, entry.captured);
  }

  setSquare(state, move.from.x, move.from.y, pieceBefore);
  setSquare(state, move.to.x, move.to.y, entry.captured ? { ...entry.captured } : null);
}

function undoDropMove(state, entry) {
  const { move, turn } = entry;
  setSquare(state, move.to.x, move.to.y, null);
  state.hands[turn][move.pieceId] = (state.hands[turn][move.pieceId] ?? 0) + 1;
}

function inferPieceBefore(state, entry, currentPiece) {
  if (!currentPiece) {
    throw new Error("取り消し対象の駒が移動先にありません。");
  }

  if (!entry.move.promoteTo) {
    return { owner: entry.turn, id: currentPiece.id };
  }

  const promotedDef = state.ruleset.pieces[currentPiece.id];
  return {
    owner: entry.turn,
    id: promotedDef?.capturedAs ?? currentPiece.id
  };
}

function removeCapturedPieceFromHand(state, owner, capturedPiece) {
  const capturedDef = state.ruleset.pieces[capturedPiece.id];
  const handPieceId = capturedDef?.capturedAs;
  if (!handPieceId) return;

  const count = state.hands[owner][handPieceId] ?? 0;
  if (count <= 1) {
    delete state.hands[owner][handPieceId];
    return;
  }

  state.hands[owner][handPieceId] = count - 1;
}
