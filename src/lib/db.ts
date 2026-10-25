import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";

let database: Database.Database | null = null;

export function getDb(): Database.Database {
  if (database) {
    return database;
  }

  const file = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "receipts.sqlite");
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      create_date TEXT NOT NULL,
      reference_no TEXT NOT NULL UNIQUE,
      user_name TEXT NOT NULL,
      receipt_date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount TEXT NOT NULL,
      remarks TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY COLLATE NOCASE,
      created_at TEXT NOT NULL
    );
  `);
  importLegacyUsers(db, path.dirname(file));
  database = db;
  return db;
}

function importLegacyUsers(db: Database.Database, directory: string): void {
  const count = db.prepare(`SELECT COUNT(*) AS count FROM users`).get() as { count: number };
  if (count.count > 0) {
    return;
  }

  const file = path.join(directory, "users.json");
  if (!existsSync(file)) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) {
    return;
  }

  const insert = db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, role, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const createdAt = new Date().toISOString();
  let imported = 0;
  const save = db.transaction(() => {
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const user = item as Record<string, unknown>;
      const id = String(user.id ?? "");
      const username = String(user.username ?? "").trim().toLowerCase();
      const displayName = String(user.displayName ?? "").trim();
      const passwordHash = String(user.passwordHash ?? "");
      const role = user.role === "admin" || user.role === "user" ? user.role : "";
      const active = user.active === false || user.active === 0 ? 0 : 1;
      if (
        !id ||
        !/^[a-z0-9._-]{3,32}$/.test(username) ||
        !displayName ||
        !passwordHash.includes(":") ||
        !role
      ) {
        continue;
      }
      insert.run(id, username, displayName, passwordHash, role, active, createdAt);
      imported += 1;
    }
  });
  save();
  if (imported > 0) {
    renameSync(file, path.join(directory, "users.json.imported"));
  }
}

export function nowInHongKong(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")}`;
}
