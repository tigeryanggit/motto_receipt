import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { getSessionUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "上傳收據",
  description: "拍攝或上傳收據，並按參考編號儲存",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  return (
    <html lang="zh-Hant">
      <body>
        <Navbar user={user ? { role: user.role, displayName: user.displayName } : null} />
        {children}
      </body>
    </html>
  );
}
