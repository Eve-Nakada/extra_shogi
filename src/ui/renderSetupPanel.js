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
    <div class="setup-budget ${createBudgetClass(remaining, budget)}">点数 ${used}/${budget}（残り ${remaining}）</div>
    <div>モード: ${createModeLabel(state.setup.mode)}</div>
  `;
  content.appendChild(header);

  content.appendChild(createSetupStatusOverview(state, player));
  content.appendChild(createBudgetWarning(state, player));
  content.appendChild(createPackComparison(state, config));
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

function createSetupStatusOverview(state, activePlayer) {
  const section = createSection("編成状況");
  const grid = document.createElement("div");
  grid.className = "setup-status-grid";

  for (const player of state.ruleset.players) {
    const selected = state.setup.selectedPieces[player] ?? {};
    const unplaced = getUnplacedSetupPieces(state, player);
    const used = getSelectedSetupCost(state, player);
    const remaining = getRemainingSetupBudget(state, player);
    const finalized = state.setup.finalizedPlayers.includes(player);
    const card = document.createElement("article");
    card.className = `setup-status-card ${player === activePlayer ? "active" : ""} ${finalized ? "finalized" : ""}`;
    card.innerHTML = `
      <h4>${playerName(player)} ${finalized ? "確定済み" : player === activePlayer ? "操作中" : "編成中"}</h4>
      <p>点数 ${used}/${getSetupBudget(state)}（残り ${remaining}）</p>
      <p>未配置 ${sumCounts(unplaced)}枚 / 選択 ${sumCounts(selected)}枚</p>
      <p>選択パック: ${createSelectedPackLabel(state, player)}</p>
    `;
    grid.appendChild(card);
  }

  section.appendChild(grid);
  section.appendChild(paragraph("通信対戦中は、相手側の編成状況もこの欄で確認できます。"));
  return section;
}

function createBudgetWarning(state, player) {
  const remaining = getRemainingSetupBudget(state, player);
  const selected = state.setup.selectedPieces[player] ?? {};
  const unplaced = getUnplacedSetupPieces(state, player);
  const section = document.createElement("section");
  section.className = "setup-warning-panel";

  const messages = [];
  if (remaining === 0) messages.push("残り点数は0です。これ以上追加できません。");
  else if (remaining <= 2) messages.push(`残り点数が少なくなっています（残り${remaining}点）。`);
  if (!Object.keys(selected).some(pieceId => state.ruleset.pieces[pieceId]?.royal)) messages.push("王・玉が未選択です。確定には王性の駒が必要です。");
  const unplacedCount = sumCounts(unplaced);
  if (unplacedCount > 0) messages.push(`未配置の駒が${unplacedCount}枚あります。配置後に確定できます。`);
  if (!messages.length) messages.push("編成条件を満たしています。必要に応じて確定できます。");

  section.classList.toggle("ok", messages.length === 1 && messages[0].startsWith("編成条件"));
  section.innerHTML = `<strong>残り点数・確定条件</strong><ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`;
  return section;
}

function createPackComparison(state, config) {
  const packs = [
    ...(config.fixedPacks ?? []).map(pack => ({ ...pack, kind: "固定" })),
    ...((state.setup.generatedPacks ?? []).map(pack => ({ ...pack, kind: "ランダム" })))
  ];
  const section = createSection("パック比較");
  if (!packs.length) {
    section.appendChild(paragraph("比較できるパックはまだありません。固定パックまたはランダムパックを表示してください。"));
    return section;
  }

  const table = document.createElement("table");
  table.className = "setup-pack-table";
  table.innerHTML = `
    <thead><tr><th>種別</th><th>パック</th><th>点数</th><th>枚数</th><th>王</th><th>内訳</th></tr></thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  for (const pack of packs) {
    const tr = document.createElement("tr");
    const hasRoyal = Object.keys(pack.pieces ?? {}).some(pieceId => state.ruleset.pieces[pieceId]?.royal);
    tr.innerHTML = `
      <td>${escapeHtml(pack.kind)}</td>
      <td>${escapeHtml(pack.name)}</td>
      <td>${calculatePieceSetCost(state, pack.pieces)}</td>
      <td>${sumCounts(pack.pieces)}</td>
      <td>${hasRoyal ? "あり" : "なし"}</td>
      <td>${escapeHtml(formatPieces(state, pack.pieces))}</td>
    `;
    body.appendChild(tr);
  }
  section.appendChild(table);
  return section;
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
  const remaining = getRemainingSetupBudget(state, player);
  for (const pieceId of getAllowedSetupPieces(state)) {
    const pieceDef = state.ruleset.pieces[pieceId];
    const point = Number(pieceDef.point ?? 1);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setup-piece-button";
    button.dataset.setupAction = "add-piece";
    button.dataset.pieceId = pieceId;
    button.disabled = point > remaining;
    button.innerHTML = `<strong>${pieceDef.display ?? pieceId} ${pieceDef.name ?? pieceId}</strong><span>${point}点 / ${getCategoryText(pieceDef.category)}</span>`;
    grid.appendChild(button);
  }
  section.appendChild(grid);
  return section;
}

function createSelectedList(state, player, selected, unplaced) {
  const section = createSection("選択済み駒一覧");
  const entries = Object.entries(selected).filter(([, count]) => count > 0);
  if (!entries.length) {
    section.appendChild(paragraph("駒を選択するか、パックを選んでください。王は必須です。"));
    return section;
  }

  const table = document.createElement("table");
  table.className = "setup-selected-table";
  table.innerHTML = `
    <thead><tr><th>分類</th><th>駒</th><th>点</th><th>選択</th><th>配置済</th><th>未配置</th><th>操作</th></tr></thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  for (const [pieceId, count] of entries.sort((a, b) => sortPieceEntries(state, a, b))) {
    const pieceDef = state.ruleset.pieces[pieceId];
    const placed = (state.setup.placedPieces[player] ?? {})[pieceId] ?? 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${getCategoryText(pieceDef.category)}</td>
      <td>${pieceDef.display ?? pieceId} ${pieceDef.name ?? pieceId}</td>
      <td>${pieceDef.point ?? 1}</td>
      <td>${count}</td>
      <td>${placed}</td>
      <td>${unplaced[pieceId] ?? 0}</td>
      <td></td>
    `;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "action-button compact-action";
    remove.dataset.setupAction = "remove-piece";
    remove.dataset.pieceId = pieceId;
    remove.textContent = "1枚減らす";
    tr.lastElementChild.appendChild(remove);
    body.appendChild(tr);
  }
  section.appendChild(table);
  return section;
}

function createPlacementList(state, uiState, player, unplaced) {
  const section = createSection("配置フェーズ");
  const actions = document.createElement("div");
  actions.className = "setup-actions";
  const randomPlacement = document.createElement("button");
  randomPlacement.type = "button";
  randomPlacement.className = "action-button";
  randomPlacement.dataset.setupAction = "random-placement";
  randomPlacement.textContent = "ランダム配置";
  actions.appendChild(randomPlacement);
  section.appendChild(actions);

  const entries = Object.entries(unplaced).filter(([, count]) => count > 0);
  if (!entries.length) {
    section.appendChild(paragraph("未配置の駒はありません。必要に応じてランダム配置で再配置できます。編成を確定できます。"));
    return section;
  }

  const list = document.createElement("div");
  list.className = "setup-piece-grid";
  for (const [pieceId, count] of entries.sort((a, b) => sortPieceEntries(state, a, b))) {
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
  section.appendChild(paragraph("配置可能エリアは盤面上に薄く表示されます。ランダム配置では王・玉を中央端へ固定し、その他の駒を配置エリア内に自動配置します。手動配置では、駒を選んでから盤面をクリックしてください。"));
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
    .sort((a, b) => sortPieceEntries(state, a, b))
    .map(([pieceId, count]) => `${state.ruleset.pieces[pieceId]?.display ?? pieceId}×${count}`)
    .join(" ") || "なし";
}

function createModeLabel(mode) {
  if (mode === "fixedPack") return "固定パック";
  if (mode === "randomPack") return "ランダムパック";
  return "点数選択";
}

function createBudgetClass(remaining, budget) {
  if (remaining < 0) return "over";
  if (remaining === 0) return "zero";
  if (remaining <= Math.max(2, Math.floor(budget * 0.15))) return "low";
  return "ok";
}

function createSelectedPackLabel(state, player) {
  const packId = state.setup.selectedPackIds?.[player];
  if (!packId) return "未選択";
  const fixed = (getSetupConfig(state).fixedPacks ?? []).find(pack => pack.id === packId);
  const random = (state.setup.generatedPacks ?? []).find(pack => pack.id === packId);
  return fixed?.name ?? random?.name ?? packId;
}

function sortPieceEntries(state, a, b) {
  const order = state.ruleset.handOrder ?? Object.keys(state.ruleset.pieces);
  return order.indexOf(a[0]) - order.indexOf(b[0]);
}

function sumCounts(counts = {}) {
  return Object.values(counts).reduce((sum, count) => sum + Number(count ?? 0), 0);
}

function getCategoryText(category) {
  const labels = {
    royal: "王",
    major: "大駒",
    minor: "小駒",
    promoted: "成駒",
    special: "特殊",
    baseBuilder: "拠点",
    air: "空中"
  };
  return labels[category] ?? "その他";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}
