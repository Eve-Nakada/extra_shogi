import { test } from "node:test";
import assert from "node:assert/strict";

import { applyMove } from "../src/core/applyMove.js";
import { getSquare, setSquare } from "../src/core/coordinates.js";
import { isInCheck } from "../src/core/check.js";
import { getLegalMoves } from "../src/core/legalMoveFilter.js";
import { serializeGameRecord, parseGameRecord, restoreGameRecord } from "../src/core/record.js";
import { replayHistory } from "../src/core/replay.js";
import { createInitialState } from "../src/core/state.js";
import { undoLastMove } from "../src/core/undo.js";
import { EXPANDED_SHOGI } from "../src/rulesets/expandedShogi.js";
import { RULESET_BY_ID } from "../src/rulesets/index.js";
import { STANDARD_SHOGI } from "../src/rulesets/standardShogi.js";

function createEmptyState(ruleset = STANDARD_SHOGI) {
  const state = createInitialState(ruleset);
  state.board.squares = state.board.squares.map(() => null);
  state.hands = Object.fromEntries(ruleset.players.map(player => [player, {}]));
  state.history = [];
  state.turn = ruleset.firstTurn ?? ruleset.players[0];
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
  assert.deepEqual(state.history[0].pieceBefore, { owner: "black", id: "P" });
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

test("1手戻すと盤面・手番・履歴が戻る", () => {
  const state = createInitialState(STANDARD_SHOGI);
  const [move] = getLegalMoves(state, { kind: "board", x: 4, y: 6 });
  applyMove(state, move);

  assert.equal(undoLastMove(state), true);
  assert.deepEqual(getSquare(state, 4, 6), { owner: "black", id: "P" });
  assert.equal(getSquare(state, 4, 5), null);
  assert.equal(state.turn, "black");
  assert.equal(state.history.length, 0);
});

test("棋譜履歴から任意手数の局面を再生できる", () => {
  const state = createInitialState(STANDARD_SHOGI);
  applyMove(state, getLegalMoves(state, { kind: "board", x: 4, y: 6 })[0]);
  applyMove(state, getLegalMoves(state, { kind: "board", x: 4, y: 2 })[0]);

  const replayed = replayHistory(STANDARD_SHOGI, state.history, 1);

  assert.deepEqual(getSquare(replayed, 4, 5), { owner: "black", id: "P" });
  assert.deepEqual(getSquare(replayed, 4, 2), { owner: "white", id: "P" });
  assert.equal(replayed.turn, "white");
  assert.equal(replayed.history.length, 1);
});

test("JSON保存データを復元できる", () => {
  const state = createInitialState(STANDARD_SHOGI);
  applyMove(state, getLegalMoves(state, { kind: "board", x: 4, y: 6 })[0]);

  const record = parseGameRecord(serializeGameRecord(state));
  const restored = restoreGameRecord(record, RULESET_BY_ID);

  assert.equal(restored.rulesetId, "standard-shogi");
  assert.deepEqual(getSquare(restored, 4, 5), { owner: "black", id: "P" });
  assert.equal(restored.turn, "white");
  assert.equal(restored.history.length, 1);
});

test("拡張検証ルールセットは11x11盤面と追加駒を持つ", () => {
  const state = createInitialState(EXPANDED_SHOGI);

  assert.equal(state.board.width, 11);
  assert.equal(state.board.height, 11);
  assert.equal(EXPANDED_SHOGI.pieces.M.display, "麒");
  assert.equal(EXPANDED_SHOGI.pieces.C.promotesTo, "PC");
  assert.equal(getSquare(state, 5, 9)?.id, "M");
});

test("拡張検証ルールセットの追加駒はデータ定義だけで合法手を生成できる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "M", 5, 5);

  const moves = getLegalMoves(state, { kind: "board", x: 5, y: 5 });

  assert.equal(hasMoveTo(moves, 5, 3), true);
  assert.equal(hasMoveTo(moves, 3, 5), true);
  assert.equal(hasMoveTo(moves, 6, 6), true);
});
