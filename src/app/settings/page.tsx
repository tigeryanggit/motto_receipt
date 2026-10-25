import { redirect } from "next/navigation";
import SystemSettings from "@/components/SystemSettings";
import { getSessionUser } from "@/lib/session";
import { getReceiptFolder, listCategories } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/");
  }
  return <SystemSettings initialFolder={getReceiptFolder()} initialCategories={listCategories()} />;
}
