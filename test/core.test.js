 
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

import { canCapture } from "../src/core/capture.js";
import { pieceAttacksSquare } from "../src/core/check.js";

test("v1.6 金剛は金属性を持つ駒以外には取られない", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "S", 4, 4);
  put(state, "black", "G", 6, 4);
  put(state, "white", "F", 5, 3);

  const silverMoves = getLegalMoves(state, { kind: "board", x: 4, y: 4 });
  const goldMoves = getLegalMoves(state, { kind: "board", x: 6, y: 4 });

  assert.equal(pieceAttacksSquare(state, { owner: "black", id: "S" }, { x: 4, y: 4 }, { x: 5, y: 3 }), true);
  assert.equal(silverMoves.some(move => move.to.x === 5 && move.to.y === 3), false);
  assert.equal(goldMoves.some(move => move.to.x === 5 && move.to.y === 3), true);
});

test("v1.6 canCaptureはcaptureRulesのrequiredAttackerAttributeを評価する", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  const defender = { owner: "white", id: "F" };

  assert.equal(canCapture(state, { owner: "black", id: "S" }, defender), false);
  assert.equal(canCapture(state, { owner: "black", id: "G" }, defender), true);
  assert.equal(canCapture(state, { owner: "black", id: "TO" }, defender), true);
});

test("v1.6 王手判定は実際に取れる場合だけ王手とする", () => {
  const state = createEmptyState({
    ...EXPANDED_SHOGI,
    pieces: {
      ...EXPANDED_SHOGI.pieces,
      K: {
        ...EXPANDED_SHOGI.pieces.K,
        captureRules: [
          { kind: "requiresAttackerAttribute", attribute: "goldLike" }
        ]
      }
    }
  });

  put(state, "black", "K", 5, 5);
  put(state, "white", "K", 0, 0);
  put(state, "white", "R", 5, 0);

  assert.equal(pieceAttacksSquare(state, { owner: "white", id: "R" }, { x: 5, y: 0 }, { x: 5, y: 5 }), true);
  assert.equal(isInCheck(state, "black"), false);

  setSquare(state, 5, 0, { owner: "white", id: "PR" });
  assert.equal(isInCheck(state, "black"), true);
});


import { applyAction, getAvailableTriggeredActions, getLegalActions } from "../src/core/action.js";

test("v1.7 2段階成りはpromotesToの連鎖で生成できる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "PA", 0, 2);

  const moves = getLegalMoves(state, { kind: "board", x: 0, y: 2 });

  assert.equal(hasMoveTo(moves, 0, 1, null), true);
  assert.equal(hasMoveTo(moves, 0, 1, "PPA"), true);
});

test("v1.7 transform actionでその場変身できる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "X", 4, 8);

  const actions = getLegalActions(state, { kind: "board", x: 4, y: 8 });
  const transform = actions.find(action => action.kind === "transform" && action.toPieceId === "Y");

  assert.ok(transform);
  applyAction(state, transform);
  assert.deepEqual(getSquare(state, 4, 8), { owner: "black", id: "Y" });
  assert.equal(state.turn, "white");
  assert.equal(state.history.at(-1).move.kind, "transform");
});

test("v1.7 promoteNearbyのtriggered actionで周囲の駒を成らせる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "U", 4, 8);
  put(state, "black", "A", 5, 8);

  const actions = getAvailableTriggeredActions(state, "black");
  const promote = actions.find(action => action.kind === "triggerEffect" && action.target.x === 5 && action.target.y === 8);

  assert.ok(promote);
  applyAction(state, promote);
  assert.deepEqual(getSquare(state, 5, 8), { owner: "black", id: "PA" });
  assert.equal(state.turn, "white");
});

test("v1.8 追撃駒は捕獲後に同じ駒だけ追加行動できる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "Q", 4, 4);
  put(state, "black", "P", 0, 7);
  put(state, "white", "P", 5, 3);

  const capture = getLegalActions(state, { kind: "board", x: 4, y: 4 })
    .find(action => action.kind === "move" && action.to.x === 5 && action.to.y === 3);

  assert.ok(capture);
  applyAction(state, capture);

  assert.equal(state.turn, "black");
  assert.equal(state.turnState.phase, "extraAction");
  assert.deepEqual(state.turnState.forcedPiece, { x: 5, y: 3 });
  assert.deepEqual(getLegalMoves(state, { kind: "board", x: 0, y: 7 }), []);

  const extraMove = getLegalMoves(state, { kind: "board", x: 5, y: 3 })
    .find(action => action.to.x === 5 && action.to.y === 2);
  assert.ok(extraMove);
  applyAction(state, extraMove);

  assert.equal(state.turn, "white");
  assert.equal(state.turnState.phase, "normal");
  assert.deepEqual(getSquare(state, 5, 2), { owner: "black", id: "Q" });
});

test("v1.8 二動駒はcompound actionで1手内に2回動ける", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "D", 4, 8);

  const compound = getLegalActions(state, { kind: "board", x: 4, y: 8 })
    .find(action => action.kind === "compound" &&
      action.actions[0].to.x === 4 && action.actions[0].to.y === 7 &&
      action.actions[1].to.x === 4 && action.actions[1].to.y === 6);

  assert.ok(compound);
  applyAction(state, compound);

  assert.equal(state.turn, "white");
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].move.kind, "compound");
  assert.equal(state.history[0].subEntries.length, 2);
  assert.deepEqual(getSquare(state, 4, 6), { owner: "black", id: "D" });
});

test("v1.8 compound actionは通信比較できる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "D", 4, 8);

  const compound = getLegalActions(state, { kind: "board", x: 4, y: 8 })
    .find(action => action.kind === "compound" &&
      action.actions[0].to.x === 4 && action.actions[0].to.y === 7 &&
      action.actions[1].to.x === 4 && action.actions[1].to.y === 6);

  assert.ok(compound);
  assert.equal(sameMove(compound, {
    kind: "compound",
    actions: [
      { kind: "move", from: { x: 4, y: 8 }, to: { x: 4, y: 7 }, promoteTo: null },
      { kind: "move", from: { x: 4, y: 7 }, to: { x: 4, y: 6 }, promoteTo: null }
    ]
  }), true);
});

test("v1.9 築城駒はbuildBase actionで御城を建てられる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  put(state, "black", "T", 4, 8);

  const build = getLegalActions(state, { kind: "board", x: 4, y: 8 })
    .find(action => action.kind === "buildBase" && action.baseType === "castle" && action.to.x === 4 && action.to.y === 7);

  assert.ok(build);
  applyAction(state, build);

  assert.equal(state.turn, "white");
  assert.equal(state.bases.length, 1);
  assert.equal(state.bases[0].kind, "castle");
  assert.equal(state.bases[0].owner, "black");
  assert.equal(state.history.at(-1).move.kind, "buildBase");
  assert.equal(state.history.at(-1).builtBase.kind, "castle");
});

test("v1.9 拠点がある場合は自拠点周囲にだけ駒を打てる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  state.hands.black.P = 1;
  state.bases.push({
    id: "black-castle-test",
    owner: "black",
    kind: "castle",
    x: 4,
    y: 8,
    layer: "ground",
    hp: null,
    providesDropZone: true,
    dropRadius: 1
  });

  const drops = getLegalMoves(state, { kind: "hand", owner: "black", pieceId: "P" });

  assert.equal(drops.some(move => move.to.x === 3 && move.to.y === 8), true);
  assert.equal(drops.some(move => move.to.x === 4 && move.to.y === 8), false);
  assert.equal(drops.some(move => move.to.x === 0 && move.to.y === 5), false);
});

test("v1.9 自拠点がない拠点ルールでは初期陣内だけ駒を打てる", () => {
  const state = createEmptyState(EXPANDED_SHOGI);
  put(state, "black", "K", 5, 10);
  put(state, "white", "K", 5, 0);
  state.hands.black.P = 1;

  const drops = getLegalMoves(state, { kind: "hand", owner: "black", pieceId: "P" });

  assert.equal(drops.some(move => move.to.x === 4 && move.to.y === 8), true);
  assert.equal(drops.some(move => move.to.x === 4 && move.to.y === 7), false);
});

test("v1.9 buildBase actionは通信比較できる", () => {
  assert.equal(sameMove(
    { kind: "buildBase", actor: { x: 4, y: 8 }, baseType: "castle", to: { x: 4, y: 7 }, id: null },
    { kind: "buildBase", actor: { x: 4, y: 8 }, baseType: "castle", to: { x: 4, y: 7 }, id: null }
  ), true);
});

import { SETUP_SHOGI } from "../src/rulesets/setupShogi.js";
import { addSetupPiece, applyPlacement, canFinalizeSetupPlayer, finalizeSetupPlayer, generateRandomPacks, getLegalPlacements, getSetupPlayer, isSetupActive, selectFixedPack, selectGeneratedPack } from "../src/core/setup.js";

test("v2.0 編成検証ルールセットはsetup phaseから開始する", () => {
  const state = createInitialState(SETUP_SHOGI);

  assert.equal(state.phase, "setup");
  assert.equal(isSetupActive(state), true);
  assert.equal(getSetupPlayer(state), "black");
  assert.equal(state.board.squares.every(square => square === null), true);
  assert.deepEqual(getLegalMoves(state, { kind: "board", x: 0, y: 0 }), []);
});

test("v2.0 点数内で駒を選択し配置できる", () => {
  const state = createInitialState(SETUP_SHOGI);

  addSetupPiece(state, "K");
  addSetupPiece(state, "G");

  assert.deepEqual(state.setup.selectedPieces.black, { K: 1, G: 1 });
  assert.equal(getLegalPlacements(state, "K", "black").some(action => action.to.x === 3 && action.to.y === 6), true);

  applyPlacement(state, { kind: "placement", player: "black", pieceId: "K", to: { x: 3, y: 6 } });
  applyPlacement(state, { kind: "placement", player: "black", pieceId: "G", to: { x: 3, y: 5 } });

  assert.deepEqual(getSquare(state, 3, 6), { owner: "black", id: "K" });
  assert.equal(canFinalizeSetupPlayer(state, "black"), true);
});

test("v2.0 固定パックを選び、両者確定後に対局へ入れる", () => {
  const state = createInitialState(SETUP_SHOGI);

  selectFixedPack(state, "balanced", "black");
  for (const pieceId of Object.keys(state.setup.selectedPieces.black)) {
    let remaining = state.setup.selectedPieces.black[pieceId];
    while (remaining > 0) {
      const [placement] = getLegalPlacements(state, pieceId, "black");
      applyPlacement(state, placement);
      remaining -= 1;
    }
  }
  finalizeSetupPlayer(state, "black");

  assert.equal(getSetupPlayer(state), "white");
  selectFixedPack(state, "rush", "white");
  for (const pieceId of Object.keys(state.setup.selectedPieces.white)) {
    let remaining = state.setup.selectedPieces.white[pieceId];
    while (remaining > 0) {
      const [placement] = getLegalPlacements(state, pieceId, "white");
      applyPlacement(state, placement);
      remaining -= 1;
    }
  }
  finalizeSetupPlayer(state, "white");

  assert.equal(state.phase, "playing");
  assert.equal(state.turn, "black");
  assert.equal(isSetupActive(state), false);
});

test("v2.0 ランダムパックはseedで再現でき、選択できる", () => {
  const a = createInitialState(SETUP_SHOGI);
  const b = createInitialState(SETUP_SHOGI);

  const packsA = generateRandomPacks(a, "seed-v20");
  const packsB = generateRandomPacks(b, "seed-v20");

  assert.deepEqual(packsA, packsB);
  selectGeneratedPack(a, packsA[0].id, "black");
  assert.deepEqual(a.setup.selectedPieces.black, packsA[0].pieces);
});
