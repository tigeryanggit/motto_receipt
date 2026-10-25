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
import { findActiveUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 200 * 1024;

function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }
  const userName = user.role === "admin" ? undefined : user.displayName;
  return NextResponse.json({ receipts: listReceipts(userName) });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const selectedUser = await findActiveUser(String(formData.get("userId") ?? "").trim());
    const receiptDate = String(formData.get("receiptDate") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const amount = parseAmount(String(formData.get("amount") ?? ""));
    const photo = formData.get("photo");
    const parsedDate = parseReceiptDate(receiptDate);

    if (!selectedUser) {
      return NextResponse.json({ error: "請選擇使用者。" }, { status: 400 });
    }
    if (!parsedDate) {
      return NextResponse.json({ error: "請輸入有效的收據日期。" }, { status: 400 });
    }
    if (!description || description.length > 200) {
      return NextResponse.json({ error: "請輸入描述。" }, { status: 400 });
    }
    if (!amount) {
      return NextResponse.json({ error: "請輸入有效金額。" }, { status: 400 });
    }
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "請先拍攝或上傳收據相片。" }, { status: 400 });
    }

    const jpeg = Buffer.from(await photo.arrayBuffer());
    if (jpeg.length === 0 || jpeg.length >= MAX_PHOTO_BYTES || !isJpeg(jpeg)) {
      return NextResponse.json({ error: "相片必須是 JPEG，而且不可超過 200KB。" }, { status: 400 });
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
          userName: selectedUser.displayName,
          receiptDate: parsedDate.iso,
          category: "",
          remarks: description,
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
