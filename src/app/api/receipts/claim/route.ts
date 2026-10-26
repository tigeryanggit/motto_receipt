import { NextRequest, NextResponse } from "next/server";
import { isReceiptReference } from "@/lib/receipt-files";
import { parseReceiptDate } from "@/lib/receipt-ref";
import { getReceipt, receiptBelongsTo, type ReceiptRow } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";
import { buildWorkbook, type ClaimItem } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 200;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthYearLabel(iso: string): string {
  const [year, month] = iso.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function claimItems(receipts: ReceiptRow[]): ClaimItem[] {
  return [...receipts]
    .sort((left, right) => left.referenceNo.localeCompare(right.referenceNo))
    .map((receipt) => ({
      reference: receipt.referenceNo,
      description: receipt.remarks,
      amount: Number(receipt.amount),
    }));
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    references?: unknown;
    dateFrom?: string;
  } | null;
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

  const receipts: ReceiptRow[] = [];
  for (const reference of unique) {
    const receipt = getReceipt(reference);
    if (!receipt || !receiptBelongsTo(receipt, user)) {
      return NextResponse.json({ error: "有收據檔案找不到，請重新整理後再試。" }, { status: 404 });
    }
    receipts.push(receipt);
  }

  const dateFrom = parseReceiptDate(body?.dateFrom ?? "");
  const monthYear = monthYearLabel(dateFrom?.iso ?? receipts[0].receiptDate);
  const grouped = new Map<string, ReceiptRow[]>();
  for (const receipt of receipts) {
    const name = receipt.userName.trim() || "Unknown";
    grouped.set(name, [...(grouped.get(name) ?? []), receipt]);
  }

  const workbook = buildWorkbook(
    [...grouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0], "zh-Hant"))
      .map(([name, rows]) => ({
        name,
        claim: {
          staffName: name,
          monthYear,
          items: claimItems(rows),
        },
      }))
  );

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="expense-claim.xlsx"',
    },
  });
}
