"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  ticketCode: string;
  fullName: string;
  groupSize: number;
}

const AUTO_RESET_SECONDS = 20;

export default function ConfirmClient({
  ticketCode,
  fullName,
  groupSize,
}: Props) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RESET_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          router.push("/");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [router]);

  const firstName = fullName.split(" ")[0] || fullName;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="w-full max-w-3xl space-y-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-success/15 border-2 border-brand-success px-4 py-2 text-brand-success text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
            You&apos;re all set, {firstName}!
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-ink">
            Your ticket number
          </h1>
        </div>

        <div className="card py-16 bg-brand-surface">
          <div className="text-[clamp(5rem,20vw,12rem)] font-black tracking-tight text-brand-accent leading-none">
            {ticketCode}
          </div>
          <div className="mt-6 text-xl text-brand-ink font-semibold">
            Show this number to our greeter
          </div>
        </div>

        {groupSize > 1 && (
          <div className="text-brand-inkMuted">
            Group of <span className="text-brand-ink font-bold">{groupSize}</span>{" "}
            — all emails will receive the photos.
          </div>
        )}

        <button
          onClick={() => router.push("/")}
          className="btn-ghost w-full text-lg"
        >
          Next person ({secondsLeft}s)
        </button>
      </div>
    </main>
  );
}
