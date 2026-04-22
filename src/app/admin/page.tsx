import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getStats, listSubmissions } from "@/lib/db";
import { getConfig } from "@/lib/config";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; q?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { day, q } = await searchParams;
  const dayNum = day ? parseInt(day, 10) : undefined;

  const stats = getStats();
  const config = getConfig();
  const submissions = listSubmissions({
    day: dayNum,
    search: q,
    limit: 500,
  });

  return (
    <AdminClient
      stats={stats}
      config={{
        eventName: config.eventName,
        currentDay: config.currentDay,
        totalDays: config.eventTotalDays,
      }}
      submissions={submissions}
      filterDay={dayNum}
      filterQuery={q ?? ""}
    />
  );
}
