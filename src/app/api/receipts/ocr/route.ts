import { NextRequest, NextResponse } from "next/server";
import { recognizeReceiptImage } from "@/lib/ocr";
import { parseAmount, parseReceiptDate } from "@/lib/receipt-ref";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  try {
    const photo = (await request.formData()).get("photo");
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "請先拍攝收據相片。" }, { status: 400 });
    }
    const jpeg = Buffer.from(await photo.arrayBuffer());
    if (jpeg.length === 0 || jpeg.length > MAX_PHOTO_BYTES || !isJpeg(jpeg)) {
      return NextResponse.json({ error: "相片必須是 JPEG，而且不可超過 12MB。" }, { status: 400 });
    }

    const record = await recognizeReceiptImage(jpeg, "receipt.jpg");
    const date = parseReceiptDate(record.date) ? record.date : "";
    const amount = parseAmount(record.totalPrice) ?? "";
    return NextResponse.json({ date, amount });
  } catch (error) {
    console.error("Receipt OCR failed", error);
    return NextResponse.json({ date: "", amount: "" });
  }
}
