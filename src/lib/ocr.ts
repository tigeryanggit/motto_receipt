import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import type { Worker } from "tesseract.js";
import { parseReceiptText } from "./parser";
import type { ReceiptRecord } from "./constants";

const execFileAsync = promisify(execFile);

let systemTesseractAvailable: boolean | null = null;
let tesseractWorkerPromise: Promise<Worker> | null = null;

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "receipt.jpg";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || `receipt${extname(base) || ".jpg"}`;
}

async function hasSystemTesseract(): Promise<boolean> {
  if (systemTesseractAvailable !== null) {
    return systemTesseractAvailable;
  }

  try {
    await execFileAsync("tesseract", ["--version"], { timeout: 5_000 });
    systemTesseractAvailable = true;
  } catch {
    systemTesseractAvailable = false;
  }

  return systemTesseractAvailable;
}

async function getTesseractJsWorker(): Promise<Worker> {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_tra+eng", 1, {
        logger: () => undefined,
      });
      return worker;
    })();
  }

  return tesseractWorkerPromise;
}

async function recognizeWithSystemTesseract(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "receipt-ocr-"));
  const imagePath = join(tempDir, sanitizeFileName(fileName));

  try {
    await writeFile(imagePath, buffer);
    const { stdout } = await execFileAsync(
      "tesseract",
      [imagePath, "stdout", "-l", "chi_tra+eng", "--psm", "6"],
      {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    return stdout;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function recognizeWithTesseractJs(
  buffer: Buffer
): Promise<string> {
  const worker = await getTesseractJsWorker();
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return text;
}

export async function recognizeReceiptImage(
  buffer: Buffer,
  fileName: string
): Promise<ReceiptRecord> {
  const text = (await hasSystemTesseract())
    ? await recognizeWithSystemTesseract(buffer, fileName)
    : await recognizeWithTesseractJs(buffer);

  const parsed = parseReceiptText(text);

  return {
    fileName,
    productName: parsed.productName || "（未能識別）",
    totalPrice: parsed.totalPrice || "（未能識別）",
    date: parsed.date || "（未能識別）",
  };
}
