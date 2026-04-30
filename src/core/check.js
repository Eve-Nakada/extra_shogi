import { canCapture } from "./capture.js";
import { fromIndex, getSquare, inBoard } from "./coordinates.js";
import { hasBaseAt } from "./base.js";
import { resolveDelta } from "./moveGenerator.js";

export function findRoyal(state, player) {
  for (let index = 0; index < state.board.squares.length; index += 1) {
    const piece = state.board.squares[index];
    if (!piece || piece.owner !== player) continue;

    const pieceDef = state.ruleset.pieces[piece.id];
    if (pieceDef?.royal) {
      return {
        ...fromIndex(index, state.board.width),
        piece
      };
    }
  }

  return null;
}

export function isInCheck(state, player) {
  const royal = findRoyal(state, player);
  if (!royal) return false;

  const opponents = state.ruleset.players.filter(candidate => candidate !== player);
  return opponents.some(opponent => isSquareAttacked(state, royal.x, royal.y, opponent));
}

export function isSquareAttacked(state, x, y, byPlayer) {
  const defender = getSquare(state, x, y);

  for (let index = 0; index < state.board.squares.length; index += 1) {
    const piece = state.board.squares[index];
    if (!piece || piece.owner !== byPlayer) continue;

    const from = fromIndex(index, state.board.width);
    if (!pieceAttacksSquare(state, piece, from, { x, y })) continue;

    if (defender && defender.owner !== byPlayer && !canCapture(state, piece, defender, {
      attackerSquare: from,
      defenderSquare: { x, y }
    })) {
      continue;
    }

    return true;
  }

  return false;
}

export function pieceAttacksSquare(state, piece, from, target) {
  const pieceDef = state.ruleset.pieces[piece.id];
  if (!pieceDef) return false;

  for (const moveDef of pieceDef.moves) {
    const delta = resolveDelta(moveDef, piece.owner);

    if (moveDef.kind === "step" || moveDef.kind === "jump") {
      if (from.x + delta.dx === target.x && from.y + delta.dy === target.y) {
        return true;
      }
      continue;
    }

    if (moveDef.kind === "slide") {
      let x = from.x + delta.dx;
      let y = from.y + delta.dy;

      while (inBoard(x, y, state.board)) {
        if (x === target.x && y === target.y) {
          return true;
        }

        if (getSquare(state, x, y) || hasBaseAt(state, x, y)) {
          break;
        }

        x += delta.dx;
        y += delta.dy;
      }
    }
  }

  return false;
}
