import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { authenticate, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const user = await authenticate(body.username ?? "", body.password ?? "");
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Login failed", error);
    return NextResponse.json({ error: "登入失敗。" }, { status: 500 });
  }
}
