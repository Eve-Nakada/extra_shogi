import { inBoard } from "./coordinates.js";

export const DEFAULT_BASE_DEFS = {
  castle: {
    name: "御城",
    display: "城",
    providesDropZone: true,
    dropRadius: 1,
    allowedLayers: ["ground"]
  },

  carrier: {
    name: "空母",
    display: "母",
    providesDropZone: true,
    dropRadius: 1,
    allowedLayers: ["ground"],
    futureAllowedLayers: ["air"],
    enablesLayerTransfer: false
  }
};

export function getBaseDefs(ruleset) {
  return ruleset.baseDefs ?? ruleset.bases ?? DEFAULT_BASE_DEFS;
}

export function getBaseDef(stateOrRuleset, baseType) {
  const ruleset = stateOrRuleset.ruleset ?? stateOrRuleset;
  return getBaseDefs(ruleset)[baseType] ?? null;
}

export function cloneBase(base) {
  if (!base) return null;
  return {
    id: base.id,
    owner: base.owner,
    kind: base.kind,
    x: base.x,
    y: base.y,
    layer: base.layer ?? "ground",
    hp: base.hp ?? null,
    providesDropZone: base.providesDropZone !== false,
    dropRadius: Number(base.dropRadius ?? 1)
  };
}

export function cloneBases(bases = []) {
  return Array.isArray(bases) ? bases.map(cloneBase).filter(Boolean) : [];
}

export function createBaseFromAction(state, owner, action) {
  const baseDef = getBaseDef(state, action.baseType);
  if (!baseDef) {
    throw new Error(`未知の拠点種別です: ${action.baseType}`);
  }

  return {
    id: action.id ?? createBaseId(state, owner, action.baseType),
    owner,
    kind: action.baseType,
    x: action.to.x,
    y: action.to.y,
    layer: action.to.layer ?? "ground",
    hp: baseDef.hp ?? null,
    providesDropZone: baseDef.providesDropZone !== false,
    dropRadius: Number(baseDef.dropRadius ?? 1)
  };
}

export function createBaseId(state, owner, kind) {
  const index = (state.bases?.length ?? 0) + 1;
  return `${owner}-${kind}-${index}`;
}

export function findBaseAt(state, x, y, layer = "ground") {
  return (state.bases ?? []).find(base => base.x === x && base.y === y && (base.layer ?? "ground") === layer) ?? null;
}

export function hasBaseAt(state, x, y, layer = "ground") {
  return Boolean(findBaseAt(state, x, y, layer));
}

export function removeBaseById(state, id) {
  if (!Array.isArray(state.bases)) state.bases = [];
  const index = state.bases.findIndex(base => base.id === id);
  if (index === -1) return false;
  state.bases.splice(index, 1);
  return true;
}

export function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isInOwnDropZone(state, player, square, options = {}) {
  const baseKinds = options.baseKinds ?? null;
  const ownBases = (state.bases ?? []).filter(base => {
    if (base.owner !== player) return false;
    if (base.providesDropZone === false) return false;
    if (baseKinds && !baseKinds.includes(base.kind)) return false;
    return true;
  });

  if (ownBases.length === 0) {
    return Boolean(options.allowInitialCampIfNoBase && isOwnCamp(state, player, square));
  }

  return ownBases.some(base => {
    const radius = Number(options.radius ?? base.dropRadius ?? getBaseDef(state, base.kind)?.dropRadius ?? 1);
    return chebyshevDistance(base, square) <= radius;
  });
}

export function isDropAllowedByPolicy(state, player, square) {
  const drops = state.ruleset.drops ?? { enabled: true, policy: "anywhere" };
  if (drops.enabled === false || drops.policy === "none") return false;
  if (drops.policy === "anywhere" || !drops.policy) return true;
  if (drops.policy === "ownCampOnly") return isOwnCamp(state, player, square);
  if (drops.policy === "nearOwnBase") {
    return isInOwnDropZone(state, player, square, {
      baseKinds: drops.baseKinds ?? null,
      radius: drops.radius,
      allowInitialCampIfNoBase: drops.allowInitialCampIfNoBase !== false
    });
  }
  return true;
}

export function isOwnCamp(state, player, square) {
  if (!inBoard(square.x, square.y, state.board)) return false;
  const depth = state.ruleset.promotion?.depth ?? 3;
  return player === "black"
    ? square.y >= state.board.height - depth
    : square.y < depth;
}
