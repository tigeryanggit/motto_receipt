import { NextRequest, NextResponse } from "next/server";
import { isReceiptReference, readReceiptFile } from "@/lib/receipt-files";
import { getReceipt, receiptBelongsTo } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";
import { zipStore } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 200;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { references?: unknown } | null;
  const references = Array.isArray(body?.references)
    ? body.references.filter((value): value is string => typeof value === "string")
    : [];
  const unique = [...new Set(references)];
  if (unique.length === 0) {
    return NextResponse.json({ error: "請先選擇收據。" }, { status: 400 });
  }
  if (unique.length > MAX_FILES) {
    return NextResponse.json({ error: "一次最多下載 200 張收據。" }, { status: 400 });
  }
  if (unique.some((reference) => !isReceiptReference(reference))) {
    return NextResponse.json({ error: "參考編號不正確。" }, { status: 400 });
  }

  if (unique.some((reference) => {
    const receipt = getReceipt(reference);
    return !receipt || !receiptBelongsTo(receipt, user);
  })) {
    return NextResponse.json({ error: "有收據檔案找不到，請重新整理後再試。" }, { status: 404 });
  }

  const files = unique.map((reference) => {
    const data = readReceiptFile(reference);
    return data ? { name: `${reference}.jpg`, data } : null;
  });
  if (files.some((file) => !file)) {
    return NextResponse.json({ error: "有收據檔案找不到，請重新整理後再試。" }, { status: 404 });
  }

  const zip = zipStore(files.filter((file): file is { name: string; data: Buffer } => Boolean(file)));
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="receipts.zip"',
    },
  });
}
