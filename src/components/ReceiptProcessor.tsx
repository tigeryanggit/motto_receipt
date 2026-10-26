"use client";

import { useState } from "react";
import CameraReceipt from "@/components/CameraReceipt";
import ReceiptLibrary from "@/components/ReceiptLibrary";

export default function ReceiptProcessor({
  userId,
  displayName,
  canDelete,
}: {
  userId: string;
  displayName: string;
  canDelete: boolean;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">上傳收據</h1>
        <p className="max-w-2xl text-slate-600">
          用相機拍攝收據，或從手機及電腦選擇圖片。相片會按參考編號儲存到伺服器，並可在下方預覽及下載。
        </p>
      </header>

      <CameraReceipt
        userId={userId}
        displayName={displayName}
        onSaved={() => setRefreshKey((current) => current + 1)}
      />
      <ReceiptLibrary refreshKey={refreshKey} canDelete={canDelete} />
    </main>
  );
}
