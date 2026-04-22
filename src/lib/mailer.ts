import fs from "node:fs";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import type { Submission } from "./db";
import {
  renderHtml,
  renderSubject,
  renderText,
  type TemplateVars,
} from "./emailTemplate";

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export interface MailerConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | undefined;
  smtpPass: string | undefined;
  fromAddress: string;
  fromName: string;
  replyTo: string | undefined;
  photosDir: string;
  mode: "attach" | "link";
  linkTemplate: string | undefined;
  maxAttachmentBytes: number;
  eventName: string;
  boothName: string;
  eventHashtag: string;
  unsubscribeUrl: string;
}

export function loadMailerConfig(): MailerConfig {
  const env = process.env;
  const host = env.SMTP_HOST;
  if (!host) {
    throw new Error(
      "SMTP_HOST is not set. Configure email settings in .env.local first.",
    );
  }
  const port = parseInt(env.SMTP_PORT || "465", 10);
  const mode = (env.PHOTO_DELIVERY_MODE || "attach") as "attach" | "link";
  if (mode !== "attach" && mode !== "link") {
    throw new Error(
      `PHOTO_DELIVERY_MODE must be "attach" or "link", got "${mode}".`,
    );
  }
  if (mode === "link" && !env.PHOTO_LINK_TEMPLATE) {
    throw new Error(
      `PHOTO_DELIVERY_MODE=link requires PHOTO_LINK_TEMPLATE (e.g. "https://gallery.example.com/{ticket_code}").`,
    );
  }
  const fromRaw = env.SMTP_FROM || "";
  const match = fromRaw.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  const fromName = match ? match[1].trim() : env.EVENT_NAME || "Photo Booth";
  const fromAddress = match ? match[2].trim() : fromRaw.trim();
  if (!fromAddress) {
    throw new Error(
      `SMTP_FROM is not set. Use format: SMTP_FROM="Your Booth <booth@yourdomain.com>"`,
    );
  }

  return {
    smtpHost: host,
    smtpPort: port,
    smtpSecure: port === 465,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    fromAddress,
    fromName,
    replyTo: env.SMTP_REPLY_TO || undefined,
    photosDir: path.resolve(env.PHOTOS_DIR || "./photos"),
    mode,
    linkTemplate: env.PHOTO_LINK_TEMPLATE,
    maxAttachmentBytes: parseInt(
      env.MAX_ATTACHMENT_BYTES || String(20 * 1024 * 1024),
      10,
    ),
    eventName: env.EVENT_NAME || "Our Event",
    boothName: env.BOOTH_NAME || "Photo Booth",
    eventHashtag: env.EVENT_HASHTAG || "",
    unsubscribeUrl: env.UNSUBSCRIBE_URL || "mailto:unsubscribe@example.com",
  };
}

export function createTransport(config: MailerConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth:
      config.smtpUser || config.smtpPass
        ? { user: config.smtpUser, pass: config.smtpPass }
        : undefined,
  });
}

export function findPhotosForTicket(
  ticketCode: string,
  photosDir: string,
): string[] {
  if (!fs.existsSync(photosDir)) return [];
  const prefix = ticketCode.toLowerCase();
  const matches: string[] = [];
  const entries = fs.readdirSync(photosDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.toLowerCase() !== prefix) continue;

    const folderPath = path.join(photosDir, entry.name);
    const files = fs.readdirSync(folderPath);
    for (const name of files) {
      const ext = path.extname(name).toLowerCase();
      if (PHOTO_EXTENSIONS.includes(ext)) {
        matches.push(path.join(folderPath, name));
      }
    }
  }

  return matches.sort();
}

export function resolveGalleryUrl(
  template: string | undefined,
  ticketCode: string,
): string | null {
  if (!template) return null;
  return template.replace(/\{ticket_code\}/gi, encodeURIComponent(ticketCode));
}

export interface SendResult {
  ticketCode: string;
  recipients: string[];
  photoFiles: string[];
  skipped?: "no-photos" | "no-consent" | "dry-run";
  error?: string;
  messageId?: string;
}

export interface SendOptions {
  dryRun?: boolean;
  onProgress?: (result: SendResult) => void;
}

export async function sendSubmission(
  submission: Submission,
  config: MailerConfig,
  transport: Transporter,
  opts: SendOptions = {},
): Promise<SendResult> {
  const recipients = [submission.primary_email, ...submission.extra_emails];
  const firstName = submission.full_name.split(/\s+/)[0] || submission.full_name;

  const photos = findPhotosForTicket(submission.ticket_code, config.photosDir);
  const galleryUrl = resolveGalleryUrl(
    config.linkTemplate,
    submission.ticket_code,
  );

  if (config.mode === "attach" && photos.length === 0) {
    return {
      ticketCode: submission.ticket_code,
      recipients,
      photoFiles: [],
      skipped: "no-photos",
    };
  }

  const vars: TemplateVars = {
    firstName,
    ticketCode: submission.ticket_code,
    eventName: config.eventName,
    boothName: config.boothName,
    eventHashtag: config.eventHashtag,
    photoCount: photos.length,
    galleryUrl,
    unsubscribeUrl: `${config.unsubscribeUrl}?ticket=${encodeURIComponent(
      submission.ticket_code,
    )}`,
    fromName: config.fromName,
  };

  if (opts.dryRun) {
    return {
      ticketCode: submission.ticket_code,
      recipients,
      photoFiles: photos,
      skipped: "dry-run",
    };
  }

  const attachments =
    config.mode === "attach"
      ? filterAttachments(photos, config.maxAttachmentBytes)
      : [];

  const info = await transport.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to: recipients.join(", "),
    replyTo: config.replyTo,
    subject: renderSubject(vars),
    text: renderText(vars),
    html: renderHtml(vars),
    headers: {
      "List-Unsubscribe": `<${vars.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    attachments: attachments.map((f) => ({
      filename: path.basename(f),
      path: f,
    })),
  });

  return {
    ticketCode: submission.ticket_code,
    recipients,
    photoFiles: photos,
    messageId: info.messageId,
  };
}

function filterAttachments(files: string[], maxBytes: number): string[] {
  const out: string[] = [];
  let total = 0;
  for (const f of files) {
    const size = fs.statSync(f).size;
    if (total + size > maxBytes) break;
    total += size;
    out.push(f);
  }
  return out;
}
