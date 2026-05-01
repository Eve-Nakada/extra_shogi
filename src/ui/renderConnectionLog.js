export function renderConnectionLog(element, log) {
  element.innerHTML = "";

  if (!log?.entries?.length) {
    const empty = document.createElement("li");
    empty.className = "connection-log-empty";
    empty.textContent = "通信ログなし";
    element.appendChild(empty);
    return;
  }

  for (const entry of [...log.entries].reverse()) {
    const item = document.createElement("li");
    item.className = `connection-log-item ${entry.level} ${entry.direction}`;

    const meta = document.createElement("span");
    meta.className = "connection-log-meta";
    meta.textContent = `${formatTime(entry.at)} ${directionLabel(entry.direction)} ${entry.type}`;

    const text = document.createElement("span");
    text.className = "connection-log-text";
    text.textContent = entry.text;

    item.appendChild(meta);
    item.appendChild(text);
    element.appendChild(item);
  }
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("ja-JP", { hour12: false });
}

function directionLabel(direction) {
  if (direction === "out") return "送信";
  if (direction === "in") return "受信";
  if (direction === "error") return "エラー";
  return "内部";
}
