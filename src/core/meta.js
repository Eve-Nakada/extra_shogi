export function createDefaultMeta(now = new Date()) {
  const iso = now instanceof Date ? now.toISOString() : String(now);
  return {
    title: "",
    blackName: "先手",
    whiteName: "後手",
    eventName: "",
    location: "",
    startedAt: iso,
    endedAt: null,
    notes: ""
  };
}

export function normalizeGameMeta(meta = {}, now = new Date()) {
  const defaults = createDefaultMeta(now);
  return {
    title: normalizeText(meta.title, defaults.title),
    blackName: normalizeText(meta.blackName, defaults.blackName),
    whiteName: normalizeText(meta.whiteName, defaults.whiteName),
    eventName: normalizeText(meta.eventName, defaults.eventName),
    location: normalizeText(meta.location, defaults.location),
    startedAt: normalizeText(meta.startedAt, defaults.startedAt),
    endedAt: meta.endedAt ? String(meta.endedAt) : null,
    notes: normalizeText(meta.notes, defaults.notes)
  };
}

export function cloneGameMeta(meta) {
  return normalizeGameMeta(meta ?? createDefaultMeta());
}

export function completeGameMeta(meta, endedAt = new Date()) {
  const normalized = normalizeGameMeta(meta);
  if (!normalized.endedAt) {
    normalized.endedAt = endedAt instanceof Date ? endedAt.toISOString() : String(endedAt);
  }
  return normalized;
}

export function playerDisplayNameFromMeta(meta, player) {
  const normalized = normalizeGameMeta(meta);
  if (player === "black") return normalized.blackName || "先手";
  if (player === "white") return normalized.whiteName || "後手";
  return "観戦者";
}

function normalizeText(value, fallback) {
  if (value == null) return fallback;
  return String(value).trim();
}
 
 
