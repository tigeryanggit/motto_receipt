const DATE_PATTERNS = [
  /(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})[日號]?/,
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
  /(\d{4})(\d{2})(\d{2})/,
  /Date[:\s]*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
];

const TOTAL_KEYWORDS =
  /(?:總計|合計|總價|總額|應付|實付|找零前|amount|total|grand\s*total|sub\s*total|balance)/i;

const PRICE_PATTERN = /[\$HK]?[\s]*([\d,]+\.?\d{0,2})/;

const SKIP_LINE =
  /^(收據|receipt|invoice|日期|date|時間|time|單號|tel|電話|地址|address|qty|數量|unit|price|amount|小計|subtotal|thank|多謝|歡迎|welcome|\*+|=-+|_+|page|\d+\s*\/\s*\d+)$/i;

const HEADER_LINE =
  /^(品名|貨品|商品|item|description|desc|名稱|product|項目)/i;

function normalizeDate(match: RegExpMatchArray): string {
  if (match[0].toLowerCase().includes("date")) {
    const [, a, b, c] = match;
    const year = c.length === 2 ? `20${c}` : c;
    return `${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }

  const first = match[1];
  if (first.length === 4) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractDate(text: string): string {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return normalizeDate(match);
    }
  }
  return "";
}

export function extractTotalPrice(text: string): string {
  const lines = text.split(/\r?\n/);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line || !TOTAL_KEYWORDS.test(line)) {
      continue;
    }

    const sameLinePrice = line.match(PRICE_PATTERN);
    if (sameLinePrice) {
      return sameLinePrice[1].replace(/,/g, "");
    }

    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const nextLine = lines[j]?.trim() ?? "";
      const nextPrice = nextLine.match(PRICE_PATTERN);
      if (nextPrice) {
        return nextPrice[1].replace(/,/g, "");
      }
    }
  }

  const fallbackPrices = [...text.matchAll(/[\$HK]?\s*([\d,]+\.\d{2})/g)].map(
    (match) => match[1].replace(/,/g, "")
  );

  if (fallbackPrices.length > 0) {
    return fallbackPrices[fallbackPrices.length - 1];
  }

  return "";
}

function cleanProductLine(line: string): string {
  return line
    .replace(/^\d+\s*[xX×]\s*/, "")
    .replace(/\s+\d+\.?\d*\s*$/, "")
    .replace(/[\$HK]\s*[\d,]+\.?\d*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isLikelyProductLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) {
    return false;
  }
  if (SKIP_LINE.test(trimmed)) {
    return false;
  }
  if (HEADER_LINE.test(trimmed)) {
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    return false;
  }
  if (/^[\$HK]?[\d,]+\.?\d*$/.test(trimmed)) {
    return false;
  }
  if (TOTAL_KEYWORDS.test(trimmed)) {
    return false;
  }
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(trimmed)) {
    return false;
  }
  return /[\u4e00-\u9fffA-Za-z]/.test(trimmed);
}

export function extractFirstProductName(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let headerPassed = false;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (HEADER_LINE.test(line)) {
      headerPassed = true;
      continue;
    }

    if (!headerPassed && /shop|store|mart|company|limited|ltd|店|公司/i.test(line)) {
      continue;
    }

    if (isLikelyProductLine(line)) {
      const cleaned = cleanProductLine(line);
      if (cleaned.length >= 2) {
        return cleaned;
      }
    }
  }

  return "";
}

export type ParsedReceipt = {
  productName: string;
  totalPrice: string;
  date: string;
};

export function parseReceiptText(text: string): ParsedReceipt {
  return {
    productName: extractFirstProductName(text),
    totalPrice: extractTotalPrice(text),
    date: extractDate(text),
  };
}
