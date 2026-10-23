import type { ReceiptRecord } from "./constants";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function recordsToCsv(records: ReceiptRecord[]): string {
  const header = ["檔案名稱", "貨品名稱", "總價錢", "日期"];
  const rows = records.map((record) => [
    record.fileName,
    record.productName,
    record.totalPrice,
    record.date,
  ]);

  const lines = [header, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(cell)).join(",")
  );

  return `\uFEFF${lines.join("\r\n")}`;
}

export function createCsvBlob(records: ReceiptRecord[]): Blob {
  return new Blob([recordsToCsv(records)], {
    type: "text/csv;charset=utf-8;",
  });
}

export function triggerCsvDownload(
  records: ReceiptRecord[],
  filename: string
): void {
  const blob = createCsvBlob(records);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
