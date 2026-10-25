import { NextRequest, NextResponse } from "next/server";
import { isReceiptReference, readReceiptFile } from "@/lib/receipt-files";
import { getReceipt, receiptBelongsTo } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const { reference } = await context.params;
  if (!isReceiptReference(reference)) {
    return NextResponse.json({ error: "參考編號不正確。" }, { status: 400 });
  }

  const receipt = getReceipt(reference);
  if (!receipt || !receiptBelongsTo(receipt, user)) {
    return NextResponse.json({ error: "找不到這張收據。" }, { status: 404 });
  }

  const bytes = readReceiptFile(reference);
  if (!bytes) {
    return NextResponse.json({ error: "找不到這張收據。" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
