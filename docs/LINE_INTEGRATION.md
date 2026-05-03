# LINE Demo Integration — Operator Guide

This guide explains how to deploy the m'AI Touch LINE demo to Render and connect it to a LINE Official Account.

## Architecture

The LINE integration runs as an Express middleware mounted at `/line/webhook`. Incoming webhook events are HMAC-verified against `LINE_CHANNEL_SECRET`, then dispatched to role-specific handlers (resident, housekeeper, admin). In the `demo` deploy profile, intent classification is handled by OpenAI-compatible models (Gemini 2.5 Flash via `OPENAI_BASE_URL`) rather than the local NLP service; session state is kept in-memory (per process) with a 30-minute TTL; real bookings are written to the SQLite database on the persistent Render disk; and accepted bookings trigger LINE push notifications to housekeeper accounts. See `docs/superpowers/specs/2026-05-01-line-online-demo-design.md` for the full design.

**Companion web dashboard**: a separate Vercel-hosted Expo Router web app (`https://mai-touch-web.vercel.app`) lets admin/logistics/resident roles use the same backend through a browser. It uses Bearer-token auth (URL `?token=...` → localStorage), which is independent from this LINE bot. See README's "Vercel Web Dashboard" section.

**AI key fallback**: `OPENAI_API_KEY` accepts a comma-separated list of keys; `OpenAIIntent` rotates through them on 429/quota errors so a Gemini Free Tier RPM hit on one key auto-falls-through to the next. Production demo currently runs 4 keys for headroom.

## One-Time Setup

### 1. LINE Developer Console (https://developers.line.biz/console)

1. Open your existing company Provider (or create one)
2. Add a Messaging API channel named "m'AI Touch demo" (or similar)
3. **Channel basic settings** → copy the `Channel secret` → save for Render env `LINE_CHANNEL_SECRET`
4. **Messaging API tab** → Issue a `Channel access token (long-lived)` → save for Render env `LINE_CHANNEL_ACCESS_TOKEN`
5. **Messaging API tab** → set Webhook URL to `https://mai-touch-demo.onrender.com/line/webhook`
6. **Messaging API tab** → enable "Use webhook"
7. **Messaging API tab** → DISABLE "Auto-reply messages" (we send our own)
8. **Messaging API tab** → DISABLE "Greeting messages" (we send our own welcome)
9. Note the **add-friend QR code** — give to demo audience

### 2. OpenAI

1. Create or reuse an OpenAI API key with access to `gpt-4o-mini`
2. (Recommended) Set a monthly spend cap of $10 in OpenAI billing settings as a safety net
3. Save key for Render env `OPENAI_API_KEY`

### 3. Render (https://render.com)

1. New → Blueprint → connect this repo
2. Render auto-detects `render.yaml` and creates a `mai-touch-demo` service
3. Set the secret env vars manually in the dashboard:
   - `LINE_CHANNEL_SECRET` (from step 1.3 above)
   - `LINE_CHANNEL_ACCESS_TOKEN` (from step 1.4 above)
   - `OPENAI_API_KEY` (from step 2.3 above)
   - `DEMO_ADMIN_LINE_USERS` — leave empty for now; you'll fill it after step 5
4. Trigger first deploy → wait for green
5. `curl https://mai-touch-demo.onrender.com/health` should return `{"ok":true,"profile":"demo",...}`

### 4. Discover your LINE userId (one-time admin bootstrap)

1. Add the bot as friend on your phone via the QR code from step 1.9
2. Send `/whoami` to the bot
3. Bot replies with your userId prefix (first 8 chars) and current role/lang
4. To get the FULL userId: check Render logs for `[LINE] inbound from U...` entries; copy the full `U` + 32 hex
5. Paste that full userId into Render env `DEMO_ADMIN_LINE_USERS` (comma-separated for multiple admins)
6. Trigger Render redeploy
7. Send `/role admin` to the bot — should reply `role => admin`
8. (Optional) Send `/demo reset` to verify admin path works

### 5. Cron-job.org keepalive (prevents Render Free plan idle)

1. Register at https://cron-job.org with email `ydw331@gmail.com`
2. Create cronjob:
   - Title: `mai-touch-demo healthcheck`
   - URL: `https://mai-touch-demo.onrender.com/health`
   - Schedule: every 14 minutes
   - Notification: email on failure
3. Save and verify a few successful pings appear in the dashboard within 30 minutes

## Demo Presentation Playbook

(Suggested 3-minute flow for showing the bot to investors/clients.)

### Quick demo (60 seconds, scripted)

1. Open the bot in LINE on your phone (audience can crowd around or screen-share)
2. Send `/demo facility` — bot plays a 30-second walkthrough showing carousel → time picker → confirmation → real DB write → simulated housekeeper notification
3. Send `/demo list` to see other available scripts (`facility`, `repair`, `visitor`, `complaint`)

### Free-form demo (2 minutes, real AI)

1. Set role to resident: `/role resident`
2. Type naturally: "我想預約週六晚上 7 點的健身房"
3. Bot's AI parses intent + slots, asks for any missing info, shows confirmation card
4. Tap confirm — real booking written to DB, housekeeper receives push (if you've also set up a housekeeper account, see below)

### Two-account demo (housekeeper visibility)

If you want to show the housekeeper side live:
1. Set up a SECOND LINE account on a tablet or another phone, add the same bot as friend
2. From the second account, send `/role housekeeper`
3. From the first account, run a booking demo
4. The second account receives a push with accept/reject/reassign buttons
5. Tap accept on the second account — booking status updates in DB

## Reset Between Presentations

If the demo gets cluttered with test bookings:
1. From the admin account, send `/demo reset` — wipes the demo DB and re-seeds (NOT YET IMPLEMENTED — Phase 9 will add this; for now, redeploy on Render to reset disk state)
2. Or manually: `Render dashboard → Disks tab → mai-touch-demo / demo-data → wipe`

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| LINE webhook verify fails (red X in console) | Signature mismatch | Check `LINE_CHANNEL_SECRET` in Render matches Channel secret in LINE console exactly |
| Bot doesn't reply to messages | Webhook not enabled, or Render is cold | Check LINE console "Use webhook" is on; check Render logs for cold-start; verify cron-job.org is pinging |
| Bot replies in wrong language | Auto-detect failed | Send `/lang en` (or `zh` / `ja`) to force |
| `/role admin` says forbidden | Your LINE userId not in whitelist | Add to `DEMO_ADMIN_LINE_USERS` and redeploy |
| `[DEMO]` prefix missing | `DEMO_BANNER=false` set or not on demo profile | Check `DEPLOY_PROFILE=demo` and `DEMO_BANNER!='false'` in Render env |
| Demo runs are stale (old date in confirmation card) | Hardcoded date in script | Edit `src/server/line/demo-scripts/facility.ts` → redeploy |
| Push to housekeeper fails | Housekeeper account hasn't friended the bot, or `LINE_CHANNEL_ACCESS_TOKEN` invalid | Have housekeeper send any message to bot first; verify token in Render env |
| Render Free plan idles despite cron | cron firing < 14 min isn't enough due to Render's 15-min idle window | Reduce cron to every 12 min OR upgrade to Starter plan ($7/mo) |

## Cost Estimate

- Render Free plan: $0
- cron-job.org Free tier: $0
- OpenAI gpt-4o-mini: ~$0.30/month at 3000 LINE interactions/month (~$0.0001 each)
- LINE Messaging API: free for ≤500 push messages/month (Developer plan)
- **Total: < $1 / month** for a moderately-active demo

## Future Upgrades

- **Starter plan ($7/mo)**: no cold start, faster first-message latency
- **Real bookings** (Phase 5 — already done): demo writes to actual `bookings` table
- **Admin dashboard** (Phase 9): runtime config edit, log viewer, manual push, demo script editor — all without redeploy

## Reference

- Spec: `docs/superpowers/specs/2026-05-01-line-online-demo-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-01-line-online-demo-plan*.md`
- Phase commits: `git log --oneline | grep -E 'feat\(line|chore\(line'`
