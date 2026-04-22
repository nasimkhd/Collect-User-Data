"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { DayStats, Submission } from "@/lib/db";

interface Props {
  stats: {
    total: number;
    total_emails: number;
    by_day: DayStats[];
    last_submission: string | null;
  };
  config: {
    eventName: string;
    currentDay: number;
    totalDays: number;
  };
  submissions: Submission[];
  filterDay?: number;
  filterQuery: string;
}

interface SendSummary {
  sent: number;
  skipped: number;
  failed: number;
  recipients: number;
}

interface SendResponse {
  ok?: boolean;
  queue?: number;
  summary?: SendSummary;
  message?: string;
  error?: string;
  dryRun?: boolean;
}

export default function AdminClient({
  stats,
  config,
  submissions,
  filterDay,
  filterQuery,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(filterQuery);
  const [pending, startTransition] = useTransition();
  const [sendingTickets, setSendingTickets] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [toast, setToast] = useState<{
    kind: "ok" | "warn" | "err";
    text: string;
  } | null>(null);

  async function callSend(payload: {
    ticket?: string;
    day?: number;
    dryRun?: boolean;
    force?: boolean;
  }): Promise<SendResponse> {
    const res = await fetch("/api/send-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as SendResponse;
  }

  async function sendOne(ticket: string, force = false) {
    setSendingTickets((prev) => new Set(prev).add(ticket));
    setToast(null);
    try {
      const data = await callSend({ ticket, force });
      if (data.error) {
        setToast({ kind: "err", text: data.error });
      } else if (data.summary?.sent) {
        setToast({
          kind: "ok",
          text: `Sent ${ticket} to ${data.summary.recipients} recipient(s).`,
        });
        startTransition(() => router.refresh());
      } else if (data.summary?.skipped) {
        setToast({
          kind: "warn",
          text: `${ticket} skipped — no matching photo files found in PHOTOS_DIR.`,
        });
      } else if (data.summary?.failed) {
        setToast({ kind: "err", text: `Send failed for ${ticket}.` });
        startTransition(() => router.refresh());
      } else {
        setToast({
          kind: "warn",
          text: data.message || "Nothing happened.",
        });
      }
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    } finally {
      setSendingTickets((prev) => {
        const next = new Set(prev);
        next.delete(ticket);
        return next;
      });
    }
  }

  async function sendBulk(opts: { dryRun?: boolean } = {}) {
    const label = filterDay ? `Day ${filterDay}` : "all days";
    const what = opts.dryRun ? "DRY RUN" : "SEND";
    if (
      !opts.dryRun &&
      !confirm(
        `${what}: email all pending tickets with photos for ${label}?\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkSending(true);
    setToast(null);
    try {
      const data = await callSend({ day: filterDay, dryRun: opts.dryRun });
      if (data.error) {
        setToast({ kind: "err", text: data.error });
      } else {
        const s = data.summary || {
          sent: 0,
          skipped: 0,
          failed: 0,
          recipients: 0,
        };
        const prefix = opts.dryRun ? "Dry run" : "Done";
        setToast({
          kind: s.failed ? "err" : s.skipped ? "warn" : "ok",
          text: `${prefix}: ${s.sent} sent → ${s.recipients} recipients · ${s.skipped} skipped (no photos) · ${s.failed} failed.`,
        });
        if (!opts.dryRun) startTransition(() => router.refresh());
      }
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    } finally {
      setBulkSending(false);
    }
  }

  function setDay(day: number | undefined) {
    const p = new URLSearchParams(params.toString());
    if (day === undefined) p.delete("day");
    else p.set("day", String(day));
    startTransition(() => router.push(`/admin?${p.toString()}`));
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams(params.toString());
    if (query) p.set("q", query);
    else p.delete("q");
    startTransition(() => router.push(`/admin?${p.toString()}`));
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/admin/login");
  }

  const exportHref = `/api/export${
    filterDay ? `?day=${filterDay}` : ""
  }`;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.2em] text-brand-accent font-bold uppercase">
              Admin · {config.eventName}
            </div>
            <h1 className="text-3xl font-black text-brand-ink mt-1">Submissions</h1>
            <p className="text-brand-inkMuted text-sm mt-1">
              Currently Day {config.currentDay} of {config.totalDays}.
              {stats.last_submission && (
                <> Last submission: {formatDate(stats.last_submission)}.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => sendBulk({ dryRun: true })}
              className="btn-ghost"
              disabled={bulkSending}
              title="Preview: which pending tickets would be sent and how many have matching photos"
            >
              {bulkSending ? "Working…" : "Dry run"}
            </button>
            <button
              onClick={() => sendBulk()}
              className="btn-primary"
              disabled={bulkSending}
              title={`Send all pending tickets${filterDay ? ` for Day ${filterDay}` : ""}`}
            >
              {bulkSending
                ? "Sending…"
                : `Send pending${filterDay ? ` (Day ${filterDay})` : ""}`}
            </button>
            <a href={exportHref} className="btn-ghost" download>
              Export CSV{filterDay ? ` (Day ${filterDay})` : ""}
            </a>
            <button onClick={logout} className="btn-ghost">
              Sign out
            </button>
          </div>
        </header>

        {toast && (
          <div
            className={
              "rounded-xl border-2 px-4 py-3 text-sm font-semibold " +
              (toast.kind === "ok"
                ? "bg-brand-success/10 border-brand-success text-brand-success"
                : toast.kind === "warn"
                  ? "bg-brand-lavender/20 border-brand-lavender text-brand-ink"
                  : "bg-brand-danger/10 border-brand-danger text-brand-danger")
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>{toast.text}</div>
              <button
                onClick={() => setToast(null)}
                className="opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total submissions" value={stats.total} />
          <StatCard label="Total emails captured" value={stats.total_emails} />
          <StatCard
            label="Today (Day)"
            value={
              stats.by_day.find((d) => d.day === config.currentDay)?.count ?? 0
            }
          />
          <StatCard
            label="Emails sent"
            value={submissions.filter((s) => s.email_sent_at).length}
            suffix={` / ${submissions.length}`}
          />
        </section>

        <section className="card">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <DayFilter
              current={filterDay}
              totalDays={config.totalDays}
              byDay={stats.by_day}
              onChange={setDay}
            />
            <form onSubmit={applySearch} className="flex gap-2 ml-auto">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, or ticket"
                className="input !py-2 !text-base w-64"
              />
              <button type="submit" className="btn-ghost !py-2">
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-inkMuted border-b-2 border-brand-border">
                  <th className="py-2 pr-3">Ticket</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Emails</th>
                  <th className="py-2 pr-3">Group</th>
                  <th className="py-2 pr-3">Email status</th>
                  <th className="py-2 pr-3">Submitted</th>
                  <th className="py-2 pr-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-brand-inkSoft">
                      {pending ? "Loading…" : "No submissions yet."}
                    </td>
                  </tr>
                )}
                {submissions.map((s) => {
                  const isSending = sendingTickets.has(s.ticket_code);
                  const alreadySent = Boolean(s.email_sent_at);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-brand-borderSoft hover:bg-brand-surfaceAlt/60"
                    >
                      <td className="py-3 pr-3 font-mono font-bold text-brand-accent">
                        {s.ticket_code}
                      </td>
                      <td className="py-3 pr-3 text-brand-ink font-semibold">{s.full_name}</td>
                      <td className="py-3 pr-3 text-brand-ink">
                        <div>{s.primary_email}</div>
                        {s.extra_emails.length > 0 && (
                          <div className="text-xs text-brand-inkSoft mt-1">
                            + {s.extra_emails.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-brand-inkMuted">{s.group_size}</td>
                      <td className="py-3 pr-3">
                        <EmailStatus submission={s} />
                      </td>
                      <td className="py-3 pr-3 text-brand-inkMuted whitespace-nowrap">
                        {formatDate(s.submitted_at)}
                      </td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            sendOne(s.ticket_code, alreadySent)
                          }
                          disabled={isSending || bulkSending}
                          className="btn-ghost !py-1 !px-3 !text-xs"
                          title={
                            alreadySent
                              ? "Re-send (force) — will email again"
                              : "Send photos for this ticket"
                          }
                        >
                          {isSending
                            ? "Sending…"
                            : alreadySent
                              ? "Re-send"
                              : "Send"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {submissions.length >= 500 && (
            <p className="text-xs text-brand-inkSoft mt-4">
              Showing most recent 500. Use search or the CSV export for the
              full list.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="card !p-4">
      <div className="text-xs text-brand-inkMuted uppercase tracking-wide font-semibold">
        {label}
      </div>
      <div className="text-3xl font-black text-brand-ink mt-1">
        {value}
        {suffix && <span className="text-brand-inkSoft text-xl">{suffix}</span>}
      </div>
    </div>
  );
}

function DayFilter({
  current,
  totalDays,
  byDay,
  onChange,
}: {
  current: number | undefined;
  totalDays: number;
  byDay: DayStats[];
  onChange: (day: number | undefined) => void;
}) {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  return (
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={() => onChange(undefined)}
        className={
          "px-3 py-1.5 rounded-lg text-sm font-semibold border-2 " +
          (current === undefined
            ? "bg-brand-accent border-brand-border text-white"
            : "bg-brand-surface border-brand-border text-brand-ink hover:bg-brand-surfaceAlt")
        }
      >
        All
      </button>
      {days.map((d) => {
        const count = byDay.find((x) => x.day === d)?.count ?? 0;
        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-semibold border-2 " +
              (current === d
                ? "bg-brand-accent border-brand-border text-white"
                : "bg-brand-surface border-brand-border text-brand-ink hover:bg-brand-surfaceAlt")
            }
          >
            Day {d}
            <span className="ml-1 text-xs opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

function EmailStatus({ submission }: { submission: Submission }) {
  if (submission.email_sent_at) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-success/15 border-2 border-brand-success px-2.5 py-1 text-xs font-semibold text-brand-success"
        title={`Sent ${formatDate(submission.email_sent_at)} (${submission.email_attempts} attempt${submission.email_attempts === 1 ? "" : "s"})`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-brand-success" />
        Sent
      </span>
    );
  }
  if (submission.email_error) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-danger/15 border-2 border-brand-danger px-2.5 py-1 text-xs font-semibold text-brand-danger"
        title={submission.email_error}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-brand-danger" />
        Failed ({submission.email_attempts})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-lavender/30 border-2 border-brand-lavender px-2.5 py-1 text-xs font-semibold text-brand-inkMuted">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-inkMuted" />
      Pending
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
