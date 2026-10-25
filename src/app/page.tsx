import { redirect } from "next/navigation";
import ReceiptProcessor from "@/components/ReceiptProcessor";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return <ReceiptProcessor userId={user.id} displayName={user.displayName} canDelete={user.role === "admin"} />;
}
