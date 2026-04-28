import { createInitialState } from "./core/state.js";
import { STANDARD_SHOGI } from "./rulesets/standardShogi.js";
import { initController } from "./ui/controller.js";

const elements = {
  board: document.getElementById("board"),
  blackHand: document.getElementById("black-hand"),
  whiteHand: document.getElementById("white-hand"),
  status: document.getElementById("status"),
  resignButton: document.getElementById("resign-button"),
  resetButton: document.getElementById("reset-button")
};

for (const [name, element] of Object.entries(elements)) {
  if (!element) {
    throw new Error(`必要なDOM要素が見つかりません: ${name}`);
  }
}

initController({
  createState: () => createInitialState(STANDARD_SHOGI),
  elements
});
