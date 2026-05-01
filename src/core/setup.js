import { getSquare, inBoard, setSquare } from "./coordinates.js";
import { getPiecePoint } from "./pieceMetadata.js";

export function createSetupState(ruleset) {
  const config = ruleset.setup;
  if (!config?.enabled) return null;

  const players = ruleset.players ?? ["black", "white"];
  return {
    phase: "select",
    mode: config.defaultMode ?? "pointBuy",
    currentPlayer: players[0],
    finalizedPlayers: [],
    setupLog: [],
    seq: 0,
    flow: config.flow ?? "sequential",
    initialPosition: null,
    selectedPieces: Object.fromEntries(players.map(player => [player, {}])),
    placedPieces: Object.fromEntries(players.map(player => [player, {}])),
    generatedPacks: [],
    randomSeed: null,
    selectedPackIds: Object.fromEntries(players.map(player => [player, null])),
    budget: Number(config.budget ?? 20)
  };
}

export function cloneSetup(setup) {
  if (!setup) return null;
  return {
    phase: setup.phase ?? "select",
    mode: setup.mode ?? "pointBuy",
    currentPlayer: setup.currentPlayer ?? "black",
    finalizedPlayers: Array.isArray(setup.finalizedPlayers) ? [...setup.finalizedPlayers] : [],
    setupLog: Array.isArray(setup.setupLog) ? setup.setupLog.map(cloneSetupLogEntry) : [],
    seq: Number(setup.seq ?? 0),
    flow: setup.flow ?? "sequential",
    initialPosition: cloneInitialPositionSnapshot(setup.initialPosition),
    selectedPieces: cloneNestedCounts(setup.selectedPieces),
    placedPieces: cloneNestedCounts(setup.placedPieces),
    generatedPacks: Array.isArray(setup.generatedPacks) ? setup.generatedPacks.map(clonePack) : [],
    randomSeed: setup.randomSeed ?? null,
    selectedPackIds: { ...(setup.selectedPackIds ?? {}) },
    budget: Number(setup.budget ?? 20)
  };
}

export function isSetupEnabled(stateOrRuleset) {
  const ruleset = stateOrRuleset.ruleset ?? stateOrRuleset;
  return Boolean(ruleset.setup?.enabled);
}

export function isSetupActive(state) {
  return state.phase === "setup" && state.setup?.phase !== "complete";
}

export function getSetupConfig(stateOrRuleset) {
  const ruleset = stateOrRuleset.ruleset ?? stateOrRuleset;
  return ruleset.setup ?? { enabled: false };
}

export function getSetupPlayer(state) {
  return state.setup?.currentPlayer ?? state.turn;
}

export function getSetupBudget(state) {
  return Number(state.setup?.budget ?? getSetupConfig(state).budget ?? 20);
}

export function getAllowedSetupPieces(state) {
  const config = getSetupConfig(state);
  const allowed = config.allowedPieces ?? Object.keys(state.ruleset.pieces);
  return allowed.filter(pieceId => Boolean(state.ruleset.pieces[pieceId]));
}

export function getSelectedSetupCost(state, player = getSetupPlayer(state)) {
  return Object.entries(state.setup?.selectedPieces?.[player] ?? {})
    .reduce((total, [pieceId, count]) => total + getPiecePoint(state.ruleset, pieceId) * count, 0);
}

export function getRemainingSetupBudget(state, player = getSetupPlayer(state)) {
  return getSetupBudget(state) - getSelectedSetupCost(state, player);
}

export function addSetupPiece(state, pieceId, player = getSetupPlayer(state)) {
  assertSetupSelectionMutable(state, player);
  if (!getAllowedSetupPieces(state).includes(pieceId)) throw new Error("この駒は編成に使えません。");

  const maxCopies = getMaxCopies(state, pieceId);
  const selected = state.setup.selectedPieces[player];
  const nextCount = (selected[pieceId] ?? 0) + 1;
  if (nextCount > maxCopies) throw new Error("この駒はこれ以上選べません。");

  const nextCost = getSelectedSetupCost(state, player) + getPiecePoint(state.ruleset, pieceId);
  if (nextCost > getSetupBudget(state)) throw new Error("編成点数を超えています。");

  selected[pieceId] = nextCount;
  logSetupEvent(state, player, "addPiece", { pieceId });
  return cloneSetup(state.setup);
}

export function removeSetupPiece(state, pieceId, player = getSetupPlayer(state)) {
  assertSetupSelectionMutable(state, player);
  const selected = state.setup.selectedPieces[player];
  const placed = state.setup.placedPieces[player];
  const selectedCount = selected[pieceId] ?? 0;
  if (selectedCount <= 0) return cloneSetup(state.setup);
  if ((placed[pieceId] ?? 0) >= selectedCount) throw new Error("配置済みの駒は先に盤面から外してください。");

  selected[pieceId] = selectedCount - 1;
  if (selected[pieceId] <= 0) delete selected[pieceId];
  logSetupEvent(state, player, "removePiece", { pieceId });
  return cloneSetup(state.setup);
}

export function selectFixedPack(state, packId, player = getSetupPlayer(state)) {
  assertSetupSelectionMutable(state, player);
  const pack = (getSetupConfig(state).fixedPacks ?? []).find(candidate => candidate.id === packId);
  if (!pack) throw new Error("指定された固定パックがありません。");
  applyPackToPlayer(state, player, pack);
  state.setup.mode = "fixedPack";
  state.setup.selectedPackIds[player] = pack.id;
  logSetupEvent(state, player, "selectFixedPack", { packId: pack.id, packName: pack.name, pieces: { ...pack.pieces } });
  return cloneSetup(state.setup);
}

export function generateRandomPacks(state, seed = createSeed()) {
  assertSetupActiveState(state);
  const config = getSetupConfig(state).randomPack ?? {};
  const count = Math.max(1, Number(config.packCount ?? 3));
  const packSize = Math.max(1, Number(config.packSize ?? 6));
  const budget = Number(config.budget ?? getSetupBudget(state));
  const pool = normalizeRandomPool(state, config.pool);
  if (pool.length === 0) throw new Error("ランダムパック候補がありません。");
  const rng = createSeededRandom(seed);
  const packs = [];

  for (let index = 0; index < count; index += 1) {
    const pieces = {};
    if (state.ruleset.pieces.K) pieces.K = 1;
    let guard = 0;
    while (Object.values(pieces).reduce((a, b) => a + b, 0) < packSize && guard < packSize * 80) {
      guard += 1;
      const pieceId = weightedPick(pool, rng);
      const nextPieces = { ...pieces, [pieceId]: (pieces[pieceId] ?? 0) + 1 };
      if (calculatePieceSetCost(state, nextPieces) <= budget && nextPieces[pieceId] <= getMaxCopies(state, pieceId)) {
        pieces[pieceId] = nextPieces[pieceId];
      }
    }
    packs.push({ id: `random-${index + 1}`, name: `ランダムパック${index + 1}`, pieces });
  }

  state.setup.mode = "randomPack";
  state.setup.randomSeed = seed;
  state.setup.generatedPacks = packs;
  logSetupEvent(state, "system", "generateRandomPacks", { seed, packs: packs.map(clonePack) });
  return packs.map(clonePack);
}

export function selectGeneratedPack(state, packId, player = getSetupPlayer(state)) {
  assertSetupSelectionMutable(state, player);
  const pack = (state.setup.generatedPacks ?? []).find(candidate => candidate.id === packId);
  if (!pack) throw new Error("指定されたランダムパックがありません。");
  applyPackToPlayer(state, player, pack);
  state.setup.mode = "randomPack";
  state.setup.selectedPackIds[player] = pack.id;
  logSetupEvent(state, player, "selectRandomPack", { packId: pack.id, packName: pack.name, pieces: { ...pack.pieces } });
  return cloneSetup(state.setup);
}

export function getUnplacedSetupPieces(state, player = getSetupPlayer(state)) {
  const selected = state.setup?.selectedPieces?.[player] ?? {};
  const placed = state.setup?.placedPieces?.[player] ?? {};
  const result = {};
  for (const [pieceId, count] of Object.entries(selected)) {
    const remaining = count - (placed[pieceId] ?? 0);
    if (remaining > 0) result[pieceId] = remaining;
  }
  return result;
}

export function getLegalPlacements(state, pieceId, player = getSetupPlayer(state)) {
  if (!isSetupActive(state)) return [];
  if (!pieceId || (getUnplacedSetupPieces(state, player)[pieceId] ?? 0) <= 0) return [];

  const zones = getSetupConfig(state).placementZones ?? {};
  const zone = zones[player];
  const placements = [];
  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      if (!inBoard(x, y, state.board)) continue;
      if (getSquare(state, x, y)) continue;
      if (!isSquareInPlacementZone({ x, y }, zone)) continue;
      placements.push({ kind: "placement", player, pieceId, to: { x, y } });
    }
  }
  return placements;
}

export function applyPlacement(state, placement) {
  assertSetupActiveState(state);
  const player = placement.player ?? getSetupPlayer(state);
  assertSetupSelectionMutable(state, player);
  if (!getLegalPlacements(state, placement.pieceId, player).some(candidate => candidate.to.x === placement.to.x && candidate.to.y === placement.to.y)) {
    throw new Error("そのマスには配置できません。");
  }

  setSquare(state, placement.to.x, placement.to.y, { owner: player, id: placement.pieceId });
  const placed = state.setup.placedPieces[player];
  placed[placement.pieceId] = (placed[placement.pieceId] ?? 0) + 1;
  logSetupEvent(state, player, "placePiece", { pieceId: placement.pieceId, to: { ...placement.to } });
  return cloneSetup(state.setup);
}

export function removeSetupPlacementAt(state, x, y, player = getSetupPlayer(state)) {
  assertSetupActiveState(state);
  const piece = getSquare(state, x, y);
  if (!piece || piece.owner !== player) return false;
  setSquare(state, x, y, null);
  const placed = state.setup.placedPieces[player];
  placed[piece.id] = Math.max(0, (placed[piece.id] ?? 0) - 1);
  if (placed[piece.id] <= 0) delete placed[piece.id];
  logSetupEvent(state, player, "removePlacement", { pieceId: piece.id, from: { x, y } });
  return true;
}

export function canFinalizeSetupPlayer(state, player = getSetupPlayer(state)) {
  if (!isSetupActive(state)) return false;
  const selected = state.setup.selectedPieces[player] ?? {};
  const requireRoyal = getSetupConfig(state).requireRoyal !== false;
  if (requireRoyal && !Object.keys(selected).some(pieceId => state.ruleset.pieces[pieceId]?.royal)) return false;
  return Object.keys(getUnplacedSetupPieces(state, player)).length === 0 && Object.keys(selected).length > 0;
}

export function finalizeSetupPlayer(state, player = getSetupPlayer(state)) {
  assertSetupActiveState(state);
  assertSetupSelectionMutable(state, player);
  if (!canFinalizeSetupPlayer(state, player)) throw new Error("未配置の駒があるか、王が選ばれていません。");

  if (!state.setup.finalizedPlayers.includes(player)) state.setup.finalizedPlayers.push(player);
  logSetupEvent(state, player, "finalize", { selectedPieces: { ...(state.setup.selectedPieces[player] ?? {}) } });
  const next = state.ruleset.players.find(candidate => !state.setup.finalizedPlayers.includes(candidate));
  if (next) {
    state.setup.currentPlayer = next;
    state.setup.phase = "select";
    return cloneSetup(state.setup);
  }

  state.setup.phase = "complete";
  state.phase = "playing";
  state.turn = state.ruleset.firstTurn ?? state.ruleset.players[0];
  state.status = { type: "playing", winner: null, reason: null };
  state.initialPosition = createInitialPositionSnapshot(state);
  state.setup.initialPosition = cloneInitialPositionSnapshot(state.initialPosition);
  return cloneSetup(state.setup);
}


export function autoPlaceSetupPieces(state, player = getSetupPlayer(state), seed = createSeed()) {
  assertSetupSelectionMutable(state, player);
  const selected = state.setup?.selectedPieces?.[player] ?? {};
  if (Object.values(selected).reduce((sum, count) => sum + Number(count ?? 0), 0) <= 0) {
    throw new Error("ランダム配置する駒が選択されていません。");
  }

  clearPlayerSetupBoard(state, player);
  state.setup.placedPieces[player] = {};

  const placements = getRandomPlacementSquares(state, player, seed);
  const piecesToPlace = expandSelectedPiecesForPlacement(state, player);
  const royalIndex = piecesToPlace.findIndex(pieceId => state.ruleset.pieces[pieceId]?.royal);

  if (royalIndex >= 0) {
    const royalPieceId = piecesToPlace.splice(royalIndex, 1)[0];
    const royalSquare = getRoyalPlacementSquare(state, player);
    if (!isSquareInPlacementZone(royalSquare, getSetupConfig(state).placementZones?.[player])) {
      throw new Error("王・玉の固定配置マスが配置エリア外です。");
    }
    if (getSquare(state, royalSquare.x, royalSquare.y)) {
      throw new Error("王・玉の固定配置マスが空いていません。");
    }
    placeSetupPieceDirectly(state, player, royalPieceId, royalSquare);
    removeSquareFromList(placements, royalSquare);
  }

  if (piecesToPlace.length > placements.length) {
    throw new Error("配置可能マスが足りません。");
  }

  for (const pieceId of piecesToPlace) {
    const square = placements.shift();
    placeSetupPieceDirectly(state, player, pieceId, square);
  }

  logSetupEvent(state, player, "randomPlacement", { seed });
  return cloneSetup(state.setup);
}

function expandSelectedPiecesForPlacement(state, player) {
  const selected = state.setup?.selectedPieces?.[player] ?? {};
  const result = [];
  for (const [pieceId, count] of Object.entries(selected)) {
    for (let i = 0; i < Number(count ?? 0); i += 1) result.push(pieceId);
  }
  return result;
}

function getRandomPlacementSquares(state, player, seed) {
  const zone = getSetupConfig(state).placementZones?.[player];
  const squares = [];
  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const square = { x, y };
      if (!isSquareInPlacementZone(square, zone)) continue;
      if (getSquare(state, x, y)) continue;
      squares.push(square);
    }
  }

  const rng = createSeededRandom(seed);
  for (let i = squares.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [squares[i], squares[j]] = [squares[j], squares[i]];
  }
  return squares;
}

function getRoyalPlacementSquare(state, player) {
  const x = Math.floor(state.board.width / 2);
  const y = player === "black" ? state.board.height - 1 : 0;
  return { x, y };
}

function placeSetupPieceDirectly(state, player, pieceId, square) {
  setSquare(state, square.x, square.y, { owner: player, id: pieceId });
  const placed = state.setup.placedPieces[player];
  placed[pieceId] = (placed[pieceId] ?? 0) + 1;
}

function removeSquareFromList(squares, square) {
  const index = squares.findIndex(candidate => candidate.x === square.x && candidate.y === square.y);
  if (index >= 0) squares.splice(index, 1);
}

export function calculatePieceSetCost(state, pieces) {
  return Object.entries(pieces ?? {}).reduce((total, [pieceId, count]) => total + getPiecePoint(state.ruleset, pieceId) * count, 0);
}

function applyPackToPlayer(state, player, pack) {
  clearPlayerSetupBoard(state, player);
  state.setup.selectedPieces[player] = { ...pack.pieces };
  state.setup.placedPieces[player] = {};
}

function clearPlayerSetupBoard(state, player) {
  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const piece = getSquare(state, x, y);
      if (piece?.owner === player) setSquare(state, x, y, null);
    }
  }
}

function getMaxCopies(state, pieceId) {
  const maxCopies = getSetupConfig(state).maxCopies ?? {};
  return Number(maxCopies[pieceId] ?? maxCopies.default ?? 9);
}

function isSquareInPlacementZone(square, zone) {
  if (!zone) return true;
  if (zone.xMin != null && square.x < zone.xMin) return false;
  if (zone.xMax != null && square.x > zone.xMax) return false;
  if (zone.yMin != null && square.y < zone.yMin) return false;
  if (zone.yMax != null && square.y > zone.yMax) return false;
  return true;
}

function assertSetupActiveState(state) {
  if (!isSetupActive(state)) throw new Error("編成フェーズではありません。");
}

function assertSetupSelectionMutable(state, player) {
  assertSetupActiveState(state);
  if (!state.ruleset.players.includes(player)) throw new Error("未知の編成プレイヤーです。");
  if ((state.setup.flow ?? "sequential") !== "simultaneous" && player !== getSetupPlayer(state)) throw new Error("現在の編成プレイヤーではありません。");
  if (state.setup.finalizedPlayers.includes(player)) throw new Error("このプレイヤーの編成は確定済みです。");
}

export function createInitialPositionSnapshot(state) {
  return {
    board: {
      width: state.board.width,
      height: state.board.height,
      squares: state.board.squares.map(piece => piece ? { ...piece } : null)
    },
    hands: Object.fromEntries(Object.entries(state.hands ?? {}).map(([player, hand]) => [player, { ...hand }])),
    bases: (state.bases ?? []).map(base => ({ ...base })),
    turn: state.ruleset.firstTurn ?? state.ruleset.players[0]
  };
}

export function cloneInitialPositionSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    board: snapshot.board ? {
      width: snapshot.board.width,
      height: snapshot.board.height,
      squares: Array.isArray(snapshot.board.squares) ? snapshot.board.squares.map(piece => piece ? { ...piece } : null) : []
    } : null,
    hands: Object.fromEntries(Object.entries(snapshot.hands ?? {}).map(([player, hand]) => [player, { ...hand }])),
    bases: Array.isArray(snapshot.bases) ? snapshot.bases.map(base => ({ ...base })) : [],
    turn: snapshot.turn ?? null
  };
}

function logSetupEvent(state, player, action, detail = {}) {
  if (!state.setup) return;
  state.setup.seq = Number(state.setup.seq ?? 0) + 1;
  if (!Array.isArray(state.setup.setupLog)) state.setup.setupLog = [];
  state.setup.setupLog.push({
    seq: state.setup.seq,
    at: new Date().toISOString(),
    player,
    action,
    detail: JSON.parse(JSON.stringify(detail ?? {}))
  });
}

function cloneSetupLogEntry(entry) {
  return {
    seq: Number(entry.seq ?? 0),
    at: entry.at ?? null,
    player: entry.player ?? null,
    action: entry.action ?? "unknown",
    detail: JSON.parse(JSON.stringify(entry.detail ?? {}))
  };
}

function cloneNestedCounts(value = {}) {
  return Object.fromEntries(Object.entries(value).map(([key, counts]) => [key, { ...(counts ?? {}) }]));
}

function clonePack(pack) {
  return { id: pack.id, name: pack.name, pieces: { ...(pack.pieces ?? {}) } };
}

function normalizeRandomPool(state, pool = null) {
  const source = pool ?? getAllowedSetupPieces(state).map(pieceId => ({ pieceId, weight: 1 }));
  return source
    .map(item => typeof item === "string" ? { pieceId: item, weight: 1 } : item)
    .filter(item => item?.pieceId && state.ruleset.pieces[item.pieceId] && Number(item.weight ?? 1) > 0)
    .filter(item => {
      const usage = state.ruleset.pieces[item.pieceId]?.usage ?? "standard";
      return state.ruleset.testOnly || usage !== "test";
    });
}

function weightedPick(pool, rng) {
  const total = pool.reduce((sum, item) => sum + Number(item.weight ?? 1), 0);
  let threshold = rng() * total;
  for (const item of pool) {
    threshold -= Number(item.weight ?? 1);
    if (threshold <= 0) return item.pieceId;
  }
  return pool.at(-1).pieceId;
}

function createSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeededRandom(seed) {
  let hash = 2166136261;
  for (const ch of String(seed)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return function random() {
    hash += 0x6D2B79F5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
 
 
