import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

const FOLDER_KEY = "receipts_dir";

export class SettingsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function defaultReceiptFolder(): string {
  return process.env.RECEIPTS_DIR || path.join(process.cwd(), "data", "Receipts");
}

export function getReceiptFolder(): string {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(FOLDER_KEY) as
    | { value: string }
    | undefined;
  const stored = row?.value?.trim();
  return stored || defaultReceiptFolder();
}

function moveFile(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }
    copyFileSync(from, to);
    unlinkSync(from);
  }
}

export function setReceiptFolder(input: string): { folder: string; moved: number } {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("\0")) {
    throw new SettingsError("Enter a folder location.");
  }
  const resolved = path.resolve(trimmed);
  if (resolved === path.parse(resolved).root) {
    throw new SettingsError("Choose a folder inside a drive, not the drive itself.");
  }

  mkdirSync(resolved, { recursive: true });
  const probe = path.join(resolved, ".receipts-write-test");
  try {
    writeFileSync(probe, "ok");
    unlinkSync(probe);
  } catch {
    throw new SettingsError("The application cannot write to that folder.");
  }

  const current = path.resolve(getReceiptFolder());
  let moved = 0;
  if (current !== resolved && existsSync(current)) {
    const names = readdirSync(current).filter((name) => /^\d{6}-\d{4}\.jpg$/i.test(name));
    for (const name of names) {
      if (existsSync(path.join(resolved, name))) {
        throw new SettingsError(`${name} already exists in the new folder.`);
      }
    }
    for (const name of names) {
      moveFile(path.join(current, name), path.join(resolved, name));
      moved += 1;
    }
  }

  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(FOLDER_KEY, resolved);
  return { folder: resolved, moved };
}

export function listCategories(): string[] {
  const rows = getDb()
    .prepare(`SELECT name FROM categories ORDER BY name COLLATE NOCASE`)
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

export function addCategory(input: string): string[] {
  const name = input.trim();
  if (!name || name.length > 40) {
    throw new SettingsError("Enter a category name up to 40 characters.");
  }
  try {
    getDb()
      .prepare(`INSERT INTO categories (name, created_at) VALUES (?, ?)`)
      .run(name, new Date().toISOString());
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code.includes("CONSTRAINT") || String(error).includes("UNIQUE")) {
      throw new SettingsError("That category already exists.");
    }
    throw error;
  }
  return listCategories();
}

export function deleteCategory(input: string): string[] {
  const name = input.trim();
  const result = getDb().prepare(`DELETE FROM categories WHERE name = ?`).run(name);
  if (result.changes === 0) {
    throw new SettingsError("That category was not found.", 404);
  }
  return listCategories();
}

export function isKnownCategory(name: string): boolean {
  const row = getDb().prepare(`SELECT name FROM categories WHERE name = ?`).get(name.trim()) as
    | { name: string }
    | undefined;
  return Boolean(row);
}
