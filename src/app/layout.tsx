import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "收據資料讀取 | Receipts OCR",
  description: "拍攝收據並儲存至 Google Drive，或由圖片讀取收據資料",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
