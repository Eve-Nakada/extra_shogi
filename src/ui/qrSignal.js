const QR_WARNING_LENGTH = 1800;
const SCAN_INTERVAL_MS = 350;

export function initSignalQrTools(elements, callbacks = {}) {
  let stream = null;
  let scanTimer = null;
  let detector = null;

  elements.showSignalQrButton.addEventListener("click", () => {
    renderSignalQr(elements, callbacks).catch(error => {
      callbacks.setMessage?.("QRコード表示中にエラーが発生しました。出力コードのコピーを使ってください。");
      notifyLog(callbacks, "qr-create-error", "QRコード表示中にエラーが発生しました。", String(error?.message ?? error));
    });
  });
  elements.scanSignalQrButton.addEventListener("click", () => startQrScan());
  elements.stopSignalQrScanButton.addEventListener("click", () => stopQrScan("QR読み取りを停止しました。"));
  elements.signalQrFileInput.addEventListener("change", () => readQrFromSelectedImage());

  async function startQrScan() {
    if (!window.isSecureContext) {
      callbacks.setMessage?.("カメラ読み取りにはHTTPSまたはlocalhostの安全な環境が必要です。QR画像読み取り、または手動貼り付けを使ってください。");
      notifyLog(callbacks, "qr-scan-error", "安全な環境ではないため、カメラを開始できませんでした。", { isSecureContext: window.isSecureContext });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      callbacks.setMessage?.("このブラウザはカメラ読み取りに対応していません。入力コード欄へ手動で貼り付けてください。");
      notifyLog(callbacks, "qr-scan-error", "getUserMediaが利用できません。");
      return;
    }

    const canDecode = isBarcodeDetectorAvailable() || isJsQrAvailable();
    if (!canDecode) {
      callbacks.setMessage?.("QR読み取りライブラリを利用できません。ネットワーク接続を確認するか、入力コード欄へ手動で貼り付けてください。");
      notifyLog(callbacks, "qr-scan-error", "BarcodeDetector/jsQRのどちらも利用できません。");
      return;
    }

    try {
      detector = isBarcodeDetectorAvailable()
        ? new window.BarcodeDetector({ formats: ["qr_code"] })
        : null;
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
      const decoderName = detector ? "BarcodeDetector" : "jsQR";
      notifyLog(callbacks, "qr-scan", `QRカメラ読み取りを開始しました。方式: ${decoderName}`);
      callbacks.setMessage?.("カメラを起動しました。相手のQRコードを画面内に入れてください。");
    } catch (error) {
      stopQrScan();
      callbacks.setMessage?.(createCameraErrorMessage(error));
      notifyLog(callbacks, "qr-scan-error", "カメラを起動できませんでした。", String(error?.message ?? error));
    }
  }

  async function scanVideoFrame() {
    if (elements.signalQrVideo.hidden) return;
    try {
      const value = detector
        ? await decodeWithBarcodeDetector(detector, elements.signalQrVideo)
        : decodeVideoWithJsQr(elements);
      if (!value) return;
      applyDecodedSignal(value, "QRコードを読み取り、入力コードへ反映しました。内容を確認してから接続操作を続けてください。");
      stopQrScan();
    } catch (error) {
      notifyLog(callbacks, "qr-scan-error", "QR読み取り中にエラーが発生しました。", String(error?.message ?? error));
    }
  }

  async function readQrFromSelectedImage() {
    const file = elements.signalQrFileInput.files?.[0];
    if (!file) return;

    const canDecode = isBarcodeDetectorAvailable() || isJsQrAvailable();
    if (!canDecode) {
      callbacks.setMessage?.("QR画像読み取りライブラリを利用できません。入力コード欄へ手動で貼り付けてください。 ");
      elements.signalQrFileInput.value = "";
      notifyLog(callbacks, "qr-image-error", "BarcodeDetector/jsQRのどちらも利用できません。");
      return;
    }

    try {
      const value = isBarcodeDetectorAvailable()
        ? await decodeImageFileWithBarcodeDetector(file)
        : await decodeImageFileWithJsQr(file, elements);
      if (!value) {
        callbacks.setMessage?.("選択した画像からQRコードを読み取れませんでした。");
        notifyLog(callbacks, "qr-image", "選択した画像からQRコードを読み取れませんでした。", { name: file.name, size: file.size });
        return;
      }
      applyDecodedSignal(value, "QR画像を読み取り、入力コードへ反映しました。内容を確認してから接続操作を続けてください。");
    } catch (error) {
      callbacks.setMessage?.("QR画像の読み取りに失敗しました。");
      notifyLog(callbacks, "qr-image-error", "QR画像の読み取りに失敗しました。", String(error?.message ?? error));
    } finally {
      elements.signalQrFileInput.value = "";
    }
  }

  function applyDecodedSignal(value, message) {
    elements.signalInput.value = value;
    notifyLog(callbacks, "qr-read", "QRコードから入力コードを読み取りました。", summarizeDecodedValue(value));
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
    if (message) {
      callbacks.setMessage?.(message);
      notifyLog(callbacks, "qr-scan", message);
    }
  }
}

async function renderSignalQr(elements, callbacks = {}) {
  const text = elements.signalOutput.value.trim();
  if (!text) {
    callbacks.setMessage?.("QR表示する出力コードがありません。先にホスト開始、またはゲスト回答作成を行ってください。");
    notifyLog(callbacks, "qr-create", "QR表示する出力コードがありません。");
    return;
  }

  elements.signalQrOutput.replaceChildren();

  if (!isQrCreateAvailable()) {
    callbacks.setMessage?.("QRコード生成ライブラリを読み込めませんでした。出力コードのコピーを使ってください。");
    notifyLog(callbacks, "qr-create-error", "QRCodeライブラリを利用できません。", {
      hasQRCode: Boolean(window.QRCode),
      hasNodeQrApi: Boolean(window.QRCode?.toCanvas),
      hasQrCodeJsApi: typeof window.QRCode === "function"
    });
    return;
  }

  try {
    await createQrCode(elements.signalQrOutput, text, {
      errorCorrectionLevel: text.length > QR_WARNING_LENGTH ? "L" : "M",
      width: 320
    });

    const lengthNote = text.length > QR_WARNING_LENGTH
      ? "コードが長いため、読み取りにくい場合はコピー貼り付けを使ってください。"
      : "相手の端末で読み取ってください。";
    notifyLog(callbacks, "qr-create", "出力コードをQR表示しました。", { length: text.length });
    callbacks.setMessage?.(`出力コードをQR表示しました。${lengthNote}`);
  } catch (error) {
    callbacks.setMessage?.("QRコードの作成に失敗しました。出力コードが長すぎる可能性があります。");
    notifyLog(callbacks, "qr-create-error", "QRコードの作成に失敗しました。", String(error?.message ?? error));
  }
}

function isQrCreateAvailable() {
  return Boolean(window.QRCode?.toCanvas) || typeof window.QRCode === "function";
}

async function createQrCode(container, text, options = {}) {
  container.replaceChildren();

  if (window.QRCode?.toCanvas) {
    const canvas = document.createElement("canvas");
    await window.QRCode.toCanvas(canvas, text, {
      errorCorrectionLevel: options.errorCorrectionLevel ?? "M",
      margin: 2,
      width: options.width ?? 320
    });
    container.appendChild(canvas);
    return;
  }

  if (typeof window.QRCode === "function") {
    const correctLevel = options.errorCorrectionLevel === "L"
      ? window.QRCode.CorrectLevel?.L
      : window.QRCode.CorrectLevel?.M;
    new window.QRCode(container, {
      text,
      width: options.width ?? 320,
      height: options.width ?? 320,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: correctLevel ?? window.QRCode.CorrectLevel?.M
    });
    return;
  }

  throw new Error("QRCode library is not available.");
}

function isBarcodeDetectorAvailable() {
  return "BarcodeDetector" in window;
}

function isJsQrAvailable() {
  return typeof window.jsQR === "function";
}

async function decodeWithBarcodeDetector(detector, source) {
  const results = await detector.detect(source);
  return results?.[0]?.rawValue?.trim() ?? null;
}

function decodeVideoWithJsQr(elements) {
  const video = elements.signalQrVideo;
  if (!video.videoWidth || !video.videoHeight) return null;
  const imageData = drawSourceToImageData(video, video.videoWidth, video.videoHeight, elements);
  const result = window.jsQR(imageData.data, imageData.width, imageData.height);
  return result?.data?.trim() ?? null;
}

async function decodeImageFileWithBarcodeDetector(file) {
  const image = await createImageBitmap(file);
  const imageDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
  const results = await imageDetector.detect(image);
  image.close?.();
  return results?.[0]?.rawValue?.trim() ?? null;
}

async function decodeImageFileWithJsQr(file, elements) {
  const image = await createImageBitmap(file);
  try {
    const imageData = drawSourceToImageData(image, image.width, image.height, elements);
    const result = window.jsQR(imageData.data, imageData.width, imageData.height);
    return result?.data?.trim() ?? null;
  } finally {
    image.close?.();
  }
}

function drawSourceToImageData(source, width, height, elements) {
  const canvas = elements.signalQrCanvas;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function notifyLog(callbacks, type, text, detail = null) {
  callbacks.addLog?.(type, text, detail);
  callbacks.onUpdate?.();
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
