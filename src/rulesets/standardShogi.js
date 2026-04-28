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

  handOrder: ["R", "B", "G", "S", "N", "L", "P"],

  pieces: {
    K: {
      name: "玉",
      display: "玉",
      royal: true,
      droppable: false,
      capturedAs: null,
      moves: KING_MOVES
    },

    R: {
      name: "飛車",
      display: "飛",
      droppable: true,
      capturedAs: "R",
      promotesTo: "PR",
      moves: ROOK_MOVES
    },

    B: {
      name: "角行",
      display: "角",
      droppable: true,
      capturedAs: "B",
      promotesTo: "PB",
      moves: BISHOP_MOVES
    },

    G: {
      name: "金将",
      display: "金",
      droppable: true,
      capturedAs: "G",
      moves: GOLD_MOVES
    },

    S: {
      name: "銀将",
      display: "銀",
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
      promoted: true,
      droppable: false,
      capturedAs: "R",
      moves: [...ROOK_MOVES, ...DIAGONAL_STEPS]
    },

    PB: {
      name: "竜馬",
      display: "馬",
      promoted: true,
      droppable: false,
      capturedAs: "B",
      moves: [...BISHOP_MOVES, ...ORTHOGONAL_STEPS]
    },

    PS: {
      name: "成銀",
      display: "全",
      promoted: true,
      droppable: false,
      capturedAs: "S",
      moves: GOLD_MOVES
    },

    PN: {
      name: "成桂",
      display: "圭",
      promoted: true,
      droppable: false,
      capturedAs: "N",
      moves: GOLD_MOVES
    },

    PL: {
      name: "成香",
      display: "杏",
      promoted: true,
      droppable: false,
      capturedAs: "L",
      moves: GOLD_MOVES
    },

    TO: {
      name: "と金",
      display: "と",
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
