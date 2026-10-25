import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { changeOwnPassword, UserStoreError } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    await changeOwnPassword(user.id, body.currentPassword ?? "", body.newPassword ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Change password failed", error);
    return NextResponse.json({ error: "Could not change the password." }, { status: 500 });
  }
}
