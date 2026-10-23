import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "收據資料讀取 | Receipts OCR",
  description: "拍攝或上傳收據，並按參考編號儲存",
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
