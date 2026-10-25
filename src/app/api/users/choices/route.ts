import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listActiveUserChoices } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }
  return NextResponse.json({ users: await listActiveUserChoices() });
}
