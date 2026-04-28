import { createInitialState } from "./core/state.js";
import { RULESETS, RULESET_BY_ID } from "./rulesets/index.js";
import { initController } from "./ui/controller.js";

const elements = {
  board: document.getElementById("board"),
  blackHand: document.getElementById("black-hand"),
  whiteHand: document.getElementById("white-hand"),
  status: document.getElementById("status"),
  message: document.getElementById("message"),
  rulesetSelect: document.getElementById("ruleset-select"),
  resignButton: document.getElementById("resign-button"),
  resetButton: document.getElementById("reset-button"),
  undoButton: document.getElementById("undo-button"),
  replayStartButton: document.getElementById("replay-start-button"),
  replayPrevButton: document.getElementById("replay-prev-button"),
  replayNextButton: document.getElementById("replay-next-button"),
  replayEndButton: document.getElementById("replay-end-button"),
  saveLocalButton: document.getElementById("save-local-button"),
  loadLocalButton: document.getElementById("load-local-button"),
  exportButton: document.getElementById("export-button"),
  importButton: document.getElementById("import-button"),
  importInput: document.getElementById("import-input"),
  historyList: document.getElementById("history-list")
};

for (const [name, element] of Object.entries(elements)) {
  if (!element) {
    throw new Error(`必要なDOM要素が見つかりません: ${name}`);
  }
}

initController({
  createState: rulesetId => createInitialState(RULESET_BY_ID[rulesetId]),
  elements,
  rulesets: RULESETS,
  rulesetsById: RULESET_BY_ID,
  defaultRulesetId: "standard-shogi"
});
