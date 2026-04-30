 
import { findRoyal } from "./check.js";
import { getPiecePoint as getDefinedPiecePoint } from "./pieceMetadata.js";

export const IMPASSE_POINT_THRESHOLD = 24;

export function calculateImpasseScore(state, player) {
  let total = 0;

  for (const piece of state.board.squares) {
    if (!piece || piece.owner !== player) continue;
    total += getPiecePoint(state, piece.id);
  }

  for (const [pieceId, count] of Object.entries(state.hands[player] ?? {})) {
    total += getPiecePoint(state, pieceId) * count;
  }

  return total;
}

export function evaluateImpasse(state) {
  const players = state.ruleset.players;
  const scores = Object.fromEntries(players.map(player => [player, calculateImpasseScore(state, player)]));
  const kingsEntered = Object.fromEntries(players.map(player => [player, isRoyalInEnemyCamp(state, player)]));
  const ready = players.every(player => kingsEntered[player]);

  if (!ready) {
    return {
      ready: false,
      scores,
      kingsEntered,
      winner: null,
      reason: "king_not_entered"
    };
  }

  const below = players.filter(player => scores[player] < IMPASSE_POINT_THRESHOLD);
  if (below.length === 0) {
    return {
      ready: true,
      scores,
      kingsEntered,
      winner: null,
      reason: "draw_by_points"
    };
  }

  if (below.length === 1) {
    const winner = players.find(player => player !== below[0]) ?? null;
    return {
      ready: true,
      scores,
      kingsEntered,
      winner,
      reason: "point_shortage"
    };
  }

  return {
    ready: true,
    scores,
    kingsEntered,
    winner: null,
    reason: "both_point_shortage"
  };
}

export function isRoyalInEnemyCamp(state, player) {
  const royal = findRoyal(state, player);
  if (!royal) return false;

  const depth = state.ruleset.promotion?.depth ?? 3;
  if (player === "black") return royal.y < depth;
  return royal.y >= state.board.height - depth;
}

export function getPiecePoint(state, pieceId) {
  return getDefinedPiecePoint(state.ruleset, pieceId);
}
 
 
