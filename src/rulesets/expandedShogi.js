 
import { STANDARD_SHOGI } from "./standardShogi.js";

const KING_MOVES = STANDARD_SHOGI.pieces.K.moves;
const GOLD_MOVES = STANDARD_SHOGI.pieces.G.moves;

const KIRIN_MOVES = [
  ...KING_MOVES,
  { kind: "jump", dx: 0, dy: -2 },
  { kind: "jump", dx: 0, dy: 2 },
  { kind: "jump", dx: -2, dy: 0 },
  { kind: "jump", dx: 2, dy: 0 }
];

const COPPER_MOVES = [
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: 1, fy: 1 },
  { kind: "step", dx: 0, fy: -1 }
];

const SOLDIER_MOVES = [
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: -1, fy: 0 },
  { kind: "step", dx: 1, fy: 0 }
];

const STRONG_SOLDIER_MOVES = [
  ...SOLDIER_MOVES,
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 1, fy: 1 }
];

const MAGE_MOVES = [
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: 1, fy: 1 },
  { kind: "step", dx: 0, fy: -1 }
];

const RUNNER_MOVES = [
  { kind: "slide", dx: 0, fy: 1 },
  { kind: "step", dx: -1, fy: 0 },
  { kind: "step", dx: 1, fy: 0 }
];

function createExpandedInitialPieces() {
  const pieces = [
    { owner: "white", id: "L", x: 0, y: 0 },
    { owner: "white", id: "N", x: 1, y: 0 },
    { owner: "white", id: "S", x: 2, y: 0 },
    { owner: "white", id: "G", x: 3, y: 0 },
    { owner: "white", id: "C", x: 4, y: 0 },
    { owner: "white", id: "K", x: 5, y: 0 },
    { owner: "white", id: "C", x: 6, y: 0 },
    { owner: "white", id: "G", x: 7, y: 0 },
    { owner: "white", id: "S", x: 8, y: 0 },
    { owner: "white", id: "N", x: 9, y: 0 },
    { owner: "white", id: "L", x: 10, y: 0 },

    { owner: "white", id: "R", x: 1, y: 1 },
    { owner: "white", id: "M", x: 5, y: 1 },
    { owner: "white", id: "B", x: 9, y: 1 },
    { owner: "white", id: "W", x: 0, y: 2 },
    { owner: "white", id: "F", x: 5, y: 2 },
    { owner: "white", id: "U", x: 6, y: 2 },
    { owner: "white", id: "X", x: 8, y: 2 },
    { owner: "white", id: "W", x: 10, y: 2 },

    { owner: "black", id: "W", x: 0, y: 8 },
    { owner: "black", id: "F", x: 5, y: 8 },
    { owner: "black", id: "U", x: 6, y: 8 },
    { owner: "black", id: "X", x: 8, y: 8 },
    { owner: "black", id: "W", x: 10, y: 8 },
    { owner: "black", id: "B", x: 1, y: 9 },
    { owner: "black", id: "M", x: 5, y: 9 },
    { owner: "black", id: "R", x: 9, y: 9 },

    { owner: "black", id: "L", x: 0, y: 10 },
    { owner: "black", id: "N", x: 1, y: 10 },
    { owner: "black", id: "S", x: 2, y: 10 },
    { owner: "black", id: "G", x: 3, y: 10 },
    { owner: "black", id: "C", x: 4, y: 10 },
    { owner: "black", id: "K", x: 5, y: 10 },
    { owner: "black", id: "C", x: 6, y: 10 },
    { owner: "black", id: "G", x: 7, y: 10 },
    { owner: "black", id: "S", x: 8, y: 10 },
    { owner: "black", id: "N", x: 9, y: 10 },
    { owner: "black", id: "L", x: 10, y: 10 }
  ];

  for (let x = 0; x < 11; x += 1) {
    pieces.push({ owner: "white", id: x === 5 ? "A" : "P", x, y: 3 });
    pieces.push({ owner: "black", id: x === 5 ? "A" : "P", x, y: 7 });
  }

  return pieces;
}

export const EXPANDED_SHOGI = {
  ...STANDARD_SHOGI,
  id: "expanded-shogi-11x11",
  name: "拡張検証将棋 11x11",

  board: {
    width: 11,
    height: 11
  },

  handOrder: ["R", "B", "M", "F", "U", "X", "Y", "Z", "A", "C", "W", "G", "S", "N", "L", "P"],

  pieces: {
    ...STANDARD_SHOGI.pieces,

    M: {
      name: "麒麟",
      display: "麒",
      description: "玉の8方向1マスに加え、縦横2マスへ跳べる拡張駒。",
      category: "special",
      point: 3,
      attributes: [],
      droppable: true,
      capturedAs: "M",
      moves: KIRIN_MOVES
    },

    C: {
      name: "銅将",
      display: "銅",
      description: "前3方向と真後ろへ1マス動ける小駒。成ると成銅になる。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "C",
      promotesTo: "PC",
      moves: COPPER_MOVES
    },

    PC: {
      name: "成銅",
      display: "銅+",
      description: "銅将が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "C",
      moves: GOLD_MOVES
    },

    F: {
      name: "金剛",
      display: "剛",
      description: "金属性を持つ駒以外には取られない特殊駒。捕獲制限の検証に使う。",
      category: "special",
      point: 4,
      attributes: ["fortified"],
      captureRules: [
        { kind: "requiresAttackerAttribute", attribute: "goldLike" }
      ],
      droppable: true,
      capturedAs: "F",
      moves: KING_MOVES
    },

    A: {
      name: "兵",
      display: "兵",
      description: "2段階成り検証用の小駒。成ると精兵、さらに英雄へ成れる。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "A",
      promotesTo: "PA",
      moves: SOLDIER_MOVES
    },

    PA: {
      name: "精兵",
      display: "精",
      description: "兵が1段階成った駒。さらに英雄へ成れる。",
      category: "promoted",
      point: 2,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "A",
      promotesTo: "PPA",
      moves: STRONG_SOLDIER_MOVES
    },

    PPA: {
      name: "英雄",
      display: "英",
      description: "兵の2段階目の成駒。取られると兵に戻る。",
      category: "promoted",
      point: 3,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "A",
      moves: GOLD_MOVES
    },

    X: {
      name: "変化駒",
      display: "変",
      description: "手番中に攻撃形態または守備形態へその場変身できる検証駒。",
      category: "special",
      point: 3,
      attributes: ["canTransform"],
      transformOptions: [
        { to: "Y", condition: "ownTurn" },
        { to: "Z", condition: "ownTurn" }
      ],
      droppable: true,
      capturedAs: "X",
      moves: KING_MOVES
    },

    Y: {
      name: "攻変",
      display: "攻",
      description: "変化駒の攻撃形態。縦横へ走れるが、再び変化駒へ戻れる。",
      category: "special",
      point: 3,
      attributes: ["canTransform"],
      transformOptions: [
        { to: "X", condition: "ownTurn" }
      ],
      droppable: false,
      capturedAs: "X",
      moves: STANDARD_SHOGI.pieces.R.moves
    },

    Z: {
      name: "守変",
      display: "守",
      description: "変化駒の守備形態。金属性を持ち、再び変化駒へ戻れる。",
      category: "special",
      point: 3,
      attributes: ["goldLike", "canTransform"],
      transformOptions: [
        { to: "X", condition: "ownTurn" }
      ],
      droppable: false,
      capturedAs: "X",
      moves: GOLD_MOVES
    },

    U: {
      name: "昇格師",
      display: "昇",
      description: "周囲1マスの自分の駒を、効果アクションで任意に成らせる特殊駒。",
      category: "special",
      point: 4,
      attributes: [],
      effects: [
        { kind: "promoteNearby", timing: "ownTurn", radius: 1, target: "ownPieces", optional: true }
      ],
      droppable: true,
      capturedAs: "U",
      moves: MAGE_MOVES
    },

    W: {
      name: "走兵",
      display: "走",
      description: "前方へ直進し、左右へ1マス動ける拡張歩兵。成ると成走になる。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "W",
      promotesTo: "PW",
      mustPromote: "lastRank",
      dropRules: ["notLastRank"],
      moves: RUNNER_MOVES
    },

    PW: {
      name: "成走",
      display: "走+",
      description: "走兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "W",
      moves: GOLD_MOVES
    }
  },

  initialPieces: createExpandedInitialPieces()
};
 
 
