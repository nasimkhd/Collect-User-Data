# Running the booth on event day

You have **two ways** to get the form onto the tablets. Pick whichever works
at the venue. Setup **A** is simpler; setup **B** is the backup that works
even if the venue Wi-Fi blocks devices from seeing each other.

In both setups, your laptop is the brain: the database, photos, admin
dashboard, and the email sender all live on your laptop. The tablets are
just a screen + keyboard for visitors.

---

## Setup A — Local Wi-Fi (try this first)

**Requires:** laptop and tablets on the same Wi-Fi network. Works offline
(no internet needed).

### On your laptop

1. Make sure the app is built:
   ```bash
   npm run build
   ```
2. Find your laptop's address on the Wi-Fi:
   ```bash
   ipconfig getifaddr en0
   ```
   If that prints nothing, try `en1`. You'll get something like
   `192.168.1.42`. Remember it — call this `LAPTOP-IP`.
3. Start the app:
   ```bash
   npm run start
   ```
   You should see `Network: http://0.0.0.0:3000`.

### On each tablet

Open the browser and go to:

```
http://LAPTOP-IP:3000
```

Example: `http://192.168.1.42:3000`

- Use **http**, not **https**.
- The form should load. Fill one out as a test; it should show up on your
  laptop at `http://localhost:3000/admin`.

### Troubleshooting

- **Page never loads on the tablet** → the venue Wi-Fi is probably
  blocking device-to-device traffic ("client isolation" / "AP isolation").
  Use Setup B instead.
- **Your laptop IP changes day-to-day** → re-run `ipconfig getifaddr en0`
  each morning and update the tablets. Or reserve a static IP on your
  home router.

---

## Setup B — Cloudflare Tunnel (public URL, works anywhere)

**Requires:** your laptop has internet (Wi-Fi or hotspot). The tablets can
be on cellular, guest Wi-Fi, anything at all — they just need to reach
a public URL.

### One-time install (do this at home before the event)

1. Install Cloudflare's tunnel tool:
   ```bash
   brew install cloudflared
   ```
2. Verify:
   ```bash
   cloudflared --version
   ```

### On your laptop, on event morning

Open **two terminal tabs** (or two terminal windows).

**Tab 1 — start the app:**
```bash
npm run build
npm run start
```
Leave it running.

**Tab 2 — start the tunnel:**
```bash
npm run tunnel
```

After ~5 seconds it will print a big box with a URL like:

```
https://furry-panda-1234.trycloudflare.com
```

Copy that URL. That is the public address of your form for today.

### On each tablet

Open the browser and go to the URL from Tab 2. Bookmark it or set it as
the home page. You can also generate a QR code for it and stick it on the
booth so visitors can scan it with their own phones.

### How to know the safety net is working

Try this from a tablet (or any phone on cellular):

```
https://furry-panda-1234.trycloudflare.com/admin
```

You should see **"Not found"**. That's correct — the admin page refuses
anything that comes through the tunnel. You, on your laptop, open admin
the same way you always have:

```
http://localhost:3000/admin
```

### End of day

Go to Tab 2 and press `Ctrl + C`. The tunnel shuts down and the public URL
dies instantly. Your laptop is invisible to the internet again.

### Important notes about this tunnel

- The URL **changes every time you restart the tunnel** (free quick-tunnel
  behaviour). If you start the tunnel on Day 2, expect a new URL, and
  update the tablets that morning.
- Keep your laptop **plugged in** and **prevent sleep** (System Settings →
  Battery → Power Adapter → "Prevent automatic sleeping"). If the laptop
  sleeps, the tunnel dies and so does the form.
- If venue internet is unreliable, plug your iPhone in and turn on
  Personal Hotspot as a backup — your laptop will use it automatically.

---

## What stays on your laptop (both setups)

- The SQLite database (`data/boothform.db`) — every submission.
- The photos folder (`PHOTOS_DIR` in your `.env.local`).
- The admin dashboard (`/admin`).
- The email sender (`npm run send-emails`).

None of this leaves your laptop. The tunnel is only forwarding traffic for
the public form routes.

## Sending the emails

Same as always — on your laptop, once the booth closes:

```bash
npm run send-emails
```

This reads the local SQLite, reads photos from `PHOTOS_DIR`, and uses the
SMTP credentials in `.env.local`. It has nothing to do with the tunnel.

---

## Kiosk port variant

If you use `npm run kiosk` instead (port 3001), use
`npm run tunnel:kiosk` instead of `npm run tunnel`.
