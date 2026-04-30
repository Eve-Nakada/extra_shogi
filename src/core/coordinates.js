 
export function toIndex(x, y, width) {
  return y * width + x;
}

export function fromIndex(index, width) {
  return {
    x: index % width,
    y: Math.floor(index / width)
  };
}

export function inBoard(x, y, board) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < board.width &&
    y < board.height
  );
}

export function getSquare(state, x, y) {
  if (!inBoard(x, y, state.board)) return null;
  return state.board.squares[toIndex(x, y, state.board.width)];
}

export function setSquare(state, x, y, piece) {
  if (!inBoard(x, y, state.board)) {
    throw new Error(`盤外の座標です: (${x}, ${y})`);
  }
  state.board.squares[toIndex(x, y, state.board.width)] = piece;
}

export function sameSquare(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}
 
 
