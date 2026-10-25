import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getReceiptFolder, setReceiptFolder, SettingsError } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can change system configuration." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }
  return NextResponse.json({ folder: getReceiptFolder() });
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  try {
    const body = (await request.json()) as { folder?: string };
    const saved = setReceiptFolder(body.folder ?? "");
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof SettingsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update folder failed", error);
    return NextResponse.json({ error: "Could not update the folder location." }, { status: 500 });
  }
}
