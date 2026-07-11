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
| POST   | `/sessions/:id/confirm`  | `x-resume-token` header | customer confirms the summary → CONFIRMED     |
| POST   | `/sessions/:id/correct`  | `x-resume-token` header | customer wants to change something → back to COLLECTING_PROJECT |
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

## Vera orchestrator (Day 3)

When `AI_ENABLED=true`, `VeraOrchestrator` replaces the placeholder engine
behind the same `ConversationEngine` port. Per turn: build a safe prompt →
call the LLM (`LlmProvider`) → parse+validate the structured output (Zod,
`ai-turn.schema.ts`) → normalize in app code (phone/email/date/area/money) →
merge (fill-empty, never overwrite, confirmed-lock, contradictions) → persist
the extraction audit (`ai_extractions`) → resolve the target phase (server) →
build the summary when required data is complete.

**Merge & contradiction policy:** a new validated value fills an empty field;
an equal value is a no-op; a conflicting *unconfirmed* value is NOT applied and
becomes a contradiction the customer is asked to clarify; a *confirmed* field
is never overwritten. Arrays merge by union.

**Safety:** the AI never chooses state, confirms a lead, or approves/sends
quotes (no such endpoint or intent exists). Customer text is passed as
delimited untrusted data; the system prompt forbids role changes / prompt
disclosure. Provider timeout/unavailable → safe fallback reply, customer
message preserved, repeated failures flag the session for review. Invalid JSON
→ safe clarify reply, extraction stored as invalid.

Fallbacks: provider down → "Ahora mismo estoy teniendo dificultad…"; invalid
output → "¿Me lo puedes explicar de otra forma?".
