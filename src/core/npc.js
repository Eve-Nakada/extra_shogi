import { getAvailableTriggeredActions, getLegalActions } from "./action.js";
import { applyMoveToClone } from "./applyMove.js";
import { fromIndex, getSquare } from "./coordinates.js";
import { isInCheck } from "./check.js";
import { getPiecePoint } from "./pieceMetadata.js";

export function getAllLegalActionsForPlayer(state, player = state.turn, options = {}) {
  if (state.status.type !== "playing" || state.phase === "setup") return [];
  const view = { ...state, turn: player };
  const actions = [];

  for (let index = 0; index < view.board.squares.length; index += 1) {
    const piece = view.board.squares[index];
    if (!piece || piece.owner !== player) continue;
    const { x, y } = fromIndex(index, view.board.width);
    actions.push(...getLegalActions(view, { kind: "board", x, y }, options));
  }

  for (const [pieceId, count] of Object.entries(view.hands[player] ?? {})) {
    if (count <= 0) continue;
    actions.push(...getLegalActions(view, { kind: "hand", owner: player, pieceId }, options));
  }

  actions.push(...getAvailableTriggeredActions(view, player));
  return dedupeActions(actions);
}

export function chooseNpcAction(state, player = state.turn, options = {}) {
  const actions = getAllLegalActionsForPlayer(state, player, options);
  if (actions.length === 0) return null;

  const scored = actions.map(action => ({ action, score: scoreNpcAction(state, player, action) }));
  const bestScore = Math.max(...scored.map(item => item.score));
  const best = scored.filter(item => item.score === bestScore);
  return best[createDeterministicIndexSeed(state, player, best.length)]?.action ?? best[0].action;
}

export function scoreNpcAction(state, player, action) {
  let score = 0;

  if (action.kind === "move") {
    const target = getSquare(state, action.to.x, action.to.y);
    if (target && target.owner !== player) score += 100 + getPiecePoint(state.ruleset, target.id) * 12;
    if (action.promoteTo) score += 25 + getPiecePoint(state.ruleset, action.promoteTo);
    score += centerBonus(state, action.to);
  } else if (action.kind === "drop") {
    score += 8 + centerBonus(state, action.to);
  } else if (action.kind === "transform") {
    score += 14;
  } else if (action.kind === "triggerEffect") {
    score += 28 + getPiecePoint(state.ruleset, action.promoteTo) * 4;
  } else if (action.kind === "buildBase") {
    score += 22 + centerBonus(state, action.to);
  } else if (action.kind === "attackBase") {
    score += 45 + Number(action.damage ?? 1) * 15 + centerBonus(state, action.target);
  } else if (action.kind === "compound") {
    score += 10;
    for (const subAction of action.actions ?? []) score += scoreNpcAction(state, player, subAction) * 0.8;
  }

  try {
    const next = applyMoveToClone(state, action, { updateTurn: true, updateHistory: false });
    const opponent = state.ruleset.players.find(candidate => candidate !== player);
    if (opponent && isInCheck(next, opponent)) score += 60;
    if (isInCheck(next, player)) score -= 1000;
  } catch {
    score -= 10000;
  }

  return Math.round(score);
}

function centerBonus(state, square) {
  if (!square) return 0;
  const cx = (state.board.width - 1) / 2;
  const cy = (state.board.height - 1) / 2;
  const dist = Math.abs(square.x - cx) + Math.abs(square.y - cy);
  return Math.max(0, Math.round(12 - dist));
}

function createDeterministicIndexSeed(state, player, length) {
  if (length <= 1) return 0;
  const raw = `${state.rulesetId}:${player}:${state.history.length}:${state.turn}:${state.board.squares.map(piece => piece ? piece.owner[0] + piece.id : "_").join("")}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  return Math.abs(hash) % length;
}

function dedupeActions(actions) {
  const seen = new Set();
  const result = [];
  for (const action of actions) {
    const key = JSON.stringify(action);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}
 
 
