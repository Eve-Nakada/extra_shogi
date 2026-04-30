 
import { applyMove } from "./applyMove.js";
import { createInitialState, cloneHistoryEntry as cloneStateHistoryEntry, cloneMove } from "./state.js";

export function replayHistory(ruleset, history, count = history.length) {
  const state = createInitialState(ruleset);
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

export function cloneHistoryEntry(entry) {
  return cloneStateHistoryEntry(entry);
}
 
 
