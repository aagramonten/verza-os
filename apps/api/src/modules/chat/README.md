# chat module

Public chat sessions for Vera (Day 2). Layers:

```
domain/          state machine, domain errors, ChatSession/ChatMessage models
application/     PublicChatService, ResumeTokenService, PlaceholderAssistantService,
                 ports (repositories, Clock, RateLimiter, AssistantResponder), public DTOs
infrastructure/  Prisma repositories (tenant-scoped), InMemoryRateLimiter, SystemClock
presentation/    Zod schemas + PublicChatRouter (no business logic)
```

Composition root: `index.ts` (`createChatModule`). Tests may override the
clock, rate limiter, or assistant.

## Endpoints (`/api/v1/public/chat`)

| Method | Path                     | Auth                    | Purpose                                       |
| ------ | ------------------------ | ----------------------- | --------------------------------------------- |
| POST   | `/sessions`              | —                       | create session + DRAFT lead + resume token    |
| POST   | `/sessions/:id/messages` | `x-resume-token` header | send message, get placeholder reply           |
| GET    | `/sessions/:id`          | `x-resume-token` header | full public session DTO                       |
| POST   | `/sessions/:id/resume`   | token in body           | re-hydrate a session                          |
| GET    | `/sessions/:id/status`   | `x-resume-token` header | state, messageCount, leadReference, updatedAt |

### curl examples

```bash
# 1. create
curl -s -X POST localhost:3333/api/v1/public/chat/sessions -H 'content-type: application/json' -d '{}'
# → { sessionId, leadReference, state: "STARTED", resumeToken, createdAt }

# 2. send a message
curl -s -X POST localhost:3333/api/v1/public/chat/sessions/$SID/messages \
  -H "x-resume-token: $TOKEN" -H 'content-type: application/json' \
  -d '{"message":"Hola, quiero cotizar grama"}'

# 3. resume after refresh
curl -s -X POST localhost:3333/api/v1/public/chat/sessions/$SID/resume \
  -H 'content-type: application/json' -d "{\"resumeToken\":\"$TOKEN\"}"
```

## State machine

`STARTED → COLLECTING_CONTACT → COLLECTING_PROJECT → COLLECTING_MEDIA →
COLLECTING_MEASUREMENTS → READY_FOR_CONFIRMATION → CONFIRMED`, with
`READY_FOR_CONFIRMATION → COLLECTING_PROJECT` as the correction loop and
`ABANDONED` reachable from any active state. No skipping; the public API can
never force a transition; **CONFIRMED requires the explicit confirmation
action (Day 8) — nothing on Day 2 reaches it.** The placeholder assistant only
drives the first two transitions.

## Resume tokens

256-bit CSPRNG, base64url. Only the SHA-256 hash is stored
(`chat_sessions.resumeTokenHash`); verification is timing-safe; expiry
`RESUME_TOKEN_TTL_DAYS` (default 30); revocation via `resumeTokenRevokedAt`.
The raw token is returned exactly once (session creation) and is redacted
from logs (`x-resume-token`). All token failures return the same opaque 401.

## Rate limiting

`InMemoryRateLimiter` (fixed window, keyed by IP, `RATE_LIMIT_PUBLIC_RPM`).
**Single-instance limitation:** counters are per process; horizontal scaling
requires the Redis implementation of the same `RateLimiter` port. 429s are
problem+json with `Retry-After`.

## Audit

`chat.session.created` · `chat.session.resumed` ·
`chat.message.customer_created` · `chat.message.assistant_created` ·
`chat.state.changed` · `chat.resume.invalid_attempt` ·
`chat.rate_limit.exceeded` — metadata never contains message contents, raw
tokens, or raw IPs (IPs are hashed).
