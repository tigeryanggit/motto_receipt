"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser, Role } from "@/lib/users";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base";

export default function AccountManager({
  initialUsers,
}: {
  initialUsers: PublicUser[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, password, role }),
      });
      const payload = (await response.json()) as { users?: PublicUser[]; error?: string };
      if (!response.ok || !payload.users) {
        throw new Error(payload.error ?? "建立帳戶失敗。");
      }
      setUsers(payload.users);
      setDisplayName("");
      setUsername("");
      setPassword("");
      setRole("user");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "建立帳戶失敗。");
    } finally {
      setPending(false);
    }
  }

  async function saveUser(user: PublicUser, nextPassword: string) {
    setError("");
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: user.displayName,
        role: user.role,
        active: user.active,
        password: nextPassword,
      }),
    });
    const payload = (await response.json()) as { users?: PublicUser[]; error?: string };
    if (!response.ok || !payload.users) {
      setError(payload.error ?? "更新帳戶失敗。");
      return;
    }
    setUsers(payload.users);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">帳戶管理</h1>
        <p className="mt-2 text-slate-600">只有這裡建立的帳戶可以登入收據頁面。所有欄位均須填寫。</p>
      </header>

      <form onSubmit={createAccount} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">新增帳戶</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            姓名
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            登入名稱
            <input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="off" className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            密碼
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            角色
            <select value={role} onChange={(event) => setRole(event.target.value as Role)} className={fieldClass}>
              <option value="user">使用者</option>
              <option value="admin">管理員</option>
            </select>
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={pending} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400">
          {pending ? "建立中..." : "新增帳戶"}
        </button>
      </form>

      <section className="space-y-4">
        {users.map((user) => (
          <UserRow key={user.id} user={user} onSave={saveUser} />
        ))}
      </section>
    </main>
  );
}

function UserRow({
  user,
  onSave,
}: {
  user: PublicUser;
  onSave: (user: PublicUser, password: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(user);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    await onSave(draft, password);
    setPassword("");
    setPending(false);
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          姓名
          <input
            value={draft.displayName}
            onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
            required
            maxLength={80}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          登入名稱
          <input value={user.username} readOnly className={`${fieldClass} bg-slate-50`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          角色
          <select
            value={draft.role}
            onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
            className={fieldClass}
          >
            <option value="user">使用者</option>
            <option value="admin">管理員</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          新密碼
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="留空則不更改"
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          允許登入
        </label>
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:bg-emerald-300">
          {pending ? "儲存中..." : "儲存"}
        </button>
      </div>
    </form>
  );
}
