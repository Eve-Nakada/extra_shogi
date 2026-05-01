import { EXPANDED_SHOGI, PRACTICAL_EXTRA_PIECE_IDS, applyPieceUsage } from "./expandedShogi.js";

const PRACTICAL_BASE_PIECE_IDS = [
  ...EXPANDED_SHOGI.handOrder.filter(pieceId => EXPANDED_SHOGI.pieces[pieceId]?.usage === "standard"),
  ...PRACTICAL_EXTRA_PIECE_IDS
];

function includePromotionChains(ids) {
  const result = [];
  const visit = pieceId => {
    if (!pieceId || result.includes(pieceId)) return;
    const pieceDef = EXPANDED_SHOGI.pieces[pieceId];
    if (!pieceDef) return;
    result.push(pieceId);
    visit(pieceDef.promotesTo);
  };

  ids.forEach(visit);
  return result;
}

const PRACTICAL_PIECE_IDS = includePromotionChains(PRACTICAL_BASE_PIECE_IDS);

function pickPieces(ids) {
  return Object.fromEntries(
    ids
      .filter(pieceId => EXPANDED_SHOGI.pieces[pieceId])
      .map(pieceId => [pieceId, { ...EXPANDED_SHOGI.pieces[pieceId], usage: EXPANDED_SHOGI.pieces[pieceId].usage ?? "practical" }])
  );
}

function createPracticalInitialPieces() {
  const back = ["L", "N", "S", "G", "C", "K", "C", "G", "S", "N", "L"];
  const support = ["W", "SC", "XS", "DS", "SP", "FG", "RG", "SB", "LH", "NIN", "W"];
  const pieces = [];

  for (let x = 0; x < 11; x += 1) {
    pieces.push({ owner: "white", id: back[x], x, y: 0 });
    pieces.push({ owner: "white", id: support[x], x, y: 2 });
    pieces.push({ owner: "white", id: x === 5 ? "DR" : "P", x, y: 3 });

    pieces.push({ owner: "black", id: x === 5 ? "DR" : "P", x, y: 7 });
    pieces.push({ owner: "black", id: support[x], x, y: 8 });
    pieces.push({ owner: "black", id: back[x], x, y: 10 });
  }

  pieces.push({ owner: "white", id: "R", x: 1, y: 1 });
  pieces.push({ owner: "white", id: "M", x: 5, y: 1 });
  pieces.push({ owner: "white", id: "B", x: 9, y: 1 });
  pieces.push({ owner: "black", id: "B", x: 1, y: 9 });
  pieces.push({ owner: "black", id: "M", x: 5, y: 9 });
  pieces.push({ owner: "black", id: "R", x: 9, y: 9 });

  return pieces;
}

export const PRACTICAL_SHOGI = applyPieceUsage({
  ...EXPANDED_SHOGI,
  id: "practical-shogi-11x11",
  name: "拡張実戦将棋 11x11",
  handOrder: EXPANDED_SHOGI.handOrder.filter(pieceId => pickPieces(PRACTICAL_BASE_PIECE_IDS)[pieceId]),
  pieces: pickPieces(PRACTICAL_PIECE_IDS),
  initialPieces: createPracticalInitialPieces()
});
