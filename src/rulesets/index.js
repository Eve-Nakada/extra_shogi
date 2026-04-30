 
import { STANDARD_SHOGI } from "./standardShogi.js";
import { EXPANDED_SHOGI } from "./expandedShogi.js";

export const RULESETS = [
  STANDARD_SHOGI,
  EXPANDED_SHOGI
];

export const RULESET_BY_ID = Object.fromEntries(
  RULESETS.map(ruleset => [ruleset.id, ruleset])
);

export function getRulesetById(rulesetId) {
  const ruleset = RULESET_BY_ID[rulesetId];
  if (!ruleset) {
    throw new Error(`未知のルールセットです: ${rulesetId}`);
  }
  return ruleset;
}
 
 
