# audit module

Read-side of audit_logs; writer lives in src/shared/audit (append-only).

Owns its Prisma models per docs/vera-chat-mvp-plan.md; communicates with other modules only via application services.
