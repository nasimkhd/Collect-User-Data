#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import {
  listSendable,
  markEmailFailed,
  markEmailSent,
  type Submission,
} from "../src/lib/db";
import {
  createTransport,
  loadMailerConfig,
  sendSubmission,
  type SendResult,
} from "../src/lib/mailer";

interface CliArgs {
  dryRun: boolean;
  day?: number;
  ticket?: string;
  force: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, force: false, help: false };
  for (const a of argv) {
    if (a === "--dry-run" || a === "-n") args.dryRun = true;
    else if (a === "--force" || a === "-f") args.force = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("--day=")) args.day = parseInt(a.slice(6), 10);
    else if (a.startsWith("--ticket=")) args.ticket = a.slice(9);
  }
  return args;
}

function printHelp(): void {
  console.log(`
BoothForm — Email Sender

Sends photos to everyone who signed up at the booth, matched by ticket code.

USAGE
  npm run send-emails -- [options]

OPTIONS
  --dry-run, -n       Preview what would be sent, don't actually send
  --force, -f         Re-send even if already marked as sent
  --day=N             Only send for event day N (1-4)
  --ticket=D1-047     Only send for one specific ticket
  --help, -h          Show this message

EXAMPLES
  npm run send-emails -- --dry-run
  npm run send-emails -- --day=1
  npm run send-emails -- --ticket=D1-047 --force
  npm run send-emails

PHOTO MATCHING
  Inside the folder configured by PHOTOS_DIR (default: ./photos), put one
  subfolder per ticket, named exactly like the ticket code. Any photos
  inside (.jpg/.jpeg/.png/.webp) will be attached to that ticket's email.

  Example layout:
    photos/
      D1-001/
        IMG_1234.jpg
        IMG_1235.jpg
      D1-002/
        IMG_1240.jpg
`);
}

function fmtRecipients(rs: string[]): string {
  if (rs.length <= 2) return rs.join(", ");
  return `${rs[0]}, ${rs[1]} (+${rs.length - 2} more)`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  let config;
  try {
    config = loadMailerConfig();
  } catch (e) {
    console.error("Config error:", (e as Error).message);
    process.exit(1);
  }

  console.log(`BoothForm email sender`);
  console.log(`  SMTP:         ${config.smtpHost}:${config.smtpPort}`);
  console.log(`  From:         "${config.fromName}" <${config.fromAddress}>`);
  console.log(`  Photos dir:   ${config.photosDir}`);
  console.log(`  Delivery:     ${config.mode}${config.mode === "link" ? ` → ${config.linkTemplate}` : ""}`);
  console.log(`  Mode:         ${args.dryRun ? "DRY RUN (no emails sent)" : "LIVE SEND"}`);
  if (args.day) console.log(`  Filter:       day ${args.day}`);
  if (args.ticket) console.log(`  Filter:       ticket ${args.ticket}`);
  if (args.force) console.log(`  Force:        re-send already-sent tickets`);
  console.log();

  const queue: Submission[] = listSendable({
    day: args.day,
    ticket: args.ticket,
    includeAlreadySent: args.force,
  });

  if (queue.length === 0) {
    console.log("Nothing to send. All matching tickets are already sent.");
    console.log("Hint: use --force to re-send, or check your filters.");
    return;
  }

  console.log(`Found ${queue.length} ticket(s) to process.\n`);

  const transport = createTransport(config);
  if (!args.dryRun) {
    try {
      await transport.verify();
      console.log("SMTP connection verified.\n");
    } catch (e) {
      console.error("SMTP verification failed:", (e as Error).message);
      process.exit(1);
    }
  }

  const counts = { sent: 0, skipped: 0, failed: 0, totalRecipients: 0 };
  const skippedNoPhotos: string[] = [];

  for (const sub of queue) {
    const label = `${sub.ticket_code}  ${sub.full_name}`.padEnd(36);
    try {
      const result: SendResult = await sendSubmission(sub, config, transport, {
        dryRun: args.dryRun,
      });

      if (result.skipped === "no-photos") {
        console.log(`  ⊘ ${label}  no photos found in ${config.photosDir}`);
        counts.skipped++;
        skippedNoPhotos.push(sub.ticket_code);
        continue;
      }
      if (result.skipped === "dry-run") {
        console.log(
          `  ~ ${label}  ${result.photoFiles.length} photo(s) → ${fmtRecipients(
            result.recipients,
          )}`,
        );
        counts.sent++;
        counts.totalRecipients += result.recipients.length;
        continue;
      }
      markEmailSent(sub.ticket_code, result.photoFiles.map((p) => p.split("/").pop() || p));
      console.log(
        `  ✓ ${label}  sent to ${fmtRecipients(result.recipients)} (${result.photoFiles.length} photo${result.photoFiles.length === 1 ? "" : "s"})`,
      );
      counts.sent++;
      counts.totalRecipients += result.recipients.length;
    } catch (e) {
      const msg = (e as Error).message;
      if (!args.dryRun) markEmailFailed(sub.ticket_code, msg);
      console.log(`  ✗ ${label}  FAILED: ${msg}`);
      counts.failed++;
    }
  }

  console.log();
  console.log("-----------------------------------------");
  console.log(`${args.dryRun ? "Would send" : "Sent"}:  ${counts.sent} email(s) to ${counts.totalRecipients} recipient(s)`);
  console.log(`Skipped:     ${counts.skipped} (no photos)`);
  console.log(`Failed:      ${counts.failed}`);
  console.log("-----------------------------------------");

  if (skippedNoPhotos.length > 0) {
    console.log(
      `\nTickets with no photos yet: ${skippedNoPhotos.slice(0, 10).join(", ")}${
        skippedNoPhotos.length > 10 ? ` (+${skippedNoPhotos.length - 10} more)` : ""
      }`,
    );
    console.log(
      "→ Drop matching files into the photos directory and re-run the command.",
    );
  }

  try {
    transport.close();
  } catch {}

  if (counts.failed > 0) process.exit(2);
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
