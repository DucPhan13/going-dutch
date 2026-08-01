export const MAX_RECEIPT_FILE_BYTES = 2 * 1024 * 1024;
// Leave room for the rest of a group's CRDT document under its 10 MB sync cap.
export const MAX_GROUP_RECEIPT_BYTES = 8 * 1024 * 1024;
const MAX_RECEIPT_DIMENSION = 1_600;
const MAX_RECEIPT_DATA_URL_BYTES = 2 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be read."));
    };
    image.src = objectUrl;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("This image could not be processed."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("This image could not be processed."));
      reader.readAsDataURL(blob);
    }, "image/jpeg", quality);
  });
}

/**
 * Re-encodes receipts before storage. Drawing into a canvas removes EXIF and
 * limits both image dimensions and the data URL copied into the sync document.
 */
export async function prepareReceipt(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file for the receipt.");
  if (file.size > MAX_RECEIPT_FILE_BYTES) throw new Error("Receipt files must be 2 MB or smaller.");

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_RECEIPT_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process receipt images.");
  context.drawImage(image, 0, 0, width, height);

  for (const quality of [0.82, 0.7, 0.58]) {
    const receiptData = await canvasToDataUrl(canvas, quality);
    if (receiptData.length <= MAX_RECEIPT_DATA_URL_BYTES) return receiptData;
  }
  throw new Error("Receipt is still too large after compression. Choose a smaller image.");
}
