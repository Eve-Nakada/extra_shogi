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
  impasseButton: document.getElementById("impasse-button"),
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
  historyList: document.getElementById("history-list"),
  clockEnabled: document.getElementById("clock-enabled"),
  clockMinutes: document.getElementById("clock-minutes"),
  clockIncrement: document.getElementById("clock-increment"),
  clockApplyButton: document.getElementById("clock-apply-button"),
  clockPauseButton: document.getElementById("clock-pause-button"),
  clockDisplay: document.getElementById("clock-display"),
  onlineStatus: document.getElementById("online-status"),
  onlineRole: document.getElementById("online-role"),
  onlineGameId: document.getElementById("online-game-id"),
  signalInput: document.getElementById("signal-input"),
  signalOutput: document.getElementById("signal-output"),
  hostOfferButton: document.getElementById("host-offer-button"),
  guestAnswerButton: document.getElementById("guest-answer-button"),
  spectatorAnswerButton: document.getElementById("spectator-answer-button"),
  hostAcceptAnswerButton: document.getElementById("host-accept-answer-button"),
  reconnectOfferButton: document.getElementById("reconnect-offer-button"),
  copySignalButton: document.getElementById("copy-signal-button"),
  disconnectButton: document.getElementById("disconnect-button"),
  syncButton: document.getElementById("sync-button"),
  syncRequestButton: document.getElementById("sync-request-button"),
  pingButton: document.getElementById("ping-button"),
  clearConnectionLogButton: document.getElementById("clear-connection-log-button"),
  connectionDetail: document.getElementById("connection-detail"),
  connectionLog: document.getElementById("connection-log")
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
