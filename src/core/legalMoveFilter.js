import { canCapture } from "./capture.js";
 
import { applyMoveToClone } from "./applyMove.js";
import { fromIndex, getSquare, inBoard } from "./coordinates.js";
import { isInCheck } from "./check.js";
import {
  canPromote,
  generatePseudoMoves,
  isLastRank,
  isLastTwoRanks,
  mustPromote
} from "./moveGenerator.js";

export function getLegalMoves(state, selection, options = {}) {
  if (state.status.type !== "playing") return [];

  const pseudoMoves = generatePseudoMoves(state, selection);

  return pseudoMoves.filter(move => {
    if (!isBasicLegal(state, move)) return false;
    if (leavesOwnRoyalInCheck(state, move)) return false;
    if (shouldValidatePawnDropMate(options) && isIllegalPawnDropMate(state, move)) return false;
    return true;
  });
}

export function getAllLegalMovesForPlayer(state, player, options = {}) {
  const view = { ...state, turn: player };
  const moves = [];

  for (let index = 0; index < view.board.squares.length; index += 1) {
    const piece = view.board.squares[index];
    if (!piece || piece.owner !== player) continue;

    const { x, y } = fromIndex(index, view.board.width);
    moves.push(...getLegalMoves(view, { kind: "board", x, y }, options));
  }

  for (const [pieceId, count] of Object.entries(view.hands[player] ?? {})) {
    if (count <= 0) continue;
    moves.push(...getLegalMoves(view, { kind: "hand", owner: player, pieceId }, options));
  }

  return moves;
}

export function isCheckmate(state, player, options = {}) {
  if (!isInCheck(state, player)) return false;
  return getAllLegalMovesForPlayer(state, player, options).length === 0;
}

export function isBasicLegal(state, move) {
  if (move.kind === "move") {
    return isBasicBoardMoveLegal(state, move);
  }

  if (move.kind === "drop") {
    return isBasicDropLegal(state, move);
  }

  if (move.kind === "transform") {
    return isBasicTransformLegal(state, move);
  }

  if (move.kind === "triggerEffect") {
    return isBasicTriggerEffectLegal(state, move);
  }

  return false;
}

export function leavesOwnRoyalInCheck(state, move) {
  const mover = state.turn;
  const next = applyMoveToClone(state, move, {
    updateTurn: false,
    updateHistory: false
  });

  return isInCheck(next, mover);
}

export function isIllegalPawnDropMate(state, move) {
  if (move.kind !== "drop") return false;

  const pieceDef = state.ruleset.pieces[move.pieceId];
  if (!pieceDef?.dropRules?.includes("noDropPawnMate")) return false;

  const next = applyMoveToClone(state, move, {
    updateTurn: true,
    updateHistory: false
  });
  const defender = next.turn;

  if (!isInCheck(next, defender)) return false;

  // 再帰爆発を避けるため、この詰み確認の内部では打ち歩詰め規則を再評価しない。
  return isCheckmate(next, defender, { validatePawnDropMate: false });
}

function isBasicBoardMoveLegal(state, move) {
  if (!inBoard(move.from.x, move.from.y, state.board)) return false;
  if (!inBoard(move.to.x, move.to.y, state.board)) return false;

  const piece = getSquare(state, move.from.x, move.from.y);
  if (!piece || piece.owner !== state.turn) return false;

  const target = getSquare(state, move.to.x, move.to.y);
  if (target?.owner === state.turn) return false;
  if (target && !canCapture(state, piece, target, {
    attackerSquare: move.from,
    defenderSquare: move.to
  })) return false;

  const pieceDef = state.ruleset.pieces[piece.id];
  if (!pieceDef) return false;

  if (move.promoteTo) {
    if (move.promoteTo !== pieceDef.promotesTo) return false;
    if (!canPromote(state, piece, move.from, move.to)) return false;
  } else if (mustPromote(state, piece, move.to)) {
    return false;
  }

  return true;
}

function isBasicDropLegal(state, move) {
  if (!inBoard(move.to.x, move.to.y, state.board)) return false;
  if (getSquare(state, move.to.x, move.to.y)) return false;
  if ((state.hands[state.turn][move.pieceId] ?? 0) <= 0) return false;

  const pieceDef = state.ruleset.pieces[move.pieceId];
  if (!pieceDef || pieceDef.droppable === false) return false;

  for (const rule of pieceDef.dropRules ?? []) {
    if (rule === "notLastRank" && isLastRank(state, state.turn, move.to.y)) {
      return false;
    }

    if (rule === "notLastTwoRanks" && isLastTwoRanks(state, state.turn, move.to.y)) {
      return false;
    }

    if (rule === "noSameFilePawn" && hasUnpromotedPawnOnFile(state, state.turn, move.to.x, move.pieceId)) {
      return false;
    }
  }

  return true;
}

function hasUnpromotedPawnOnFile(state, owner, x, pieceId) {
  for (let y = 0; y < state.board.height; y += 1) {
    const piece = getSquare(state, x, y);
    if (piece?.owner === owner && piece.id === pieceId) {
      return true;
    }
  }

  return false;
}

function shouldValidatePawnDropMate(options) {
  return options.validatePawnDropMate !== false;
}
 
 

function isBasicTransformLegal(state, action) {
  if (!inBoard(action.from.x, action.from.y, state.board)) return false;
  const piece = getSquare(state, action.from.x, action.from.y);
  if (!piece || piece.owner !== state.turn) return false;
  if (!state.ruleset.pieces[action.toPieceId]) return false;

  const pieceDef = state.ruleset.pieces[piece.id];
  return (pieceDef?.transformOptions ?? []).some(option => {
    const toPieceId = typeof option === "string" ? option : option.to;
    const condition = typeof option === "string" ? "ownTurn" : (option.condition ?? "ownTurn");
    return toPieceId === action.toPieceId && condition === "ownTurn";
  });
}

function isBasicTriggerEffectLegal(state, action) {
  if (action.effectKind !== "promoteNearby") return false;
  if (!inBoard(action.source.x, action.source.y, state.board)) return false;
  if (!inBoard(action.target.x, action.target.y, state.board)) return false;

  const sourcePiece = getSquare(state, action.source.x, action.source.y);
  const targetPiece = getSquare(state, action.target.x, action.target.y);
  if (!sourcePiece || sourcePiece.owner !== state.turn || !targetPiece) return false;

  const sourceDef = state.ruleset.pieces[sourcePiece.id];
  const effect = (sourceDef?.effects ?? []).find(candidate => candidate.kind === "promoteNearby");
  if (!effect) return false;

  const radius = Math.max(1, Number(effect.radius ?? 1));
  const dx = Math.abs(action.target.x - action.source.x);
  const dy = Math.abs(action.target.y - action.source.y);
  if ((dx === 0 && dy === 0) || dx > radius || dy > radius) return false;
  if ((effect.target ?? "ownPieces") === "ownPieces" && targetPiece.owner !== state.turn) return false;

  const targetDef = state.ruleset.pieces[targetPiece.id];
  return Boolean(targetDef?.promotesTo && targetDef.promotesTo === action.promoteTo && state.ruleset.pieces[action.promoteTo]);
}
