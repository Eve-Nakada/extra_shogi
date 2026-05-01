const QR_WARNING_LENGTH = 1800;
const SCAN_INTERVAL_MS = 350;

export function initSignalQrTools(elements, callbacks = {}) {
  let stream = null;
  let scanTimer = null;
  let detector = null;

  elements.showSignalQrButton.addEventListener("click", () => renderSignalQr(elements, callbacks));
  elements.scanSignalQrButton.addEventListener("click", () => startQrScan());
  elements.stopSignalQrScanButton.addEventListener("click", () => stopQrScan("QR読み取りを停止しました。"));
  elements.signalQrFileInput.addEventListener("change", () => readQrFromSelectedImage());

  async function startQrScan() {
    if (!window.isSecureContext) {
      callbacks.setMessage?.("カメラ読み取りにはHTTPSまたはlocalhostの安全な環境が必要です。");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      callbacks.setMessage?.("このブラウザはカメラ読み取りに対応していません。入力コード欄へ手動で貼り付けてください。");
      return;
    }

    if (!("BarcodeDetector" in window)) {
      callbacks.setMessage?.("このブラウザはQRのカメラ認識に未対応です。QR画像読み取り、または手動貼り付けを使ってください。");
      return;
    }

    try {
      detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      elements.signalQrVideo.srcObject = stream;
      elements.signalQrVideo.hidden = false;
      elements.stopSignalQrScanButton.hidden = false;
      elements.scanSignalQrButton.disabled = true;
      await elements.signalQrVideo.play();
      scanTimer = window.setInterval(scanVideoFrame, SCAN_INTERVAL_MS);
      callbacks.addLog?.("qr-scan", "QRカメラ読み取りを開始しました。");
      callbacks.setMessage?.("カメラを起動しました。相手のQRコードを画面内に入れてください。");
    } catch (error) {
      stopQrScan();
      callbacks.setMessage?.(createCameraErrorMessage(error));
    }
  }

  async function scanVideoFrame() {
    if (!detector || elements.signalQrVideo.hidden) return;
    try {
      const results = await detector.detect(elements.signalQrVideo);
      const value = results?.[0]?.rawValue?.trim();
      if (!value) return;
      applyDecodedSignal(value, "QRコードを読み取り、入力コードへ反映しました。内容を確認してから接続操作を続けてください。");
      stopQrScan();
    } catch (error) {
      callbacks.addLog?.("qr-scan-error", "QR読み取り中にエラーが発生しました。", String(error?.message ?? error));
    }
  }

  async function readQrFromSelectedImage() {
    const file = elements.signalQrFileInput.files?.[0];
    if (!file) return;

    if (!("BarcodeDetector" in window)) {
      callbacks.setMessage?.("このブラウザはQR画像認識に未対応です。入力コード欄へ手動で貼り付けてください。");
      elements.signalQrFileInput.value = "";
      return;
    }

    try {
      const image = await createImageBitmap(file);
      const imageDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const results = await imageDetector.detect(image);
      const value = results?.[0]?.rawValue?.trim();
      if (!value) {
        callbacks.setMessage?.("選択した画像からQRコードを読み取れませんでした。");
        return;
      }
      applyDecodedSignal(value, "QR画像を読み取り、入力コードへ反映しました。内容を確認してから接続操作を続けてください。");
    } catch (error) {
      callbacks.setMessage?.("QR画像の読み取りに失敗しました。");
      callbacks.addLog?.("qr-image-error", "QR画像の読み取りに失敗しました。", String(error?.message ?? error));
    } finally {
      elements.signalQrFileInput.value = "";
    }
  }

  function applyDecodedSignal(value, message) {
    elements.signalInput.value = value;
    callbacks.addLog?.("qr-read", "QRコードから入力コードを読み取りました。", summarizeDecodedValue(value));
    callbacks.setMessage?.(message);
  }

  function stopQrScan(message = null) {
    if (scanTimer) {
      window.clearInterval(scanTimer);
      scanTimer = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    detector = null;
    elements.signalQrVideo.pause?.();
    elements.signalQrVideo.srcObject = null;
    elements.signalQrVideo.hidden = true;
    elements.stopSignalQrScanButton.hidden = true;
    elements.scanSignalQrButton.disabled = false;
    if (message) callbacks.setMessage?.(message);
  }
}

async function renderSignalQr(elements, callbacks = {}) {
  const text = elements.signalOutput.value.trim();
  if (!text) {
    callbacks.setMessage?.("QR表示する出力コードがありません。");
    return;
  }

  elements.signalQrOutput.replaceChildren();

  if (!window.QRCode?.toCanvas) {
    callbacks.setMessage?.("QRコード生成ライブラリを読み込めませんでした。出力コードのコピーを使ってください。");
    return;
  }

  try {
    const canvas = document.createElement("canvas");
    await window.QRCode.toCanvas(canvas, text, {
      errorCorrectionLevel: text.length > QR_WARNING_LENGTH ? "L" : "M",
      margin: 2,
      width: 320
    });
    elements.signalQrOutput.appendChild(canvas);

    const lengthNote = text.length > QR_WARNING_LENGTH
      ? "コードが長いため、読み取りにくい場合はコピー貼り付けを使ってください。"
      : "相手の端末で読み取ってください。";
    callbacks.addLog?.("qr-create", "出力コードをQR表示しました。", { length: text.length });
    callbacks.setMessage?.(`出力コードをQR表示しました。${lengthNote}`);
  } catch (error) {
    callbacks.setMessage?.("QRコードの作成に失敗しました。出力コードが長すぎる可能性があります。");
    callbacks.addLog?.("qr-create-error", "QRコードの作成に失敗しました。", String(error?.message ?? error));
  }
}

function summarizeDecodedValue(value) {
  try {
    const parsed = JSON.parse(value);
    return {
      type: parsed.type ?? null,
      gameId: parsed.gameId ?? null,
      version: parsed.version ?? parsed.protocolVersion ?? null,
      length: value.length
    };
  } catch {
    return { length: value.length, json: false };
  }
}

function createCameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "カメラ権限が許可されませんでした。ブラウザの権限設定を確認してください。";
  if (error?.name === "NotFoundError") return "利用できるカメラが見つかりませんでした。";
  if (error?.name === "NotReadableError") return "カメラを開始できませんでした。他のアプリが使用中の可能性があります。";
  return "カメラを起動できませんでした。HTTPS環境、ブラウザ権限、カメラ設定を確認してください。";
}
