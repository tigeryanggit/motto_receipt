export function parseReceiptDate(
  value: string
): { iso: string; monthKey: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    iso: value,
    monthKey: `${year}${String(month).padStart(2, "0")}`,
  };
}

export function parseAmount(value: string): string | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function nextReference(monthKey: string, existingNames: string[]): string {
  const pattern = new RegExp(`^${monthKey}-(\\d{4})\\.jpg$`, "i");
  let max = 0;

  for (const name of existingNames) {
    const match = pattern.exec(name);
    if (!match) {
      continue;
    }
    max = Math.max(max, Number(match[1]));
  }

  const next = max + 1;
  if (next > 9999) {
    throw new Error("本月參考編號已滿。");
  }

  return `${monthKey}-${String(next).padStart(4, "0")}`;
}

export function referenceFileName(reference: string): string {
  return `${reference}.jpg`;
}
