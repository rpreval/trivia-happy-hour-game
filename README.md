# Trivia Happy Hour — Split-Origin Production Deployment

Trivia Happy Hour uses a split architecture:
- **Frontend (`client/`):** React + Vite SPA hosted on **Netlify** (`/host`, `/display`, `/join`).
- **Backend (`server/`):** Stateful Express + WebSocket (`ws`) + PostgreSQL server hosted on **Render**, **Railway**, **Fly.io**, or **Google Cloud Run**.

---

## 1. Backend Deployment (Render / Railway / Cloud Run)

1. Provision a **PostgreSQL** database (`DATABASE_URL`).
2. Deploy the `server/` service with:
   - **Build Command:** `npm ci`
   - **Start Command:** `node server/index.js`
   - **Health Check Path:** `/healthz`
   - **Instance Count:** `1` (required so in-memory 105s round timers and WebSocket rooms remain synchronized).
3. Configure the backend environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://...`
   - `DATABASE_SSL=true`
   - `GEMINI_API_KEY=<your-gemini-api-key>`
   - `ALLOWED_ORIGINS=https://<your-site>.netlify.app`

---

## 2. Frontend Deployment (Netlify)

1. Connect your GitHub repository to Netlify.
2. Netlify automatically reads `client/netlify.toml`, or verify these build settings in the Netlify UI:
   - **Base directory:** `client`
   - **Build command:** `npm ci && npm run build`
   - **Publish directory:** `client/dist`
3. Add the following environment variables in **Netlify -> Site configuration -> Environment variables**:
   - `VITE_API_URL=https://<your-backend-domain>`
   - `VITE_WS_URL=wss://<your-backend-domain>/ws`
   - `VITE_PUBLIC_APP_URL=https://<your-site>.netlify.app`
4. Trigger a deploy and confirm the production build passes (`VITE_API_URL` and `VITE_WS_URL` are validated at build/boot time to enforce `https://` and `wss://`).

---

## 3. Verifying Real-Time Multiplayer Across 3 Devices & Networks

1. **Device 1 — Host Laptop (Home Wi‑Fi):**
   - Open `https://<your-site>.netlify.app/host`.
   - Enter host name, select 8 categories, create the room, and generate question sets.
2. **Device 2 — Big-Screen TV / Tablet (Different Wi‑Fi or Hotspot):**
   - Open `https://<your-site>.netlify.app/display` and enter the 5-character room code.
   - Confirm the QR code and invite URL resolve to `https://<your-site>.netlify.app/join?code=XXXXX`.
3. **Device 3 — Player Smartphone (5G/LTE Cellular Data, Wi‑Fi Off):**
   - Scan the QR code on the TV or open the invite link.
   - Register a team name, verify it appears immediately on `/display` and `/host`, refresh the mobile browser to verify `sessionToken` reconnection, and test answering + buzzing in against the synchronized 105-second server countdown.
