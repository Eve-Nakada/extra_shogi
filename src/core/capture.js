import { getPieceAttributes } from "./pieceMetadata.js";

export function canCapture(state, attacker, defender, context = {}) {
  if (!attacker || !defender) return false;
  if (attacker.owner === defender.owner) return false;

  const attackerDef = state.ruleset.pieces[attacker.id];
  const defenderDef = state.ruleset.pieces[defender.id];
  if (!attackerDef || !defenderDef) return false;

  for (const rule of defenderDef.captureRules ?? []) {
    if (!isCaptureRuleSatisfied(state, attacker, defender, rule, context)) {
      return false;
    }
  }

  return true;
}

export function isCaptureRuleSatisfied(state, attacker, defender, rule, context = {}) {
  if (!rule || typeof rule !== "object") return true;

  if (rule.kind === "requiresAttackerAttribute") {
    return hasPieceAttribute(state, attacker, rule.attribute, context.attackerSquare);
  }

  return true;
}

export function hasPieceAttribute(state, piece, attribute, square = null) {
  if (!attribute) return false;
  return getPieceAttributes(state.ruleset, piece?.id, { piece, square }).includes(attribute);
}

export function summarizeCaptureRules(captureRules = []) {
  if (!captureRules.length) return "通常通り取られる";

  return captureRules.map(rule => {
    if (rule.kind === "requiresAttackerAttribute") {
      return `攻撃側に ${rule.attribute} 属性が必要`;
    }
    return rule.kind ?? "不明な捕獲制限";
  }).join(" / ");
}
 
 
