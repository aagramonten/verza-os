# Agent Instructions

This file is the permanent operating manual for every AI coding agent working on Verza OS. It is authoritative for implementation behavior and must be read before making code changes.

## Read First

Before coding, read these documents in this order:

1. `docs/verza-os-architecture.md`
2. `docs/verza-os-mvp-plan.md`
3. `docs/vera-conversation-strategy.md`
4. `PRODUCT_VISION.md`
5. `BUSINESS_RULES.md`
6. `ROADMAP.md`

If any instruction in an issue conflicts with these documents, stop and ask for clarification. Do not silently reinterpret the architecture.

## Non-Negotiable Architecture Rules

- Do not redesign the architecture.
- Verza OS is a modular monolith with strict module boundaries.
- Preserve Clean Architecture: presentation calls application, application owns use cases, domain owns invariants, infrastructure implements ports.
- Domain code must not depend on presentation, infrastructure, Prisma, HTTP, framework details, or vendor SDKs.
- Modules communicate through events or explicit application ports. Do not reach into another module's repositories.
- The server is always the source of truth.
- The client may display state, request actions, and submit input, but it never decides business state, permissions, prices, scores, or transitions.
- All state transitions are deterministic and validated by application/domain code.
- Never continue to another feature unless explicitly instructed.

## Data And Tenant Safety

- `companyId` is required on every tenant-owned table.
- Tenant queries must be scoped by tenant context and protected by the Prisma tenant guard/extension pattern.
- Never cache data across tenants.
- Redis keys, storage keys, jobs, events, logs, and read models must be tenant namespaced when they contain tenant data.
- Never trust `companyId` from a browser header.
- Cross-tenant reads, writes, references, exports, and analytics must be impossible by design and covered by tests.
- Internal identifiers, private storage keys, hashed tokens, permission internals, provider payloads, and raw model output must not leak to clients.

## Validation And API Contracts

- Never bypass Zod validation.
- Validate every external boundary: HTTP bodies, params, query strings, environment variables, AI structured output, file uploads, webhook payloads, and background job payloads.
- Return DTOs only. Never expose Prisma entities, domain entities, internal DTOs, provider responses, audit rows, raw errors, stack traces, or prompt/model internals.
- Use the standard success envelope and RFC-7807 style problem responses.
- Keep API behavior resource-oriented, versioned, and compatible with generated client contracts.
- Idempotent actions must remain idempotent, especially payments, quote approval, quote sending, confirmation, and job handlers.

## Security And Audit Rules

- Never expose audit logs through public APIs.
- Admin audit views must be authenticated, permission-gated, tenant-scoped, and intentionally shaped as safe DTOs.
- Audit logs are append-only business evidence, not a mutable activity feed.
- Log security-sensitive actions: login, permission changes, lead transitions, customer confirmation, price rule changes, quote approval, quote sending, invoice/payment activity, user management, and super-admin impersonation.
- Secrets must stay in environment variables or secret managers. Never commit credentials.
- Public endpoints require rate limiting and strict payload limits.
- File uploads require type validation, size limits, private storage, safe filenames/keys, and short-lived access URLs.
- Magic links and resume tokens must be opaque, hashed at rest, expiring, and single-purpose.

## Money, Pricing, And Profit

- Money is always stored as integer cents, never floating point numbers.
- Store currency explicitly where money is stored or returned.
- Pricing, estimates, taxes, totals, discounts, costs, and profit calculations must be deterministic.
- AI never invents prices, estimates, discounts, taxes, margins, scores, or profitability.
- Preliminary estimates come from the pricing engine and must be labeled as non-official.
- Official quotes require human approval.

## Vera And AI Guardrails

- Vera is an intake and sales-assist system, not an autonomous operator.
- Vera can converse, extract, detect signals, request missing information, recommend next steps, and help move the customer toward a site visit.
- AI never approves quotations.
- AI never sends official quotes.
- AI never modifies confirmed customer data.
- AI never overwrites non-null confirmed values silently.
- AI output must be validated before use.
- AI may suggest changes when a contradiction appears, but the server decides what changes and whether confirmation is required.
- The model must not receive hidden numeric scores if those scores should not be visible to customers.
- Prompt instructions are not security controls. Permissions, state machines, validation, and tool allow-lists enforce the rules.

## Customer Data Rules

- Confirmed customer data is immutable unless a human-approved correction flow explicitly changes it.
- Customer confirmation snapshots are permanent records of what the customer approved.
- Measurements, photos, descriptions, budgets, service preferences, and contact details must preserve source and confidence where relevant.
- Do not delete customer history to simplify implementation. Use audit records, activity records, superseding records, or soft deletion where business history matters.

## Testing Requirements

- Every feature must have tests.
- Business invariants must be tested at the lowest useful layer, preferably domain/application tests.
- Public API behavior must be tested for success, validation failure, permission failure, and important edge cases.
- Tenant isolation, RBAC, quote approval, pricing determinism, token behavior, uploads, and AI guardrails require explicit tests.
- AI tests must use mocked providers. Do not require live LLM calls in CI.
- Background jobs and event handlers must be idempotent and tested where they mutate state.

## Completion Checklist

Before considering work complete, run:

```bash
npm test
npm run lint
npm run build
```

If any command cannot be run, document exactly why. Do not call work complete if avoidable test, lint, or build failures remain.

## Scope Discipline

- Implement only the requested feature or fix.
- Do not perform opportunistic refactors.
- Do not modify Prisma unless the task explicitly requires schema or migration work.
- Do not modify tests just to make failures disappear.
- Do not change architecture to make a feature easier.
- Do not add dependencies without a clear reason and local project fit.
- Do not create commits unless explicitly instructed.
- Stop when the requested work is complete and the required checks are green.
