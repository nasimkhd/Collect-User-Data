# Photo Booth — Data Collection & Photo Delivery Plan

**Event:** Sport Card Expo Toronto — International Centre, Mississauga
**Dates:** April 30 – May 1, 2026 *(2 days for this run)*
**Expected volume:** 200–300 guests per day, mix of individuals and groups
**Chosen capture method:** **Option A — Tablet kiosk** (iPads at the booth, no in-line QR)

---

## 0. Plan Update (current implementation)

The original plan below recommended **Jotform + Airtable + Make.com + Pixieset**. We've replaced that whole stack with a **single self-hosted Next.js app in this repo** (`Collect-User-Data/`). This gives us one code surface, a free-forever cost profile, and no monthly subscriptions to juggle for a 2-day event.

**What changed vs. the original plan:**

| Role | Original plan | Current implementation |
|---|---|---|
| Kiosk form | Jotform Kiosk on iPads | `/` route (Next.js) in full-screen Safari on iPads |
| Database | Airtable | Local SQLite (`data/boothform.db`), file-based |
| Ticket codes | Jotform auto-increment | `D{day}-{###}` generated in `src/lib/db.ts` |
| Confirmation screen | Jotform thank-you page | `/confirm/[ticket]` route, huge ticket number |
| Automation | Make.com scenario | `/api/send-photos` route + `npm run send-emails` CLI |
| Email delivery | SendGrid via Make | Any SMTP (Resend free tier recommended) via `nodemailer` |
| Photo storage | Pixieset galleries ($) | `PHOTOS_DIR` folder, attached directly (or set `PHOTO_DELIVERY_MODE=link` to use a free Dropbox / Google Drive share link) |
| Admin dashboard | Airtable UI | `/admin` route, password-protected, with per-ticket Send button |

**What's the same:** Ticket code + physical slate card → photographer workflow (sections 5, 6, 10), consent & CASL compliance (section 11), group handling with repeater emails (section 4).

**Event days:** Configured via `EVENT_TOTAL_DAYS` in `.env.local` (now `2`). Ticket codes are `D1-001…` on day 1 and `D2-001…` on day 2.

**Cost for a 2-day event:** essentially $0 — Resend free tier (3,000 emails/month) covers ~600 guests × 1 email. No Pixieset/Jotform/Make subscriptions needed.

When reading the rest of this doc, treat the Jotform/Airtable/Make references as historical context — the same ideas are implemented in the app; only the tooling changed.

---

## 1. Goals & Constraints

- **Capture** name + email (optional phone) from every guest or group, fast.
- **Associate** each capture with the exact photo(s) the photographer took.
- **Deliver** high-resolution photos by email, reliably, within minutes to hours.
- **Scale** to a line of 200–300 people without bottlenecking the photographer.
- **Handle groups**: one photo → multiple emails.
- **Professional brand**: clean landing page, branded email, no spammy feel.
- **Privacy/compliance**: Canada's CASL + PIPEDA — consent required, unsubscribe link, clear purpose statement.

---

## 2. Core Workflow (the golden path — Option A / kiosk)

```
[Guest enters queue]
        ↓
[PRE-FILL ZONE — 2–3 iPads on stands]
  Guest fills form: name, email(s), consent
        ↓
[Kiosk shows a ticket code, e.g. "047"]
        ↓
[Greeter writes "047" on a physical slate card, hands to guest]
        ↓
[Guest steps to SHOOT ZONE — photographer]
  Photographer: slate in first frame, shoot, collect slate back
        ↓
[Photos ingest to laptop / cloud, renamed by ticket code]
        ↓
[Editor (optional) culls/retouches]
        ↓
[Automated email sent with gallery link to all email(s) on that ticket]
```

**Key principle: pipeline, don't serialize.** While the photographer shoots guest 047, guest 048 should already be filling the form. This keeps the photographer at full throughput.

The **ticket code** is the glue that links the email address(es) to the right photo.

---

## 3. Data Collection — Tablet Kiosk Setup (chosen: Option A)

Place **2–3 iPads** on sturdy stands in a "pre-fill zone" just before the shoot position. Guests self-serve while a greeter assists. The form auto-resets after submit so the next guest can step up immediately.

### Tool recommendation: **Jotform Kiosk Mode**

Why Jotform wins for this flow:
- Purpose-built "Kiosk Mode" — no login between submissions, auto-clears, full-screen.
- **Offline mode** with auto-sync when Wi-Fi returns (essential — event Wi-Fi is unreliable).
- Native repeating-email widget for groups.
- Unique ID / auto-number field for ticket codes.
- Direct integrations to Airtable, Google Sheets, Dropbox, SendGrid, Make.com.
- Branded theming (fonts, colors, logo).

Alternatives if you can't use Jotform:
- **Tally** — free, clean, but no offline mode.
- **Typeform** — beautiful but slow (one question at a time).
- **Google Forms** — free, but no offline, no branding, no auto-reset.

### Required form fields (in order)

1. **Full name** (text, required)
2. **Primary email** (email, required, with format validation)
3. **+ Add another email** (repeater, up to 6 — for groups)
4. **Phone** (optional)
5. **How did you hear about the booth?** (optional dropdown — marketing data)
6. **Consent checkbox** (required, NOT pre-ticked):
   *"I agree to receive my photos and occasional updates by email. I can unsubscribe anytime."*
7. **Age confirmation** (required): *"I am 18+ or a parent/guardian of anyone under 18 in this photo."*
8. **Ticket code** (hidden field, auto-populated by Jotform's unique-ID or sequence — see section 5)

### Confirmation screen

After submit, show a **big, bold** screen:
```
┌─────────────────────────────┐
│   Your ticket number:       │
│                             │
│          047                │
│                             │
│   Show this to our greeter  │
└─────────────────────────────┘
```
The greeter writes `047` on a slate card and hands it to the guest for the shoot.

### Why not other capture options?
We evaluated a QR-code-in-line flow and a staff-entry-on-laptop flow. QR was rejected because it assumes every guest scans + some won't, leaving a messy fallback. Staff-entry is too slow for 300/day. The kiosk approach is the cleanest, most consistent UX and keeps all data in one database.

---

## 4. Handling Groups

**Chosen approach: Multiple emails per ticket (one form, up to 6 emails, one shared photo set).**

One group = one kiosk submission = one ticket code = one set of photos delivered to every email on that ticket. The group picks one person to fill the form; that person types in everyone's email via the repeater field. No per-person forms, no "forward it to your friends" gamble.

### How it works in practice
1. Group walks up to an open iPad together.
2. One person (the "group lead") fills in their name + primary email.
3. They tap **+ Add another email** once per extra group member (max 6 total).
4. Consent + age checkboxes are ticked **once on behalf of the group** — the lead confirms everyone is 18+ or accompanied by a guardian.
5. Kiosk issues a single ticket code (e.g., `D1-047`) — the whole group uses this one slate for their photo.
6. After the shoot, the automation sends the **same gallery link** to all 2–6 emails on that ticket.

### Why this over the alternatives
- **One email per group (lead forwards)** — rejected. Too easy for the photo to never reach the others; also undermines your consent/opt-in data for the other guests.
- **One form per person, same ticket** — rejected. Doubles or triples kiosk time for a group of 4, which tanks the 50/hr throughput target. Only worthwhile if every guest had their own QR, which we're not using.

### Data model
| ticket_code | photo_file(s) | email_1 | email_2 | … | email_6 | consent | timestamp |
|---|---|---|---|---|---|---|---|

Airtable stores emails as a multi-value field (or one row per email with a shared `ticket_code` — either works; pick whichever your automation tool handles more cleanly). The Make.com scenario loops over the emails and fires one send per address so each guest gets their own deliverable, unsubscribable email.

### Edge cases
- **Group bigger than 6** — cap at 6 on the form; greeter tells the overflow guest(s) to share the gallery link (it's the same photo anyway). Don't raise the cap — longer forms slow the line.
- **Typo'd email in a group** — the confirmation screen echoes all entered emails back before final submit so the lead can spot mistakes.
- **Someone in the group wants to opt out of email** — they simply don't give their address; the form only requires the primary. No one is forced onto the list.

---

## 5. The Ticket Code System (chosen approach)

The kiosk generates the code; the greeter transfers it to a physical slate; the photographer puts it in the first frame.

### Chosen: Sequential numbers + physical slate card

- Jotform auto-increments a sequence: `001`, `002`, `003` … `400`.
  (In Jotform: use an **Auto-Increment** / **Unique ID** field starting at 001. Reset daily if you want per-day ranges like D1-047.)
- The confirmation screen shows the number in huge type.
- **Greeter writes it on a slate card** (pre-printed flip cards 001–400, or a small dry-erase board).
- **Photographer includes the slate in the first frame of every session**, then shoots the portraits. The slate frame is used for matching and discarded in editing.

### Why this over alternatives?

- **QR-on-card + scan app**: more moving parts, needs an extra device, fails silently. Avoid.
- **Tethered capture with live typing**: great for studios, overkill for a fast booth line.
- **Date-prefixed codes** (`D1-047`, `D2-047`): use these if you run the same sequence across all four days, to prevent collisions. **Recommended for a 4-day event.**

**Final format: `D{day}-{###}`**, e.g. `D1-047`, `D3-112`. Easy to parse, collision-proof, readable on a slate.

---

## 6. Photo Ingest & Matching Workflow

### Gear
- DSLR/mirrorless → SD card or tethered to a laptop.
- Laptop with folder sync to cloud (Dropbox, Google Drive, Lightroom Cloud, or **ShootProof** / **Pic-Time** / **Pixieset** event galleries).

### Matching process (after each batch)
1. Dump cards / ingest tethered shots into a dated folder.
2. Rename files with ticket code prefix: `A047_IMG_1234.jpg`.
   - Tools: **Adobe Bridge**, **Photo Mechanic**, or Lightroom's batch rename.
3. Spreadsheet / Airtable maps `ticket_code → [filenames]`.
4. A script or Zapier/Make scenario uploads photos to a gallery, pulls the URL, and sends the email.

---

## 7. Photo Delivery Options (You → Guest)

### Option 1 — Gallery link per guest (recommended for pro events)
Services: **Pixieset**, **Pic-Time**, **ShootProof**, **SmugMug**, **Cloudspot**.

- Create one private gallery per ticket code.
- Email the guest a link + password (or token URL).
- Guests can download HD, share on socials (good for your event marketing).
- Includes branding, your logo, and sponsor logos (eBay, Upper Deck, etc. — fits the Expo aesthetic).

**Pros:** Professional, scales easily, no email attachment size limits, analytics (did they open/download?).
**Cons:** ~$15–$40/month subscription.

---

### Option 2 — Direct email with attached photos
Use a transactional email service — **not** Gmail (rate limits + deliverability).

**Transactional email providers:**
- **SendGrid** (free 100/day, then paid) — easy API.
- **Postmark** — best deliverability, $15/mo.
- **Mailgun** — developer-friendly.
- **Resend** — modern, developer-focused, generous free tier.
- **Amazon SES** — cheapest at scale ($0.10 per 1,000).

**Pros:** Guest gets photos directly, no click-through needed.
**Cons:** Attachment size limits (~10–25 MB), no analytics, can land in spam if not warmed up.

**Best practice:** Send a **link to the gallery** + a **small preview image attached** in the email. Best of both.

---

### Option 3 — Automation tools (no-code)
- **Zapier / Make (Integromat)** — watch a Google Sheet / Airtable, trigger a SendGrid/Gmail/Mailchimp email with merge fields.
- **Airtable Automations** — native, powerful, works great with a "Send photos" button per row.
- **n8n** (self-hosted, free) — more technical but unlimited runs.

**Recommended no-code stack:**
```
Jotform (capture)  →  Airtable (database)  →  Dropbox/Pixieset (photos)
                              ↓
                   Make.com scenario
                              ↓
                  SendGrid/Postmark email
```

---

### Option 4 — Custom script (if you're technical)
A small Node.js or Python script that:
1. Reads the CSV/Airtable.
2. For each row, finds matching photo files by ticket code.
3. Uploads them to a cloud bucket (S3/R2) or Dropbox, gets a share link.
4. Sends a branded HTML email via SendGrid/Resend API.

Runs in a batch at end of day or every 15 min. ~100 lines of code.

---

## 8. Recommended End-to-End Stack (for this event)

| Stage | Tool | Why |
|---|---|---|
| Data capture | **Jotform Kiosk** on 2–3 iPads | Fast, offline, multi-email, branded, auto-reset |
| Database | **Airtable** | Links tickets to photos, visual, scripts |
| Photo storage & gallery | **Pixieset** (or Dropbox + a simple landing page) | Pro-grade galleries, per-guest access |
| Automation | **Make.com** | Matches ticket → gallery → email |
| Email delivery | **SendGrid** or **Postmark** | Deliverability, branded templates |
| Backup | Jotform offline cache + Google Sheet export + SD card copies | Never lose data |

Cost estimate: **~$50–$100 for the 4-day event** on monthly trials (Jotform Bronze ~$34/mo, Pixieset Basic ~$12/mo, Make free tier, SendGrid free tier).

---

## 9. Email Template (copy-ready)

> **Subject:** Your photos from the Sport Card Expo Toronto are ready!
>
> Hi {{first_name}},
>
> Thanks for stopping by our booth at the Sport Card Expo Toronto! Your photos are ready to view and download here:
>
> **[View your gallery →]({{gallery_link}})**
> *(This link is private to you. Access code: {{code}})*
>
> Feel free to share them on social — tag **@sportcardexpo** and **#SCMEToronto**.
>
> See you at the next show!
>
> — The {{your_brand}} Team
> *You're receiving this because you gave us your email at our photo booth. [Unsubscribe]({{unsubscribe}}).*

---

## 10. Onsite Operations Checklist

**Gear**
- [ ] **3× iPad** (2 active + 1 hot spare), charged to 100% each morning
- [ ] 3× sturdy weighted tablet stands (e.g., Compulocks, Heckler)
- [ ] 3× Lightning/USB-C cables + power bricks at each station
- [ ] Portable Wi-Fi hotspot + backup hotspot (event Wi-Fi is unreliable)
- [ ] Camera, 2× batteries, 4× SD cards, tether cable
- [ ] Laptop with Lightroom / Photo Mechanic
- [ ] **Ticket slate cards** — pre-printed flip numbers `D1-001` to `D1-300` for each day (or a dry-erase slate)
- [ ] Signage: "Step 1: Fill your info → Step 2: Photo"
- [ ] Surge protector, extension cords, gaffer tape
- [ ] Physical signup clipboard + pens (offline emergency backup only)

**Staff roles (minimum 2, ideal 3)**
1. **Greeter / kiosk attendant** — guides guests to an open iPad, helps with the form, reads the ticket number off the screen, writes it on the slate card, hands it to the guest.
2. **Photographer** — shoots, includes slate card in first frame, shoots portraits, collects slate back.
3. **Ingest / ops** *(can be same person as greeter between waves)* — at end of each 1-hour block: dumps SD card, batch-renames photos by ticket code, triggers automation.

**Timing per guest (Option A reality check)**
- Form fill at kiosk: **30–45 s**
- Photo shoot: **30–60 s**
- **If serialized** (bad): 60–105 s per guest → ~35–45/hr
- **If pipelined** (good — 2+ tablets, next guest fills while current shoots): ~45 s bottleneck → **~50–70/hr per photographer**

Target: 300 guests / 6 open hours = **50/hr**. This is achievable with **2 tablets + 1 photographer**, but add a second photographer for peak hours (Saturday afternoon) to build a safety margin.

---

## 11. Privacy & Compliance (Canada)

You're in Ontario — CASL + PIPEDA apply.

- **Explicit consent** on the form: checkbox, not pre-ticked.
- **Purpose statement**: "We'll email your photos and occasional event news. Unsubscribe anytime."
- **Unsubscribe link** in every email (SendGrid/Postmark handle this).
- **Data retention**: Delete emails/photos after X months if not needed (state it in the form).
- **Minors**: If a guest is under 18, parental consent needed — add a "I am 18+ or a parent/guardian" checkbox.

---

## 12. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Wi-Fi drops | Jotform offline mode caches submissions locally + mobile hotspot |
| iPad dies / freezes | 3rd iPad as hot spare, all pre-configured identically |
| Tablet stand tips over | Weighted / clamped stands, not free-standing easels |
| Line bottlenecks at form | 2–3 tablets + pipelining; greeter actively triages |
| Ticket mix-up | Slate card in first frame of every shoot, no exceptions |
| Duplicate ticket numbers | Day-prefix format (`D1-047`, `D2-047`) avoids collisions across 4 days |
| Emails bounce | Email format validation on form; real-time typo suggestion if Jotform supports it |
| Photos not delivered | Send same-day confirmation email: "Photos processing, arriving within 24h" |
| Lost SD card | Tether to laptop + cloud auto-upload (Lightroom Cloud / Dropbox) |
| Guest gives wrong email | Confirmation screen repeats entered email(s) back before final submit |
| Kiosk abuse (fake submissions) | Greeter observes each submission; minimal friction so no incentive to spam |
| Minor in photo | Required checkbox: "I am 18+ or parent/guardian of minors shown" |

---

## 13. Phased Rollout Plan

**Week -2 (now):** Choose stack, set up Jotform + Airtable + Pixieset + SendGrid accounts. Build the Jotform kiosk form end-to-end.
**Week -1:** Full dress rehearsal with 10–20 fake guests timed end-to-end. Print ticket slate cards `D1-001`–`D1-300` (× 4 days) or buy a dry-erase slate. Pre-configure all 3 iPads identically with Jotform Kiosk app in guided-access / single-app mode.
**Day before:** Charge everything to 100%, confirm offline mode works, sync Airtable, pre-create daily folders, test hotspot.
**Event days:** Run the booth. 10-minute ingest/automation check at end of each day to trigger overnight email send.
**Week +1:** Follow-up email offering prints / next event promo (optional, with explicit consent only).

---

## 14. Quick Decision Summary

| Question | Chosen Answer |
|---|---|
| How do guests enter data? | **Jotform Kiosk on 2–3 iPads (Option A)** — pre-fill zone before shoot |
| How to match photo to person? | **Day-prefixed sequential ticket (`D1-047`) + physical slate card in first frame** |
| Where to store photos? | **Pixieset gallery per ticket code** |
| How to send email? | **SendGrid via Make.com automation → gallery link** |
| Groups? | **Jotform repeater field — up to 6 emails per ticket** |
| Backup plan? | **Jotform offline mode + paper clipboard + duplicate SD cards** |
| Minimum staff? | **2 (greeter + photographer)**, ideal 3 with an ingest/ops person |
| How to hit 50 guests/hr? | **Pipeline: next guest fills form while current guest is shot** |
