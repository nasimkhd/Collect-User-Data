import { notFound } from "next/navigation";
import { getSubmissionByTicket } from "@/lib/db";
import ConfirmClient from "./ConfirmClient";

export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ ticket: string }>;
}) {
  const { ticket } = await params;
  const submission = getSubmissionByTicket(ticket);
  if (!submission) notFound();

  return (
    <ConfirmClient
      ticketCode={submission.ticket_code}
      fullName={submission.full_name}
      groupSize={submission.group_size}
    />
  );
}
