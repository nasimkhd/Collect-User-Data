import { NextResponse } from "next/server";
import { loginAdmin, logoutAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  const ok = await loginAdmin(password);
  if (!ok) {
    const url = new URL(req.url);
    url.pathname = "/admin/login";
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }
  const url = new URL(req.url);
  url.pathname = "/admin";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}

export async function DELETE() {
  await logoutAdmin();
  return new NextResponse(null, { status: 204 });
}
