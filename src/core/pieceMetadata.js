export const CATEGORY_LABELS = {
  royal: "王・玉",
  major: "大駒",
  minor: "小駒",
  promoted: "成駒",
  special: "特殊駒",
  baseBuilder: "拠点建設系",
  air: "空中系"
};

export const ATTRIBUTE_LABELS = {
  royal: "王性",
  goldLike: "金属性",
  promoted: "成駒",
  fortified: "堅牢",
  baseBuilder: "拠点建設",
  canTransform: "変身",
  multiAction: "複数行動",
  airUnit: "空中駒"
};

export function getPieceCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category ?? "未分類";
}

export function getPieceAttributeLabel(attribute) {
  return ATTRIBUTE_LABELS[attribute] ?? attribute;
}

export function getPieceAttributes(ruleset, pieceId, context = {}) {
  const pieceDef = ruleset?.pieces?.[pieceId];
  if (!pieceDef) return [];
  const attrs = Array.isArray(pieceDef.attributes) ? [...pieceDef.attributes] : [];
  return [...new Set(attrs)];
}

export function getPiecePoint(ruleset, pieceId) {
  const pieceDef = ruleset?.pieces?.[pieceId];
  if (!pieceDef) return 0;
  if (pieceDef.royal) return 0;
  if (Number.isFinite(pieceDef.point)) return Number(pieceDef.point);

  // v1.5移行前の旧ルールセットを読み込んだ場合の後方互換。
  const baseId = pieceDef.capturedAs ?? pieceId;
  if (baseId === "R" || baseId === "B") return 5;
  return 1;
}

export function validatePieceMetadata(ruleset) {
  const missing = [];
  for (const [pieceId, pieceDef] of Object.entries(ruleset?.pieces ?? {})) {
    if (!pieceDef.description) missing.push(`${pieceId}.description`);
    if (!pieceDef.category) missing.push(`${pieceId}.category`);
    if (!Number.isFinite(pieceDef.point)) missing.push(`${pieceId}.point`);
    if (!Array.isArray(pieceDef.attributes)) missing.push(`${pieceId}.attributes`);
  }
  return missing;
}
