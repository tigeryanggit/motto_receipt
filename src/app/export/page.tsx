import { redirect } from "next/navigation";
import ExportReceipts from "@/components/ExportReceipts";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  if (!(await getSessionUser())) {
    redirect("/login");
  }
  return <ExportReceipts />;
}
