import { NextRequest, NextResponse } from "next/server";
import { isReceiptReference, receiptFileExists, removeReceiptFile, withReceiptLock } from "@/lib/receipt-files";
import { deleteReceipt, getReceipt } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 200;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "只有管理員可以刪除收據。" }, { status: 403 });
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
    return NextResponse.json({ error: "一次最多刪除 200 張收據。" }, { status: 400 });
  }
  if (unique.some((reference) => !isReceiptReference(reference))) {
    return NextResponse.json({ error: "參考編號不正確。" }, { status: 400 });
  }

  const missing = unique.filter((reference) => !getReceipt(reference) && !receiptFileExists(reference));
  if (missing.length > 0) {
    return NextResponse.json({ error: "有收據檔案找不到，請重新整理後再試。" }, { status: 404 });
  }

  await withReceiptLock(async () => {
    for (const reference of unique) {
      deleteReceipt(reference);
      removeReceiptFile(reference);
    }
  });

  return NextResponse.json({ deleted: unique.length });
}
