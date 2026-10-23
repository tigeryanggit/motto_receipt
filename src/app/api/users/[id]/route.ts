import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listPublicUsers, updateUser, UserStoreError, type Role } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getSessionUser();
  if (!actor) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }
  if (actor.role !== "admin") {
    return NextResponse.json({ error: "只有管理員可以管理帳戶。" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      displayName?: string;
      password?: string;
      role?: Role;
      active?: boolean;
    };
    await updateUser(id, {
      displayName: body.displayName,
      password: body.password,
      role: body.role,
      active: body.active,
    });
    return NextResponse.json({ users: await listPublicUsers() });
  } catch (error) {
    if (error instanceof UserStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update user failed", error);
    return NextResponse.json({ error: "更新帳戶失敗。" }, { status: 500 });
  }
}
