import { inBoard } from "./coordinates.js";

export const DEFAULT_BASE_DEFS = {
  castle: {
    name: "御城",
    display: "城",
    hp: 3,
    providesDropZone: true,
    dropRadius: 1,
    captureMode: "occupy",
    allowedLayers: ["ground"]
  },

  carrier: {
    name: "空母",
    display: "母",
    hp: 2,
    providesDropZone: true,
    dropRadius: 2,
    captureMode: "destroy",
    allowedLayers: ["ground"],
    futureAllowedLayers: ["air"],
    enablesLayerTransfer: false,
    preparedForAirLayer: true
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
    maxHp: base.maxHp ?? base.hp ?? null,
    providesDropZone: base.providesDropZone !== false,
    dropRadius: Number(base.dropRadius ?? 1),
    captureMode: base.captureMode ?? null,
    preparedForAirLayer: Boolean(base.preparedForAirLayer)
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
    maxHp: baseDef.hp ?? null,
    providesDropZone: baseDef.providesDropZone !== false,
    dropRadius: Number(baseDef.dropRadius ?? 1),
    captureMode: baseDef.captureMode ?? null,
    preparedForAirLayer: Boolean(baseDef.preparedForAirLayer)
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
  if (options.allowOwnCampAlways && isOwnCamp(state, player, square)) return true;

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
      allowInitialCampIfNoBase: drops.allowInitialCampIfNoBase !== false,
      allowOwnCampAlways: drops.allowOwnCampAlways === true
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

export function getBaseMaxHp(state, base) {
  const baseDef = getBaseDef(state, base.kind);
  return Number(base.maxHp ?? baseDef?.hp ?? base.hp ?? 1);
}

export function getBaseCaptureMode(state, base) {
  const baseDef = getBaseDef(state, base.kind);
  return base.captureMode ?? baseDef?.captureMode ?? "destroy";
}

export function damageBase(state, baseId, attacker, damage = 1) {
  if (!Array.isArray(state.bases)) state.bases = [];
  const index = state.bases.findIndex(base => base.id === baseId);
  if (index === -1) throw new Error("攻撃対象の拠点が見つかりません。");

  const before = cloneBase(state.bases[index]);
  const actualDamage = Math.max(1, Number(damage ?? 1));
  const currentHp = Number(state.bases[index].hp ?? getBaseMaxHp(state, state.bases[index]));
  state.bases[index].hp = currentHp - actualDamage;

  let outcome = "damaged";
  if (state.bases[index].hp <= 0) {
    const mode = getBaseCaptureMode(state, state.bases[index]);
    if (mode === "occupy") {
      state.bases[index].owner = attacker;
      state.bases[index].hp = getBaseMaxHp(state, state.bases[index]);
      outcome = "occupied";
    } else {
      state.bases.splice(index, 1);
      outcome = "destroyed";
    }
  }

  const after = outcome === "destroyed" ? null : cloneBase(state.bases.find(base => base.id === baseId));
  return { before, after, outcome, damage: actualDamage };
}

export function restoreBaseSnapshot(state, before) {
  if (!Array.isArray(state.bases)) state.bases = [];
  if (!before?.id) return;
  const index = state.bases.findIndex(base => base.id === before.id);
  if (index >= 0) {
    state.bases[index] = cloneBase(before);
  } else {
    state.bases.push(cloneBase(before));
  }
}
