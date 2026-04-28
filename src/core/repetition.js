import { applyMove } from "./applyMove.js";
import { isInCheck } from "./check.js";
import { createInitialState, cloneMove } from "./state.js";

export const REPETITION_LIMIT = 4;

export function createPositionHash(state) {
  const boardPart = state.board.squares
    .map(piece => piece ? `${piece.owner}:${piece.id}` : "_")
    .join(",");

  const handPart = state.ruleset.players
    .map(player => `${player}:${formatHand(state.hands[player] ?? {})}`)
    .join("|");

  return [
    `ruleset=${state.rulesetId}`,
    `turn=${state.turn}`,
    `board=${boardPart}`,
    `hands=${handPart}`
  ].join(";");
}

export function createPositionTimeline(ruleset, history) {
  const state = createInitialState(ruleset);
  const timeline = [createTimelineEntry(state, 0)];

  for (const [index, entry] of history.entries()) {
    applyMove(state, cloneMove(entry.move), {
      updateTurn: true,
      updateHistory: false
    });
    timeline.push(createTimelineEntry(state, index + 1));
  }

  return timeline;
}

export function detectRepetition(state) {
  const currentHash = createPositionHash(state);
  const timeline = createPositionTimeline(state.ruleset, state.history);
  const matches = timeline.filter(entry => entry.hash === currentHash);

  if (matches.length < REPETITION_LIMIT) {
    return {
      repeated: false,
      hash: currentHash,
      count: matches.length,
      occurrences: matches.map(entry => entry.ply)
    };
  }

  const checkedOccurrences = matches.filter(entry => entry.inCheck);
  if (checkedOccurrences.length >= REPETITION_LIMIT) {
    return {
      repeated: true,
      type: "perpetual_check",
      hash: currentHash,
      count: matches.length,
      occurrences: matches.map(entry => entry.ply),
      checkedPlayer: state.turn,
      winner: state.turn
    };
  }

  return {
    repeated: true,
    type: "sennichite",
    hash: currentHash,
    count: matches.length,
    occurrences: matches.map(entry => entry.ply),
    winner: null
  };
}

function createTimelineEntry(state, ply) {
  return {
    ply,
    hash: createPositionHash(state),
    turn: state.turn,
    inCheck: isInCheck(state, state.turn)
  };
}

function formatHand(hand) {
  return Object.entries(hand)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pieceId, count]) => `${pieceId}${count}`)
    .join(",");
}
