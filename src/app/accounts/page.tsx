import { redirect } from "next/navigation";
import AccountManager from "@/components/AccountManager";
import { getSessionUser } from "@/lib/session";
import { listPublicUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/");
  }

  return <AccountManager initialUsers={await listPublicUsers()} />;
}
