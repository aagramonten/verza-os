# Roadmap

This roadmap replaces day-based planning with product milestones. Each sprint should produce a coherent product capability while preserving the approved architecture.

## Sprint 1: Foundation

### Purpose

Establish the tenant-aware technical and product foundation for Verza OS. The system must be safe, testable, and ready for future SaaS expansion before revenue workflows grow on top of it.

### Features

- Nx workspace structure for API, web app, shared package, and future worker.
- Express API with typed configuration and Zod environment validation.
- Prisma and MySQL foundation.
- Seeded company for Verza Garden.
- Tenant-aware data model with `companyId` on tenant-owned tables.
- Health endpoint.
- Shared domain vocabulary and scoring configuration foundation.
- Audit logging foundation.
- Local development setup with database and test workflow.
- Baseline CI expectations for test, lint, and build.

### Success Criteria

- The repo can be installed, built, and tested locally.
- The API starts with validated environment configuration.
- Tenant-owned data has explicit tenant ownership.
- Foundational tests pass.
- Future modules can follow the established architecture without redesign.

## Sprint 2: Vera AI

### Purpose

Create Vera as the sales-oriented intake specialist that captures project context, builds customer trust, and moves conversations toward a site visit.

### Features

- Public `/cotizar` conversation flow.
- Session creation, resume token, and conversation persistence.
- Vera prompt and structured output contract.
- AI provider abstraction with deterministic fallback.
- Zod validation for model output.
- Extraction of service type, municipality, project description, budget signal, urgency, contact details, measurements, and relevant notes.
- Buying signal and hesitation signal detection.
- Lead Score and Customer Confidence Score computed by server rules.
- Photo and measurement prompts as part of the conversation.
- Confirmation summary.
- Guardrails preventing AI from approving quotes, sending quotes, inventing official prices, or overwriting confirmed customer data.

### Success Criteria

- A customer can start and resume an intake conversation.
- Vera asks one relevant question at a time and guides toward a site visit.
- Structured model output is validated before use.
- AI failures fall back safely.
- Scores and next actions are computed by application code.
- Tests prove AI cannot bypass state, pricing, validation, or quote approval rules.

## Sprint 3: CRM

### Purpose

Turn captured demand into an organized sales pipeline that the business can act on quickly.

### Features

- Customers and contacts.
- Leads with source, service type, status, municipality, budget signal, urgency, notes, and owner assignment.
- Lead activity timeline.
- Lead status state machine.
- Lead board or table for admin users.
- Transcript and intake summary on lead detail.
- Site visit intent and scheduling fields.
- Follow-up reminders and stale lead signals.
- Source attribution for marketing reporting.

### Success Criteria

- Leads can be created from Vera, form/manual entry, and admin workflows.
- Lead transitions are deterministic and audited.
- Staff can see which leads need action.
- Lead source and follow-up status are visible.
- Invalid transitions and unauthorized access are rejected.

## Sprint 4: Projects

### Purpose

Create the operational record for confirmed work and make every job measurable from scope through completion.

### Features

- Projects linked to customers.
- Project creation from won quotes or manual workflows.
- Project status tracking.
- Scope, service type, schedule, address, and assigned crew.
- Project photos and documents.
- Measurements and site notes.
- Task/work-order structure.
- Hours worked.
- Crew member tracking.
- Project expense assignment.
- Project completion workflow.

### Success Criteria

- Every project belongs to a customer.
- Every project can track revenue, costs, hours, and crew members.
- Project changes affecting scope, schedule, or cost are auditable.
- Completed projects can feed profitability reporting.

## Sprint 5: Finance

### Purpose

Connect estimates, quotes, invoices, payments, expenses, and profitability into one accountable financial workflow.

### Features

- Pricing rules and deterministic preliminary estimates.
- Quote drafts from estimates or project scope.
- Quote line editor.
- Quote approval workflow requiring human permission.
- Quote PDF generation.
- Quote sending and audit records.
- Invoice creation from approved/won work.
- Payment tracking.
- Expense categories and project expense entry.
- Gross profit, net profit, profit margin, and average project value calculations.

### Success Criteria

- Preliminary estimates are generated only by server pricing rules.
- Official quotes cannot be approved automatically.
- Quote approval and sending are permission-gated and audited.
- Money is stored as integer cents.
- Projects expose revenue, costs, profit, margin, and payment state.

## Sprint 6: Maintenance

### Purpose

Make recurring landscape service a first-class revenue stream instead of an informal follow-up task.

### Features

- Maintenance plans linked to projects and customers.
- Frequency, start date, included services, price, notes, and status.
- Generated maintenance visits.
- Visit completion, skip, cancel, and reschedule flows.
- Crew assignment.
- Owner reminders for upcoming visits.
- Maintenance revenue and cost tracking.
- Follow-up opportunities for upgrades, renewals, and seasonal work.

### Success Criteria

- Every maintenance plan belongs to a project.
- Upcoming visits are visible and actionable.
- Completed visits contribute to project/customer profitability.
- Missed or skipped visits are explicit.
- Maintenance follow-up is automated enough to prevent forgotten recurring work.

## Sprint 7: Marketing

### Purpose

Show which marketing efforts generate profitable customers, not just leads.

### Features

- Marketing source and campaign tracking.
- Referral and partner attribution foundation.
- Advertising cost assignment to project, campaign, or source.
- Lead-to-site-visit-to-quote-to-win funnel.
- Source-level average project value.
- Source-level customer lifetime value.
- Follow-up automation by source and lead quality.
- Campaign performance dashboard.

### Success Criteria

- Every lead can preserve its source where known.
- Marketing reports connect spend to revenue and profit.
- The business can compare channels by close rate, average project value, and profitability.
- Follow-up workflows reduce lost opportunities.

## Sprint 8: Analytics

### Purpose

Give owners a clear operating picture of sales, operations, profitability, and customer value.

### Features

- Dashboard for leads, visits, quotes, projects, invoices, maintenance, and profit.
- Profitability by project, service type, crew, source, campaign, and time period.
- Lead Score and Customer Confidence Score reporting.
- Quote conversion and follow-up performance.
- Maintenance recurring revenue metrics.
- Customer lifetime value.
- Crew utilization.
- Exportable reports.
- Analytics read models or rollups where needed.

### Success Criteria

- Owners can answer what work is profitable and where it came from.
- Reports are tenant scoped and performant.
- Analytics use deterministic formulas and trusted data.
- The system highlights operational bottlenecks and missed follow-up opportunities.

## Sprint 9: SaaS Multi-Tenant

### Purpose

Turn the Verza Garden internal product into a commercial SaaS platform for multiple landscape companies.

### Features

- Tenant onboarding flow.
- Tenant branding and settings.
- Subdomain or custom domain resolution.
- User memberships across companies.
- Role and permission administration.
- Platform admin tools.
- Subscription/billing foundation.
- Tenant-aware storage, cache, jobs, and events.
- Data export and tenant lifecycle operations.

### Success Criteria

- A second company can use the product without code changes.
- Tenant isolation is tested across reads, writes, jobs, storage, cache, and analytics.
- Users can belong to multiple companies safely.
- Platform administration is audited.
- Billing and plan controls can support commercial rollout.

## Sprint 10: Scale

### Purpose

Prepare Verza OS for high-volume usage, larger tenants, deeper automation, and selective service extraction without rewriting the product.

### Features

- Worker process hardening.
- Outbox relay reliability.
- Queue observability and dead-letter handling.
- Read replicas or query optimization where needed.
- Redis cache strategy with tenant namespacing.
- Cloud storage hardening.
- OpenTelemetry and structured logging.
- Backup and restore runbooks.
- Rate-limit tuning.
- Selective extraction plan for AI, notifications, or analytics if real pressure exists.
- Enterprise silo tenant option planning.

### Success Criteria

- The system handles growth without abandoning the modular monolith architecture.
- Operations can detect, debug, and recover from failures.
- Jobs are idempotent and observable.
- Tenant isolation remains intact under scale.
- Hot modules can be extracted later through existing events and ports, not rewrites.
