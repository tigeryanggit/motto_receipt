import { NextRequest, NextResponse } from "next/server";
import { recognizeReceiptImage } from "@/lib/ocr";
import { isImageFile } from "@/lib/constants";
import { recordsToCsv } from "@/lib/csv";
import { buildCsvFilename } from "@/lib/constants";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    const download = formData.get("download") === "true";

    const imageFiles = files.filter(
      (entry): entry is File =>
        entry instanceof File && isImageFile(entry.name)
    );

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "請選擇包含 JPEG、JPG、PNG 或 BMP 圖片的資料夾。" },
        { status: 400 }
      );
    }

    imageFiles.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

    const records = [];
    for (const file of imageFiles) {
      console.info(`OCR start: ${file.name} (${file.size} bytes)`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const record = await recognizeReceiptImage(buffer, file.name);
      console.info(`OCR done: ${file.name}`);
      records.push(record);
    }

    if (download) {
      const filename = buildCsvFilename();
      return new NextResponse(recordsToCsv(records), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ records, filename: buildCsvFilename() });
  } catch (error) {
    console.error("Receipt processing failed:", error);
    return NextResponse.json(
      { error: "處理收據時發生錯誤，請稍後再試。" },
      { status: 500 }
    );
  }
}
