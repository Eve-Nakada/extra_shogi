import { getSquare } from "../core/coordinates.js";

export function renderBoard(boardElement, state, uiState) {
  setBoardCssVariables(boardElement, state);
  boardElement.innerHTML = "";

  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = "square";
      square.dataset.x = String(x);
      square.dataset.y = String(y);
      square.setAttribute("aria-label", createSquareLabel(state, x, y));

      if (isSelectedSquare(uiState, x, y)) {
        square.classList.add("selected");
      }

      const legalMove = findLegalMoveTo(uiState, x, y);
      if (legalMove) {
        square.classList.add("legal");
        if (getSquare(state, x, y)) {
          square.classList.add("capture");
        }
      }

      const piece = getSquare(state, x, y);
      if (piece) {
        square.appendChild(createPieceElement(state, piece));
      }

      boardElement.appendChild(square);
    }
  }
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

function createPieceElement(state, piece) {
  const pieceDef = state.ruleset.pieces[piece.id];
  const element = document.createElement("span");
  element.className = `piece ${piece.owner}`;
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

function createSquareLabel(state, x, y) {
  const piece = getSquare(state, x, y);
  if (!piece) return `${x + 1},${y + 1} 空きマス`;

  const owner = piece.owner === "black" ? "先手" : "後手";
  const pieceDef = state.ruleset.pieces[piece.id];
  return `${x + 1},${y + 1} ${owner} ${pieceDef?.name ?? piece.id}`;
}
