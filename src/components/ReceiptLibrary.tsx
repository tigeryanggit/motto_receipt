"use client";

import { useEffect, useMemo, useState } from "react";

type ReceiptItem = {
  createDate: string;
  referenceNo: string;
  userName: string;
  receiptDate: string;
  category: string;
  amount: string;
  remarks: string;
};

type SortKey = "name" | "receiptDate" | "createDate";

function currentMonthRange(): { from: string; to: string } {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, "0");
  return {
    from: `${year}-${monthText}-01`,
    to: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default function ReceiptLibrary({
  refreshKey,
  canDelete,
}: {
  refreshKey: number;
  canDelete: boolean;
}) {
  const range = currentMonthRange();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [sortKey, setSortKey] = useState<SortKey>("createDate");
  const [ascending, setAscending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<ReceiptItem | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/receipts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { receipts?: ReceiptItem[]; error?: string };
        if (!response.ok || !payload.receipts) {
          throw new Error(payload.error ?? "無法讀取收據。");
        }
        setReceipts(payload.receipts);
        setSelected((current) =>
          current.filter((reference) => payload.receipts?.some((item) => item.referenceNo === reference))
        );
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "無法讀取收據。");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [refreshKey, reloadKey]);

  const sorted = useMemo(() => {
    const copy = receipts.filter((item) => {
      if (dateFrom && item.receiptDate < dateFrom) {
        return false;
      }
      if (dateTo && item.receiptDate > dateTo) {
        return false;
      }
      return true;
    });
    const value = (item: ReceiptItem) => {
      if (sortKey === "name") {
        return item.referenceNo;
      }
      if (sortKey === "receiptDate") {
        return item.receiptDate;
      }
      return item.createDate;
    };
    copy.sort((left, right) => {
      const compared = value(left).localeCompare(value(right), "zh-Hant");
      return ascending ? compared : -compared;
    });
    return copy;
  }, [receipts, dateFrom, dateTo, sortKey, ascending]);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const visible = rangeInvalid ? [] : sorted;
  const visibleSelected = selected.filter((reference) =>
    visible.some((item) => item.referenceNo === reference)
  );
  const allSelected = visible.length > 0 && visible.every((item) => visibleSelected.includes(item.referenceNo));

  function toggleAll() {
    setSelected(allSelected ? [] : visible.map((item) => item.referenceNo));
  }

  function toggleOne(reference: string) {
    setSelected((current) =>
      current.includes(reference) ? current.filter((item) => item !== reference) : [...current, reference]
    );
  }

  async function downloadSelected() {
    if (visibleSelected.length === 0 || downloading) {
      return;
    }
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch("/api/receipts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: visibleSelected }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "下載失敗。");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "receipts.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadFailure) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : "下載失敗。");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadClaim() {
    if (visibleSelected.length === 0 || exporting) {
      return;
    }
    setExporting(true);
    setDownloadError("");
    try {
      const response = await fetch("/api/receipts/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: visibleSelected, dateFrom }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "下載失敗。");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "expense-claim.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportFailure) {
      setDownloadError(exportFailure instanceof Error ? exportFailure.message : "下載失敗。");
    } finally {
      setExporting(false);
    }
  }

  async function deleteSelected() {
    if (!canDelete || visibleSelected.length === 0 || deleting) {
      return;
    }
    const confirmed = window.confirm(`確定刪除所選的 ${visibleSelected.length} 張收據？相片和資料都會移除。`);
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    setDownloadError("");
    try {
      const response = await fetch("/api/receipts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: visibleSelected }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "刪除失敗。");
      }
      setSelected([]);
      setPreview(null);
      setReloadKey((current) => current + 1);
    } catch (deleteFailure) {
      setDownloadError(deleteFailure instanceof Error ? deleteFailure.message : "刪除失敗。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[#001f3f] bg-[#ECF3FF] p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">收據記錄</h2>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
          <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-600 lg:flex-row lg:items-center">
            <span className="shrink-0">日期由</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm lg:w-40"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-600 lg:flex-row lg:items-center">
            <span className="shrink-0">日期至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm lg:w-40"
            />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-3 lg:col-auto">
          <label className="text-sm text-slate-600">
            排序
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="name">編號</option>
              <option value="receiptDate">收據日期</option>
              <option value="createDate">建立日期</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setAscending((current) => !current)}
            className="rounded-lg border border-slate-300 bg-gray-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-gray-300"
          >
            {ascending ? "由小至大" : "由大至小"}
          </button>
          </div>
        </div>
        <div className="flex flex-nowrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void downloadClaim()}
            disabled={visibleSelected.length === 0 || exporting}
            className="rounded-lg bg-[#001f3f] px-2.5 py-2 text-xs font-medium text-white transition hover:bg-[#001433] disabled:cursor-not-allowed sm:px-4 sm:text-sm"
          >
            {exporting ? "下載中..." : `下載表格${visibleSelected.length > 0 ? `（${visibleSelected.length}）` : ""}`}
          </button>
          <button
            type="button"
            onClick={() => void downloadSelected()}
            disabled={visibleSelected.length === 0 || downloading}
            className="rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300 sm:px-4 sm:text-sm"
          >
            {downloading ? "下載中..." : `下載收據${visibleSelected.length > 0 ? `（${visibleSelected.length}）` : ""}`}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => void deleteSelected()}
              disabled={visibleSelected.length === 0 || deleting}
              className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-red-200 sm:px-4 sm:text-sm"
            >
              {deleting ? "刪除中..." : `刪除收據${visibleSelected.length > 0 ? `（${visibleSelected.length}）` : ""}`}
            </button>
          )}
        </div>
      </div>

      {(error || downloadError) && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{downloadError || error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">正在讀取收據...</p>
      ) : rangeInvalid ? (
        <p className="mt-4 text-sm text-slate-500">日期由不可晚於日期至。</p>
      ) : receipts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">尚未儲存任何收據。</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">此日期範圍內沒有收據。</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="選擇全部收據"
                  />
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">編號</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">收據日期</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">描述</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">金額</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">姓名</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">預覽</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700">建立日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((item) => (
                <tr key={item.referenceNo} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.referenceNo)}
                      onChange={() => toggleOne(item.referenceNo)}
                      aria-label={`選擇 ${item.referenceNo}`}
                    />
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-900">{item.referenceNo}</td>
                  <td className="px-3 py-3 text-slate-700">{item.receiptDate}</td>
                  <td className="px-3 py-3 text-slate-700">{item.remarks}</td>
                  <td className="px-3 py-3 text-slate-900">{item.amount}</td>
                  <td className="px-3 py-3 text-slate-700">{item.userName}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setPreview(item)}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      預覽
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{item.createDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{preview.referenceNo}</h3>
            <img
              src={`/api/receipts/files/${preview.referenceNo}`}
              alt={`${preview.referenceNo} 收據`}
              className="mt-4 max-h-80 w-full rounded-lg bg-slate-100 object-contain"
            />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">收據日期</dt>
                <dd className="font-medium text-slate-900">{preview.receiptDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">建立日期</dt>
                <dd className="font-medium text-slate-900">{preview.createDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">姓名</dt>
                <dd className="font-medium text-slate-900">{preview.userName}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">描述</dt>
                <dd className="font-medium text-slate-900">{preview.remarks}</dd>
              </div>
              <div>
                <dt className="text-slate-500">金額</dt>
                <dd className="font-medium text-slate-900">{preview.amount}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
