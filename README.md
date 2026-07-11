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

## Vera AI (Day 3)

Vera is the conversational intelligence behind `/cotizar`. She interprets
messages, extracts structured project data (validated by Zod), detects
buying/hesitation signals and contradictions, and recommends the next step —
but the **server** is the authority: the AI never writes the database, never
chooses the conversation state, and never confirms a lead or touches
quotations. All numbers (square footage, money, dates, phones) are validated in
application code, and confirmed fields can never be overwritten.

Enable a real provider (any OpenAI-compatible `/chat/completions` endpoint):

```env
AI_ENABLED=true
AI_PROVIDER_BASE_URL=https://api.openai.com/v1   # or Groq, a gateway, etc.
AI_PROVIDER_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

With `AI_ENABLED=false` (default) the app runs fully on a deterministic
placeholder engine — no credentials required. Details + the structured output
contract and merge policy: [apps/api/src/modules/chat/README.md](apps/api/src/modules/chat/README.md).

## Status

Day 3 complete: Vera orchestrator (LLM provider abstraction, Zod-validated
structured output, prompt-injection defenses, merge/contradiction policy,
extraction audit, server-authoritative state, confirmation summary + confirm/
correct), plus the updated /cotizar UI (summary card, quick actions, success
state). Day 4 not started.
