import { isInCheck } from "./check.js";
import { isCheckmate } from "./legalMoveFilter.js";
import { opposite, playerName } from "./state.js";

export function updateGameStatus(state) {
  if (state.status.type !== "playing") return state.status;

  const playerToMove = state.turn;
  if (isCheckmate(state, playerToMove)) {
    state.status = {
      type: "ended",
      winner: opposite(state, playerToMove),
      reason: "checkmate"
    };
  }

  return state.status;
}

export function resign(state, player = state.turn) {
  if (state.status.type !== "playing") return state.status;

  state.status = {
    type: "ended",
    winner: opposite(state, player),
    reason: "resign"
  };

  return state.status;
}

export function createStatusText(state) {
  if (state.status.type === "ended") {
    const winner = playerName(state.status.winner);
    const reason = state.status.reason === "checkmate" ? "詰み" : "投了";
    return `${reason}：${winner}の勝ち`;
  }

  const turnName = playerName(state.turn);
  const checkSuffix = isInCheck(state, state.turn) ? "（王手）" : "";
  return `手番：${turnName}${checkSuffix}`;
}

export function isCurrentTurnInCheck(state) {
  return state.status.type === "playing" && isInCheck(state, state.turn);
}
