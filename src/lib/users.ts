import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export type Role = "admin" | "user";

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
};

type UserRecord = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: Role;
  active: number;
};

export class UserStoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function assertUsername(username: string): void {
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new UserStoreError("登入名稱須為 3 至 32 個英數字、點、底線或連字號。");
  }
}

function assertDisplayName(displayName: string): void {
  if (!displayName || displayName.length > 80) {
    throw new UserStoreError("請輸入姓名。");
  }
}

function assertPassword(password: string): void {
  if (password.length < 6) {
    throw new UserStoreError("密碼最少 6 個字元。");
  }
}

function toPublic(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    active: user.active === 1,
  };
}

function assertRole(role: Role): void {
  if (role !== "admin" && role !== "user") {
    throw new UserStoreError("請選擇有效的角色。");
  }
}

export async function countUsers(): Promise<number> {
  const row = getDb().prepare(`SELECT COUNT(*) AS count FROM users`).get() as { count: number };
  return row.count;
}

export async function listPublicUsers(): Promise<PublicUser[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, username, display_name, password_hash, role, active
       FROM users
       ORDER BY created_at, username`
    )
    .all() as UserRecord[];
  return rows.map(toPublic);
}

export async function findActiveUser(id: string): Promise<PublicUser | null> {
  const user = getDb()
    .prepare(
      `SELECT id, username, display_name, password_hash, role, active
       FROM users
       WHERE id = ? AND active = 1`
    )
    .get(id) as UserRecord | undefined;
  return user ? toPublic(user) : null;
}

export async function authenticate(username: string, password: string): Promise<PublicUser> {
  const user = getDb()
    .prepare(
      `SELECT id, username, display_name, password_hash, role, active
       FROM users
       WHERE username = ?`
    )
    .get(normalizeUsername(username)) as UserRecord | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new UserStoreError("登入名稱或密碼不正確。", 401);
  }
  if (user.active !== 1) {
    throw new UserStoreError("此帳戶已停用。", 403);
  }
  return toPublic(user);
}

export async function createFirstAdmin(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<PublicUser> {
  if ((await countUsers()) > 0) {
    throw new UserStoreError("管理員帳戶已經建立。", 403);
  }
  return createUser({ ...input, role: "admin" });
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
  role: Role;
}): Promise<PublicUser> {
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim();
  assertUsername(username);
  assertDisplayName(displayName);
  assertPassword(input.password);
  assertRole(input.role);
  const passwordHash = await hashPassword(input.password);
  const id = randomBytes(8).toString("hex");
  try {
    getDb()
      .prepare(
        `INSERT INTO users (id, username, display_name, password_hash, role, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(id, username, displayName, passwordHash, input.role, new Date().toISOString());
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code.includes("CONSTRAINT") || String(error).includes("UNIQUE")) {
      throw new UserStoreError("登入名稱已存在。");
    }
    throw error;
  }
  return {
    id,
    username,
    displayName,
    role: input.role,
    active: true,
  };
}

export async function updateUser(
  id: string,
  patch: {
    displayName?: string;
    password?: string;
    role?: Role;
    active?: boolean;
  }
): Promise<PublicUser> {
  const existing = getDb()
    .prepare(
      `SELECT id, username, display_name, password_hash, role, active
       FROM users WHERE id = ?`
    )
    .get(id) as UserRecord | undefined;
  if (!existing) {
    throw new UserStoreError("找不到此帳戶。", 404);
  }

  const displayName = patch.displayName?.trim() ?? existing.display_name;
  const role = patch.role ?? existing.role;
  const active = patch.active === undefined ? existing.active === 1 : patch.active;
  assertDisplayName(displayName);
  assertRole(role);
  const passwordHash = patch.password
    ? await hashPassword(patch.password)
    : existing.password_hash;
  if (patch.password) {
    assertPassword(patch.password);
  }

  const db = getDb();
  const save = db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET display_name = ?, password_hash = ?, role = ?, active = ?
       WHERE id = ?`
    ).run(displayName, passwordHash, role, active ? 1 : 0, id);
    const admins = db
      .prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1`)
      .get() as { count: number };
    if (admins.count === 0) {
      throw new UserStoreError("必須保留最少一個有效的管理員帳戶。");
    }
  });
  save();

  return {
    id,
    username: existing.username,
    displayName,
    role,
    active,
  };
}
