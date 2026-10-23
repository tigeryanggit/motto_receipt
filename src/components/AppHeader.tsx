import Link from "next/link";
import type { PublicUser } from "@/lib/users";

export default function AppHeader({ user }: { user: PublicUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3 text-sm">
        <span className="font-medium text-slate-800">{user.displayName}</span>
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-slate-600 hover:text-slate-900">
            收據
          </Link>
          {user.role === "admin" && (
            <Link href="/accounts" className="text-slate-600 hover:text-slate-900">
              帳戶管理
            </Link>
          )}
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-slate-600 hover:text-slate-900">
              登出
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
