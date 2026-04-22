import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  listSendable,
  markEmailFailed,
  markEmailSent,
  type Submission,
} from "@/lib/db";
import {
  createTransport,
  loadMailerConfig,
  sendSubmission,
  type SendResult,
} from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  ticket?: string;
  day?: number;
  force?: boolean;
  dryRun?: boolean;
}

interface TicketResult {
  ticket: string;
  name: string;
  status: "sent" | "dry-run" | "no-photos" | "failed";
  recipients: number;
  photos: number;
  error?: string;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // empty body is allowed → send all pending
  }

  let config;
  try {
    config = loadMailerConfig();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  const queue: Submission[] = listSendable({
    day: body.day,
    ticket: body.ticket,
    includeAlreadySent: Boolean(body.force),
  });

  if (queue.length === 0) {
    return NextResponse.json({
      ok: true,
      queue: 0,
      results: [],
      summary: { sent: 0, skipped: 0, failed: 0, recipients: 0 },
      message:
        "Nothing to send. All matching tickets are already sent, or none match.",
    });
  }

  const transport = createTransport(config);
  if (!body.dryRun) {
    try {
      await transport.verify();
    } catch (e) {
      return NextResponse.json(
        {
          error: `SMTP verification failed: ${(e as Error).message}`,
        },
        { status: 502 },
      );
    }
  }

  const results: TicketResult[] = [];
  const summary = { sent: 0, skipped: 0, failed: 0, recipients: 0 };

  for (const sub of queue) {
    try {
      const r: SendResult = await sendSubmission(sub, config, transport, {
        dryRun: body.dryRun,
      });

      if (r.skipped === "no-photos") {
        summary.skipped++;
        results.push({
          ticket: sub.ticket_code,
          name: sub.full_name,
          status: "no-photos",
          recipients: r.recipients.length,
          photos: 0,
        });
        continue;
      }

      if (r.skipped === "dry-run") {
        summary.sent++;
        summary.recipients += r.recipients.length;
        results.push({
          ticket: sub.ticket_code,
          name: sub.full_name,
          status: "dry-run",
          recipients: r.recipients.length,
          photos: r.photoFiles.length,
        });
        continue;
      }

      markEmailSent(
        sub.ticket_code,
        r.photoFiles.map((p) => p.split("/").pop() || p),
      );
      summary.sent++;
      summary.recipients += r.recipients.length;
      results.push({
        ticket: sub.ticket_code,
        name: sub.full_name,
        status: "sent",
        recipients: r.recipients.length,
        photos: r.photoFiles.length,
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (!body.dryRun) markEmailFailed(sub.ticket_code, msg);
      summary.failed++;
      results.push({
        ticket: sub.ticket_code,
        name: sub.full_name,
        status: "failed",
        recipients: sub.extra_emails.length + 1,
        photos: 0,
        error: msg,
      });
    }
  }

  try {
    transport.close();
  } catch {}

  return NextResponse.json({
    ok: summary.failed === 0,
    queue: queue.length,
    results,
    summary,
    dryRun: Boolean(body.dryRun),
  });
}
