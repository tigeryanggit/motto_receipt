import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ReceiptProcessor from "@/components/ReceiptProcessor";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <AppHeader user={user} />
      <ReceiptProcessor displayName={user.displayName} />
    </>
  );
}
