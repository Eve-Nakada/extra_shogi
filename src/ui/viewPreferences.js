export const VIEW_PREFERENCES_KEY = "shogi-html:view-preferences";

export const DEFAULT_VIEW_PREFERENCES = {
  perspective: "black",
  showLegalMoves: true,
  confirmResign: true,
  confirmReset: true
};

export function normalizeViewPreferences(value = {}) {
  return {
    perspective: value.perspective === "white" ? "white" : "black",
    showLegalMoves: value.showLegalMoves !== false,
    confirmResign: value.confirmResign !== false,
    confirmReset: value.confirmReset !== false
  };
}

export function loadViewPreferences(storage = globalThis.localStorage) {
  if (!storage) return { ...DEFAULT_VIEW_PREFERENCES };

  try {
    const text = storage.getItem(VIEW_PREFERENCES_KEY);
    if (!text) return { ...DEFAULT_VIEW_PREFERENCES };
    return normalizeViewPreferences(JSON.parse(text));
  } catch (error) {
    return { ...DEFAULT_VIEW_PREFERENCES };
  }
}

export function saveViewPreferences(preferences, storage = globalThis.localStorage) {
  if (!storage) return;

  try {
    storage.setItem(VIEW_PREFERENCES_KEY, JSON.stringify(normalizeViewPreferences(preferences)));
  } catch (error) {
    // localStorage can be unavailable in private browsing or restricted contexts.
  }
}
 
 
