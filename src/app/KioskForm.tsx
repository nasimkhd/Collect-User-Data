"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  eventName: string;
  boothName: string;
  currentDay: number;
}

const MAX_EXTRA_EMAILS = 5;

export default function KioskForm({ eventName, boothName, currentDay }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);

  function addEmail() {
    if (extraEmails.length < MAX_EXTRA_EMAILS) {
      setExtraEmails([...extraEmails, ""]);
    }
  }

  function removeEmail(i: number) {
    setExtraEmails(extraEmails.filter((_, idx) => idx !== i));
  }

  function updateExtraEmail(i: number, value: string) {
    setExtraEmails(extraEmails.map((e, idx) => (idx === i ? value : e)));
  }

  function validate(): string | null {
    if (!fullName.trim()) return "Please enter your name.";
    if (!primaryEmail.trim()) return "Please enter an email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail.trim())) {
      return "That email looks invalid — please double-check.";
    }
    for (const e of extraEmails) {
      if (e.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) {
        return `Please check the additional email: ${e}`;
      }
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          primary_email: primaryEmail.trim().toLowerCase(),
          extra_emails: extraEmails
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || "Something went wrong. Please ask for help.");
        return;
      }
      const data = (await res.json()) as { ticket_code: string };
      router.push(`/confirm/${data.ticket_code}`);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-2xl card space-y-6"
      autoComplete="off"
    >
      <header className="text-center space-y-2">
        <div className="text-xs tracking-[0.2em] text-brand-accent font-bold uppercase">
          {eventName} · Day {currentDay}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-brand-ink">
          {boothName}
        </h1>
        <p className="text-brand-inkMuted">
          Get your photos emailed to you — takes 20 seconds.
        </p>
      </header>

      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoCorrect="off"
          className="input"
          placeholder="First and last name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="input"
          placeholder="you@example.com"
          value={primaryEmail}
          onChange={(e) => setPrimaryEmail(e.target.value)}
          required
        />
      </div>

      {extraEmails.length > 0 && (
        <div className="space-y-3">
          <div className="label">Additional emails (for group photos)</div>
          {extraEmails.map((email, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="input"
                placeholder={`Group member ${i + 2}`}
                value={email}
                onChange={(e) => updateExtraEmail(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeEmail(i)}
                className="btn-ghost px-4"
                aria-label="Remove email"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {extraEmails.length < MAX_EXTRA_EMAILS && (
        <button type="button" onClick={addEmail} className="btn-ghost w-full">
          + Add another email (group photo)
        </button>
      )}

      {error && (
        <div className="rounded-xl bg-brand-danger/15 border-2 border-brand-danger text-brand-ink px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full text-lg py-5"
      >
        {pending ? "Submitting…" : "Get my ticket number →"}
      </button>

      <p className="text-xs text-brand-inkSoft text-center">
        Your information is used only to send your photos. We never sell your
        data.
      </p>
    </form>
  );
}
