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

## Status

Day 1 complete: workspace, schema + first migration, seed, env validation,
health endpoint, tests. Day 2 (chat sessions + state machine) not started.
