import { STANDARD_SHOGI } from "./standardShogi.js";

function createSmallInitialPieces() {
  return [
    { owner: "white", id: "R", x: 0, y: 0 },
    { owner: "white", id: "B", x: 1, y: 0 },
    { owner: "white", id: "K", x: 2, y: 0 },
    { owner: "white", id: "G", x: 3, y: 0 },
    { owner: "white", id: "S", x: 4, y: 0 },
    { owner: "white", id: "P", x: 0, y: 1 },
    { owner: "white", id: "P", x: 1, y: 1 },
    { owner: "white", id: "P", x: 2, y: 1 },
    { owner: "white", id: "P", x: 3, y: 1 },
    { owner: "white", id: "P", x: 4, y: 1 },

    { owner: "black", id: "P", x: 0, y: 3 },
    { owner: "black", id: "P", x: 1, y: 3 },
    { owner: "black", id: "P", x: 2, y: 3 },
    { owner: "black", id: "P", x: 3, y: 3 },
    { owner: "black", id: "P", x: 4, y: 3 },
    { owner: "black", id: "S", x: 0, y: 4 },
    { owner: "black", id: "G", x: 1, y: 4 },
    { owner: "black", id: "K", x: 2, y: 4 },
    { owner: "black", id: "B", x: 3, y: 4 },
    { owner: "black", id: "R", x: 4, y: 4 }
  ];
}

const SMALL_SETUP_ALLOWED = ["K", "R", "B", "G", "S", "N", "L", "P"];

export const SMALL_SHOGI = {
  ...STANDARD_SHOGI,
  id: "small-shogi-5x5",
  name: "小型将棋 5x5",
  board: {
    width: 5,
    height: 5
  },
  promotion: {
    depth: 1
  },
  handOrder: ["R", "B", "G", "S", "N", "L", "P"],
  setup: {
    enabled: true,
    defaultMode: "pointBuy",
    flow: "simultaneous",
    budget: 10,
    requireRoyal: true,
    allowedPieces: SMALL_SETUP_ALLOWED,
    placementZones: {
      black: { yMin: 3, yMax: 4 },
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
      G: 1,
      S: 2,
      N: 1,
      L: 1,
      P: 5,
      default: 2
    },
    fixedPacks: [
      { id: "small-balanced", name: "5x5均衡パック", pieces: { K: 1, G: 1, S: 1, P: 3 } },
      { id: "small-power", name: "5x5大駒パック", pieces: { K: 1, R: 1, B: 1, P: 2 } },
      { id: "small-speed", name: "5x5速攻パック", pieces: { K: 1, S: 1, N: 1, L: 1, P: 2 } }
    ],
    randomPack: {
      packCount: 3,
      packSize: 6,
      budget: 10,
      pool: [
        { pieceId: "P", weight: 10 },
        { pieceId: "S", weight: 5 },
        { pieceId: "G", weight: 4 },
        { pieceId: "N", weight: 3 },
        { pieceId: "L", weight: 3 },
        { pieceId: "B", weight: 2 },
        { pieceId: "R", weight: 2 }
      ]
    }
  },
  pieces: {
    ...STANDARD_SHOGI.pieces,
    K: {
      ...STANDARD_SHOGI.pieces.K,
      droppable: false
    }
  },
  initialPieces: createSmallInitialPieces()
};
