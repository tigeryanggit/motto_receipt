import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { addCategory, deleteCategory, listCategories, SettingsError } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }
  return NextResponse.json({ categories: listCategories() });
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can change categories." }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }
  try {
    const body = (await request.json()) as { name?: string };
    return NextResponse.json({ categories: addCategory(body.name ?? "") });
  } catch (error) {
    if (error instanceof SettingsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Add category failed", error);
    return NextResponse.json({ error: "Could not add the category." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }
  try {
    const body = (await request.json()) as { name?: string };
    return NextResponse.json({ categories: deleteCategory(body.name ?? "") });
  } catch (error) {
    if (error instanceof SettingsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Delete category failed", error);
    return NextResponse.json({ error: "Could not delete the category." }, { status: 500 });
  }
}
