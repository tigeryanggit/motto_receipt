export const IMAGE_EXTENSIONS = [".jpeg", ".jpg", ".png", ".bmp"] as const;

export type ReceiptRecord = {
  fileName: string;
  productName: string;
  totalPrice: string;
  date: string;
};

export function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("");
}

export function buildCsvFilename(date = new Date()): string {
  return `Receipts_${formatTimestamp(date)}.csv`;
}
