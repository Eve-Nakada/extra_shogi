 
import { findRoyal, isInCheck } from "../core/check.js";
import { getSquare } from "../core/coordinates.js";
import { findBaseAt } from "../core/base.js";

export function renderBoard(boardElement, state, uiState) {
  setBoardCssVariables(boardElement, state);
  boardElement.innerHTML = "";

  const perspective = uiState.view?.perspective ?? "black";
  boardElement.classList.toggle("view-black", perspective === "black");
  boardElement.classList.toggle("view-white", perspective === "white");

  const lastMove = getLastMove(state);
  const checkedRoyal = getCheckedRoyal(state);

  for (const y of displayRange(state.board.height, perspective)) {
    for (const x of displayRange(state.board.width, perspective)) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = "square";
      square.dataset.x = String(x);
      square.dataset.y = String(y);
      square.setAttribute("aria-label", createSquareLabel(state, x, y));

      if (isSelectedSquare(uiState, x, y)) {
        square.classList.add("selected");
      }

      if (uiState.view?.showLegalMoves !== false) {
        const legalMove = findLegalMoveTo(uiState, x, y);
        const setupPlacement = findSetupPlacementTo(uiState, x, y);
        if (isSetupZoneSquare(state, uiState, x, y)) {
          square.classList.add("setup-zone");
        }
        if (setupPlacement) {
          square.classList.add("legal", "setup-placement");
        }
        if (legalMove) {
          square.classList.add("legal");
          if (getSquare(state, x, y)) {
            square.classList.add("capture");
          }
        }
      }

      if (sameSquare(lastMove?.from, { x, y })) square.classList.add("last-move-from");
      if (sameSquare(lastMove?.to, { x, y })) square.classList.add("last-move-to");
      if (sameSquare(checkedRoyal, { x, y })) square.classList.add("royal-in-check");

      const base = findBaseAt(state, x, y);
      if (base) {
        square.classList.add("base-square");
        square.appendChild(createBaseElement(state, base));
      }

      const piece = getSquare(state, x, y);
      if (piece?.owner === state.turn && state.status.type === "playing") {
        square.classList.add("active-turn-piece-square");
      }
      if (piece) {
        square.appendChild(createPieceElement(state, piece, perspective));
      }

      boardElement.appendChild(square);
    }
  }
}

function displayRange(length, perspective) {
  const values = Array.from({ length }, (_, index) => index);
  return perspective === "white" ? values.reverse() : values;
}

function setBoardCssVariables(boardElement, state) {
  const targets = [
    boardElement,
    boardElement.closest(".game-panel"),
    boardElement.closest(".layout"),
    boardElement.closest("#app")
  ].filter(Boolean);

  for (const target of targets) {
    target.style.setProperty("--board-width", state.board.width);
    target.style.setProperty("--board-height", state.board.height);
  }
}

function createBaseElement(state, base) {
  const baseDef = state.ruleset.baseDefs?.[base.kind] ?? state.ruleset.bases?.[base.kind];
  const element = document.createElement("span");
  element.className = `base-marker ${base.owner}`;
  element.textContent = baseDef?.display ?? base.kind;
  element.title = `${base.owner === "black" ? "先手" : "後手"} ${baseDef?.name ?? base.kind}`;
  return element;
}

function createPieceElement(state, piece, perspective) {
  const pieceDef = state.ruleset.pieces[piece.id];
  const element = document.createElement("span");
  element.className = `piece ${piece.owner}`;
  if (perspective === "white") element.classList.add("viewer-white");
  if (piece.owner === state.turn && state.status.type === "playing") {
    element.classList.add("active-turn-piece");
  }
  if (pieceDef?.promoted) element.classList.add("promoted");
  element.textContent = pieceDef?.display ?? piece.id;
  element.title = pieceDef?.name ?? piece.id;
  return element;
}

function isSelectedSquare(uiState, x, y) {
  return (
    uiState.selected?.kind === "board" &&
    uiState.selected.x === x &&
    uiState.selected.y === y
  );
}

function findLegalMoveTo(uiState, x, y) {
  return uiState.legalMoves.find(move => move.to.x === x && move.to.y === y);
}

function getLastMove(state) {
  const entry = state.history.at(-1);
  if (!entry?.move) return null;

  if (entry.move.kind === "move") {
    return { from: entry.move.from, to: entry.move.to };
  }

  if (entry.move.kind === "drop") {
    return { from: null, to: entry.move.to };
  }

  if (entry.move.kind === "transform") {
    return { from: null, to: entry.move.from };
  }

  if (entry.move.kind === "triggerEffect") {
    return { from: entry.move.source, to: entry.move.target };
  }

  if (entry.move.kind === "compound") {
    const first = entry.move.actions?.[0];
    const last = entry.move.actions?.at(-1);
    return { from: first?.from ?? null, to: last?.to ?? last?.from ?? null };
  }

  if (entry.move.kind === "buildBase") {
    return { from: entry.move.actor, to: entry.move.to };
  }

  return null;
}

function getCheckedRoyal(state) {
  if (state.status.type !== "playing") return null;
  if (!isInCheck(state, state.turn)) return null;
  const royal = findRoyal(state, state.turn);
  return royal ? { x: royal.x, y: royal.y } : null;
}

function sameSquare(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function createSquareLabel(state, x, y) {
  const base = findBaseAt(state, x, y);
  const piece = getSquare(state, x, y);
  if (!piece && !base) return `${x + 1},${y + 1} 空きマス`;
  if (!piece && base) {
    const baseDef = state.ruleset.baseDefs?.[base.kind] ?? state.ruleset.bases?.[base.kind];
    return `${x + 1},${y + 1} ${base.owner === "black" ? "先手" : "後手"} ${baseDef?.name ?? base.kind}`;
  }

  const owner = piece.owner === "black" ? "先手" : "後手";
  const pieceDef = state.ruleset.pieces[piece.id];
  return `${x + 1},${y + 1} ${owner} ${pieceDef?.name ?? piece.id}`;
}
 
 

function findSetupPlacementTo(uiState, x, y) {
  return (uiState.setupPlacements ?? []).find(action => action.to.x === x && action.to.y === y);
}


function isSetupZoneSquare(state, uiState, x, y) {
  if (state.phase !== "setup" || !state.setup) return false;
  const player = uiState.setupPlayer ?? state.setup.currentPlayer ?? state.turn;
  const zone = state.ruleset.setup?.placementZones?.[player];
  if (!zone) return false;
  if (zone.xMin != null && x < zone.xMin) return false;
  if (zone.xMax != null && x > zone.xMax) return false;
  if (zone.yMin != null && y < zone.yMin) return false;
  if (zone.yMax != null && y > zone.yMax) return false;
  return true;
}
