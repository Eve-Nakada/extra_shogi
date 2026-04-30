 
import { test } from "node:test";
import assert from "node:assert/strict";

import { applyMove } from "../src/core/applyMove.js";
import { getSquare, setSquare } from "../src/core/coordinates.js";
import { isInCheck } from "../src/core/check.js";
import { getLegalMoves } from "../src/core/legalMoveFilter.js";
import { serializeGameRecord, parseGameRecord, restoreGameRecord, createGameRecord } from "../src/core/record.js";
import { replayHistory } from "../src/core/replay.js";
import { createInitialState } from "../src/core/state.js";
import { undoLastMove } from "../src/core/undo.js";
import { applyIncomingMove, createMoveMessage, sameMove, createSyncRequestMessage, createPingMessage, createPongMessage, isCompatibleProtocol } from "../src/net/gameSync.js";
import { parseSignal, summarizeSignal, canAcceptSignalForCurrentSession } from "../src/net/rtcSession.js";
import { EXPANDED_SHOGI } from "../src/rulesets/expandedShogi.js";
import { RULESET_BY_ID } from "../src/rulesets/index.js";
import { STANDARD_SHOGI } from "../src/rulesets/standardShogi.js";
import { createKifLikeGameRecord, createTextGameRecord } from "../src/core/notation.js";
import { normalizeGameMeta } from "../src/core/meta.js";
import { createConnectionLog, addConnectionLog, summarizeMessage, createSnapshotText } from "../src/net/connectionLog.js";

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


test("通信メッセージとして作成した指し手を相手局面へ反映できる", () => {
  const sender = createInitialState(STANDARD_SHOGI);
  const receiver = createInitialState(STANDARD_SHOGI);
  const [move] = getLegalMoves(sender, { kind: "board", x: 4, y: 6 });

  applyMove(sender, move);
  const message = createMoveMessage(sender);
  const result = applyIncomingMove(receiver, message);

  assert.equal(message.type, "move");
  assert.equal(message.seq, 1);
  assert.equal(result.ok, true);
  assert.deepEqual(getSquare(receiver, 4, 5), { owner: "black", id: "P" });
  assert.equal(receiver.turn, "white");
  assert.equal(receiver.history.length, 1);
});

test("通信指し手の手数がずれている場合は反映しない", () => {
  const sender = createInitialState(STANDARD_SHOGI);
  const receiver = createInitialState(STANDARD_SHOGI);
  const [move] = getLegalMoves(sender, { kind: "board", x: 4, y: 6 });

  applyMove(sender, move);
  const message = createMoveMessage(sender);
  message.seq = 2;

  const result = applyIncomingMove(receiver, message);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "sequence");
  assert.equal(result.expectedSeq, 1);
  assert.equal(result.actualSeq, 2);
  assert.equal(getSquare(receiver, 4, 5), null);
});

test("通信指し手の比較は通常移動と駒打ちを区別できる", () => {
  assert.equal(sameMove(
    { kind: "move", from: { x: 4, y: 6 }, to: { x: 4, y: 5 }, promoteTo: null },
    { kind: "move", from: { x: 4, y: 6 }, to: { x: 4, y: 5 }, promoteTo: null }
  ), true);

  assert.equal(sameMove(
    { kind: "drop", pieceId: "P", to: { x: 4, y: 4 } },
    { kind: "drop", pieceId: "P", to: { x: 4, y: 4 } }
  ), true);

  assert.equal(sameMove(
    { kind: "drop", pieceId: "P", to: { x: 4, y: 4 } },
    { kind: "drop", pieceId: "G", to: { x: 4, y: 4 } }
  ), false);
});

test("WebRTC接続コードを検証して読み込める", () => {
  const signal = {
    app: "shogi-html",
    kind: "webrtc-signal",
    version: 1,
    type: "offer",
    gameId: "game-test",
    description: {
      type: "offer",
      sdp: "v=0\r\n"
    }
  };

  const parsed = parseSignal(JSON.stringify(signal), "offer");

  assert.equal(parsed.type, "offer");
  assert.equal(parsed.gameId, "game-test");
  assert.equal(parsed.description.type, "offer");
});

import { createClock, startClock, switchClockAfterMove, getDisplayRemainingMs, pauseClock } from "../src/core/clock.js";
import { createClockMessage, applyIncomingClock } from "../src/net/gameSync.js";

test("持ち時間は手番側の経過時間を差し引き、指し手後に相手へ切り替わる", () => {
  const state = createInitialState(STANDARD_SHOGI);
  state.clock = createClock({ enabled: true, initialMs: 60000, incrementMs: 1000 }, state.ruleset.players);
  startClock(state.clock, "black", 1000);

  assert.equal(getDisplayRemainingMs(state.clock, "black", 11000), 50000);

  switchClockAfterMove(state.clock, "black", state.ruleset, 11000);

  assert.equal(state.clock.activePlayer, "white");
  assert.equal(state.clock.remainingMs.black, 51000);
  assert.equal(state.clock.running, true);
});

test("時計メッセージは同じ手数の局面へ反映できる", () => {
  const source = createInitialState(STANDARD_SHOGI);
  source.clock = createClock({ enabled: true, initialMs: 30000, incrementMs: 0 }, source.ruleset.players);
  startClock(source.clock, "black", 1000);
  pauseClock(source.clock, 6000);

  const target = createInitialState(STANDARD_SHOGI);
  const result = applyIncomingClock(target, createClockMessage(source));

  assert.equal(result.ok, true);
  assert.equal(target.clock.remainingMs.black, 25000);
  assert.equal(target.clock.running, false);
});

test("観戦用接続コードはroleHintを含む形式として検証できる", () => {
  const signal = JSON.stringify({
    app: "shogi-html",
    kind: "webrtc-signal",
    version: 2,
    type: "reconnect-offer",
    gameId: "game-v06",
    reconnectToken: "token-v06",
    roleHint: "host",
    description: { type: "offer", sdp: "v=0\r\n" },
    createdAt: "2026-04-28T00:00:00.000Z"
  });

  const parsed = parseSignal(signal, "reconnect-offer");

  assert.equal(parsed.gameId, "game-v06");
  assert.equal(parsed.reconnectToken, "token-v06");
  assert.equal(parsed.roleHint, "host");
});


test("v0.7 通信ログは件数上限を守り、メッセージを要約できる", () => {
  const log = createConnectionLog({ maxEntries: 2 });
  addConnectionLog(log, { direction: "out", type: "sync", text: "first" }, new Date("2026-04-28T00:00:00.000Z"));
  addConnectionLog(log, { direction: "in", type: "move", text: "second" }, new Date("2026-04-28T00:00:01.000Z"));
  addConnectionLog(log, { direction: "local", type: "status", text: "third" }, new Date("2026-04-28T00:00:02.000Z"));

  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[0].text, "second");
  assert.equal(summarizeMessage({ type: "sync-request", seq: 12, reason: "sequence" }), "局面同期要求 #12 (sequence)");
});

test("v0.7 同期要求・ping・pongメッセージを作成できる", () => {
  const state = createInitialState(STANDARD_SHOGI);
  const syncRequest = createSyncRequestMessage(state, "manual");
  const ping = createPingMessage(state);
  const pong = createPongMessage(state, { sentAt: "2026-04-28T00:00:00.000Z" });

  assert.equal(syncRequest.type, "sync-request");
  assert.equal(syncRequest.reason, "manual");
  assert.equal(ping.type, "ping");
  assert.equal(pong.type, "pong");
  assert.equal(pong.pingSentAt, "2026-04-28T00:00:00.000Z");
  assert.equal(isCompatibleProtocol(1), true);
  assert.equal(isCompatibleProtocol(2), true);
  assert.equal(isCompatibleProtocol(3), true);
});

test("v0.7 接続診断テキストと接続コード要約を作れる", () => {
  const signal = JSON.stringify({
    app: "shogi-html",
    kind: "webrtc-signal",
    version: 3,
    type: "reconnect-offer",
    gameId: "game-v07-example",
    reconnectToken: "token-v07",
    roleHint: "host",
    description: { type: "offer", sdp: "v=0\r\n" },
    createdAt: "2026-04-28T00:00:00.000Z"
  });

  assert.equal(summarizeSignal(signal), "reconnect-offer / host / game-v07");
  assert.equal(canAcceptSignalForCurrentSession(signal, { gameId: "game-v07-example" }), true);
  assert.equal(canAcceptSignalForCurrentSession(signal, { gameId: "other-game" }), false);
  assert.equal(createSnapshotText({ status: "connected", connected: true, role: "host", localPlayer: "black", channelState: "open", peerCount: 1 }).includes("dc=open"), true);
});

import { createPositionHash, detectRepetition } from "../src/core/repetition.js";
import { calculateImpasseScore, evaluateImpasse } from "../src/core/impasse.js";
import { declareImpasse, updateGameStatus as updateStatusWithRules } from "../src/core/gameStatus.js";

test("局面ハッシュは手番・盤面・持ち駒を含めて比較できる", () => {
  const a = createInitialState(STANDARD_SHOGI);
  const b = createInitialState(STANDARD_SHOGI);

  assert.equal(createPositionHash(a), createPositionHash(b));

  b.turn = "white";
  assert.notEqual(createPositionHash(a), createPositionHash(b));

  b.turn = "black";
  b.hands.black.P = 1;
  assert.notEqual(createPositionHash(a), createPositionHash(b));
});

test("同一局面が4回出現すると千日手として終了する", () => {
  const state = createInitialState(STANDARD_SHOGI);

  const cycle = [
    { kind: "move", from: { x: 4, y: 6 }, to: { x: 4, y: 5 }, promoteTo: null },
    { kind: "move", from: { x: 4, y: 2 }, to: { x: 4, y: 3 }, promoteTo: null },
    { kind: "move", from: { x: 4, y: 5 }, to: { x: 4, y: 6 }, promoteTo: null },
    { kind: "move", from: { x: 4, y: 3 }, to: { x: 4, y: 2 }, promoteTo: null }
  ];

  for (let i = 0; i < 3; i += 1) {
    for (const move of cycle) {
      applyMove(state, move);
      updateStatusWithRules(state);
    }
  }

  const repetition = detectRepetition(state);
  assert.equal(repetition.repeated, true);
  assert.equal(repetition.type, "sennichite");
  assert.equal(state.status.reason, "sennichite");
  assert.equal(state.status.winner, null);
});
test("持将棋の点数計算は飛角を5点、その他を1点として扱う", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 0);
  put(state, "white", "K", 4, 8);
  put(state, "black", "R", 0, 0);
  put(state, "black", "B", 1, 0);
  state.hands.black.P = 3;

  assert.equal(calculateImpasseScore(state, "black"), 13);
});

test("双方の玉が敵陣に入り24点以上なら持将棋は引き分けになる", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 0);
  put(state, "white", "K", 4, 8);
  state.hands.black.P = 24;
  state.hands.white.P = 24;

  const evaluation = evaluateImpasse(state);
  assert.equal(evaluation.ready, true);
  assert.equal(evaluation.winner, null);

  const status = declareImpasse(state);
  assert.equal(status.type, "ended");
  assert.equal(status.reason, "impasse");
  assert.equal(status.winner, null);
});



test("v0.9 JSON保存データは対局メタ情報を保持して復元できる", () => {
  const state = createInitialState(STANDARD_SHOGI);
  state.meta = normalizeGameMeta({
    title: "テスト対局",
    blackName: "Alice",
    whiteName: "Bob",
    eventName: "v0.9検証",
    location: "Tokyo",
    startedAt: "2026-04-30T00:00:00.000Z",
    notes: "metadata test"
  });

  applyMove(state, getLegalMoves(state, { kind: "board", x: 4, y: 6 })[0]);

  const record = parseGameRecord(serializeGameRecord(state));
  const restored = restoreGameRecord(record, RULESET_BY_ID);

  assert.equal(record.meta.title, "テスト対局");
  assert.equal(record.meta.blackName, "Alice");
  assert.equal(restored.meta.whiteName, "Bob");
  assert.equal(restored.meta.eventName, "v0.9検証");
});

test("v0.9 棋譜テキスト出力はメタ情報と指し手を含む", () => {
  const state = createInitialState(STANDARD_SHOGI);
  state.meta = normalizeGameMeta({
    title: "棋譜出力テスト",
    blackName: "先手太郎",
    whiteName: "後手花子",
    startedAt: "2026-04-30T00:00:00.000Z"
  });
  applyMove(state, getLegalMoves(state, { kind: "board", x: 4, y: 6 })[0]);

  const text = createTextGameRecord(state);
  const kif = createKifLikeGameRecord(state);

  assert.equal(text.includes("表題：棋譜出力テスト"), true);
  assert.equal(text.includes("先手太郎"), true);
  assert.equal(text.includes("後手花子"), true);
  assert.equal(kif.includes("#KIF version=shogi-html-v1"), true);
  assert.equal(kif.includes("先手：先手太郎"), true);
  assert.equal(kif.includes("   1 "), true);
});

test("v0.9 createGameRecordは局面診断とメタ情報を同時に出力する", () => {
  const state = createInitialState(STANDARD_SHOGI);
  state.meta = normalizeGameMeta({ title: "診断つき保存" });
  const record = createGameRecord(state);

  assert.equal(record.meta.title, "診断つき保存");
  assert.equal(typeof record.positionHash, "string");
  assert.equal(record.repetition.repeated, false);
  assert.equal(typeof record.impasse.ready, "boolean");
});

import { normalizeViewPreferences, loadViewPreferences, saveViewPreferences, VIEW_PREFERENCES_KEY } from "../src/ui/viewPreferences.js";

test("v1.4 表示設定は正規化して保存・復元できる", () => {
  const storage = new Map();
  const adapter = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value)
  };

  const preferences = normalizeViewPreferences({
    perspective: "white",
    showLegalMoves: false,
    confirmResign: false,
    confirmReset: true
  });

  saveViewPreferences(preferences, adapter);
  const restored = loadViewPreferences(adapter);

  assert.equal(storage.has(VIEW_PREFERENCES_KEY), true);
  assert.deepEqual(restored, {
    perspective: "white",
    showLegalMoves: false,
    confirmResign: false,
    confirmReset: true
  });
});

test("v1.4 表示設定は不正値を安全な初期値へ寄せる", () => {
  const normalized = normalizeViewPreferences({
    perspective: "sideways",
    showLegalMoves: "yes",
    confirmResign: null,
    confirmReset: undefined
  });

  assert.deepEqual(normalized, {
    perspective: "black",
    showLegalMoves: true,
    confirmResign: true,
    confirmReset: true
  });
});
 
 

test("v1.5 標準駒定義は説明・分類・点数・属性を持つ", () => {
  for (const [pieceId, pieceDef] of Object.entries(STANDARD_SHOGI.pieces)) {
    assert.equal(typeof pieceDef.description, "string", `${pieceId}.description`);
    assert.notEqual(pieceDef.description.length, 0, `${pieceId}.description`);
    assert.equal(typeof pieceDef.category, "string", `${pieceId}.category`);
    assert.equal(typeof pieceDef.point, "number", `${pieceId}.point`);
    assert.equal(Array.isArray(pieceDef.attributes), true, `${pieceId}.attributes`);
  }
});

test("v1.5 金・玉・成駒はgoldLike属性を持つ", () => {
  const goldLikeIds = ["K", "G", "PR", "PB", "PS", "PN", "PL", "TO"];
  for (const pieceId of goldLikeIds) {
    assert.equal(STANDARD_SHOGI.pieces[pieceId].attributes.includes("goldLike"), true, pieceId);
  }
});

test("v1.5 拡張駒定義も説明・分類・点数・属性を持つ", () => {
  for (const [pieceId, pieceDef] of Object.entries(EXPANDED_SHOGI.pieces)) {
    assert.equal(typeof pieceDef.description, "string", `${pieceId}.description`);
    assert.equal(typeof pieceDef.category, "string", `${pieceId}.category`);
    assert.equal(typeof pieceDef.point, "number", `${pieceId}.point`);
    assert.equal(Array.isArray(pieceDef.attributes), true, `${pieceId}.attributes`);
  }
  assert.equal(EXPANDED_SHOGI.pieces.PC.attributes.includes("goldLike"), true);
  assert.equal(EXPANDED_SHOGI.pieces.PW.attributes.includes("goldLike"), true);
});

test("v1.5 持将棋点数は駒定義のpointを参照する", () => {
  const state = createEmptyState();
  put(state, "black", "K", 4, 0);
  put(state, "white", "K", 4, 8);
  put(state, "black", "PR", 0, 0);
  state.hands.black.B = 1;
  state.hands.black.P = 3;

  assert.equal(calculateImpasseScore(state, "black"), STANDARD_SHOGI.pieces.PR.point + STANDARD_SHOGI.pieces.B.point + 3);
});
