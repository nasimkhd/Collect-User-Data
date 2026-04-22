# BoothForm — Self-hosted Photo Booth Data Capture

A purpose-built, self-hosted alternative to Jotform for running a photo booth at a live event. Built for the **Sport Card Expo Toronto (April 30 – May 3, 2026)** but usable for any event.

- **No monthly fees, no submission limits, no vendor branding**
- Runs on a booth laptop; iPads connect over local Wi-Fi — **zero internet dependency**
- **Auto-generated ticket codes** like `D1-047` link each guest to the photographer's shot
- **Group support** — one submission can capture up to 6 email addresses
- **Admin dashboard** with live stats, search, and CSV export
- **Dark, touch-friendly UI** optimized for iPad

See [`PHOTO_BOOTH_PLAN.md`](./PHOTO_BOOTH_PLAN.md) for the full event plan.

---

## Quick start

### 1. Install

Requires Node.js 20+ and a C toolchain for `better-sqlite3`.

```bash
npm install
```

If `better-sqlite3` fails to install on macOS, run:

```bash
xcode-select --install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
EVENT_NAME="Sport Card Expo Toronto"
BOOTH_NAME="Photo Booth"
EVENT_START_DATE="2026-04-30"
EVENT_TOTAL_DAYS=4
ADMIN_PASSWORD="pick-a-strong-password"
SESSION_SECRET="any-long-random-string-at-least-32-chars"
```

### 3. Run in development

```bash
npm run dev
```

Open http://localhost:3000 on the laptop to see the kiosk form.
Open http://localhost:3000/admin for the admin dashboard (password = `ADMIN_PASSWORD`).

### 4. Run in production (event day)

```bash
npm run build
npm run kiosk
```

This starts the server on `0.0.0.0:3000` so it's reachable from other devices on the same Wi-Fi network.

---

## Event-day setup

### Getting the iPads connected

1. **Connect the laptop and all iPads to the same Wi-Fi network.**
   Either:
   - Connect all devices to the venue's Wi-Fi, or
   - Create a Wi-Fi hotspot on the laptop and have iPads join it *(recommended — no internet dependency)*.

2. **Find the laptop's local IP address:**

   ```bash
   # macOS:
   ipconfig getifaddr en0

   # Or:
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

   Say it's `192.168.1.42`.

3. **On each iPad:**
   - Open Safari
   - Navigate to `http://192.168.1.42:3000`
   - Tap the **Share** icon → **Add to Home Screen** → "Photo Booth"
   - Tap the new home-screen icon → it opens full-screen
   - Enable **Guided Access** (Settings → Accessibility → Guided Access) so guests can't navigate away

4. **Kiosk app tips for iPad:**
   - Put the iPad on a weighted stand
   - Plug into power (the kiosk stays on all day)
   - Turn on **Auto-Lock: Never** (Settings → Display & Brightness)
   - Disable notifications during the event (Focus mode)

### Daily workflow

| When | Action |
|---|---|
| Morning | Power up laptop + iPads, verify form loads on each iPad, pre-print slate cards for today's day prefix (e.g. `D1-001`..`D1-300`) |
| During event | Guests fill form → greeter reads ticket number → writes on slate → photographer shoots |
| Every hour | (Optional) Open `/admin` on laptop to check submission count |
| End of day | Export CSV from `/admin`, back up `data/boothform.db` to a USB stick + cloud |
| End of event | Export final CSV, import to Airtable/SendGrid for photo delivery |

### Backing up the database

All data lives in `data/boothform.db`. Copy this file at end of each day:

```bash
cp data/boothform.db data/backup-day1-$(date +%Y%m%d).db
```

---

## CSV export format

The exported CSV is ready to import into Airtable, Make.com, SendGrid, or a custom email script. Columns:

```
ticket_code, event_day, day_sequence, full_name, primary_email,
extra_email_1, extra_email_2, extra_email_3, extra_email_4, extra_email_5,
all_emails, group_size, submitted_at
```

The `all_emails` column semicolon-joins every email on a ticket (handy for sending one email to the whole group via BCC).

---

## How to send the photos

BoothForm includes a built-in **email-sending pipeline** as a CLI script. It reads submissions directly from the SQLite database, finds photos by ticket-code prefix, and sends them via any SMTP provider (Resend, SendGrid, Postmark, Gmail, etc.).

### 1. Configure SMTP

Add to `.env.local`:

```env
# Resend (recommended — free 3,000/mo, best DX):
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_YOUR_API_KEY
SMTP_FROM="Photo Booth <booth@yourdomain.com>"

# Where the photographer drops renamed JPG/PNG files:
PHOTOS_DIR=./photos

# "attach" sends photos as attachments. "link" sends a gallery link instead.
PHOTO_DELIVERY_MODE=attach

# For link mode:
# PHOTO_LINK_TEMPLATE=https://gallery.example.com/{ticket_code}

UNSUBSCRIBE_URL=mailto:unsubscribe@yourdomain.com
```

Any SMTP provider works — see `.env.example` for examples.

### 2. Rename photos by ticket code

After the shoot, the photographer renames files to start with the ticket code:

```
photos/
  D1-047_IMG_1234.jpg
  D1-047_IMG_1235.jpg
  D1-048_IMG_1236.jpg
```

Files are matched if they start with `<ticket>_`, `<ticket>-`, or equal `<ticket>.jpg/png/webp`. One ticket can have any number of photos.

Use Adobe Bridge, Lightroom batch rename, or the macOS Finder batch-rename for this.

### 3. Dry-run first

```bash
npm run send-emails -- --dry-run
```

This prints who would be emailed and which photos match, without actually sending anything.

### 4. Send for real

```bash
npm run send-emails                  # send everyone who hasn't been sent yet
npm run send-emails -- --day=1       # only day 1
npm run send-emails -- --ticket=D1-047   # single ticket
npm run send-emails -- --force       # re-send even if already sent
npm run send-emails -- --help        # all options
```

**It's idempotent** — already-sent tickets are skipped on subsequent runs. You can run it hourly during the event, or once end-of-day. Failures don't mark a ticket as sent, so they auto-retry on the next run.

### 5. Monitor from the admin dashboard

`/admin` shows a colored status badge per ticket:
- **Sent** (green) — email delivered successfully
- **Pending** (grey) — not yet sent, or no photos found yet
- **Failed** (red) — hover for error details

The "Emails sent" stat card at the top shows your progress.

See `PHOTO_BOOTH_PLAN.md` §7 for the full photo-delivery plan and `.env.example` for all email config options.

---

## Project structure

```
src/
  app/
    page.tsx                    # Kiosk form (entry point)
    KioskForm.tsx               # Client component — form logic
    confirm/[ticket]/
      page.tsx                  # Ticket number display
      ConfirmClient.tsx         # Auto-reset timer
    admin/
      page.tsx                  # Admin dashboard (auth-gated)
      AdminClient.tsx           # Stats, filters, table
      login/page.tsx            # Password form
    api/
      submit/route.ts           # POST new submission
      login/route.ts            # Admin login/logout
      export/route.ts           # CSV download
    layout.tsx                  # Root layout + meta
    globals.css                 # Tailwind + component styles
  lib/
    db.ts                       # SQLite + ticket generation
    auth.ts                     # HMAC-signed cookie auth
    config.ts                   # Event config + auto day detection
data/
  boothform.db                  # SQLite database (gitignored)
```

---

## Troubleshooting

**"better-sqlite3" build fails on install**
Install Xcode Command Line Tools: `xcode-select --install`, then `npm install` again.

**iPads can't reach the laptop**
- Verify both devices are on the same Wi-Fi.
- Verify the laptop's firewall allows port 3000: **System Settings → Network → Firewall → Options → Allow Node.js**.
- Try `http://<laptop-ip>:3000` (not `https`).

**Ticket numbers are wrong (showing Day 1 on Day 2)**
Either set `EVENT_DAY_OVERRIDE=2` in `.env.local` and restart, or verify `EVENT_START_DATE` and the laptop's system clock.

**Forgot the admin password**
Edit `ADMIN_PASSWORD` in `.env.local` and restart the server.

**Need to reset the database**
Stop the server, delete `data/boothform.db`, restart. (Back it up first!)

---

## Security notes

- This app is designed for use on a **trusted local network at a live event**, not on the public internet.
- Admin auth is a simple signed cookie — fine for the booth laptop, not hardened for public deployment.
- No PII is sent to any third party by this app. Data stays in the SQLite file on your laptop.
- Always back up `data/boothform.db` at end of each day.

---

## License

MIT — use it however you like for your event.
