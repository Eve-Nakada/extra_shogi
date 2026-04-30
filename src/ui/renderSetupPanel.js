import {
  calculatePieceSetCost,
  canFinalizeSetupPlayer,
  getAllowedSetupPieces,
  getLegalPlacements,
  getRemainingSetupBudget,
  getSelectedSetupCost,
  getSetupBudget,
  getSetupConfig,
  getSetupPlayer,
  getUnplacedSetupPieces,
  isSetupActive,
  isSetupEnabled
} from "../core/setup.js";
import { playerName } from "../core/state.js";

export function renderSetupPanel(panel, content, state, uiState) {
  if (!panel || !content) return;
  const enabled = isSetupEnabled(state);
  panel.hidden = false;
  content.innerHTML = "";

  if (!enabled) {
    panel.open = false;
    content.appendChild(paragraph("現在のルールセットは通常初期配置です。編成フェーズはありません。"));
    return;
  }

  panel.open = isSetupActive(state) || panel.open;
  if (!isSetupActive(state)) {
    content.appendChild(paragraph("編成は完了しています。通常対局中です。"));
    content.appendChild(createPieceSummary(state));
    return;
  }

  const player = uiState.setupPlayer ?? getSetupPlayer(state);
  const config = getSetupConfig(state);
  const budget = getSetupBudget(state);
  const used = getSelectedSetupCost(state, player);
  const remaining = getRemainingSetupBudget(state, player);
  const selected = state.setup.selectedPieces[player] ?? {};
  const unplaced = getUnplacedSetupPieces(state, player);

  const header = document.createElement("div");
  header.className = "setup-header";
  header.innerHTML = `
    <div><strong>${playerName(player)}の編成中</strong>${uiState.setupReadonly ? "（閲覧のみ）" : ""}</div>
    <div>点数 ${used}/${budget}（残り ${remaining}）</div>
    <div>モード: ${createModeLabel(state.setup.mode)}</div>
  `;
  content.appendChild(header);

  content.appendChild(createFixedPacks(state, config.fixedPacks ?? []));
  content.appendChild(createRandomPacks(state));
  content.appendChild(createPointBuyList(state, player));
  content.appendChild(createSelectedList(state, player, selected, unplaced));
  content.appendChild(createPlacementList(state, uiState, player, unplaced));

  const footer = document.createElement("div");
  footer.className = "setup-actions";
  const finalize = document.createElement("button");
  finalize.type = "button";
  finalize.className = "action-button primary-action";
  finalize.dataset.setupAction = "finalize";
  finalize.disabled = !canFinalizeSetupPlayer(state, player);
  finalize.textContent = `${playerName(player)}の編成を確定`;
  footer.appendChild(finalize);
  content.appendChild(footer);

  if (uiState.setupReadonly) {
    for (const button of content.querySelectorAll("button")) button.disabled = true;
  }
}

function createFixedPacks(state, packs) {
  const section = createSection("固定パック選択");
  if (!packs.length) {
    section.appendChild(paragraph("固定パックは定義されていません。"));
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "setup-pack-grid";
  for (const pack of packs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setup-pack-button";
    button.dataset.setupAction = "select-fixed-pack";
    button.dataset.packId = pack.id;
    button.innerHTML = `<strong>${escapeHtml(pack.name)}</strong><span>${formatPieces(state, pack.pieces)} / ${calculatePieceSetCost(state, pack.pieces)}点</span>`;
    grid.appendChild(button);
  }
  section.appendChild(grid);
  return section;
}

function createRandomPacks(state) {
  const section = createSection("ランダムパック選択");
  const actions = document.createElement("div");
  actions.className = "setup-actions";
  const generate = document.createElement("button");
  generate.type = "button";
  generate.className = "action-button";
  generate.dataset.setupAction = "generate-random-packs";
  generate.textContent = "ランダムパック生成";
  actions.appendChild(generate);
  section.appendChild(actions);

  const packs = state.setup.generatedPacks ?? [];
  if (!packs.length) {
    section.appendChild(paragraph("生成すると、同じseedから再現できる候補パックが表示されます。"));
    return section;
  }

  const seed = document.createElement("p");
  seed.className = "setup-note";
  seed.textContent = `seed: ${state.setup.randomSeed}`;
  section.appendChild(seed);

  const grid = document.createElement("div");
  grid.className = "setup-pack-grid";
  for (const pack of packs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setup-pack-button";
    button.dataset.setupAction = "select-random-pack";
    button.dataset.packId = pack.id;
    button.innerHTML = `<strong>${escapeHtml(pack.name)}</strong><span>${formatPieces(state, pack.pieces)} / ${calculatePieceSetCost(state, pack.pieces)}点</span>`;
    grid.appendChild(button);
  }
  section.appendChild(grid);
  return section;
}

function createPointBuyList(state, player) {
  const section = createSection("点数内で駒選択");
  const grid = document.createElement("div");
  grid.className = "setup-piece-grid";
  for (const pieceId of getAllowedSetupPieces(state)) {
    const pieceDef = state.ruleset.pieces[pieceId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setup-piece-button";
    button.dataset.setupAction = "add-piece";
    button.dataset.pieceId = pieceId;
    button.textContent = `${pieceDef.display ?? pieceId} ${pieceDef.name ?? pieceId} / ${pieceDef.point ?? 1}点`;
    grid.appendChild(button);
  }
  section.appendChild(grid);
  return section;
}

function createSelectedList(state, player, selected, unplaced) {
  const section = createSection("選択済み駒");
  const entries = Object.entries(selected).filter(([, count]) => count > 0);
  if (!entries.length) {
    section.appendChild(paragraph("駒を選択するか、パックを選んでください。王は必須です。"));
    return section;
  }

  const list = document.createElement("div");
  list.className = "setup-selected-list";
  for (const [pieceId, count] of entries) {
    const pieceDef = state.ruleset.pieces[pieceId];
    const item = document.createElement("div");
    item.className = "setup-selected-item";
    item.innerHTML = `<span>${pieceDef.display ?? pieceId} ${pieceDef.name ?? pieceId} ×${count} / 未配置 ${unplaced[pieceId] ?? 0}</span>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "action-button";
    remove.dataset.setupAction = "remove-piece";
    remove.dataset.pieceId = pieceId;
    remove.textContent = "1枚減らす";
    item.appendChild(remove);
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

function createPlacementList(state, uiState, player, unplaced) {
  const section = createSection("配置フェーズ");
  const entries = Object.entries(unplaced).filter(([, count]) => count > 0);
  if (!entries.length) {
    section.appendChild(paragraph("未配置の駒はありません。編成を確定できます。"));
    return section;
  }

  const list = document.createElement("div");
  list.className = "setup-piece-grid";
  for (const [pieceId, count] of entries) {
    const pieceDef = state.ruleset.pieces[pieceId];
    const placements = getLegalPlacements(state, pieceId, player);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setup-piece-button";
    button.dataset.setupAction = "select-placement-piece";
    button.dataset.pieceId = pieceId;
    button.disabled = placements.length === 0;
    button.textContent = `${pieceDef.display ?? pieceId}を配置 ×${count}`;
    if (uiState.setupSelectedPieceId === pieceId) button.classList.add("selected");
    list.appendChild(button);
  }
  section.appendChild(list);
  section.appendChild(paragraph("配置したい駒を選んでから、盤面の自陣配置エリアをクリックしてください。配置済みの自駒をクリックすると盤面から外せます。"));
  return section;
}

function createPieceSummary(state) {
  const section = createSection("編成結果");
  for (const player of state.ruleset.players) {
    const p = document.createElement("p");
    p.textContent = `${playerName(player)}: ${formatPieces(state, state.setup?.selectedPieces?.[player] ?? {})}`;
    section.appendChild(p);
  }
  return section;
}

function createSection(title) {
  const section = document.createElement("section");
  section.className = "setup-section";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  section.appendChild(h3);
  return section;
}

function paragraph(text) {
  const p = document.createElement("p");
  p.className = "setup-note";
  p.textContent = text;
  return p;
}

function formatPieces(state, pieces) {
  return Object.entries(pieces ?? {})
    .filter(([, count]) => count > 0)
    .map(([pieceId, count]) => `${state.ruleset.pieces[pieceId]?.display ?? pieceId}×${count}`)
    .join(" ") || "なし";
}

function createModeLabel(mode) {
  if (mode === "fixedPack") return "固定パック";
  if (mode === "randomPack") return "ランダムパック";
  return "点数選択";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}
