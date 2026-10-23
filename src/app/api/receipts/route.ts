import { NextRequest, NextResponse } from "next/server";
import {
  ReceiptSaveError,
  removeReceiptFile,
  storedFileNames,
  withReceiptLock,
  writeReceiptFile,
} from "@/lib/receipt-files";
import { nextReference, parseAmount, parseReceiptDate } from "@/lib/receipt-ref";
import { insertReceipt, listReceipts, storedReferenceFileNames } from "@/lib/receipts-db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }
  return NextResponse.json({ receipts: listReceipts() });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const userName = String(formData.get("userName") ?? "").trim();
    const receiptDate = String(formData.get("receiptDate") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const amount = parseAmount(String(formData.get("amount") ?? ""));
    const photo = formData.get("photo");
    const parsedDate = parseReceiptDate(receiptDate);

    if (!userName || userName.length > 80) {
      return NextResponse.json({ error: "請輸入姓名。" }, { status: 400 });
    }
    if (!parsedDate) {
      return NextResponse.json({ error: "請輸入有效的收據日期。" }, { status: 400 });
    }
    if (!category || category.length > 40) {
      return NextResponse.json({ error: "請輸入類別。" }, { status: 400 });
    }
    if (!amount) {
      return NextResponse.json({ error: "請輸入有效金額。" }, { status: 400 });
    }
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "請先拍攝或上傳收據相片。" }, { status: 400 });
    }

    const jpeg = Buffer.from(await photo.arrayBuffer());
    if (jpeg.length === 0 || jpeg.length > MAX_PHOTO_BYTES || !isJpeg(jpeg)) {
      return NextResponse.json({ error: "相片必須是 JPEG，而且不可超過 12MB。" }, { status: 400 });
    }

    const saved = await withReceiptLock(async () => {
      const reference = nextReference(parsedDate.monthKey, [
        ...storedFileNames(parsedDate.monthKey),
        ...storedReferenceFileNames(parsedDate.monthKey),
      ]);
      writeReceiptFile(reference, jpeg);
      try {
        const row = insertReceipt({
          referenceNo: reference,
          userName,
          receiptDate: parsedDate.iso,
          category,
          amount,
        });
        return {
          reference,
          fileName: `${reference}.jpg`,
          createDate: row.createDate,
        };
      } catch (error) {
        removeReceiptFile(reference);
        throw error;
      }
    });

    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof ReceiptSaveError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "本月參考編號已滿。") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Receipt upload failed", error);
    return NextResponse.json({ error: "儲存收據時發生錯誤，請稍後再試。" }, { status: 500 });
  }
}
