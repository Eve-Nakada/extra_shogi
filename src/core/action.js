import { applyMove } from "./applyMove.js";
import { getSquare } from "./coordinates.js";
import { getLegalMoves, isBasicLegal, leavesOwnRoyalInCheck } from "./legalMoveFilter.js";

export function getLegalActions(state, selection, options = {}) {
  if (state.status.type !== "playing") return [];

  const actions = [
    ...getLegalMoves(state, selection, options)
  ];

  if (selection?.kind === "board") {
    actions.push(...getLegalTransformActions(state, selection));
  }

  return actions;
}

export function getLegalTransformActions(state, selection) {
  const piece = getSquare(state, selection.x, selection.y);
  if (!piece || piece.owner !== state.turn) return [];

  const pieceDef = state.ruleset.pieces[piece.id];
  const options = pieceDef?.transformOptions ?? [];
  const actions = [];

  for (const option of options) {
    const toPieceId = typeof option === "string" ? option : option.to;
    const condition = typeof option === "string" ? "ownTurn" : (option.condition ?? "ownTurn");
    if (!toPieceId || toPieceId === piece.id) continue;
    if (!state.ruleset.pieces[toPieceId]) continue;
    if (condition !== "ownTurn") continue;

    const action = {
      kind: "transform",
      from: { x: selection.x, y: selection.y },
      toPieceId
    };

    if (!leavesOwnRoyalInCheck(state, action)) {
      actions.push(action);
    }
  }

  return actions;
}

export function getAvailableTriggeredActions(state, player = state.turn) {
  if (state.status.type !== "playing") return [];

  const actions = [];

  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const sourcePiece = getSquare(state, x, y);
      if (!sourcePiece || sourcePiece.owner !== player) continue;

      const sourceDef = state.ruleset.pieces[sourcePiece.id];
      for (const effect of sourceDef?.effects ?? []) {
        if (effect.kind === "promoteNearby") {
          actions.push(...createPromoteNearbyActions(state, player, { x, y }, effect));
        }
      }
    }
  }

  return actions.filter(action => isBasicLegal(state, action) && !leavesOwnRoyalInCheck(state, action));
}

export function applyAction(state, action, options = {}) {
  return applyMove(state, action, options);
}

function createPromoteNearbyActions(state, player, source, effect) {
  const radius = Math.max(1, Number(effect.radius ?? 1));
  const targetMode = effect.target ?? "ownPieces";
  const actions = [];

  for (let y = source.y - radius; y <= source.y + radius; y += 1) {
    for (let x = source.x - radius; x <= source.x + radius; x += 1) {
      if (x === source.x && y === source.y) continue;
      if (x < 0 || y < 0 || x >= state.board.width || y >= state.board.height) continue;

      const targetPiece = getSquare(state, x, y);
      if (!targetPiece) continue;
      if (targetMode === "ownPieces" && targetPiece.owner !== player) continue;
      if (targetMode === "enemyPieces" && targetPiece.owner === player) continue;

      const targetDef = state.ruleset.pieces[targetPiece.id];
      if (!targetDef?.promotesTo) continue;
      if (!state.ruleset.pieces[targetDef.promotesTo]) continue;

      actions.push({
        kind: "triggerEffect",
        effectKind: "promoteNearby",
        source: { ...source },
        target: { x, y },
        promoteTo: targetDef.promotesTo
      });
    }
  }

  return actions;
}
