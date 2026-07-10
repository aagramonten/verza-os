# Verza OS — Vera Chat MVP

Monorepo for the Verza Garden AI intake chat (Vera) and, later, the Verza OS platform.

Approved design docs (read before contributing):

- [../docs/verza-os-architecture.md](../docs/verza-os-architecture.md)
- [../docs/vera-chat-mvp-plan.md](../docs/vera-chat-mvp-plan.md)
- [../docs/vera-conversation-strategy.md](../docs/vera-conversation-strategy.md)

## Layout

```
apps/api        Express + TypeScript + Prisma (MySQL) — clean architecture modules
apps/web        Angular 17 (standalone components, signals) — /cotizar chat UI
packages/shared Domain vocabulary: enums, scoring config, disclaimer
```

## Run locally

```bash
npm install                  # once
docker compose up -d mysql   # database
cp .env.example .env         # then adjust if needed
cp .env.example apps/api/.env
npm run db:migrate           # prisma migrate dev
npm run db:seed              # company, owner, scoring config, pricing rules
npm run dev                  # API on http://localhost:3333  → GET /health
npm run dev:web              # Angular on http://localhost:4200
npm test                     # vitest (requires MySQL up)
```

## Try the chat (Day 2)

With both servers running, open **http://localhost:4200/cotizar**: type a
message, Vera (deterministic placeholder — AI arrives Day 3) answers, and the
conversation survives a browser refresh.

- The API issues an opaque **resume token** at session creation; the web app
  stores `{ sessionId, resumeToken }` in `localStorage` under
  `vg_chat_session` and calls `POST /sessions/:id/resume` on page load.
- Only the SHA-256 of the token is stored server-side; tokens expire after
  `RESUME_TOKEN_TTL_DAYS` (30) and can be revoked.
- Public endpoints are rate limited per IP (`RATE_LIMIT_PUBLIC_RPM`) —
  in-memory, single-instance only for the MVP.
- Full endpoint reference + curl examples:
  [apps/api/src/modules/chat/README.md](apps/api/src/modules/chat/README.md).

## Status

Day 2 complete: public chat sessions (create/message/get/resume/status),
enforced state machine, hashed resume tokens with expiry+revocation, in-memory
rate limiting, audit events, and the /cotizar developer chat UI. Day 3 (AI
provider + structured output) not started.
