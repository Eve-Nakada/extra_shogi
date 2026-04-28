import { applyMove } from "../core/applyMove.js";
import { updateGameStatus, resign } from "../core/gameStatus.js";
import { getLegalMoves } from "../core/legalMoveFilter.js";
import { createGameRecord } from "../core/record.js";
import { cloneHistoryEntry, cloneMove } from "../core/state.js";

export const WIRE_PROTOCOL_VERSION = 1;

export function createSyncMessage(state) {
  return {
    type: "sync",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    record: createGameRecord(state)
  };
}

export function createMoveMessage(state) {
  const entry = state.history.at(-1);
  if (!entry) {
    throw new Error("送信する指し手履歴がありません。");
  }

  return {
    type: "move",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length,
    player: entry.turn,
    move: cloneMove(entry.move),
    entry: cloneHistoryEntry(entry)
  };
}

export function createResignMessage(state, player) {
  return {
    type: "resign",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length,
    player
  };
}

export function applyIncomingMove(state, message) {
  if (!message || message.type !== "move") {
    return { ok: false, reason: "message_type" };
  }

  if (message.protocolVersion !== WIRE_PROTOCOL_VERSION) {
    return { ok: false, reason: "protocol_version" };
  }

  const expectedSeq = state.history.length + 1;
  if (message.seq !== expectedSeq) {
    return { ok: false, reason: "sequence", expectedSeq, actualSeq: message.seq };
  }

  if (message.player !== state.turn) {
    return { ok: false, reason: "turn", expectedPlayer: state.turn, actualPlayer: message.player };
  }

  const move = message.entry?.move ?? message.move;
  if (!move || !isMoveLegalNow(state, move)) {
    return { ok: false, reason: "illegal_move" };
  }

  applyMove(state, move);
  updateGameStatus(state);
  return { ok: true };
}

export function applyIncomingResign(state, message) {
  if (!message || message.type !== "resign") {
    return { ok: false, reason: "message_type" };
  }

  if (message.protocolVersion !== WIRE_PROTOCOL_VERSION) {
    return { ok: false, reason: "protocol_version" };
  }

  if (!state.ruleset.players.includes(message.player)) {
    return { ok: false, reason: "player" };
  }

  resign(state, message.player);
  return { ok: true };
}

export function isMoveLegalNow(state, move) {
  const selection = selectionFromMove(state, move);
  if (!selection) return false;

  return getLegalMoves(state, selection).some(candidate => sameMove(candidate, move));
}

export function selectionFromMove(state, move) {
  if (!move || typeof move !== "object") return null;

  if (move.kind === "move") {
    return {
      kind: "board",
      x: move.from?.x,
      y: move.from?.y
    };
  }

  if (move.kind === "drop") {
    return {
      kind: "hand",
      owner: state.turn,
      pieceId: move.pieceId
    };
  }

  return null;
}

export function sameMove(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;

  if (a.kind === "move") {
    return (
      a.from.x === b.from.x &&
      a.from.y === b.from.y &&
      a.to.x === b.to.x &&
      a.to.y === b.to.y &&
      (a.promoteTo ?? null) === (b.promoteTo ?? null)
    );
  }

  if (a.kind === "drop") {
    return (
      a.pieceId === b.pieceId &&
      a.to.x === b.to.x &&
      a.to.y === b.to.y
    );
  }

  return false;
}
