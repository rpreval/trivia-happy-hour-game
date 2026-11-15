# Trivia Happy Hour — Split-Origin Production Deployment

Trivia Happy Hour uses a split architecture:
- **Frontend (`client/`):** React + Vite SPA hosted on Netlify (`/host`, `/display`, `/join`).
- **Backend (`server/`):** Express + WebSocket (`ws`) + PostgreSQL hosted on Render, Railway, Fly.io, or Google Cloud Run.

## Backend deployment

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Deploy the repository's Node service with build command `npm install`, start command `node server/index.js`, and health check `/healthz`.
3. Run a single backend instance so in-memory round timers and WebSocket rooms stay synchronized.
4. Configure `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `GEMINI_API_KEY`, and `ALLOWED_ORIGINS=https://<your-site>.netlify.app` on the backend host. Keep secrets in the host's environment settings, not in frontend variables.

## Netlify frontend deployment

1. Connect the GitHub repository. `client/netlify.toml` sets the client base and `dist` publish directory.
2. Set these Netlify environment variables before building:
   - `VITE_API_URL=https://<your-backend-domain>`
   - `VITE_WS_URL=wss://<your-backend-domain>/ws`
   - `VITE_PUBLIC_APP_URL=https://<your-site>.netlify.app`
3. Deploy. The production client requires HTTPS and WSS backend URLs.

## Multiplayer smoke test

1. Open `/host`, create a room, and generate questions.
2. Open `/display?code=<ROOMCODE>` on a separate screen.
3. Join from a phone using the QR/invite link; confirm the team appears in the host and display views.
4. Submit answers and verify reveal, scoring, reconnect behavior, and final winner celebration.

## Local development

Install root/server and client dependencies, set backend credentials in a local environment file, and run the Vite client with `npm --prefix client run dev`. Configure `VITE_API_URL` and `VITE_WS_URL` to point to the local backend. Do not commit `.env` files containing secrets.
