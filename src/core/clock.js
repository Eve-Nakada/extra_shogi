 
import { opposite } from "./state.js";

export const DEFAULT_CLOCK_CONFIG = {
  enabled: false,
  initialMs: 10 * 60 * 1000,
  incrementMs: 0
};

export function createClock(config = DEFAULT_CLOCK_CONFIG, players = ["black", "white"]) {
  const normalized = normalizeClockConfig(config);
  return {
    config: normalized,
    remainingMs: Object.fromEntries(players.map(player => [player, normalized.initialMs])),
    running: false,
    activePlayer: null,
    lastStartedAt: null,
    flagFallPlayer: null
  };
}

export function normalizeClockConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    initialMs: Math.max(0, Number(config.initialMs ?? DEFAULT_CLOCK_CONFIG.initialMs)),
    incrementMs: Math.max(0, Number(config.incrementMs ?? DEFAULT_CLOCK_CONFIG.incrementMs))
  };
}

export function cloneClock(clock) {
  if (!clock) return null;
  return {
    config: { ...clock.config },
    remainingMs: { ...clock.remainingMs },
    running: Boolean(clock.running),
    activePlayer: clock.activePlayer ?? null,
    lastStartedAt: clock.lastStartedAt ?? null,
    flagFallPlayer: clock.flagFallPlayer ?? null
  };
}

export function startClock(clock, player, now = Date.now()) {
  if (!clock?.config?.enabled || clock.flagFallPlayer) return clock;
  clock.running = true;
  clock.activePlayer = player;
  clock.lastStartedAt = now;
  return clock;
}

export function pauseClock(clock, now = Date.now()) {
  if (!clock?.running) return clock;
  commitElapsed(clock, now);
  clock.running = false;
  clock.lastStartedAt = null;
  return clock;
}

export function switchClockAfterMove(clock, mover, ruleset, now = Date.now()) {
  if (!clock?.config?.enabled || clock.flagFallPlayer) return clock;

  if (clock.running && clock.activePlayer === mover) {
    commitElapsed(clock, now);
  }

  if (!clock.flagFallPlayer) {
    clock.remainingMs[mover] = Math.max(0, (clock.remainingMs[mover] ?? 0) + clock.config.incrementMs);
    clock.activePlayer = opposite(ruleset, mover);
    clock.running = true;
    clock.lastStartedAt = now;
  }

  return clock;
}

export function updateClock(clock, now = Date.now()) {
  if (!clock?.config?.enabled || !clock.running || !clock.activePlayer || clock.flagFallPlayer) {
    return clock;
  }

  const elapsed = Math.max(0, now - (clock.lastStartedAt ?? now));
  const base = clock.remainingMs[clock.activePlayer] ?? 0;
  if (base - elapsed <= 0) {
    clock.remainingMs[clock.activePlayer] = 0;
    clock.flagFallPlayer = clock.activePlayer;
    clock.running = false;
    clock.lastStartedAt = null;
  }

  return clock;
}

export function getDisplayRemainingMs(clock, player, now = Date.now()) {
  if (!clock?.config?.enabled) return null;

  let remaining = clock.remainingMs[player] ?? 0;
  if (clock.running && clock.activePlayer === player && !clock.flagFallPlayer) {
    remaining -= Math.max(0, now - (clock.lastStartedAt ?? now));
  }

  return Math.max(0, remaining);
}

export function formatClockMs(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function commitElapsed(clock, now) {
  const player = clock.activePlayer;
  if (!player) return;

  const elapsed = Math.max(0, now - (clock.lastStartedAt ?? now));
  const next = Math.max(0, (clock.remainingMs[player] ?? 0) - elapsed);
  clock.remainingMs[player] = next;
  if (next <= 0) {
    clock.flagFallPlayer = player;
  }
}
 
 
