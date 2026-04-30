 
import { applyMove } from "../core/applyMove.js";
import { updateGameStatus, resign } from "../core/gameStatus.js";
import { getLegalActions } from "../core/action.js";
import { createGameRecord } from "../core/record.js";
import { cloneClock } from "../core/clock.js";
import { cloneHistoryEntry, cloneMove } from "../core/state.js";

export const WIRE_PROTOCOL_VERSION = 3;

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
    entry: cloneHistoryEntry(entry),
    clock: cloneClock(state.clock)
  };
}

export function createResignMessage(state, player) {
  return {
    type: "resign",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length,
    player,
    clock: cloneClock(state.clock)
  };
}

export function createClockMessage(state) {
  return {
    type: "clock",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length,
    clock: cloneClock(state.clock)
  };
}

export function createSyncRequestMessage(state, reason = "manual") {
  return {
    type: "sync-request",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length,
    reason,
    clock: cloneClock(state.clock)
  };
}

export function createPingMessage(state) {
  return {
    type: "ping",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length
  };
}

export function createPongMessage(state, pingMessage = {}) {
  return {
    type: "pong",
    protocolVersion: WIRE_PROTOCOL_VERSION,
    seq: state.history.length,
    pingSentAt: pingMessage.sentAt ?? null
  };
}

export function applyIncomingMove(state, message) {
  if (!message || message.type !== "move") {
    return { ok: false, reason: "message_type" };
  }

  if (!isCompatibleProtocol(message.protocolVersion)) {
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
  if (message.clock) state.clock = cloneClock(message.clock);
  return { ok: true };
}

export function applyIncomingResign(state, message) {
  if (!message || message.type !== "resign") {
    return { ok: false, reason: "message_type" };
  }

  if (!isCompatibleProtocol(message.protocolVersion)) {
    return { ok: false, reason: "protocol_version" };
  }

  if (!state.ruleset.players.includes(message.player)) {
    return { ok: false, reason: "player" };
  }

  if (message.clock) state.clock = cloneClock(message.clock);
  resign(state, message.player);
  return { ok: true };
}

export function applyIncomingClock(state, message) {
  if (!message || message.type !== "clock") {
    return { ok: false, reason: "message_type" };
  }

  if (!isCompatibleProtocol(message.protocolVersion)) {
    return { ok: false, reason: "protocol_version" };
  }

  if (message.seq !== state.history.length) {
    return { ok: false, reason: "sequence", expectedSeq: state.history.length, actualSeq: message.seq };
  }

  state.clock = cloneClock(message.clock);
  return { ok: true };
}

export function isMoveLegalNow(state, move) {
  const selection = selectionFromMove(state, move);
  if (!selection) return false;

  return getLegalActions(state, selection).some(candidate => sameMove(candidate, move));
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

  if (move.kind === "transform") {
    return { kind: "board", x: move.from?.x, y: move.from?.y };
  }

  if (move.kind === "triggerEffect") {
    return { kind: "board", x: move.source?.x, y: move.source?.y };
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

  if (a.kind === "transform") {
    return a.from.x === b.from.x && a.from.y === b.from.y && a.toPieceId === b.toPieceId;
  }

  if (a.kind === "triggerEffect") {
    return (
      a.effectKind === b.effectKind &&
      a.source.x === b.source.x &&
      a.source.y === b.source.y &&
      a.target.x === b.target.x &&
      a.target.y === b.target.y &&
      a.promoteTo === b.promoteTo
    );
  }

  return false;
}

export function isCompatibleProtocol(version) {
  // v0.7 accepts v0.5/v0.6 messages. Older messages simply lack clock or sync-request fields.
  return version === 1 || version === 2 || version === WIRE_PROTOCOL_VERSION;
}
 
 
