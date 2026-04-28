import { playerName } from "./state.js";

export function formatHistoryEntry(entry, ruleset, index = null) {
  const prefix = index == null ? "" : `${index + 1}. `;
  const turn = playerName(entry.turn);

  if (entry.move.kind === "drop") {
    const pieceDef = ruleset.pieces[entry.move.pieceId];
    return `${prefix}${turn} ${pieceDef?.display ?? entry.move.pieceId}打 ${formatSquare(entry.move.to)}`;
  }

  if (entry.move.kind === "move") {
    const pieceId = entry.pieceBefore?.id ?? entry.move.promoteTo ?? "?";
    const pieceDef = ruleset.pieces[pieceId];
    const promote = entry.move.promoteTo ? "成" : "";
    const capture = entry.captured ? "x" : "-";
    return `${prefix}${turn} ${pieceDef?.display ?? pieceId} ${formatSquare(entry.move.from)}${capture}${formatSquare(entry.move.to)}${promote}`;
  }

  return `${prefix}${turn} 未知の指し手`;
}

export function formatSquare(square) {
  return `${square.x + 1},${square.y + 1}`;
}
