 
import { applyMove } from "./applyMove.js";
import { createInitialState, cloneMove } from "./state.js";

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
  return {
    turn: entry.turn,
    move: cloneMove(entry.move),
    captured: entry.captured ? { ...entry.captured } : null,
    pieceBefore: entry.pieceBefore ? { ...entry.pieceBefore } : null,
    pieceAfter: entry.pieceAfter ? { ...entry.pieceAfter } : null
  };
}
 
 
