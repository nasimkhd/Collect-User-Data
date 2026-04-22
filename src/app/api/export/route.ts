import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listSubmissions } from "@/lib/db";

export const runtime = "nodejs";

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const dayParam = url.searchParams.get("day");
  const day = dayParam ? parseInt(dayParam, 10) : undefined;

  const rows = listSubmissions({ day, limit: 100000 });

  const headers = [
    "ticket_code",
    "event_day",
    "day_sequence",
    "full_name",
    "primary_email",
    "extra_email_1",
    "extra_email_2",
    "extra_email_3",
    "extra_email_4",
    "extra_email_5",
    "all_emails",
    "group_size",
    "submitted_at",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    const extras = [...r.extra_emails];
    while (extras.length < 5) extras.push("");
    const allEmails = [r.primary_email, ...r.extra_emails].join("; ");
    lines.push(
      [
        r.ticket_code,
        r.event_day,
        r.day_sequence,
        r.full_name,
        r.primary_email,
        extras[0],
        extras[1],
        extras[2],
        extras[3],
        extras[4],
        allEmails,
        r.group_size,
        r.submitted_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = lines.join("\n");
  const filename = `submissions${day ? `-day${day}` : ""}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
