export interface TemplateVars {
  firstName: string;
  ticketCode: string;
  eventName: string;
  boothName: string;
  eventHashtag: string;
  photoCount: number;
  galleryUrl: string | null;
  unsubscribeUrl: string;
  fromName: string;
}

export function renderSubject(v: TemplateVars): string {
  return `Your photos from ${v.eventName} (${v.ticketCode})`;
}

export function renderText(v: TemplateVars): string {
  const lines: string[] = [];
  lines.push(`Hi ${v.firstName},`);
  lines.push("");
  lines.push(
    `Thanks for stopping by the ${v.boothName} at ${v.eventName}! Your photos are ready.`,
  );
  lines.push("");
  lines.push(`Ticket: ${v.ticketCode}`);
  if (v.galleryUrl) {
    lines.push(`Photos: ${v.galleryUrl}`);
  } else {
    lines.push(
      `Photos: attached to this email (${v.photoCount} photo${
        v.photoCount === 1 ? "" : "s"
      }).`,
    );
  }
  lines.push("");
  if (v.eventHashtag) {
    lines.push(
      `Share them on social and tag ${v.eventHashtag} — we'd love to see it!`,
    );
    lines.push("");
  }
  lines.push(`— ${v.fromName}`);
  lines.push("");
  lines.push("---");
  lines.push(
    `You're receiving this because you signed up at our photo booth. Unsubscribe: ${v.unsubscribeUrl}`,
  );
  return lines.join("\n");
}

export function renderHtml(v: TemplateVars): string {
  const galleryBlock = v.galleryUrl
    ? `
      <tr>
        <td align="center" style="padding:8px 0 28px 0;">
          <a href="${escapeHtml(v.galleryUrl)}"
             style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;
                    font-weight:600;padding:14px 28px;border-radius:10px;font-size:16px;">
            View your photos →
          </a>
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding:4px 0 20px 0;color:#475569;font-size:15px;line-height:1.6;">
          Your photos (${v.photoCount}) are attached to this email.
        </td>
      </tr>`;

  const hashtagBlock = v.eventHashtag
    ? `
      <tr>
        <td style="padding:12px 0;color:#475569;font-size:14px;line-height:1.6;">
          Share on social and tag <strong>${escapeHtml(v.eventHashtag)}</strong> — we'd love to see it.
        </td>
      </tr>`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(renderSubject(v))}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:28px 32px 8px 32px;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:12px;letter-spacing:2px;color:#3b82f6;font-weight:700;text-transform:uppercase;">
                ${escapeHtml(v.eventName)}
              </div>
              <div style="font-size:22px;color:#0f172a;font-weight:700;margin-top:4px;">
                Your photos are ready
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#0f172a;font-size:16px;line-height:1.6;padding-bottom:12px;">
                    Hi ${escapeHtml(v.firstName)},
                  </td>
                </tr>
                <tr>
                  <td style="color:#334155;font-size:15px;line-height:1.6;padding-bottom:20px;">
                    Thanks for stopping by the <strong>${escapeHtml(v.boothName)}</strong> at ${escapeHtml(v.eventName)}! Your photos are ready.
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 8px 0;">
                    <div style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:#0f172a;letter-spacing:1px;">
                      ${escapeHtml(v.ticketCode)}
                    </div>
                  </td>
                </tr>
                ${galleryBlock}
                ${hashtagBlock}
                <tr>
                  <td style="padding:20px 0 8px 0;color:#0f172a;font-size:15px;">
                    — ${escapeHtml(v.fromName)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #e2e8f0;">
              <div style="color:#94a3b8;font-size:12px;line-height:1.6;">
                You're receiving this because you signed up at our photo booth at ${escapeHtml(v.eventName)}.
                <a href="${escapeHtml(v.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
