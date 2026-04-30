 
import { replayHistory } from "./replay.js";
import { cloneHistoryEntry, cloneTurnState } from "./state.js";
import { cloneClock } from "./clock.js";
import { createPositionHash, detectRepetition } from "./repetition.js";
import { evaluateImpasse } from "./impasse.js";
import { cloneGameMeta } from "./meta.js";
import { cloneBases } from "./base.js";
import { cloneSetup, cloneInitialPositionSnapshot } from "./setup.js";

const CURRENT_RECORD_VERSION = 1;

export function createGameRecord(state) {
  return {
    app: "shogi-html",
    version: CURRENT_RECORD_VERSION,
    savedAt: new Date().toISOString(),
    meta: cloneGameMeta(state.meta),
    rulesetId: state.rulesetId,
    phase: state.phase ?? "playing",
    setup: cloneSetup(state.setup),
    initialPosition: cloneInitialPositionSnapshot(state.initialPosition ?? state.setup?.initialPosition),
    turn: state.turn,
    status: cloneStatus(state.status),
    positionHash: createPositionHash(state),
    repetition: detectRepetition(state),
    impasse: evaluateImpasse(state),
    clock: cloneClock(state.clock),
    board: cloneBoardSnapshot(state),
    turnState: cloneTurnState(state.turnState),
    bases: cloneBases(state.bases),
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
  const state = replayHistory(ruleset, history, history.length, { initialPosition: record.initialPosition ?? record.setup?.initialPosition });
  state.phase = record.phase ?? state.phase ?? "playing";
  state.setup = cloneSetup(record.setup ?? state.setup);
  state.initialPosition = cloneInitialPositionSnapshot(record.initialPosition ?? state.setup?.initialPosition);
  state.turn = record.turn ?? state.turn;
  state.status = record.status ? cloneStatus(record.status) : {
    type: "playing",
    winner: null,
    reason: null
  };
  state.clock = cloneClock(record.clock);
  restoreBoardSnapshot(state, record.board);
  state.turnState = cloneTurnState(record.turnState);
  state.meta = cloneGameMeta(record.meta);
  state.bases = cloneBases(record.bases ?? state.bases);

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
 
 

function cloneBoardSnapshot(state) {
  return {
    width: state.board.width,
    height: state.board.height,
    squares: state.board.squares.map(piece => piece ? { ...piece } : null)
  };
}

function restoreBoardSnapshot(state, board) {
  if (!board || !Array.isArray(board.squares)) return;
  if (board.width !== state.board.width || board.height !== state.board.height) return;
  state.board.squares = board.squares.map(piece => piece ? { ...piece } : null);
}
