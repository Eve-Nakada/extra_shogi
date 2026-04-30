 
import { getSquare, inBoard } from "./coordinates.js";

export function generatePseudoMoves(state, selection) {
  if (state.status.type !== "playing") return [];

  if (selection.kind === "board") {
    return generateBoardPseudoMoves(state, selection.x, selection.y);
  }

  if (selection.kind === "hand") {
    return generateDropPseudoMoves(state, selection);
  }

  return [];
}

export function generateBoardPseudoMoves(state, x, y) {
  const piece = getSquare(state, x, y);
  if (!piece || piece.owner !== state.turn) return [];

  const pieceDef = state.ruleset.pieces[piece.id];
  if (!pieceDef) return [];

  const moves = [];

  for (const moveDef of pieceDef.moves) {
    const delta = resolveDelta(moveDef, piece.owner);

    if (moveDef.kind === "slide") {
      let toX = x + delta.dx;
      let toY = y + delta.dy;

      while (inBoard(toX, toY, state.board)) {
        const target = getSquare(state, toX, toY);
        if (target?.owner === piece.owner) break;

        moves.push(...expandPromotionChoices(state, piece, { x, y }, { x: toX, y: toY }));

        if (target && target.owner !== piece.owner) break;
        toX += delta.dx;
        toY += delta.dy;
      }

      continue;
    }

    if (moveDef.kind === "step" || moveDef.kind === "jump") {
      const toX = x + delta.dx;
      const toY = y + delta.dy;
      if (!inBoard(toX, toY, state.board)) continue;

      const target = getSquare(state, toX, toY);
      if (target?.owner === piece.owner) continue;

      moves.push(...expandPromotionChoices(state, piece, { x, y }, { x: toX, y: toY }));
    }
  }

  return moves;
}

export function generateDropPseudoMoves(state, selection) {
  if (selection.owner !== state.turn) return [];
  if ((state.hands[selection.owner][selection.pieceId] ?? 0) <= 0) return [];

  const pieceDef = state.ruleset.pieces[selection.pieceId];
  if (!pieceDef || pieceDef.droppable === false) return [];

  const moves = [];
  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      if (!getSquare(state, x, y)) {
        moves.push({
          kind: "drop",
          pieceId: selection.pieceId,
          to: { x, y }
        });
      }
    }
  }

  return moves;
}

export function expandPromotionChoices(state, piece, from, to) {
  const pieceDef = state.ruleset.pieces[piece.id];
  const base = {
    kind: "move",
    from: { ...from },
    to: { ...to },
    promoteTo: null
  };

  if (!pieceDef?.promotesTo) {
    return [base];
  }

  if (!canPromote(state, piece, from, to)) {
    return [base];
  }

  if (mustPromote(state, piece, to)) {
    return [{ ...base, promoteTo: pieceDef.promotesTo }];
  }

  return [
    base,
    { ...base, promoteTo: pieceDef.promotesTo }
  ];
}

export function canPromote(state, piece, from, to) {
  const pieceDef = state.ruleset.pieces[piece.id];
  if (!pieceDef?.promotesTo) return false;

  return (
    isPromotionZone(state, piece.owner, from.y) ||
    isPromotionZone(state, piece.owner, to.y)
  );
}

export function mustPromote(state, piece, to) {
  const pieceDef = state.ruleset.pieces[piece.id];
  if (!pieceDef?.mustPromote) return false;

  if (pieceDef.mustPromote === "lastRank") {
    return isLastRank(state, piece.owner, to.y);
  }

  if (pieceDef.mustPromote === "lastTwoRanks") {
    return isLastTwoRanks(state, piece.owner, to.y);
  }

  return false;
}

export function isPromotionZone(state, owner, y) {
  const depth = state.ruleset.promotion?.depth ?? 0;
  if (depth <= 0) return false;

  if (owner === "black") {
    return y < depth;
  }

  return y >= state.board.height - depth;
}

export function isLastRank(state, owner, y) {
  return owner === "black" ? y === 0 : y === state.board.height - 1;
}

export function isLastTwoRanks(state, owner, y) {
  return owner === "black" ? y <= 1 : y >= state.board.height - 2;
}

export function forwardOf(owner) {
  return owner === "black" ? -1 : 1;
}

export function resolveDelta(moveDef, owner) {
  const dx = moveDef.dx ?? 0;
  const dy = Object.hasOwn(moveDef, "fy")
    ? moveDef.fy * forwardOf(owner)
    : (moveDef.dy ?? 0);

  return { dx, dy };
}
 
 
