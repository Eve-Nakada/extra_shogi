import { playerName } from "./state.js";
import { normalizeGameMeta, playerDisplayNameFromMeta } from "./meta.js";

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

  if (entry.move.kind === "transform") {
    const beforeDef = ruleset.pieces[entry.pieceBefore?.id];
    const afterDef = ruleset.pieces[entry.move.toPieceId];
    return `${prefix}${turn} ${beforeDef?.display ?? entry.pieceBefore?.id ?? "?"}変身 ${formatSquare(entry.move.from)}→${afterDef?.display ?? entry.move.toPieceId}`;
  }

  if (entry.move.kind === "triggerEffect") {
    const promotedDef = ruleset.pieces[entry.move.promoteTo];
    return `${prefix}${turn} 効果 ${formatSquare(entry.move.source)} ${formatSquare(entry.move.target)}→${promotedDef?.display ?? entry.move.promoteTo}`;
  }

  if (entry.move.kind === "buildBase") {
    const baseDef = ruleset.baseDefs?.[entry.move.baseType] ?? ruleset.bases?.[entry.move.baseType];
    return `${prefix}${turn} ${baseDef?.display ?? entry.move.baseType}建設 ${formatSquare(entry.move.to)}`;
  }

  if (entry.move.kind === "compound") {
    const parts = (entry.subEntries ?? []).map(subEntry => formatHistoryEntry({ ...subEntry, turn: entry.turn }, ruleset)).join(" / ");
    return `${prefix}${turn} 複合 ${parts || `${entry.move.actions.length}アクション`}`;
  }

  return `${prefix}${turn} 未知の指し手`;
}

export function createTextGameRecord(state) {
  const meta = normalizeGameMeta(state.meta);
  const lines = [];
  lines.push("# shogi-html 棋譜");
  lines.push(`表題：${meta.title || "無題の対局"}`);
  lines.push(`ルール：${state.ruleset.name ?? state.rulesetId}`);
  lines.push(`先手：${meta.blackName || "先手"}`);
  lines.push(`後手：${meta.whiteName || "後手"}`);
  if (meta.eventName) lines.push(`棋戦：${meta.eventName}`);
  if (meta.location) lines.push(`場所：${meta.location}`);
  if (meta.startedAt) lines.push(`開始日時：${formatDateTime(meta.startedAt)}`);
  if (meta.endedAt) lines.push(`終了日時：${formatDateTime(meta.endedAt)}`);
  lines.push(`手数：${state.history.length}`);
  lines.push(`結果：${formatResult(state)}`);
  if (meta.notes) lines.push(`備考：${meta.notes}`);
  appendSetupLogLines(lines, state);
  lines.push("");
  lines.push("手数  指手");

  state.history.forEach((entry, index) => {
    lines.push(`${String(index + 1).padStart(3, " ")}  ${formatHistoryEntryForText(entry, state.ruleset, state.meta)}`);
  });

  lines.push("");
  lines.push(`終局：${formatResult(state)}`);
  return lines.join("\n");
}

export function createKifLikeGameRecord(state) {
  const meta = normalizeGameMeta(state.meta);
  const lines = [];
  lines.push(`#KIF version=shogi-html-v1`);
  lines.push(`表題：${meta.title || "無題の対局"}`);
  lines.push(`棋戦：${meta.eventName || "-"}`);
  lines.push(`場所：${meta.location || "-"}`);
  lines.push(`開始日時：${formatDateTime(meta.startedAt)}`);
  if (meta.endedAt) lines.push(`終了日時：${formatDateTime(meta.endedAt)}`);
  lines.push(`手合割：平手`);
  lines.push(`先手：${meta.blackName || "先手"}`);
  lines.push(`後手：${meta.whiteName || "後手"}`);
  appendSetupLogLines(lines, state, "# ");
  lines.push("手数----指手---------消費時間--");

  state.history.forEach((entry, index) => {
    lines.push(`${String(index + 1).padStart(4, " ")} ${formatKifLikeMove(entry, state.ruleset)}`);
  });

  lines.push(`まで${state.history.length}手で${formatResult(state)}`);
  if (meta.notes) lines.push(`備考：${meta.notes}`);
  return lines.join("\n");
}

export function formatSquare(square) {
  return `${square.x + 1},${square.y + 1}`;
}

function formatHistoryEntryForText(entry, ruleset, meta) {
  const player = playerDisplayNameFromMeta(meta, entry.turn);

  if (entry.move.kind === "drop") {
    const pieceDef = ruleset.pieces[entry.move.pieceId];
    return `${player} ${formatSquare(entry.move.to)} ${pieceDef?.display ?? entry.move.pieceId}打`;
  }

  if (entry.move.kind === "move") {
    const pieceId = entry.pieceBefore?.id ?? entry.move.promoteTo ?? "?";
    const pieceDef = ruleset.pieces[pieceId];
    const capture = entry.captured ? " 同" : "";
    const promote = entry.move.promoteTo ? "成" : "";
    return `${player} ${formatSquare(entry.move.from)} -> ${formatSquare(entry.move.to)} ${pieceDef?.display ?? pieceId}${capture}${promote}`;
  }

  if (entry.move.kind === "transform") {
    const beforeDef = ruleset.pieces[entry.pieceBefore?.id];
    const afterDef = ruleset.pieces[entry.move.toPieceId];
    return `${player} ${formatSquare(entry.move.from)} ${beforeDef?.display ?? entry.pieceBefore?.id ?? "?"}変身${afterDef?.display ?? entry.move.toPieceId}`;
  }

  if (entry.move.kind === "triggerEffect") {
    const promotedDef = ruleset.pieces[entry.move.promoteTo];
    return `${player} ${formatSquare(entry.move.source)} 効果 ${formatSquare(entry.move.target)} ${promotedDef?.display ?? entry.move.promoteTo}`;
  }

  if (entry.move.kind === "buildBase") {
    const baseDef = ruleset.baseDefs?.[entry.move.baseType] ?? ruleset.bases?.[entry.move.baseType];
    return `${player} ${formatSquare(entry.move.to)} ${baseDef?.display ?? entry.move.baseType}建設`;
  }

  if (entry.move.kind === "compound") {
    const parts = (entry.subEntries ?? []).map(subEntry => formatHistoryEntryForText({ ...subEntry, turn: entry.turn }, ruleset, meta));
    return `${player} 複合 ${parts.join(" / ")}`;
  }

  return `${player} 未知の指し手`;
}

function formatKifLikeMove(entry, ruleset) {
  if (entry.move.kind === "drop") {
    const pieceDef = ruleset.pieces[entry.move.pieceId];
    return `${formatJapaneseSquare(entry.move.to)}${pieceDef?.display ?? entry.move.pieceId}打`;
  }

  if (entry.move.kind === "move") {
    const pieceId = entry.pieceBefore?.id ?? entry.move.promoteTo ?? "?";
    const pieceDef = ruleset.pieces[pieceId];
    const promote = entry.move.promoteTo ? "成" : "";
    const from = `(${entry.move.from.x + 1}${entry.move.from.y + 1})`;
    return `${formatJapaneseSquare(entry.move.to)}${pieceDef?.display ?? pieceId}${promote}${from}`;
  }

  if (entry.move.kind === "transform") {
    const afterDef = ruleset.pieces[entry.move.toPieceId];
    return `${formatJapaneseSquare(entry.move.from)}${afterDef?.display ?? entry.move.toPieceId}変`;
  }

  if (entry.move.kind === "triggerEffect") {
    const promotedDef = ruleset.pieces[entry.move.promoteTo];
    return `${formatJapaneseSquare(entry.move.target)}${promotedDef?.display ?? entry.move.promoteTo}効成`;
  }

  if (entry.move.kind === "buildBase") {
    const baseDef = ruleset.baseDefs?.[entry.move.baseType] ?? ruleset.bases?.[entry.move.baseType];
    return `${formatJapaneseSquare(entry.move.to)}${baseDef?.display ?? entry.move.baseType}建`;
  }

  if (entry.move.kind === "compound") {
    const parts = (entry.subEntries ?? []).map(subEntry => formatKifLikeMove(subEntry, ruleset));
    return `複合(${parts.join(" / ")})`;
  }

  return "未知の指し手";
}

function formatJapaneseSquare(square) {
  const files = ["１", "２", "３", "４", "５", "６", "７", "８", "９", "10", "11", "12", "13", "14", "15"];
  const ranks = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"];
  return `${files[square.x] ?? square.x + 1}${ranks[square.y] ?? square.y + 1}`;
}

function appendSetupLogLines(lines, state, prefix = "") {
  const log = state.setup?.setupLog ?? [];
  if (!log.length) return;
  lines.push("");
  lines.push(prefix + "編成履歴:");
  for (const entry of log) {
    lines.push(prefix + formatSetupLogEntry(entry, state.ruleset));
  }
}

function formatSetupLogEntry(entry, ruleset) {
  const player = entry.player === "system" ? "共通" : playerName(entry.player);
  const detail = entry.detail ?? {};
  if (entry.action === "addPiece") return `${entry.seq}. ${player} ${pieceLabel(ruleset, detail.pieceId)}を追加`;
  if (entry.action === "removePiece") return `${entry.seq}. ${player} ${pieceLabel(ruleset, detail.pieceId)}を削除`;
  if (entry.action === "selectFixedPack") return `${entry.seq}. ${player} 固定パック「${detail.packName ?? detail.packId}」を選択`;
  if (entry.action === "generateRandomPacks") return `${entry.seq}. ${player} ランダムパック生成 seed=${detail.seed ?? "-"}`;
  if (entry.action === "selectRandomPack") return `${entry.seq}. ${player} ランダムパック「${detail.packName ?? detail.packId}」を選択`;
  if (entry.action === "placePiece") return `${entry.seq}. ${player} ${pieceLabel(ruleset, detail.pieceId)}を${formatSquare(detail.to ?? { x: 0, y: 0 })}へ配置`;
  if (entry.action === "removePlacement") return `${entry.seq}. ${player} ${pieceLabel(ruleset, detail.pieceId)}を${formatSquare(detail.from ?? { x: 0, y: 0 })}から除去`;
  if (entry.action === "finalize") return `${entry.seq}. ${player} 編成確定`;
  return `${entry.seq}. ${player} ${entry.action}`;
}

function pieceLabel(ruleset, pieceId) {
  const pieceDef = ruleset.pieces[pieceId];
  return pieceDef ? `${pieceDef.display ?? pieceId}(${pieceDef.name ?? pieceId})` : pieceId;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ja-JP");
}

function formatResult(state) {
  if (state.status.type !== "ended") return "対局中";
  if (!state.status.winner) return "引き分け";
  return `${playerName(state.status.winner)}勝ち`;
}
