import { EXPANDED_SHOGI, applyPieceUsage } from "./expandedShogi.js";

export const TEST_LAB_SHOGI = applyPieceUsage({
  ...EXPANDED_SHOGI,
  id: "test-lab-shogi-11x11",
  name: "開発テスト将棋 11x11",
  testOnly: true
});
