import { test } from "node:test";
import assert from "node:assert/strict";

import { applyMove } from "../src/core/applyMove.js";
import { getSquare, setSquare } from "../src/core/coordinates.js";
import { isInCheck } from "../src/core/check.js";
import { getLegalMoves } from "../src/core/legalMoveFilter.js";
import { createInitialState } from "../src/core/state.js";
import { STANDARD_SHOGI } from "../src/rulesets/standardShogi.js";

function createEmptyState() {
  const state = createInitialState(STANDARD_SHOGI);
  state.board.squares = state.board.squares.map(() => null);
  state.hands = { black: {}, white: {} };
  state.history = [];
  state.turn = "black";
  state.status = { type: "playing", winner: null, reason: null };
  return state;
}

function put(state, owner, id, x, y) {
  setSquare(state, x, y, { owner, id });
}

function hasMoveTo(moves, x, y, promoteTo = null) {
  return moves.some(move => (
    move.to.x === x &&
    move.to.y === y &&
    (move.promoteTo ?? null) === promoteTo
  ));
}

test("初期局面で先手の歩は1マス前へだけ進める", () => {
  const state = createInitialState(STANDARD_SHOGI);
  const moves = getLegalMoves(state, { kind: "board", x: 4, y: 6 });

  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], {
    kind: "move",
    from: { x: 4, y: 6 },
    to: { x: 4, y: 5 },
    promoteTo: null
  });
});

test("手番ではない駒は合法手を持たない", () => {
  const state = createInitialState(STANDARD_SHOGI);
  const moves = getLegalMoves(state, { kind: "board", x: 4, y: 2 });

  assert.deepEqual(moves, []);
});

test("指し手を適用すると盤面・手番・履歴が更新される", () => {
  const state = createInitialState(STANDARD_SHOGI);
  const [move] = getLegalMoves(state, { kind: "board", x: 4, y: 6 });

  applyMove(state, move);

  assert.equal(getSquare(state, 4, 6), null);
  assert.deepEqual(getSquare(state, 4, 5), { owner: "black", id: "P" });
  assert.equal(state.turn, "white");
  assert.equal(state.history.length, 1);
});

test("取った駒は持ち駒に入る", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 8);
  put(state, "white", "K", 4, 0);
  put(state, "black", "P", 4, 4);
  put(state, "white", "P", 4, 3);

  const [capture] = getLegalMoves(state, { kind: "board", x: 4, y: 4 });
  applyMove(state, capture);

  assert.deepEqual(getSquare(state, 4, 3), { owner: "black", id: "P" });
  assert.equal(state.hands.black.P, 1);
});

test("二歩になる歩打ちは生成されない", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 8);
  put(state, "white", "K", 4, 0);
  put(state, "black", "P", 4, 4);
  state.hands.black.P = 1;

  const drops = getLegalMoves(state, { kind: "hand", owner: "black", pieceId: "P" });

  assert.equal(drops.some(move => move.to.x === 4), false);
  assert.equal(drops.some(move => move.to.x === 3 && move.to.y === 5), true);
});

test("成れる位置では通常手と成り手の両方が生成される", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 8);
  put(state, "white", "K", 4, 0);
  put(state, "black", "P", 0, 2);

  const moves = getLegalMoves(state, { kind: "board", x: 0, y: 2 });

  assert.equal(hasMoveTo(moves, 0, 1, null), true);
  assert.equal(hasMoveTo(moves, 0, 1, "TO"), true);
});

test("王手を放置する無関係な手は生成されない", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 8);
  put(state, "black", "G", 0, 8);
  put(state, "white", "K", 8, 0);
  put(state, "white", "R", 4, 0);

  assert.equal(isInCheck(state, "black"), true);
  assert.deepEqual(getLegalMoves(state, { kind: "board", x: 0, y: 8 }), []);
});
