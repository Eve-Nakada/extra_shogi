const GOLD_MOVES = [
  { kind: "step", dx: 0, fy: 1 },
  { kind: "step", dx: -1, fy: 1 },
  { kind: "step", dx: 1, fy: 1 },
  { kind: "step", dx: -1, fy: 0 },
  { kind: "step", dx: 1, fy: 0 },
  { kind: "step", dx: 0, fy: -1 }
];

const KING_MOVES = [
  { kind: "step", dx: -1, dy: -1 },
  { kind: "step", dx: 0, dy: -1 },
  { kind: "step", dx: 1, dy: -1 },
  { kind: "step", dx: -1, dy: 0 },
  { kind: "step", dx: 1, dy: 0 },
  { kind: "step", dx: -1, dy: 1 },
  { kind: "step", dx: 0, dy: 1 },
  { kind: "step", dx: 1, dy: 1 }
];

const ROOK_MOVES = [
  { kind: "slide", dx: 0, dy: -1 },
  { kind: "slide", dx: 0, dy: 1 },
  { kind: "slide", dx: -1, dy: 0 },
  { kind: "slide", dx: 1, dy: 0 }
];

const BISHOP_MOVES = [
  { kind: "slide", dx: -1, dy: -1 },
  { kind: "slide", dx: 1, dy: -1 },
  { kind: "slide", dx: -1, dy: 1 },
  { kind: "slide", dx: 1, dy: 1 }
];

const ORTHOGONAL_STEPS = [
  { kind: "step", dx: 0, dy: -1 },
  { kind: "step", dx: 0, dy: 1 },
  { kind: "step", dx: -1, dy: 0 },
  { kind: "step", dx: 1, dy: 0 }
];

const DIAGONAL_STEPS = [
  { kind: "step", dx: -1, dy: -1 },
  { kind: "step", dx: 1, dy: -1 },
  { kind: "step", dx: -1, dy: 1 },
  { kind: "step", dx: 1, dy: 1 }
];

export const STANDARD_SHOGI = {
  id: "standard-shogi",
  name: "本将棋",

  board: {
    width: 9,
    height: 9
  },

  players: ["black", "white"],
  firstTurn: "black",

  promotion: {
    depth: 3
  },

  drops: {
    enabled: true,
    capturedPiecesBecomeHand: true,
    policy: "anywhere",
    allowDropInPromotionZone: true
  },

  handOrder: ["R", "B", "G", "S", "N", "L", "P"],

  pieces: {
    K: {
      name: "玉",
      display: "玉",
      description: "王手を受けないように守る最重要駒。周囲8方向へ1マス動ける。",
      category: "royal",
      point: 0,
      attributes: ["royal", "goldLike"],
      royal: true,
      droppable: false,
      capturedAs: null,
      moves: KING_MOVES
    },

    R: {
      name: "飛車",
      display: "飛",
      description: "縦横に何マスでも進める大駒。成ると竜王になる。",
      category: "major",
      point: 5,
      attributes: [],
      droppable: true,
      capturedAs: "R",
      promotesTo: "PR",
      moves: ROOK_MOVES
    },

    B: {
      name: "角行",
      display: "角",
      description: "斜めに何マスでも進める大駒。成ると竜馬になる。",
      category: "major",
      point: 5,
      attributes: [],
      droppable: true,
      capturedAs: "B",
      promotesTo: "PB",
      moves: BISHOP_MOVES
    },

    G: {
      name: "金将",
      display: "金",
      description: "前3方向・横・真後ろへ1マス動ける守備の要。金属性を持つ。",
      category: "minor",
      point: 1,
      attributes: ["goldLike"],
      droppable: true,
      capturedAs: "G",
      moves: GOLD_MOVES
    },

    S: {
      name: "銀将",
      display: "銀",
      description: "前3方向と斜め後ろへ1マス動ける小駒。成ると金と同じ動きになる。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "S",
      promotesTo: "PS",
      moves: [
        { kind: "step", dx: -1, fy: 1 },
        { kind: "step", dx: 0, fy: 1 },
        { kind: "step", dx: 1, fy: 1 },
        { kind: "step", dx: -1, fy: -1 },
        { kind: "step", dx: 1, fy: -1 }
      ]
    },

    N: {
      name: "桂馬",
      display: "桂",
      description: "前方2マス先の左右へ跳ぶ小駒。途中の駒を飛び越えられる。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "N",
      promotesTo: "PN",
      mustPromote: "lastTwoRanks",
      dropRules: ["notLastTwoRanks"],
      moves: [
        { kind: "jump", dx: -1, fy: 2 },
        { kind: "jump", dx: 1, fy: 2 }
      ]
    },

    L: {
      name: "香車",
      display: "香",
      description: "前方へまっすぐ何マスでも進める小駒。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "L",
      promotesTo: "PL",
      mustPromote: "lastRank",
      dropRules: ["notLastRank"],
      moves: [
        { kind: "slide", dx: 0, fy: 1 }
      ]
    },

    P: {
      name: "歩兵",
      display: "歩",
      description: "前に1マス進む基本駒。成るとと金になる。",
      category: "minor",
      point: 1,
      attributes: [],
      droppable: true,
      capturedAs: "P",
      promotesTo: "TO",
      mustPromote: "lastRank",
      dropRules: ["notLastRank", "noSameFilePawn", "noDropPawnMate"],
      moves: [
        { kind: "step", dx: 0, fy: 1 }
      ]
    },

    PR: {
      name: "竜王",
      display: "竜",
      description: "飛車が成った駒。飛車の動きに加えて斜め4方向へ1マス動ける。",
      category: "promoted",
      point: 5,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "R",
      moves: [...ROOK_MOVES, ...DIAGONAL_STEPS]
    },

    PB: {
      name: "竜馬",
      display: "馬",
      description: "角行が成った駒。角行の動きに加えて縦横4方向へ1マス動ける。",
      category: "promoted",
      point: 5,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "B",
      moves: [...BISHOP_MOVES, ...ORTHOGONAL_STEPS]
    },

    PS: {
      name: "成銀",
      display: "全",
      description: "銀将が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "S",
      moves: GOLD_MOVES
    },

    PN: {
      name: "成桂",
      display: "圭",
      description: "桂馬が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "N",
      moves: GOLD_MOVES
    },

    PL: {
      name: "成香",
      display: "杏",
      description: "香車が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "L",
      moves: GOLD_MOVES
    },

    TO: {
      name: "と金",
      display: "と",
      description: "歩兵が成った駒。金と同じ動きになり、金属性を持つ。",
      category: "promoted",
      point: 1,
      attributes: ["promoted", "goldLike"],
      promoted: true,
      droppable: false,
      capturedAs: "P",
      moves: GOLD_MOVES
    }
  },

  initialPieces: [
    { owner: "white", id: "L", x: 0, y: 0 },
    { owner: "white", id: "N", x: 1, y: 0 },
    { owner: "white", id: "S", x: 2, y: 0 },
    { owner: "white", id: "G", x: 3, y: 0 },
    { owner: "white", id: "K", x: 4, y: 0 },
    { owner: "white", id: "G", x: 5, y: 0 },
    { owner: "white", id: "S", x: 6, y: 0 },
    { owner: "white", id: "N", x: 7, y: 0 },
    { owner: "white", id: "L", x: 8, y: 0 },
    { owner: "white", id: "R", x: 1, y: 1 },
    { owner: "white", id: "B", x: 7, y: 1 },
    { owner: "white", id: "P", x: 0, y: 2 },
    { owner: "white", id: "P", x: 1, y: 2 },
    { owner: "white", id: "P", x: 2, y: 2 },
    { owner: "white", id: "P", x: 3, y: 2 },
    { owner: "white", id: "P", x: 4, y: 2 },
    { owner: "white", id: "P", x: 5, y: 2 },
    { owner: "white", id: "P", x: 6, y: 2 },
    { owner: "white", id: "P", x: 7, y: 2 },
    { owner: "white", id: "P", x: 8, y: 2 },

    { owner: "black", id: "P", x: 0, y: 6 },
    { owner: "black", id: "P", x: 1, y: 6 },
    { owner: "black", id: "P", x: 2, y: 6 },
    { owner: "black", id: "P", x: 3, y: 6 },
    { owner: "black", id: "P", x: 4, y: 6 },
    { owner: "black", id: "P", x: 5, y: 6 },
    { owner: "black", id: "P", x: 6, y: 6 },
    { owner: "black", id: "P", x: 7, y: 6 },
    { owner: "black", id: "P", x: 8, y: 6 },
    { owner: "black", id: "B", x: 1, y: 7 },
    { owner: "black", id: "R", x: 7, y: 7 },
    { owner: "black", id: "L", x: 0, y: 8 },
    { owner: "black", id: "N", x: 1, y: 8 },
    { owner: "black", id: "S", x: 2, y: 8 },
    { owner: "black", id: "G", x: 3, y: 8 },
    { owner: "black", id: "K", x: 4, y: 8 },
    { owner: "black", id: "G", x: 5, y: 8 },
    { owner: "black", id: "S", x: 6, y: 8 },
    { owner: "black", id: "N", x: 7, y: 8 },
    { owner: "black", id: "L", x: 8, y: 8 }
  ]
};
 
 
