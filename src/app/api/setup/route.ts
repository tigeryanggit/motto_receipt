import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { createFirstAdmin, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      password?: string;
    };
    const user = await createFirstAdmin({
      username: body.username ?? "",
      displayName: body.displayName ?? "",
      password: body.password ?? "",
    });
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Setup failed", error);
    return NextResponse.json({ error: "建立帳戶失敗。" }, { status: 500 });
  }
}
