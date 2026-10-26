"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/users";

type NavbarUser = {
  role: Role;
  displayName: string;
} | null;

export default function Navbar({ user }: { user: NavbarUser }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOnOutside(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const itemClass = "block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";
  const childClass = "block w-full py-2 pl-8 pr-4 text-left text-sm text-slate-600 hover:bg-slate-50";

  return (
    <header className="sticky top-0 z-40 border-b border-[#001433] bg-[#001f3f]">
      <div ref={panelRef} className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href={user ? "/" : "/login"} className="text-lg font-semibold tracking-tight text-white">
          上傳收據
        </Link>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/40 text-white hover:bg-white/10"
        >
          <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
          </span>
        </button>
        {open && (
          <nav className="absolute right-4 top-14 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-lg sm:right-6">
            {user?.role === "admin" && (
              <div>
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Account Management
                </p>
                <Link href="/accounts" className={childClass} onClick={() => setOpen(false)}>
                  Create User
                </Link>
              </div>
            )}
            {user && (
              <Link href="/account/password" className={itemClass} onClick={() => setOpen(false)}>
                Change password
              </Link>
            )}
            {user?.role === "admin" && (
              <div>
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  System Configuration
                </p>
                <Link href="/settings#folder-location" className={childClass} onClick={() => setOpen(false)}>
                  Folder Location
                </Link>
                <Link href="/settings#category-dropdown" className={childClass} onClick={() => setOpen(false)}>
                  Category Dropdown
                </Link>
              </div>
            )}
            {user && (
              <Link href="/export" className={itemClass} onClick={() => setOpen(false)}>
                Export Receipts
              </Link>
            )}
            {user ? (
              <form action="/api/auth/logout" method="post">
                <button type="submit" className={itemClass}>
                  Sign Out
                </button>
              </form>
            ) : (
              <Link href="/login" className={itemClass} onClick={() => setOpen(false)}>
                Sign In
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
