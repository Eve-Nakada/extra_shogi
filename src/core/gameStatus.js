import { isInCheck } from "./check.js";
import { isCheckmate } from "./legalMoveFilter.js";
import { opposite, playerName } from "./state.js";
import { detectRepetition } from "./repetition.js";
import { evaluateImpasse } from "./impasse.js";

export function updateGameStatus(state) {
  if (state.status.type !== "playing") return state.status;

  const playerToMove = state.turn;
  if (isCheckmate(state, playerToMove)) {
    state.status = {
      type: "ended",
      winner: opposite(state, playerToMove),
      reason: "checkmate"
    };
    return state.status;
  }

  const repetition = detectRepetition(state);
  if (repetition.repeated) {
    state.status = {
      type: "ended",
      winner: repetition.winner,
      reason: repetition.type,
      detail: repetition
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

export function declareImpasse(state) {
  if (state.status.type !== "playing") return state.status;

  const result = evaluateImpasse(state);
  if (!result.ready) {
    return {
      type: "rejected",
      winner: null,
      reason: "impasse_not_ready",
      detail: result
    };
  }

  state.status = {
    type: "ended",
    winner: result.winner,
    reason: "impasse",
    detail: result
  };

  return state.status;
}

export function createStatusText(state) {
  if (state.status.type === "ended") {
    return createEndedStatusText(state.status);
  }

  const turnName = playerName(state.turn);
  const checkSuffix = isInCheck(state, state.turn) ? "（王手）" : "";
  return `手番：${turnName}${checkSuffix}`;
}

export function createEndedStatusText(status) {
  if (status.reason === "sennichite") return "千日手：引き分け";
  if (status.reason === "perpetual_check") return `連続王手の千日手：${playerName(status.winner)}の勝ち`;
  if (status.reason === "impasse") {
    const scoreText = formatScoreDetail(status.detail?.scores);
    if (!status.winner) return `持将棋：引き分け${scoreText}`;
    return `持将棋：${playerName(status.winner)}の勝ち${scoreText}`;
  }
  if (status.reason === "time") return `時間切れ：${playerName(status.winner)}の勝ち`;

  const winner = playerName(status.winner);
  const reason = status.reason === "checkmate" ? "詰み" : "投了";
  return `${reason}：${winner}の勝ち`;
}

export function isCurrentTurnInCheck(state) {
  return state.status.type === "playing" && isInCheck(state, state.turn);
}

function formatScoreDetail(scores) {
  if (!scores) return "";
  const black = scores.black ?? "-";
  const white = scores.white ?? "-";
  return `（先手${black}点 / 後手${white}点）`;
}
