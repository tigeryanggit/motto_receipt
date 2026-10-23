import { NextRequest, NextResponse } from "next/server";
import { listMonthFileNames, ReceiptSaveError } from "@/lib/drive";
import { nextReference, parseReceiptDate } from "@/lib/receipt-ref";
import { storedReferenceFileNames } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const parsed = parseReceiptDate(request.nextUrl.searchParams.get("date") ?? "");
  if (!parsed) {
    return NextResponse.json({ error: "請輸入有效的收據日期。" }, { status: 400 });
  }

  try {
    const names = [
      ...(await listMonthFileNames(parsed.monthKey)),
      ...storedReferenceFileNames(parsed.monthKey),
    ];
    return NextResponse.json({ reference: nextReference(parsed.monthKey, names) });
  } catch (error) {
    if (error instanceof ReceiptSaveError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Reference allocation failed", error);
    return NextResponse.json(
      { error: "暫時無法編配參考編號，請稍後再試。" },
      { status: 500 }
    );
  }
}
