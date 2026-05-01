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

const BUILDER_MOVES = GOLD_MOVES;

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

const SCOUT_MOVES = [
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 1, fy: 1 },
  { kind: "jump", dx: 0, fy: 2 }
];

const SHIELD_MOVES = [
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: -1, fy: 0 },
  { kind: "step", dx: 1, fy: 0 },
  { kind: "step", dx: 0, fy: -1 }
];

const HORIZONTAL_SOLDIER_MOVES = [
  { kind: "slide", dx: -1, dy: 0 },
  { kind: "slide", dx: 1, dy: 0 },
  { kind: "step", dx: 0, fy: 1 }
];


const SPEAR_MOVES = [
  { kind: "slide", dx: 0, fy: 1 },
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 1, fy: 1 }
];

const DIAGONAL_SOLDIER_MOVES = [
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 1, fy: 1 },
  { kind: "step", dx: 0, fy: -1 }
];

const REAR_GUARD_MOVES = [
  { kind: "step", dx: -1, fy: -1 },
  { kind: "step", dx: 0, fy: -1 },
  { kind: "step", dx: 1, fy: -1 },
  { kind: "step", dx: -1, fy: 0 },
  { kind: "step", dx: 1, fy: 0 }
];

const SMALL_BISHOP_MOVES = [
  { kind: "step", dx: -1, dy: -1 },
  { kind: "step", dx: 1, dy: -1 },
  { kind: "step", dx: -1, dy: 1 },
  { kind: "step", dx: 1, dy: 1 },
  { kind: "jump", dx: -2, dy: -2 },
  { kind: "jump", dx: 2, dy: -2 },
  { kind: "jump", dx: -2, dy: 2 },
  { kind: "jump", dx: 2, dy: 2 }
];

const CROSS_SOLDIER_MOVES = [
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: 0, fy: -1 },
  { kind: "step", dx: -1, fy: 0 },
  { kind: "step", dx: 1, fy: 0 }
];

const NINJA_MOVES = [
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 1, fy: 1 },
  { kind: "jump", dx: -2, fy: 2 },
  { kind: "jump", dx: 2, fy: 2 },
  { kind: "jump", dx: -2, fy: -2 },
  { kind: "jump", dx: 2, fy: -2 }
];

const LIGHT_HORSE_MOVES = [
  { kind: "jump", dx: -1, fy: 2 },
  { kind: "jump", dx: 1, fy: 2 },
  { kind: "jump", dx: -2, fy: 1 },
  { kind: "jump", dx: 2, fy: 1 },
  { kind: "jump", dx: -1, fy: -2 },
  { kind: "jump", dx: 1, fy: -2 },
  { kind: "jump", dx: -2, fy: -1 },
  { kind: "jump", dx: 2, fy: -1 }
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
    { owner: "white", id: "SC", x: 1, y: 2 },
    { owner: "white", id: "Q", x: 2, y: 2 },
    { owner: "white", id: "D", x: 3, y: 2 },
    { owner: "white", id: "T", x: 4, y: 2 },
    { owner: "white", id: "F", x: 5, y: 2 },
    { owner: "white", id: "U", x: 6, y: 2 },
    { owner: "white", id: "FG", x: 7, y: 2 },
    { owner: "white", id: "X", x: 8, y: 2 },
    { owner: "white", id: "W", x: 10, y: 2 },

    { owner: "black", id: "W", x: 0, y: 8 },
    { owner: "black", id: "SC", x: 1, y: 8 },
    { owner: "black", id: "Q", x: 2, y: 8 },
    { owner: "black", id: "D", x: 3, y: 8 },
    { owner: "black", id: "T", x: 4, y: 8 },
    { owner: "black", id: "F", x: 5, y: 8 },
    { owner: "black", id: "U", x: 6, y: 8 },
    { owner: "black", id: "FG", x: 7, y: 8 },
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

  handOrder: ["R", "B", "M", "F", "FG", "IW", "U", "DR", "EG", "SRM", "NIN", "RG", "SB", "XS", "DS", "SP", "Q", "D", "T", "X", "Y", "Z", "LH", "HB", "SC", "SH", "A", "C", "W", "G", "S", "N", "L", "P"],

  drops: {
    enabled: true,
    capturedPiecesBecomeHand: true,
    policy: "nearOwnBase",
    baseKinds: ["castle", "carrier"],
    radius: 1,
    allowInitialCampIfNoBase: true,
    allowOwnCampAlways: true,
    allowDropInPromotionZone: true
  },

  baseDefs: {
    castle: {
      name: "御城",
      display: "城",
      hp: 3,
      providesDropZone: true,
      dropRadius: 1,
      captureMode: "occupy",
      allowedLayers: ["ground"]
    },
    carrier: {
      name: "空母",
      display: "母",
      hp: 2,
      providesDropZone: true,
      dropRadius: 2,
      captureMode: "destroy",
      allowedLayers: ["ground"],
      futureAllowedLayers: ["air"],
      enablesLayerTransfer: false,
      preparedForAirLayer: true
    }
  },

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


    T: {
      name: "築城駒",
      display: "築",
      description: "周囲1マスの空きマスに御城を建てられる拠点建設系の駒。",
      category: "baseBuilder",
      point: 4,
      attributes: ["baseBuilder"],
      actions: [
        { kind: "buildBase", baseType: "castle", range: 1, buildOn: "emptySquare" }
      ],
      droppable: true,
      capturedAs: "T",
      moves: BUILDER_MOVES
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



    Q: {
      name: "追撃駒",
      display: "追",
      description: "敵駒を取ると、同じ駒だけもう一度動ける特殊駒。追加行動の検証に使う。",
      category: "special",
      point: 4,
      attributes: ["multiAction"],
      effects: [
        { kind: "extraActionOnCapture", actionCount: 1, samePieceOnly: true, chainable: false }
      ],
      droppable: true,
      capturedAs: "Q",
      moves: KING_MOVES
    },

    D: {
      name: "二動駒",
      display: "二",
      description: "1手の中で同じ駒を最大2回動かせる特殊駒。複合アクションの検証に使う。",
      category: "special",
      point: 4,
      attributes: ["multiAction"],
      actions: [
        { kind: "multiMove", count: 2, samePieceOnly: true, secondMoveSet: "same", optionalStop: true, allowCaptureOnSecond: true }
      ],
      droppable: true,
      capturedAs: "D",
      moves: KING_MOVES
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

    SC: {
      name: "斥候",
      display: "斥",
      description: "軽量機動枠。前方と斜め前へ1マス動き、前方2マスへ跳べる偵察駒。",
      category: "minor",
      point: 1,
      attributes: ["scout"],
      droppable: true,
      capturedAs: "SC",
      promotesTo: "PSC",
      dropRules: ["notLastRank"],
      moves: SCOUT_MOVES
    },

    PSC: {
      name: "成斥候",
      display: "斥+",
      description: "斥候が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "SC",
      moves: GOLD_MOVES
    },

    SH: {
      name: "盾兵",
      display: "盾",
      description: "守備小駒枠。前後左右へ1マス動けるが、斜めには動けない防御向きの駒。",
      category: "minor",
      point: 1,
      attributes: ["defender"],
      droppable: true,
      capturedAs: "SH",
      promotesTo: "PSH",
      moves: SHIELD_MOVES
    },

    PSH: {
      name: "成盾兵",
      display: "盾+",
      description: "盾兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "SH",
      moves: GOLD_MOVES
    },

    HB: {
      name: "横兵",
      display: "横",
      description: "横制圧枠。左右へ走り、前へ1マス進める横方向制圧用の小駒。",
      category: "minor",
      point: 2,
      attributes: ["sideControl"],
      droppable: true,
      capturedAs: "HB",
      promotesTo: "PHB",
      moves: HORIZONTAL_SOLDIER_MOVES
    },

    PHB: {
      name: "成横兵",
      display: "横+",
      description: "横兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 2,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "HB",
      moves: GOLD_MOVES
    },

    FG: {
      name: "砦将",
      display: "砦",
      description: "金属性・対金剛枠。金属性を持つため、金剛を捕獲できる守備寄りの将。",
      category: "special",
      point: 3,
      attributes: ["goldLike", "fortress"],
      droppable: true,
      capturedAs: "FG",
      moves: GOLD_MOVES
    },

    LH: {
      name: "軽馬",
      display: "軽",
      description: "ジャンプ機動枠。桂馬系の跳躍を前後左右に拡張した機動駒。",
      category: "special",
      point: 2,
      attributes: ["jumper"],
      droppable: true,
      capturedAs: "LH",
      promotesTo: "PLH",
      moves: LIGHT_HORSE_MOVES
    },

    PLH: {
      name: "成軽馬",
      display: "軽+",
      description: "軽馬が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 2,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "LH",
      moves: GOLD_MOVES
    },


    SP: {
      name: "槍兵",
      display: "槍",
      description: "前方へ走り、斜め前にも1マス動ける攻撃的な歩兵。",
      category: "minor",
      point: 2,
      attributes: ["spear"],
      droppable: true,
      capturedAs: "SP",
      promotesTo: "PSP",
      dropRules: ["notLastRank"],
      moves: SPEAR_MOVES
    },

    PSP: {
      name: "成槍兵",
      display: "槍+",
      description: "槍兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 2,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "SP",
      moves: GOLD_MOVES
    },

    DS: {
      name: "斜兵",
      display: "斜",
      description: "斜め前へ進み、後ろへ1マス戻れる斜行小駒。",
      category: "minor",
      point: 1,
      attributes: ["diagonal"],
      droppable: true,
      capturedAs: "DS",
      promotesTo: "PDS",
      moves: DIAGONAL_SOLDIER_MOVES
    },

    PDS: {
      name: "成斜兵",
      display: "斜+",
      description: "斜兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "DS",
      moves: GOLD_MOVES
    },

    RG: {
      name: "後衛",
      display: "後",
      description: "後方3方向と左右へ1マス動ける支援向きの駒。",
      category: "minor",
      point: 2,
      attributes: ["support"],
      droppable: true,
      capturedAs: "RG",
      promotesTo: "PRG",
      moves: REAR_GUARD_MOVES
    },

    PRG: {
      name: "成後衛",
      display: "後+",
      description: "後衛が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 2,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "RG",
      moves: GOLD_MOVES
    },

    SB: {
      name: "小角",
      display: "小角",
      description: "斜め1マスと斜め2マス跳びを持つ軽量角系の駒。",
      category: "minor",
      point: 2,
      attributes: ["diagonal", "jumper"],
      droppable: true,
      capturedAs: "SB",
      promotesTo: "PSB",
      moves: SMALL_BISHOP_MOVES
    },

    PSB: {
      name: "成小角",
      display: "小角+",
      description: "小角が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 2,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "SB",
      moves: GOLD_MOVES
    },

    XS: {
      name: "十字兵",
      display: "十",
      description: "前後左右へ1マス動ける十字型の基本駒。",
      category: "minor",
      point: 1,
      attributes: ["cross"],
      droppable: true,
      capturedAs: "XS",
      promotesTo: "PXS",
      moves: CROSS_SOLDIER_MOVES
    },

    PXS: {
      name: "成十字兵",
      display: "十+",
      description: "十字兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "XS",
      moves: GOLD_MOVES
    },

    EG: {
      name: "工兵",
      display: "工",
      description: "御城と空母を建設できる拠点運用向けの駒。",
      category: "baseBuilder",
      point: 4,
      attributes: ["baseBuilder"],
      actions: [
        { kind: "buildBase", baseType: "castle", range: 1, buildOn: "emptySquare" },
        { kind: "buildBase", baseType: "carrier", range: 1, buildOn: "emptySquare" }
      ],
      droppable: true,
      capturedAs: "EG",
      moves: SHIELD_MOVES
    },

    SRM: {
      name: "破城槌",
      display: "槌",
      description: "拠点攻撃に特化した攻城駒。拠点へ2点のダメージを与える。",
      category: "special",
      point: 4,
      attributes: ["siege"],
      actions: [
        { kind: "attackBase", damage: 2 }
      ],
      baseDamage: 2,
      droppable: true,
      capturedAs: "SRM",
      moves: RUNNER_MOVES
    },

    IW: {
      name: "鉄壁",
      display: "壁",
      description: "金属性を持つ駒以外には取られない、防御特化の壁駒。",
      category: "special",
      point: 4,
      attributes: ["fortified", "wall"],
      captureRules: [
        { kind: "requiresAttackerAttribute", attribute: "goldLike" }
      ],
      droppable: true,
      capturedAs: "IW",
      moves: SHIELD_MOVES
    },

    NIN: {
      name: "忍者",
      display: "忍",
      description: "斜め前へ歩き、斜め2マスへ跳べる奇襲用の機動駒。",
      category: "special",
      point: 3,
      attributes: ["ninja", "jumper"],
      droppable: true,
      capturedAs: "NIN",
      promotesTo: "PNIN",
      moves: NINJA_MOVES
    },

    PNIN: {
      name: "成忍者",
      display: "忍+",
      description: "忍者が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 3,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "NIN",
      moves: GOLD_MOVES
    },

    DR: {
      name: "鼓舞兵",
      display: "鼓",
      description: "周囲支援の素体となる支援駒。成ると鼓舞将になり、周囲の味方を成らせる効果を得る。",
      category: "special",
      point: 3,
      attributes: ["support"],
      droppable: true,
      capturedAs: "DR",
      promotesTo: "PDR",
      moves: CROSS_SOLDIER_MOVES
    },

    PDR: {
      name: "鼓舞将",
      display: "鼓+",
      description: "鼓舞兵が成った駒。周囲1マスの味方を効果アクションで任意に成らせる。",
      category: "promoted",
      point: 3,
      attributes: ["promoted", "goldLike", "support"],
      promoted: true,
      effects: [
        { kind: "promoteNearby", timing: "ownTurn", radius: 1, target: "ownPieces", optional: true }
      ],
      droppable: false,
      capturedAs: "DR",
      moves: GOLD_MOVES
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

export const PRACTICAL_EXTRA_PIECE_IDS = [
  "M", "C", "PC", "SC", "PSC", "SH", "PSH", "HB", "PHB",
  "FG", "LH", "PLH", "SP", "PSP", "DS", "PDS", "RG", "PRG",
  "SB", "PSB", "XS", "PXS", "EG", "SRM", "IW", "NIN", "PNIN",
  "DR", "PDR", "W", "PW"
];

export const TEST_PIECE_IDS = [
  "F", "A", "PA", "PPA", "T", "X", "Y", "Z", "Q", "D", "U"
];

export function getExpandedPieceUsage(pieceId) {
  if (TEST_PIECE_IDS.includes(pieceId)) return "test";
  if (PRACTICAL_EXTRA_PIECE_IDS.includes(pieceId)) return "practical";
  return "standard";
}

export function applyPieceUsage(ruleset) {
  for (const [pieceId, pieceDef] of Object.entries(ruleset.pieces ?? {})) {
    if (!pieceDef.usage) pieceDef.usage = getExpandedPieceUsage(pieceId);
  }
  return ruleset;
}

applyPieceUsage(EXPANDED_SHOGI);
 
 
