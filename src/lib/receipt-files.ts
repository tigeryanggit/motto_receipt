import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const REFERENCE_PATTERN = /^\d{6}-\d{4}$/;

export class ReceiptSaveError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

let lockTail: Promise<void> = Promise.resolve();

export function receiptsDirectory(): string {
  return process.env.RECEIPTS_DIR || path.join(process.cwd(), "data", "Receipts");
}

export function ensureReceiptsDirectory(): string {
  const directory = receiptsDirectory();
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function isReceiptReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}

export function receiptFilePath(reference: string): string {
  if (!isReceiptReference(reference)) {
    throw new ReceiptSaveError("參考編號不正確。", 400);
  }
  return path.join(ensureReceiptsDirectory(), `${reference}.jpg`);
}

export function storedFileNames(monthKey: string): string[] {
  const directory = ensureReceiptsDirectory();
  return readdirSync(directory).filter((name) => {
    const lower = name.toLowerCase();
    return lower.startsWith(`${monthKey.toLowerCase()}-`) && lower.endsWith(".jpg");
  });
}

export function writeReceiptFile(reference: string, jpeg: Buffer): void {
  writeFileSync(receiptFilePath(reference), jpeg);
}

export function removeReceiptFile(reference: string): void {
  try {
    unlinkSync(receiptFilePath(reference));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function readReceiptFile(reference: string): Buffer | null {
  try {
    return readFileSync(receiptFilePath(reference));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function withReceiptLock<T>(action: () => Promise<T>): Promise<T> {
  const run = lockTail.then(action, action);
  lockTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
