import { summarizeCaptureRules } from "../core/capture.js";
import { getPieceAttributeLabel, getPieceCategoryLabel } from "../core/pieceMetadata.js";

export function renderPieceGuide(container, ruleset) {
  if (!container || !ruleset) return;
  container.innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "piece-guide-intro";
  intro.innerHTML = `
    <section>
      <h3>移動定義</h3>
      <p>駒の動きはルールセット内の <code>moves</code> 配列から読み取ります。駒を追加する場合も、UI側に個別処理を書かず、駒定義を増やします。</p>
      <dl class="definition-list">
        <div><dt><code>step</code></dt><dd>指定方向へ1マス移動します。</dd></div>
        <div><dt><code>slide</code></dt><dd>指定方向へ、駒や盤端に当たるまで直線移動します。</dd></div>
        <div><dt><code>jump</code></dt><dd>途中の駒を飛び越えて指定先へ移動します。</dd></div>
      </dl>
    </section>
    <section>
      <h3>属性・点数</h3>
      <p><code>description</code> / <code>category</code> / <code>point</code> / <code>attributes</code> / <code>captureRules</code> を駒定義から自動表示します。金・玉・成駒は <code>goldLike</code> を持ちます。</p>
    </section>
  `;
  container.appendChild(intro);

  const groups = groupPieces(ruleset);
  for (const [category, pieces] of groups) {
    const section = document.createElement("section");
    section.className = "piece-guide-category";

    const heading = document.createElement("h3");
    heading.textContent = getPieceCategoryLabel(category);
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = "piece-card-grid";

    for (const [pieceId, pieceDef] of pieces) {
      list.appendChild(createPieceCard(ruleset, pieceId, pieceDef));
    }

    section.appendChild(list);
    container.appendChild(section);
  }
}

function groupPieces(ruleset) {
  const order = ruleset.handOrder ?? Object.keys(ruleset.pieces ?? {});
  const ids = [...new Set([...order, ...Object.keys(ruleset.pieces ?? {})])];
  const map = new Map();

  for (const pieceId of ids) {
    const pieceDef = ruleset.pieces[pieceId];
    if (!pieceDef) continue;
    const category = pieceDef.category ?? "uncategorized";
    if (!map.has(category)) map.set(category, []);
    map.get(category).push([pieceId, pieceDef]);
  }

  const categoryOrder = ["royal", "major", "minor", "promoted", "special", "baseBuilder", "air", "uncategorized"];
  return [...map.entries()].sort((a, b) => categoryOrder.indexOf(a[0]) - categoryOrder.indexOf(b[0]));
}

function createPieceCard(ruleset, pieceId, pieceDef) {
  const card = document.createElement("article");
  card.className = "piece-guide-card";

  const head = document.createElement("div");
  head.className = "piece-guide-card-head";

  const piece = document.createElement("span");
  piece.className = "piece-guide-display";
  piece.textContent = pieceDef.display ?? pieceId;

  const title = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = `${pieceDef.name ?? pieceId}（${pieceId}）`;
  const meta = document.createElement("span");
  meta.className = "piece-guide-meta";
  meta.textContent = `${getPieceCategoryLabel(pieceDef.category)} / ${pieceDef.point ?? "-"}点`;
  title.append(name, meta);
  head.append(piece, title);

  const description = document.createElement("p");
  description.className = "piece-guide-description";
  description.textContent = pieceDef.description ?? "説明未設定";

  const tags = document.createElement("div");
  tags.className = "piece-guide-tags";
  const attributes = pieceDef.attributes?.length ? pieceDef.attributes : ["属性なし"];
  for (const attribute of attributes) {
    const tag = document.createElement("span");
    tag.className = attribute === "goldLike" ? "piece-guide-tag gold-like" : "piece-guide-tag";
    tag.textContent = getPieceAttributeLabel(attribute);
    tags.appendChild(tag);
  }

  const details = document.createElement("dl");
  details.className = "piece-guide-details";
  appendDetail(details, "成り", pieceDef.promotesTo ? `${pieceDef.promotesTo}（${ruleset.pieces[pieceDef.promotesTo]?.name ?? "未定義"}）` : "なし");
  appendDetail(details, "持ち駒", pieceDef.droppable === false ? "打てない" : "打てる");
  appendDetail(details, "取られた時", pieceDef.capturedAs ?? "持ち駒化しない");
  appendDetail(details, "捕獲制限", summarizeCaptureRules(pieceDef.captureRules));
  appendDetail(details, "変身", summarizeTransformOptions(ruleset, pieceDef.transformOptions));
  appendDetail(details, "効果", summarizeEffects(pieceDef.effects));
  appendDetail(details, "特殊行動", summarizeActions(pieceDef.actions));
  appendDetail(details, "移動", summarizeMoves(pieceDef.moves));

  card.append(head, description, tags, details);
  return card;
}

function appendDetail(parent, term, value) {
  const wrapper = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = value;
  wrapper.append(dt, dd);
  parent.appendChild(wrapper);
}

function summarizeMoves(moves = []) {
  const counts = moves.reduce((acc, move) => {
    acc[move.kind] = (acc[move.kind] ?? 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(counts).map(([kind, count]) => `${kind}×${count}`);
  return parts.length ? parts.join(" / ") : "なし";
}

function summarizeTransformOptions(ruleset, options = []) {
  if (!options.length) return "なし";
  return options.map(option => {
    const toPieceId = typeof option === "string" ? option : option.to;
    const condition = typeof option === "string" ? "ownTurn" : (option.condition ?? "ownTurn");
    const target = ruleset.pieces[toPieceId];
    return `${target?.name ?? toPieceId}（${condition}）`;
  }).join(" / ");
}

function summarizeEffects(effects = []) {
  if (!effects.length) return "なし";
  return effects.map(effect => {
    if (effect.kind === "promoteNearby") {
      return `周囲${effect.radius ?? 1}マスの駒を成らせる`;
    }
    if (effect.kind === "extraActionOnCapture") {
      return `捕獲時に追加行動×${effect.actionCount ?? 1}`;
    }
    return effect.kind ?? "不明な効果";
  }).join(" / ");
}

function summarizeActions(actions = []) {
  if (!actions.length) return "なし";
  return actions.map(action => {
    if (action.kind === "multiMove") {
      return `${action.count ?? 2}回行動${action.optionalStop ? "（途中停止可）" : ""}`;
    }
    return action.kind ?? "不明な特殊行動";
  }).join(" / ");
}
