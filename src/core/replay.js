import { applyMove } from "./applyMove.js";
import { createInitialState, cloneHistoryEntry as cloneStateHistoryEntry, cloneMove } from "./state.js";
import { cloneInitialPositionSnapshot } from "./setup.js";

export function replayHistory(ruleset, history, count = history.length, options = {}) {
  const state = createInitialState(ruleset);
  if (options.initialPosition) restoreInitialPosition(state, options.initialPosition);
  const limit = Math.max(0, Math.min(count, history.length));

  for (let index = 0; index < limit; index += 1) {
    const entry = history[index];
    applyMove(state, cloneMove(entry.move), {
      updateTurn: true,
      updateHistory: false
    });

    state.history.push(cloneHistoryEntry(entry));
  }

  state.status = {
    type: "playing",
    winner: null,
    reason: null
  };

  return state;
}

function restoreInitialPosition(state, snapshot) {
  const initial = cloneInitialPositionSnapshot(snapshot);
  if (!initial?.board?.squares?.length) return;
  if (initial.board.width === state.board.width && initial.board.height === state.board.height) {
    state.board.squares = initial.board.squares.map(piece => piece ? { ...piece } : null);
  }
  state.hands = Object.fromEntries(Object.entries(initial.hands ?? state.hands).map(([player, hand]) => [player, { ...hand }]));
  state.bases = Array.isArray(initial.bases) ? initial.bases.map(base => ({ ...base })) : [];
  state.phase = "playing";
  if (state.setup) state.setup.phase = "complete";
  state.initialPosition = initial;
  state.turn = initial.turn ?? state.ruleset.firstTurn ?? state.ruleset.players[0];
}

export function cloneHistoryEntry(entry) {
  return cloneStateHistoryEntry(entry);
}
 
 
