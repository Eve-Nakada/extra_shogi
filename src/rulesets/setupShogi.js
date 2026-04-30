import { STANDARD_SHOGI } from "./standardShogi.js";
import { EXPANDED_SHOGI } from "./expandedShogi.js";

export const SETUP_SHOGI = {
  ...EXPANDED_SHOGI,
  id: "setup-shogi-7x7",
  name: "編成検証将棋 7x7",

  board: {
    width: 7,
    height: 7
  },

  players: ["black", "white"],
  firstTurn: "black",

  promotion: {
    depth: 2
  },

  drops: {
    enabled: true,
    capturedPiecesBecomeHand: true,
    policy: "anywhere",
    allowDropInPromotionZone: true
  },

  handOrder: ["R", "B", "M", "F", "FG", "IW", "U", "DR", "EG", "SRM", "NIN", "RG", "SB", "XS", "DS", "SP", "Q", "D", "T", "X", "LH", "HB", "SC", "SH", "A", "C", "W", "G", "S", "N", "L", "P"],

  setup: {
    enabled: true,
    defaultMode: "pointBuy",
    flow: "simultaneous",
    budget: 18,
    requireRoyal: true,
    allowedPieces: ["K", "R", "B", "M", "F", "FG", "IW", "U", "DR", "EG", "SRM", "NIN", "RG", "SB", "XS", "DS", "SP", "Q", "D", "T", "X", "LH", "HB", "SC", "SH", "A", "C", "W", "G", "S", "N", "L", "P"],
    placementZones: {
      black: { yMin: 5, yMax: 6 },
      white: { yMin: 0, yMax: 1 }
    },
    randomPlacement: {
      enabled: true,
      royalPosition: "centerEdge"
    },
    maxCopies: {
      K: 1,
      R: 1,
      B: 1,
      M: 1,
      F: 1,
      U: 1,
      Q: 1,
      D: 1,
      T: 1,
      X: 1,
      G: 2,
      S: 2,
      N: 2,
      L: 2,
      A: 4,
      C: 4,
      W: 4,
      SC: 4,
      SH: 4,
      HB: 3,
      FG: 1,
      LH: 2,
      SP: 3,
      DS: 4,
      RG: 2,
      SB: 2,
      XS: 4,
      EG: 1,
      SRM: 1,
      IW: 1,
      NIN: 2,
      DR: 1,
      P: 7,
      default: 4
    },
    fixedPacks: [
      {
        id: "balanced",
        name: "均衡パック",
        pieces: { K: 1, G: 1, S: 1, B: 1, C: 1, P: 3 }
      },
      {
        id: "rush",
        name: "速攻パック",
        pieces: { K: 1, R: 1, N: 1, L: 1, W: 2, P: 2 }
      },
      {
        id: "trick",
        name: "特殊パック",
        pieces: { K: 1, X: 1, U: 1, T: 1, A: 2, P: 2 }
      },
      {
        id: "new-units",
        name: "新駒検証パック",
        pieces: { K: 1, FG: 1, LH: 1, HB: 1, SC: 2, SH: 2 }
      },
      {
        id: "base-assault",
        name: "拠点攻防パック",
        pieces: { K: 1, EG: 1, SRM: 1, IW: 1, SP: 1, XS: 2 }
      },
      {
        id: "v24-new-units",
        name: "v2.4新駒パック",
        pieces: { K: 1, NIN: 1, DR: 1, RG: 1, SB: 1, DS: 2, XS: 1 }
      }
    ],
    randomPack: {
      packCount: 3,
      packSize: 8,
      budget: 18,
      pool: [
        { pieceId: "P", weight: 10 },
        { pieceId: "XS", weight: 5 },
        { pieceId: "DS", weight: 4 },
        { pieceId: "SP", weight: 3 },
        { pieceId: "RG", weight: 3 },
        { pieceId: "SB", weight: 3 },
        { pieceId: "NIN", weight: 2 },
        { pieceId: "DR", weight: 2 },
        { pieceId: "EG", weight: 1 },
        { pieceId: "SRM", weight: 1 },
        { pieceId: "IW", weight: 1 },
        { pieceId: "A", weight: 5 },
        { pieceId: "C", weight: 5 },
        { pieceId: "W", weight: 4 },
        { pieceId: "SC", weight: 5 },
        { pieceId: "SH", weight: 5 },
        { pieceId: "HB", weight: 3 },
        { pieceId: "S", weight: 4 },
        { pieceId: "G", weight: 3 },
        { pieceId: "N", weight: 3 },
        { pieceId: "L", weight: 3 },
        { pieceId: "B", weight: 2 },
        { pieceId: "R", weight: 2 },
        { pieceId: "M", weight: 2 },
        { pieceId: "LH", weight: 2 },
        { pieceId: "FG", weight: 2 },
        { pieceId: "F", weight: 1 },
        { pieceId: "U", weight: 1 },
        { pieceId: "Q", weight: 1 },
        { pieceId: "D", weight: 1 },
        { pieceId: "T", weight: 1 },
        { pieceId: "X", weight: 1 }
      ]
    }
  },

  pieces: {
    ...EXPANDED_SHOGI.pieces,
    K: {
      ...STANDARD_SHOGI.pieces.K,
      droppable: false
    }
  },

  initialPieces: []
};
