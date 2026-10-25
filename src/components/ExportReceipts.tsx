"use client";

import { useState } from "react";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base";

function lastMonthRange(): { from: string; to: string } {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month] = today.split("-").map(Number);
  const lastDayOfPreviousMonth = new Date(Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000);
  const previousYear = lastDayOfPreviousMonth.getUTCFullYear();
  const previousMonth = String(lastDayOfPreviousMonth.getUTCMonth() + 1).padStart(2, "0");
  const previousDay = String(lastDayOfPreviousMonth.getUTCDate()).padStart(2, "0");
  return {
    from: `${previousYear}-${previousMonth}-01`,
    to: `${previousYear}-${previousMonth}-${previousDay}`,
  };
}

export default function ExportReceipts() {
  const range = lastMonthRange();
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/receipts/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipts-${dateFrom}-${dateTo}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Export failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Export Receipts</h1>
      <p className="mt-2 text-slate-600">
        Download receipt images whose receipt date is inside the range, plus an Excel summary. The All sheet lists every receipt. Each user sheet is an expense claim form, ordered by Reference No.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Date From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} required className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Date To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} required className={fieldClass} />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:bg-emerald-300">
          {pending ? "Preparing..." : "Download ZIP"}
        </button>
      </form>
    </main>
  );
}
