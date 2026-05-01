import { STANDARD_SHOGI } from "./standardShogi.js";
import { EXPANDED_SHOGI } from "./expandedShogi.js";
import { PRACTICAL_SHOGI } from "./practicalShogi.js";
import { TEST_LAB_SHOGI } from "./testLabShogi.js";
import { SETUP_SHOGI } from "./setupShogi.js";
import { SMALL_SHOGI } from "./smallShogi.js";

export const RULESETS = [
  STANDARD_SHOGI,
  SMALL_SHOGI,
  PRACTICAL_SHOGI,
  SETUP_SHOGI,
  TEST_LAB_SHOGI,
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
