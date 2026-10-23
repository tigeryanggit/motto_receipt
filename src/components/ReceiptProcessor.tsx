"use client";

import { useMemo, useRef, useState } from "react";
import CameraReceipt from "@/components/CameraReceipt";
import type { ReceiptRecord } from "@/lib/constants";
import { buildCsvFilename, isImageFile } from "@/lib/constants";
import { triggerCsvDownload } from "@/lib/csv";

type ProcessResponse = {
  records: ReceiptRecord[];
  filename: string;
};

export default function ReceiptProcessor({ displayName }: { displayName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderName, setFolderName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [records, setRecords] = useState<ReceiptRecord[]>([]);
  const [csvFilename, setCsvFilename] = useState("");
  const [status, setStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  const imageCount = useMemo(
    () => selectedFiles.filter((file) => isImageFile(file.name)).length,
    [selectedFiles]
  );

  function handleFolderChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      setSelectedFiles([]);
      setFolderName("");
      setRecords([]);
      setStatus("idle");
      setMessage("");
      return;
    }

    const files = Array.from(fileList).filter((file) => isImageFile(file.name));
    const firstPath = fileList[0]?.webkitRelativePath ?? fileList[0]?.name ?? "";
    const derivedFolder = firstPath.includes("/")
      ? firstPath.split("/")[0]
      : "已選擇的資料夾";

    setSelectedFiles(files);
    setFolderName(derivedFolder);
    setRecords([]);
    setCsvFilename("");
    setStatus("idle");
    setMessage(
      files.length > 0
        ? `已找到 ${files.length} 張圖片，準備讀取收據資料。`
        : "資料夾內沒有符合格式的圖片（JPEG、JPG、PNG、BMP）。"
    );
  }

  async function handleProcess() {
    if (selectedFiles.length === 0) {
      setStatus("error");
      setMessage("請先選擇包含收據圖片的資料夾。");
      return;
    }

    setStatus("processing");
    setMessage("");
    setRecords([]);

    const results: ReceiptRecord[] = [];
    const filename = buildCsvFilename();

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setProgress(
          `正在辨識第 ${index + 1} / ${selectedFiles.length} 張：${file.name}`
        );

        const formData = new FormData();
        formData.append("files", file, file.name);

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 180_000);

        let response: Response;
        try {
          response = await fetch("/api/process", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? `處理失敗：${file.name}`);
        }

        const payload = (await response.json()) as ProcessResponse;
        results.push(...payload.records);
      }

      setRecords(results);
      setCsvFilename(filename);
      triggerCsvDownload(results, filename);
      setStatus("done");
      setProgress("");
      setMessage(
        `成功讀取 ${results.length} 張收據，CSV 已下載至「下載」資料夾：${filename}`
      );
    } catch (error) {
      setStatus("error");
      setProgress("");
      if (results.length > 0) {
        setRecords(results);
        setCsvFilename(filename);
        triggerCsvDownload(results, filename);
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage(
          results.length > 0
            ? `部分完成（${results.length}/${selectedFiles.length} 張）。有圖片處理逾時，已下載目前結果。`
            : "處理逾時，請減少圖片數量或稍後再試。"
        );
        return;
      }

      setMessage(
        results.length > 0
          ? `部分完成（${results.length}/${selectedFiles.length} 張）：${
              error instanceof Error ? error.message : "處理時發生未知錯誤。"
            }，已下載目前結果。`
          : error instanceof Error
            ? error.message
            : "處理時發生未知錯誤。"
      );
    }
  }

  function handleDownload() {
    if (records.length === 0) {
      return;
    }
    triggerCsvDownload(records, csvFilename || buildCsvFilename());
    setMessage(`CSV 檔案已下載至瀏覽器預設的「下載」資料夾：${csvFilename || buildCsvFilename()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Motto Education
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          收據資料自動讀取
        </h1>
        <p className="max-w-2xl text-slate-600">
          用手機拍攝收據並填寫資料，相片會按參考編號儲存到 Google Drive。
          亦可選擇資料夾批次辨識貨品名稱、總價錢及日期，並匯出 CSV。
        </p>
      </header>

      <CameraReceipt displayName={displayName} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">2. 選擇資料夾</h2>
            <p className="text-sm text-slate-500">
              支援 JPEG、JPG、PNG、BMP 格式
            </p>
            {folderName && (
              <p className="mt-2 text-sm text-slate-700">
                資料夾：<span className="font-medium">{folderName}</span>
                {" · "}
                {imageCount} 張圖片
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              選擇資料夾
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={selectedFiles.length === 0 || status === "processing"}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {status === "processing" ? "處理中..." : "開始讀取"}
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".jpeg,.jpg,.png,.bmp,image/jpeg,image/png,image/bmp"
          multiple
          className="hidden"
          onChange={handleFolderChange}
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        />

        {(message || progress) && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              status === "error"
                ? "bg-red-50 text-red-700"
                : status === "done"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {progress || message}
          </div>
        )}
      </section>

      {records.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">3. 讀取結果</h2>
              <p className="text-sm text-slate-500">
                檔案名稱：{csvFilename || buildCsvFilename()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              下載 CSV 至「下載」資料夾
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    檔案名稱
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    貨品名稱
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    總價錢
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    日期
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.fileName} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{record.fileName}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {record.productName}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{record.totalPrice}</td>
                    <td className="px-4 py-3 text-slate-900">{record.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
