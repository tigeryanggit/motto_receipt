"use client";

import { useEffect, useRef, useState } from "react";

type SavedReceipt = {
  reference: string;
  fileName: string;
};

const MAX_PHOTO_BYTES = 200 * 1024;

function encodeJpeg(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("無法處理相片。"));
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("無法把相片轉成 JPEG。"))),
      "image/jpeg",
      quality
    );
  });
}

async function compressPhoto(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): Promise<Blob> {
  let width = sourceWidth;
  let height = sourceHeight;
  const longest = Math.max(width, height);
  if (longest > 1600) {
    const scale = 1600 / longest;
    width *= scale;
    height *= scale;
  }

  let quality = 0.8;
  let blob = await encodeJpeg(source, width, height, quality);
  for (let attempt = 0; blob.size >= MAX_PHOTO_BYTES && attempt < 24; attempt += 1) {
    if (quality > 0.5) {
      quality = Math.round((quality - 0.1) * 10) / 10;
    } else if (Math.max(width, height) > 480) {
      width *= 0.8;
      height *= 0.8;
      quality = 0.7;
    } else {
      quality = Math.max(0.3, Math.round((quality - 0.1) * 10) / 10);
    }
    blob = await encodeJpeg(source, width, height, quality);
  }
  if (blob.size >= MAX_PHOTO_BYTES) {
    throw new Error("無法把相片壓縮至 200KB 以下。");
  }
  return blob;
}

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await compressPhoto(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

type UserChoice = {
  id: string;
  displayName: string;
};

function todayInHongKong(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-20 w-20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h3.2L8.6 5.5h6.8L16.8 8H20a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="14" r="3.25" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-20 w-20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V6m0 0 4 4m-4-4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 18.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" />
    </svg>
  );
}

export default function CameraReceipt({
  userId,
  displayName,
  onSaved,
}: {
  userId: string;
  displayName: string;
  onSaved?: () => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nameRef = useRef<HTMLSelectElement>(null);
  const previewUrl = useRef("");
  const dateEdited = useRef(false);
  const amountEdited = useRef(false);
  const ocrRequest = useRef(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [userName, setUserName] = useState(displayName);
  const [selectedUserId, setSelectedUserId] = useState(userId);
  const [userChoices, setUserChoices] = useState<UserChoice[]>([]);
  const [receiptDate, setReceiptDate] = useState(todayInHongKong);
  const [description, setDescription] = useState("");
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
    const controller = new AbortController();
    fetch("/api/users/choices", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { users?: UserChoice[] };
        if (response.ok && payload.users) {
          setUserChoices(payload.users);
          setSelectedUserId((current) =>
            payload.users?.some((choice) => choice.id === current) ? current : userId
          );
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, saved, userId]);

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
    setSelectedUserId(userId);
    setUserName(displayName);
    setReceiptDate(todayInHongKong());
    setDescription("");
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
    try {
      const blob = await compressPhoto(video, video.videoWidth, video.videoHeight);
      setCameraOpen(false);
      showPhoto(blob);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "無法拍攝相片。");
    }
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
    const chosen = userChoices.find((choice) => choice.id === selectedUserId);
    formData.set("userId", selectedUserId);
    formData.set("userName", chosen?.displayName ?? userName);
    formData.set("receiptDate", receiptDate);
    formData.set("description", description.trim());
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
    Boolean(photo && reference && selectedUserId && receiptDate && description.trim() && amount.trim()) &&
    !referenceLoading &&
    !saving;

  return (
    <section className="rounded-2xl border-2 border-[#001f3f] bg-[#ECF3FF] p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">拍攝或上傳</h2>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#001f3f] px-4 py-8 text-base font-medium text-white transition hover:bg-[#001433]"
        >
          <CameraIcon />
          拍攝收據
        </button>
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-[#001f3f] bg-white px-4 py-8 text-base font-medium text-[#001f3f] transition hover:bg-white/70"
        >
          <UploadIcon />
          上傳收據
        </button>
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
                  <select
                    ref={nameRef}
                    value={selectedUserId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setSelectedUserId(nextId);
                      const chosen = userChoices.find((choice) => choice.id === nextId);
                      setUserName(chosen?.displayName ?? "");
                    }}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                  >
                    {userChoices.length === 0 && <option value={userId}>{displayName}</option>}
                    {userChoices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="-mt-2 text-xs text-slate-500">預設為登入使用者，可以改選其他使用者。</p>
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
                  描述
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    maxLength={200}
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
