import { NextResponse } from "next/server";
import { loginAdmin, logoutAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  const ok = await loginAdmin(password);
  // Use a relative Location header so the browser resolves against the host
  // it actually connected to. Building a URL from req.url can yield
  // http://0.0.0.0:3001/... when the server is bound to 0.0.0.0, which
  // Safari/WebKit refuses to load.
  const location = ok ? "/admin" : "/admin/login?error=1";
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location },
  });
}

export async function DELETE() {
  await logoutAdmin();
  return new NextResponse(null, { status: 204 });
}
