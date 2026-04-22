import { NextResponse } from "next/server";
import { createSubmission } from "@/lib/db";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EXTRA = 5;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const full_name = typeof b.full_name === "string" ? b.full_name.trim() : "";
  const primary_email =
    typeof b.primary_email === "string"
      ? b.primary_email.trim().toLowerCase()
      : "";
  const extra_emails_raw = Array.isArray(b.extra_emails) ? b.extra_emails : [];
  const extra_emails = extra_emails_raw
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_EXTRA);

  if (!full_name) return new NextResponse("Name is required", { status: 400 });
  if (!EMAIL_RE.test(primary_email)) {
    return new NextResponse("Valid email is required", { status: 400 });
  }
  for (const e of extra_emails) {
    if (!EMAIL_RE.test(e)) {
      return new NextResponse(`Invalid email: ${e}`, { status: 400 });
    }
  }

  const { currentDay } = getConfig();

  try {
    const sub = createSubmission({
      full_name,
      primary_email,
      extra_emails,
      event_day: currentDay,
    });
    return NextResponse.json({
      ticket_code: sub.ticket_code,
      id: sub.id,
    });
  } catch (err) {
    console.error("submit failed", err);
    return new NextResponse("Database error", { status: 500 });
  }
}
