import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  if (!(await getSessionUser())) {
    redirect("/login");
  }
  return <ChangePasswordForm />;
}
