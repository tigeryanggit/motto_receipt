import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import SetupForm from "@/components/SetupForm";
import { getSessionUser } from "@/lib/session";
import { countUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) {
    redirect("/");
  }

  return (await countUsers()) > 0 ? <LoginForm /> : <SetupForm />;
}
