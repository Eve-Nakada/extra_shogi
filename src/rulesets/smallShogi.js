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
  handOrder: ["R", "B", "G", "S", "P"],
  initialPieces: createSmallInitialPieces()
};
