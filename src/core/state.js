import { setSquare } from "./coordinates.js";
import { cloneClock } from "./clock.js";
import { cloneBases } from "./base.js";
import { createDefaultMeta, cloneGameMeta } from "./meta.js";

export function createInitialState(ruleset) {
  const width = ruleset.board.width;
  const height = ruleset.board.height;

  const state = {
    ruleset,
    rulesetId: ruleset.id,
    board: {
      width,
      height,
      squares: Array.from({ length: width * height }, () => null)
    },
    turn: ruleset.firstTurn ?? ruleset.players[0],
    hands: createEmptyHands(ruleset),
    bases: cloneBases(ruleset.initialBases ?? []),
    history: [],
    status: {
      type: "playing",
      winner: null,
      reason: null
    },
    clock: null,
    meta: createDefaultMeta(),
    turnState: createDefaultTurnState()
  };

  for (const item of ruleset.initialPieces) {
    setSquare(state, item.x, item.y, {
      owner: item.owner,
      id: item.id
    });
  }

  return state;
}

export function createEmptyHands(ruleset) {
  const hands = {};
  for (const player of ruleset.players) {
    hands[player] = {};
  }
  return hands;
}

export function cloneState(state) {
  return {
    ruleset: state.ruleset,
    rulesetId: state.rulesetId,
    board: {
      width: state.board.width,
      height: state.board.height,
      squares: state.board.squares.map(piece => piece ? { ...piece } : null)
    },
    turn: state.turn,
    hands: cloneHands(state.hands),
    bases: cloneBases(state.bases),
    history: state.history.map(cloneHistoryEntry),
    status: { ...state.status },
    clock: cloneClock(state.clock),
    meta: cloneGameMeta(state.meta),
    turnState: cloneTurnState(state.turnState)
  };
}

export function cloneHistoryEntry(entry) {
  return {
    turn: entry.turn,
    move: cloneMove(entry.move),
    captured: entry.captured ? { ...entry.captured } : null,
    pieceBefore: entry.pieceBefore ? { ...entry.pieceBefore } : null,
    pieceAfter: entry.pieceAfter ? { ...entry.pieceAfter } : null,
    subEntries: Array.isArray(entry.subEntries) ? entry.subEntries.map(cloneHistoryEntry) : undefined,
    builtBase: entry.builtBase ? { ...entry.builtBase } : null,
    turnStateBefore: cloneTurnState(entry.turnStateBefore),
    turnStateAfter: cloneTurnState(entry.turnStateAfter)
  };
}

export function cloneMove(move) {
  if (move.kind === "move") {
    return {
      kind: "move",
      from: { ...move.from },
      to: { ...move.to },
      promoteTo: move.promoteTo ?? null
    };
  }

  if (move.kind === "drop") {
    return {
      kind: "drop",
      pieceId: move.pieceId,
      to: { ...move.to }
    };
  }

  if (move.kind === "transform") {
    return {
      kind: "transform",
      from: { ...move.from },
      toPieceId: move.toPieceId
    };
  }

  if (move.kind === "triggerEffect") {
    return {
      kind: "triggerEffect",
      effectKind: move.effectKind,
      source: { ...move.source },
      target: { ...move.target },
      promoteTo: move.promoteTo
    };
  }

  if (move.kind === "compound") {
    return {
      kind: "compound",
      actions: move.actions.map(cloneMove)
    };
  }

  if (move.kind === "buildBase") {
    return {
      kind: "buildBase",
      actor: { ...move.actor },
      baseType: move.baseType,
      to: { ...move.to },
      id: move.id ?? null
    };
  }

  throw new Error(`未知の指し手種別です: ${move.kind}`);
}

export function createDefaultTurnState() {
  return {
    phase: "normal",
    actionIndex: 0,
    remainingActions: 1,
    forcedPiece: null,
    reason: null,
    compoundActions: []
  };
}

export function cloneTurnState(turnState) {
  if (!turnState) return createDefaultTurnState();
  return {
    phase: turnState.phase ?? "normal",
    actionIndex: Number(turnState.actionIndex ?? 0),
    remainingActions: Number(turnState.remainingActions ?? 1),
    forcedPiece: turnState.forcedPiece ? { ...turnState.forcedPiece } : null,
    reason: turnState.reason ?? null,
    compoundActions: Array.isArray(turnState.compoundActions)
      ? turnState.compoundActions.map(cloneMove)
      : []
  };
}

export function isExtraActionTurnState(turnState) {
  return Boolean(turnState && turnState.phase === "extraAction" && turnState.remainingActions > 0 && turnState.forcedPiece);
}

function cloneHands(hands) {
  const cloned = {};
  for (const [owner, pieces] of Object.entries(hands)) {
    cloned[owner] = { ...pieces };
  }
  return cloned;
}

export function opposite(stateOrRuleset, player) {
  const players = stateOrRuleset.players ?? stateOrRuleset.ruleset.players;
  const index = players.indexOf(player);
  if (index === -1) {
    throw new Error(`未知のプレイヤーです: ${player}`);
  }
  return players[(index + 1) % players.length];
}

export function playerName(player) {
  if (player === "spectator") return "観戦者";
  return player === "black" ? "先手" : "後手";
}
