import { NextRequest, NextResponse } from "next/server";
import { readReceiptFile } from "@/lib/receipt-files";
import { parseReceiptDate } from "@/lib/receipt-ref";
import { listReceiptsBetween, type ReceiptRow } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";
import { buildWorkbook, type Cell, type ClaimItem } from "@/lib/xlsx";
import { zipStore } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = ["Reference No", "User", "Receipt Date", "Description", "Amount", "Create Date"];

function toRow(receipt: ReceiptRow): Cell[] {
  return [
    receipt.referenceNo,
    receipt.userName,
    receipt.receiptDate,
    receipt.remarks,
    { amount: Number(receipt.amount) },
    receipt.createDate,
  ];
}

function sheetNameForUser(name: string): string {
  return name.trim() || "Unknown";
}

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
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { dateFrom?: string; dateTo?: string } | null;
  const dateFrom = parseReceiptDate(body?.dateFrom ?? "");
  const dateTo = parseReceiptDate(body?.dateTo ?? "");
  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Enter a valid Date From and Date To." }, { status: 400 });
  }
  if (dateFrom.iso > dateTo.iso) {
    return NextResponse.json({ error: "Date From must be on or before Date To." }, { status: 400 });
  }

  const receipts = listReceiptsBetween(
    dateFrom.iso,
    dateTo.iso,
    user.role === "admin" ? undefined : user.displayName
  );
  if (receipts.length === 0) {
    return NextResponse.json({ error: "No receipts in that date range." }, { status: 404 });
  }

  const grouped = new Map<string, ReceiptRow[]>();
  for (const receipt of receipts) {
    const key = sheetNameForUser(receipt.userName);
    grouped.set(key, [...(grouped.get(key) ?? []), receipt]);
  }

  const workbook = buildWorkbook([
    { name: "All", amountColumn: 4, rows: [HEADERS, ...receipts.map(toRow)] },
    ...[...grouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0], "zh-Hant"))
      .map(([name, rows]) => ({
        name,
        claim: {
          staffName: name,
          monthYear: monthYearLabel(dateFrom.iso),
          items: claimItems(rows),
        },
      })),
  ]);

  const images = receipts.flatMap((receipt) => {
    const data = readReceiptFile(receipt.referenceNo);
    return data ? [{ name: `${receipt.referenceNo}.jpg`, data }] : [];
  });

  const zip = zipStore([{ name: "receipts.xlsx", data: workbook }, ...images]);
  const filename = `receipts-${dateFrom.iso}-${dateTo.iso}.zip`;
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
