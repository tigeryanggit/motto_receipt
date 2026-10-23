import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createUser, listPublicUsers, UserStoreError, type Role } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "請先登入。" }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "只有管理員可以管理帳戶。" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }
  return NextResponse.json({ users: await listPublicUsers() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      password?: string;
      role?: Role;
    };
    await createUser({
      username: body.username ?? "",
      displayName: body.displayName ?? "",
      password: body.password ?? "",
      role: body.role === "admin" ? "admin" : "user",
    });
    return NextResponse.json({ users: await listPublicUsers() });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Create user failed", error);
    return NextResponse.json({ error: "建立帳戶失敗。" }, { status: 500 });
  }
}
