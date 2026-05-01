export function createConnectionLog(options = {}) {
  return {
    maxEntries: Math.max(1, Number(options.maxEntries ?? 80)),
    nextId: 1,
    entries: []
  };
}

export function addConnectionLog(log, entry, now = new Date()) {
  if (!log || !Array.isArray(log.entries)) {
    throw new Error("通信ログの形式が不正です。");
  }

  const normalized = {
    id: log.nextId,
    at: now instanceof Date ? now.toISOString() : String(now),
    level: entry.level ?? "info",
    direction: entry.direction ?? "local",
    type: entry.type ?? "event",
    text: entry.text ?? "",
    detail: entry.detail ?? null
  };

  log.nextId += 1;
  log.entries.push(normalized);

  while (log.entries.length > log.maxEntries) {
    log.entries.shift();
  }

  return normalized;
}

export function clearConnectionLog(log) {
  if (!log || !Array.isArray(log.entries)) return;
  log.entries.length = 0;
}

export function summarizeMessage(message) {
  if (!message || typeof message !== "object") return "不明なメッセージ";

  const seq = Number.isInteger(message.seq) ? ` #${message.seq}` : "";
  const type = message.type ?? "unknown";
  const player = message.player ? ` ${message.player}` : "";

  if (type === "setup") return `編成同期${seq}${player}${message.setupAction ? ` (${message.setupAction})` : ""}`;
  if (type === "move") return `指し手${seq}${player}`;
  if (type === "sync") return `局面同期${message.record?.history ? ` ${message.record.history.length}手` : ""}`;
  if (type === "sync-request") return `局面同期要求${seq}${message.reason ? ` (${message.reason})` : ""}`;
  if (type === "clock") return `時計同期${seq}`;
  if (type === "resign") return `投了${seq}${player}`;
  if (type === "ping") return `疎通確認${seq}`;
  if (type === "pong") return `疎通応答${seq}`;

  return `${type}${seq}${player}`.trim();
}

export function createSnapshotText(snapshot) {
  if (!snapshot) return "未接続";
  const parts = [
    `状態=${snapshot.status ?? "unknown"}`,
    `接続=${snapshot.connected ? "yes" : "no"}`,
    `役割=${snapshot.role ?? "-"}`,
    `手番=${snapshot.localPlayer ?? "-"}`
  ];

  if (snapshot.spectating) parts.push("観戦=yes");
  if (snapshot.connectionState) parts.push(`pc=${snapshot.connectionState}`);
  if (snapshot.iceConnectionState) parts.push(`ice=${snapshot.iceConnectionState}`);
  if (snapshot.channelState) parts.push(`dc=${snapshot.channelState}`);
  if (snapshot.peerCount != null) parts.push(`peers=${snapshot.peerCount}`);

  return parts.join(" / ");
}
