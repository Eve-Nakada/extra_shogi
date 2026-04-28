import { formatHistoryEntry } from "../core/notation.js";

export function renderHistory(historyElement, state, uiState) {
  historyElement.innerHTML = "";

  if (state.history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "棋譜なし";
    historyElement.appendChild(empty);
    return;
  }

  state.history.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.dataset.index = String(index);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-button";
    button.dataset.index = String(index);
    button.textContent = formatHistoryEntry(entry, state.ruleset, index);

    if (uiState.replayIndex === index + 1) {
      button.classList.add("current");
    }

    item.appendChild(button);
    historyElement.appendChild(item);
  });
}
