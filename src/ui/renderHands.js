import { playerName } from "../core/state.js";

export function renderHands(handElement, state, owner, uiState) {
  handElement.innerHTML = "";
  handElement.classList.toggle("active-turn", state.status.type === "playing" && owner === state.turn);
  handElement.classList.toggle("inactive-turn", state.status.type === "playing" && owner !== state.turn);

  const title = document.createElement("div");
  title.className = "hand-title";
  title.textContent = `${playerName(owner)} 持駒`;
  handElement.appendChild(title);

  const list = document.createElement("div");
  list.className = "hand-list";

  const entries = createHandEntries(state, owner);
  if (entries.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-hand";
    empty.textContent = "なし";
    list.appendChild(empty);
  } else {
    for (const [pieceId, count] of entries) {
      const pieceDef = state.ruleset.pieces[pieceId];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hand-piece";
      button.dataset.owner = owner;
      button.dataset.pieceId = pieceId;
      button.disabled = uiState.readonly || state.status.type !== "playing" || owner !== state.turn;
      button.textContent = `${pieceDef?.display ?? pieceId}×${count}`;
      button.title = pieceDef?.name ?? pieceId;

      if (isSelectedHand(uiState, owner, pieceId)) {
        button.classList.add("selected");
      }

      list.appendChild(button);
    }
  }

  handElement.appendChild(list);
}

function createHandEntries(state, owner) {
  const hand = state.hands[owner] ?? {};
  const order = state.ruleset.handOrder ?? Object.keys(hand);
  const ordered = [];

  for (const pieceId of order) {
    const count = hand[pieceId] ?? 0;
    if (count > 0) ordered.push([pieceId, count]);
  }

  for (const [pieceId, count] of Object.entries(hand)) {
    if (count > 0 && !order.includes(pieceId)) {
      ordered.push([pieceId, count]);
    }
  }

  return ordered;
}

function isSelectedHand(uiState, owner, pieceId) {
  return (
    uiState.selected?.kind === "hand" &&
    uiState.selected.owner === owner &&
    uiState.selected.pieceId === pieceId
  );
}
