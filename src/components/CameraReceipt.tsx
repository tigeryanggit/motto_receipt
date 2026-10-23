"use client";

import { useEffect, useRef, useState } from "react";

type SavedReceipt = {
  reference: string;
  fileName: string;
};

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 2000;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("無法處理相片。");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });
    if (!blob) {
      throw new Error("無法把相片轉成 JPEG。");
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export default function CameraReceipt({
  displayName,
  onSaved,
}: {
  displayName: string;
  onSaved?: () => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const previewUrl = useRef("");
  const dateEdited = useRef(false);
  const amountEdited = useRef(false);
  const ocrRequest = useRef(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [userName, setUserName] = useState(displayName);
  const [receiptDate, setReceiptDate] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [ocrMessage, setOcrMessage] = useState("");
  const [reference, setReference] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState<SavedReceipt | null>(null);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    setCameraError("");

    navigator.mediaDevices
      ?.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      })
      .then(async (next) => {
        stream = next;
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = next;
        if (videoRef.current) {
          videoRef.current.srcObject = next;
          await videoRef.current.play();
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setCameraError("無法開啟相機。請允許相機權限，或改用「上傳收據」。");
        setCameraOpen(false);
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!open || saved) {
      return;
    }
    nameRef.current?.focus();
  }, [open, saved]);

  useEffect(() => {
    if (!open || saved || !/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
      return;
    }

    const controller = new AbortController();
    setReference("");
    setReferenceError("");
    setReferenceLoading(true);

    fetch(`/api/receipts/reference?date=${receiptDate}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as { reference?: string; error?: string };
        if (!response.ok || !payload.reference) {
          throw new Error(payload.error ?? "無法編配參考編號。");
        }
        setReference(payload.reference);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setReferenceError(error instanceof Error ? error.message : "無法編配參考編號。");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setReferenceLoading(false);
        }
      });

    return () => controller.abort();
  }, [open, receiptDate, saved]);

  async function recognizeReceipt(jpeg: Blob) {
    const requestId = ocrRequest.current + 1;
    ocrRequest.current = requestId;
    setOcrMessage("正在辨識日期及金額...");
    try {
      const formData = new FormData();
      formData.set("photo", jpeg, "receipt.jpg");
      const response = await fetch("/api/receipts/ocr", { method: "POST", body: formData });
      const payload = (await response.json()) as { date?: string; amount?: string; error?: string };
      if (requestId !== ocrRequest.current) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "辨識失敗。");
      }
      if (!dateEdited.current && payload.date) {
        setReceiptDate(payload.date);
      }
      if (!amountEdited.current && payload.amount) {
        setAmount(payload.amount);
      }
      setOcrMessage(
        payload.date || payload.amount
          ? "已從相片填入日期及金額，可以修改。"
          : "未能辨識日期或金額，請手動輸入。"
      );
    } catch (error) {
      if (requestId !== ocrRequest.current) {
        return;
      }
      setOcrMessage(error instanceof Error ? error.message : "未能辨識日期或金額，請手動輸入。");
    }
  }

  function showPhoto(jpeg: Blob) {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
    }
    const url = URL.createObjectURL(jpeg);
    previewUrl.current = url;
    setPhoto(jpeg);
    setPhotoUrl(url);
    dateEdited.current = false;
    amountEdited.current = false;
    setUserName(displayName);
    setReceiptDate("");
    setCategory("");
    setAmount("");
    setReference("");
    setReferenceError("");
    setOcrMessage("");
    setSaveError("");
    setSaved(null);
    setOpen(true);
    void recognizeReceipt(jpeg);
  }

  function closeForm() {
    setOpen(false);
    setPhoto(null);
    setSaved(null);
    setSaveError("");
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = "";
    }
    setPhotoUrl("");
  }

  function closeCamera() {
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("相機尚未準備好，請再試一次。");
      return;
    }
    const maxEdge = 2000;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("無法拍攝相片。");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });
    if (!blob) {
      setCameraError("無法拍攝相片。");
      return;
    }
    setCameraOpen(false);
    showPhoto(blob);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setCameraError("");
    try {
      showPhoto(await toJpeg(file));
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "無法讀取相片。");
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!photo || !reference || saving) {
      return;
    }

    setSaving(true);
    setSaveError("");
    const formData = new FormData();
    formData.set("userName", userName.trim());
    formData.set("receiptDate", receiptDate);
    formData.set("category", category.trim());
    formData.set("amount", amount.trim());
    formData.set("photo", photo, `${reference}.jpg`);

    try {
      const response = await fetch("/api/receipts", { method: "POST", body: formData });
      const payload = (await response.json()) as SavedReceipt & { error?: string };
      if (!response.ok || !payload.reference) {
        throw new Error(payload.error ?? "儲存失敗。");
      }
      setSaved(payload);
      setReference(payload.reference);
      onSaved?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "儲存失敗。");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    Boolean(photo && reference && userName.trim() && receiptDate && category.trim() && amount.trim()) &&
    !referenceLoading &&
    !saving;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">1. 拍攝收據</h2>
          <p className="text-sm text-slate-500">用相機拍照或從裝置選擇圖片，填寫資料後儲存到伺服器</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            拍攝收據
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            上傳收據
          </button>
        </div>
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleUpload}
      />

      {cameraError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{cameraError}</p>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">拍攝收據</h3>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="mt-4 aspect-[3/4] w-full rounded-lg bg-slate-900 object-contain sm:aspect-video"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void capturePhoto()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                拍照
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <form
            onSubmit={handleSave}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            aria-labelledby="receipt-form-title"
          >
            <h3 id="receipt-form-title" className="text-lg font-semibold text-slate-900">
              收據資料
            </h3>

            {photoUrl && (
              <img
                src={photoUrl}
                alt="收據相片"
                className="mt-4 max-h-48 w-full rounded-lg bg-slate-100 object-contain"
              />
            )}

            {saved ? (
              <div className="mt-4 space-y-4">
                <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  已儲存為 {saved.fileName}
                </p>
                <p className="text-sm text-slate-600">
                  參考編號{" "}
                  <span className="font-mono text-base font-semibold text-slate-900">{saved.reference}</span>
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-500">所有欄位均須填寫。</p>
                {ocrMessage && (
                  <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">{ocrMessage}</p>
                )}
                <label className="block text-sm font-medium text-slate-700">
                  姓名
                  <input
                    ref={nameRef}
                    value={userName}
                    onChange={(event) => setUserName(event.target.value)}
                    maxLength={80}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                  />
                </label>
                <p className="-mt-2 text-xs text-slate-500">已按登入使用者填入，可以修改。</p>
                <label className="block text-sm font-medium text-slate-700">
                  收據日期
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(event) => {
                      dateEdited.current = true;
                      setReceiptDate(event.target.value);
                    }}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  類別
                  <input
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    maxLength={40}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  金額
                  <input
                    value={amount}
                    onChange={(event) => {
                      amountEdited.current = true;
                      setAmount(event.target.value);
                    }}
                    inputMode="decimal"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  參考編號
                  <input
                    value={referenceLoading ? "編配中..." : reference}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-base text-slate-900"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  相片會以參考編號命名，例如 {reference ? `${reference}.jpg` : "202610-0001.jpg"}。
                </p>
                {(referenceError || saveError) && (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    {saveError || referenceError}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {saving ? "儲存中..." : "儲存"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
