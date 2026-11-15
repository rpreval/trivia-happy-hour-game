# Trivia Happy Hour

A real-time multiplayer trivia game with a React client, Express/WebSocket server, PostgreSQL persistence, and Gemini-generated question sets.

## Configuration

Copy `.env.example` to `.env` and set `DATABASE_URL` and `GEMINI_API_KEY`. The database schema is applied automatically at server startup. For local development, start the API with `npm start` and build the client with `npm run build`.

## Docker

Build and run the container with your environment variables configured:

```sh
docker build -t trivia-happy-hour-game .
docker run --rm -p 8080:8080 -e DATABASE_URL="$DATABASE_URL" -e GEMINI_API_KEY="$GEMINI_API_KEY" trivia-happy-hour-game
```

## Deploy to Google Cloud Run

Enable the Cloud Run, Cloud Build, and Artifact Registry APIs; configure the Google Cloud project and create Secret Manager secrets named `TRIVIA_DB_URL` and `GEMINI_API_KEY`. Then deploy from the repository root:

```sh
gcloud run deploy trivia-happy-hour-game \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --session-affinity \
  --min-instances 1 \
  --concurrency 250 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=TRIVIA_DB_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

The runtime service account must have permission to access both secrets. Cloud Run's session affinity is best-effort; use a shared coordination mechanism if deploying multiple instances that need globally coordinated game timers.

## Routes

- `/host` — create and manage a room
- `/display?code=ROOMCODE` — public game display
- `/join?code=ROOMCODE` — team entry and answering
