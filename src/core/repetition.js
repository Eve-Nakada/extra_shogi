import { applyMove } from "./applyMove.js";
import { isInCheck } from "./check.js";
import { createInitialState, cloneMove } from "./state.js";
import { cloneInitialPositionSnapshot } from "./setup.js";

export const REPETITION_LIMIT = 4;

export function createPositionHash(state) {
  const boardPart = state.board.squares
    .map(piece => piece ? `${piece.owner}:${piece.id}` : "_")
    .join(",");

  const handPart = state.ruleset.players
    .map(player => `${player}:${formatHand(state.hands[player] ?? {})}`)
    .join("|");

  const basePart = formatBases(state.bases ?? []);

  const turnStatePart = state.turnState?.phase === "extraAction"
    ? `extra:${state.turnState.forcedPiece?.x},${state.turnState.forcedPiece?.y}:${state.turnState.remainingActions}`
    : "normal";

  return [
    `ruleset=${state.rulesetId}`,
    `phase=${state.phase ?? "playing"}`,
    `turn=${state.turn}`,
    `turnState=${turnStatePart}`,
    `board=${boardPart}`,
    `hands=${handPart}`,
    `bases=${basePart}`
  ].join(";");
}

export function createPositionTimeline(ruleset, history, initialPosition = null) {
  const state = createInitialState(ruleset);
  if (initialPosition) restoreInitialPositionForTimeline(state, initialPosition);
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
  const timeline = createPositionTimeline(state.ruleset, state.history, state.initialPosition ?? state.setup?.initialPosition);
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
 
 

function formatBases(bases) {
  return bases
    .map(base => `${base.owner}:${base.kind}:${base.x},${base.y}:${base.layer ?? "ground"}`)
    .sort()
    .join(",");
}

function restoreInitialPositionForTimeline(state, snapshot) {
  const initial = cloneInitialPositionSnapshot(snapshot);
  if (!initial?.board?.squares?.length) return;
  if (initial.board.width === state.board.width && initial.board.height === state.board.height) {
    state.board.squares = initial.board.squares.map(piece => piece ? { ...piece } : null);
  }
  state.hands = Object.fromEntries(Object.entries(initial.hands ?? state.hands).map(([player, hand]) => [player, { ...hand }]));
  state.bases = Array.isArray(initial.bases) ? initial.bases.map(base => ({ ...base })) : [];
  state.phase = "playing";
  if (state.setup) state.setup.phase = "complete";
  state.turn = initial.turn ?? state.ruleset.firstTurn ?? state.ruleset.players[0];
}
 
 
