import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  redirect("/login");
}
