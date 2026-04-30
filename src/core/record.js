 
import { replayHistory } from "./replay.js";
import { cloneHistoryEntry, cloneTurnState } from "./state.js";
import { cloneClock } from "./clock.js";
import { createPositionHash, detectRepetition } from "./repetition.js";
import { evaluateImpasse } from "./impasse.js";
import { cloneGameMeta } from "./meta.js";

const CURRENT_RECORD_VERSION = 1;

export function createGameRecord(state) {
  return {
    app: "shogi-html",
    version: CURRENT_RECORD_VERSION,
    savedAt: new Date().toISOString(),
    meta: cloneGameMeta(state.meta),
    rulesetId: state.rulesetId,
    turn: state.turn,
    status: cloneStatus(state.status),
    positionHash: createPositionHash(state),
    repetition: detectRepetition(state),
    impasse: evaluateImpasse(state),
    clock: cloneClock(state.clock),
    turnState: cloneTurnState(state.turnState),
    history: state.history.map(cloneHistoryEntry)
  };
}

export function serializeGameRecord(state) {
  return JSON.stringify(createGameRecord(state), null, 2);
}

export function parseGameRecord(text) {
  let record;
  try {
    record = JSON.parse(text);
  } catch (error) {
    throw new Error("JSONとして読み込めません。ファイル内容を確認してください。");
  }

  validateGameRecord(record);
  return record;
}

export function restoreGameRecord(record, rulesetsById) {
  validateGameRecord(record);

  const ruleset = rulesetsById[record.rulesetId];
  if (!ruleset) {
    throw new Error(`対応していないルールセットです: ${record.rulesetId}`);
  }

  const history = record.history ?? [];
  const state = replayHistory(ruleset, history, history.length);
  state.turn = record.turn ?? state.turn;
  state.status = record.status ? cloneStatus(record.status) : {
    type: "playing",
    winner: null,
    reason: null
  };
  state.clock = cloneClock(record.clock);
  state.turnState = cloneTurnState(record.turnState);
  state.meta = cloneGameMeta(record.meta);

  return state;
}

function validateGameRecord(record) {
  if (!record || typeof record !== "object") {
    throw new Error("保存データの形式が不正です。");
  }

  if (record.app !== "shogi-html") {
    throw new Error("このアプリの保存データではありません。");
  }

  if (!record.rulesetId || typeof record.rulesetId !== "string") {
    throw new Error("保存データにrulesetIdがありません。");
  }

  if (!Array.isArray(record.history)) {
    throw new Error("保存データにhistory配列がありません。");
  }

  for (const [index, entry] of record.history.entries()) {
    if (!entry || typeof entry !== "object" || !entry.move) {
      throw new Error(`history[${index}] の形式が不正です。`);
    }
  }
}

function cloneStatus(status) {
  if (!status) return status;
  return JSON.parse(JSON.stringify(status));
}
 
 
