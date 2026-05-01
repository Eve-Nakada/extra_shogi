import { canCapture } from "./capture.js";
import { cloneMove, cloneState, cloneTurnState, createDefaultTurnState, isExtraActionTurnState, opposite } from "./state.js";
import { getSquare, setSquare } from "./coordinates.js";
import { chebyshevDistance, createBaseFromAction, damageBase, findBaseAt, getBaseDef, hasBaseAt } from "./base.js";

export function applyMove(state, move, options = {}) {
  const { updateTurn = true, updateHistory = true } = options;
  const mover = state.turn;
  const turnStateBefore = cloneTurnState(state.turnState);
  let result;

  if (move.kind === "move") {
    result = applyBoardMove(state, mover, move);
  } else if (move.kind === "drop") {
    result = applyDropMove(state, mover, move);
  } else if (move.kind === "transform") {
    result = applyTransformAction(state, mover, move);
  } else if (move.kind === "triggerEffect") {
    result = applyTriggerEffectAction(state, mover, move);
  } else if (move.kind === "compound") {
    result = applyCompoundAction(state, mover, move);
  } else if (move.kind === "buildBase") {
    result = applyBuildBaseAction(state, mover, move);
  } else if (move.kind === "attackBase") {
    result = applyAttackBaseAction(state, mover, move);
  } else {
    throw new Error(`未知の指し手種別です: ${move.kind}`);
  }

  if (updateTurn) {
    updateTurnStateAfterAction(state, mover, move, result, turnStateBefore);
  }

  if (updateHistory) {
    state.history.push({
      turn: mover,
      move: cloneMove(move),
      captured: result.captured ? { ...result.captured } : null,
      pieceBefore: result.pieceBefore ? { ...result.pieceBefore } : null,
      pieceAfter: result.pieceAfter ? { ...result.pieceAfter } : null,
      subEntries: result.subEntries ? result.subEntries.map(cloneHistoryEntryLike) : undefined,
      builtBase: result.builtBase ? { ...result.builtBase } : null,
      baseBefore: result.baseBefore ? { ...result.baseBefore } : null,
      baseAfter: result.baseAfter ? { ...result.baseAfter } : null,
      baseOutcome: result.baseOutcome ?? null,
      baseDamage: result.baseDamage ?? null,
      turnStateBefore,
      turnStateAfter: cloneTurnState(state.turnState)
    });
  }

  return {
    turn: mover,
    move: cloneMove(move),
    captured: result.captured,
    pieceBefore: result.pieceBefore,
    pieceAfter: result.pieceAfter,
    subEntries: result.subEntries
  };
}

export function applyMoveToClone(state, move, options = {}) {
  const next = cloneState(state);
  applyMove(next, move, options);
  return next;
}

function applyBoardMove(state, mover, move) {
  const piece = getSquare(state, move.from.x, move.from.y);
  if (!piece || piece.owner !== mover) {
    throw new Error("移動元に手番側の駒がありません。");
  }

  if (hasBaseAt(state, move.to.x, move.to.y)) {
    throw new Error("拠点があるマスへは移動できません。");
  }

  const target = getSquare(state, move.to.x, move.to.y);
  if (target && target.owner === mover) {
    throw new Error("移動先に自分の駒があります。");
  }

  if (target && !canCapture(state, piece, target, {
    attackerSquare: move.from,
    defenderSquare: move.to
  })) {
    throw new Error("この駒は捕獲制限により取れません。");
  }

  if (target) {
    addCapturedPieceToHand(state, mover, target);
  }

  const pieceAfter = {
    owner: mover,
    id: move.promoteTo ?? piece.id
  };

  setSquare(state, move.from.x, move.from.y, null);
  setSquare(state, move.to.x, move.to.y, pieceAfter);

  return {
    captured: target ? { ...target } : null,
    pieceBefore: { ...piece },
    pieceAfter: { ...pieceAfter },
    finalSquare: { ...move.to }
  };
}

function applyDropMove(state, mover, move) {
  const count = state.hands[mover][move.pieceId] ?? 0;
  if (count <= 0) {
    throw new Error("持ち駒が足りません。");
  }

  if (getSquare(state, move.to.x, move.to.y) || hasBaseAt(state, move.to.x, move.to.y)) {
    throw new Error("駒打ちは空きマスにしかできません。");
  }

  state.hands[mover][move.pieceId] = count - 1;
  if (state.hands[mover][move.pieceId] <= 0) {
    delete state.hands[mover][move.pieceId];
  }

  const pieceAfter = {
    owner: mover,
    id: move.pieceId
  };

  setSquare(state, move.to.x, move.to.y, pieceAfter);

  return {
    captured: null,
    pieceBefore: null,
    pieceAfter,
    finalSquare: { ...move.to }
  };
}

function applyCompoundAction(state, mover, action) {
  if (!Array.isArray(action.actions) || action.actions.length === 0) {
    throw new Error("複合アクションの内容がありません。");
  }

  const subEntries = [];
  let firstResult = null;
  let lastResult = null;

  for (const subAction of action.actions) {
    const beforeTurnState = cloneTurnState(state.turnState);
    const result = applyMove(state, subAction, { updateTurn: false, updateHistory: false });
    const subEntry = {
      turn: mover,
      move: cloneMove(subAction),
      captured: result.captured ? { ...result.captured } : null,
      pieceBefore: result.pieceBefore ? { ...result.pieceBefore } : null,
      pieceAfter: result.pieceAfter ? { ...result.pieceAfter } : null,
      turnStateBefore: beforeTurnState,
      turnStateAfter: cloneTurnState(state.turnState)
    };
    subEntries.push(subEntry);
    if (!firstResult) firstResult = result;
    lastResult = result;
  }

  return {
    captured: subEntries.find(entry => entry.captured)?.captured ?? null,
    pieceBefore: firstResult?.pieceBefore ?? null,
    pieceAfter: lastResult?.pieceAfter ?? null,
    subEntries,
    builtBase: subEntries.find(entry => entry.builtBase)?.builtBase ?? null,
    baseBefore: subEntries.find(entry => entry.baseBefore)?.baseBefore ?? null,
    baseAfter: subEntries.find(entry => entry.baseAfter)?.baseAfter ?? null,
    baseOutcome: subEntries.find(entry => entry.baseOutcome)?.baseOutcome ?? null,
    baseDamage: subEntries.find(entry => entry.baseDamage)?.baseDamage ?? null,
    finalSquare: getActionFinalSquare(action.actions.at(-1))
  };
}

function applyBuildBaseAction(state, mover, action) {
  const actor = getSquare(state, action.actor.x, action.actor.y);
  if (!actor || actor.owner !== mover) {
    throw new Error("拠点建設元に手番側の駒がありません。");
  }

  if (getSquare(state, action.to.x, action.to.y) || hasBaseAt(state, action.to.x, action.to.y)) {
    throw new Error("拠点は空きマスにだけ建てられます。");
  }

  const actorDef = state.ruleset.pieces[actor.id];
  const buildAction = (actorDef?.actions ?? []).find(candidate => candidate.kind === "buildBase" && candidate.baseType === action.baseType);
  if (!buildAction || !getBaseDef(state, action.baseType)) {
    throw new Error("この駒は指定された拠点を建設できません。");
  }
  const range = Math.max(1, Number(buildAction.range ?? 1));
  if (chebyshevDistance(action.actor, action.to) > range || (action.actor.x === action.to.x && action.actor.y === action.to.y)) {
    throw new Error("拠点建設先が範囲外です。");
  }

  const builtBase = createBaseFromAction(state, mover, action);
  if (!Array.isArray(state.bases)) state.bases = [];
  state.bases.push(builtBase);

  return {
    captured: null,
    pieceBefore: { ...actor },
    pieceAfter: { ...actor },
    builtBase: { ...builtBase },
    finalSquare: { ...action.to }
  };
}

function applyAttackBaseAction(state, mover, action) {
  const actor = getSquare(state, action.actor.x, action.actor.y);
  if (!actor || actor.owner !== mover) throw new Error("拠点攻撃元に手番側の駒がありません。");

  const base = findBaseAt(state, action.target.x, action.target.y);
  if (!base || base.id !== action.baseId) throw new Error("攻撃対象の拠点がありません。");
  if (base.owner === mover) throw new Error("自分の拠点は攻撃できません。");

  const actorDef = state.ruleset.pieces[actor.id];
  const attackAction = (actorDef?.actions ?? []).find(candidate => candidate.kind === "attackBase");
  const damage = Math.max(1, Number(action.damage ?? attackAction?.damage ?? actorDef?.baseDamage ?? 1));
  if (!attackAction && actorDef?.baseDamage == null && !actorDef?.attributes?.includes("siege")) {
    throw new Error("この駒は拠点を攻撃できません。");
  }

  const result = damageBase(state, base.id, mover, damage);
  return {
    captured: null,
    pieceBefore: { ...actor },
    pieceAfter: { ...actor },
    baseBefore: result.before,
    baseAfter: result.after,
    baseOutcome: result.outcome,
    baseDamage: result.damage,
    finalSquare: { ...action.target }
  };
}

function addCapturedPieceToHand(state, owner, capturedPiece) {
  const capturedDef = state.ruleset.pieces[capturedPiece.id];
  const handPieceId = capturedDef?.capturedAs;

  if (!handPieceId) return;

  state.hands[owner][handPieceId] = (state.hands[owner][handPieceId] ?? 0) + 1;
}

function applyTransformAction(state, mover, action) {
  const piece = getSquare(state, action.from.x, action.from.y);
  if (!piece || piece.owner !== mover) throw new Error("変身元に手番側の駒がありません。");

  const pieceDef = state.ruleset.pieces[piece.id];
  const allowed = (pieceDef?.transformOptions ?? []).some(option => {
    const toPieceId = typeof option === "string" ? option : option.to;
    const condition = typeof option === "string" ? "ownTurn" : (option.condition ?? "ownTurn");
    return toPieceId === action.toPieceId && condition === "ownTurn";
  });
  if (!allowed || !state.ruleset.pieces[action.toPieceId]) throw new Error("この駒は指定された駒へ変身できません。");

  const pieceAfter = { owner: mover, id: action.toPieceId };
  setSquare(state, action.from.x, action.from.y, pieceAfter);
  return { captured: null, pieceBefore: { ...piece }, pieceAfter: { ...pieceAfter }, finalSquare: { ...action.from } };
}

function applyTriggerEffectAction(state, mover, action) {
  if (action.effectKind !== "promoteNearby") throw new Error(`未知の誘発効果です: ${action.effectKind}`);

  const sourcePiece = getSquare(state, action.source.x, action.source.y);
  if (!sourcePiece || sourcePiece.owner !== mover) throw new Error("効果元に手番側の駒がありません。");

  const sourceDef = state.ruleset.pieces[sourcePiece.id];
  const effect = (sourceDef?.effects ?? []).find(candidate => candidate.kind === "promoteNearby");
  if (!effect) throw new Error("この駒は周囲の駒を成らせる効果を持ちません。");

  const radius = Math.max(1, Number(effect.radius ?? 1));
  const dx = Math.abs(action.target.x - action.source.x);
  const dy = Math.abs(action.target.y - action.source.y);
  if ((dx === 0 && dy === 0) || dx > radius || dy > radius) throw new Error("効果対象が範囲外です。");

  const targetPiece = getSquare(state, action.target.x, action.target.y);
  if (!targetPiece) throw new Error("効果対象の駒がありません。");
  if ((effect.target ?? "ownPieces") === "ownPieces" && targetPiece.owner !== mover) throw new Error("自分の駒だけを対象にできます。");

  const targetDef = state.ruleset.pieces[targetPiece.id];
  if (!targetDef?.promotesTo || targetDef.promotesTo !== action.promoteTo) throw new Error("この駒は効果で成れません。");

  const pieceAfter = { owner: targetPiece.owner, id: action.promoteTo };
  setSquare(state, action.target.x, action.target.y, pieceAfter);
  return { captured: null, pieceBefore: { ...targetPiece }, pieceAfter: { ...pieceAfter }, finalSquare: { ...action.target } };
}

function updateTurnStateAfterAction(state, mover, action, result, turnStateBefore) {
  if (isExtraActionTurnState(turnStateBefore)) {
    state.turnState = createDefaultTurnState();
    state.turn = opposite(state, mover);
    return;
  }

  const extra = getExtraActionOnCaptureEffect(state, result.pieceAfter);
  if (action.kind === "move" && result.captured && extra) {
    state.turnState = {
      phase: "extraAction",
      actionIndex: 1,
      remainingActions: Math.max(1, Number(extra.actionCount ?? 1)),
      forcedPiece: { ...result.finalSquare },
      reason: "extraActionOnCapture",
      compoundActions: [cloneMove(action)]
    };
    return;
  }

  state.turnState = createDefaultTurnState();
  state.turn = opposite(state, mover);
}

function getExtraActionOnCaptureEffect(state, piece) {
  if (!piece) return null;
  const pieceDef = state.ruleset.pieces[piece.id];
  return (pieceDef?.effects ?? []).find(effect => effect.kind === "extraActionOnCapture" && effect.samePieceOnly !== false);
}

function getActionFinalSquare(action) {
  if (!action) return null;
  if (action.kind === "move" || action.kind === "drop") return { ...action.to };
  if (action.kind === "transform") return { ...action.from };
  if (action.kind === "triggerEffect") return { ...action.target };
  if (action.kind === "compound") return getActionFinalSquare(action.actions.at(-1));
  if (action.kind === "attackBase") return { ...action.target };
  return null;
}

function cloneHistoryEntryLike(entry) {
  return {
    turn: entry.turn,
    move: cloneMove(entry.move),
    captured: entry.captured ? { ...entry.captured } : null,
    pieceBefore: entry.pieceBefore ? { ...entry.pieceBefore } : null,
    pieceAfter: entry.pieceAfter ? { ...entry.pieceAfter } : null,
    subEntries: entry.subEntries ? entry.subEntries.map(cloneHistoryEntryLike) : undefined,
    builtBase: entry.builtBase ? { ...entry.builtBase } : null,
    baseBefore: entry.baseBefore ? { ...entry.baseBefore } : null,
    baseAfter: entry.baseAfter ? { ...entry.baseAfter } : null,
    baseOutcome: entry.baseOutcome ?? null,
    baseDamage: entry.baseDamage ?? null,
    turnStateBefore: cloneTurnState(entry.turnStateBefore),
    turnStateAfter: cloneTurnState(entry.turnStateAfter)
  };
}
 
 
