# Business Rules

This document defines the business rules Verza OS must preserve across every implementation. These rules are product requirements, not suggestions.

## Global Rules

- The server is the source of truth for all business state.
- All tenant-owned records require `companyId`.
- All money is stored as integer cents with currency.
- Every state transition is deterministic and validated by application/domain code.
- Every important business action is auditable.
- AI can assist, but AI cannot approve, send, delete, or silently overwrite business-critical data.
- Confirmed customer data cannot be overwritten by AI.
- Official quotes cannot be approved automatically.
- Customer-facing preliminary numbers are estimates only until a human-approved quote exists.

## Customer

A customer is the person or organization receiving landscaping services.

Rules:

- Every project belongs to a customer.
- Every lead must be connected to a customer or enough contact data to create one.
- Customer contact data must preserve source and confirmation status.
- Confirmed customer data cannot be overwritten by AI.
- Duplicate customers should be merged only through an intentional, auditable process.
- Customer lifetime value is calculated from won projects, recurring maintenance, invoices, and payments.
- Customer records must show source history where known so marketing ROI can be analyzed.

Important customer data includes:

- Name.
- Phone.
- Email.
- Address.
- Municipality.
- Property type.
- Preferred language.
- Marketing source.
- Notes.
- Consent and communication preferences where applicable.

## Lead

A lead is a potential revenue opportunity.

Rules:

- A lead belongs to one company and one customer/contact context.
- A lead has a source such as web, Vera, manual entry, referral, campaign, or partner.
- A lead must have a deterministic status.
- Invalid lead status transitions are rejected.
- Every lead transition writes activity and audit evidence.
- Leads should preserve service type, urgency, budget signal, project description, property context, municipality, photos, measurements, buying signals, hesitation signals, and next recommended action.
- A lead can be qualified by Vera, but qualification scores are computed by server rules.
- Lead Score and Customer Confidence Score are internal business tools and must not be shown to customers.
- A lead should move toward a site visit unless explicitly disqualified, archived, or lost.

Expected lead flow:

`NEW -> INTAKE -> QUALIFIED -> SITE_INFO_PENDING -> CONFIRMED -> ESTIMATED -> IN_REVIEW -> QUOTED -> WON | LOST | ARCHIVED`

## Site Visit

A site visit is the primary conversion step for landscape work.

Rules:

- Every Vera conversation must move toward scheduling a site visit.
- A site visit belongs to a customer and should be associated with a lead or project.
- Site visits should capture date, time window, address, contact person, service interest, notes, and assigned staff or crew.
- Site visit outcomes should update the lead and inform estimate/quote accuracy.
- Missed, canceled, completed, and rescheduled visits must be tracked.
- Site visit reminders should be automated where possible.

## Estimate

An estimate is a preliminary, non-official price range.

Rules:

- Estimates are computed by the server, never invented by AI.
- Estimates use deterministic pricing rules and versioned inputs.
- Estimate inputs must be stored so the same versioned rules can explain the result later.
- Estimates must be labeled as preliminary and not an official quote.
- Estimates can inform sales conversations but do not authorize work.
- Estimates should include disclaimers when shown to customers.
- Estimate ranges should be recalculated when relevant scope, measurements, photos, or pricing rules change.

## Quote

A quote is the official customer-facing offer for work.

Rules:

- Quotes cannot be approved automatically.
- AI never approves quotations.
- AI never sends official quotes.
- Quote approval requires a human actor with the correct permission.
- Quote sending requires the correct permission.
- Quote approval and sending must be audit logged.
- A quote must be based on a customer, lead or project context, line items, subtotal, taxes where applicable, total, currency, validity period, and status.
- Quote totals must be calculated from integer cents.
- Quote state transitions are deterministic.
- Quote PDFs must be generated from approved quote data, stored privately, and served through safe access mechanisms.

Expected quote flow:

`DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT -> ACCEPTED | REJECTED | EXPIRED`

## Project

A project is confirmed work to be delivered.

Rules:

- Every project belongs to a customer.
- A project may originate from a won quote, a maintenance plan, or a manual internal workflow.
- Every maintenance belongs to a project.
- Every expense belongs to a project.
- A project must track operational status, scope, service type, assigned crew, schedule, notes, photos, tasks, materials, labor, equipment, invoices, and profitability.
- Project changes that affect price, scope, or schedule must be auditable.
- Project completion should trigger profitability calculation and follow-up opportunities.

Every project must track:

- Revenue.
- Material Cost.
- Labor Cost.
- Equipment Cost.
- Fuel.
- Advertising Cost.
- Other Expenses.
- Gross Profit.
- Net Profit.
- Profit Margin.
- Hours Worked.
- Crew Members.

## Invoice

An invoice records money owed by the customer.

Rules:

- Invoices belong to a customer and should be associated with a project.
- Invoice totals are stored as integer cents with currency.
- Invoice line items, taxes, discounts, payments, balance, due date, and status must be deterministic.
- Payments must be auditable.
- Paid, partially paid, overdue, voided, and refunded states must be explicit.
- Invoice PDFs and receipts are private documents.
- Invoice data contributes to customer lifetime value and project profitability.

## Maintenance

Maintenance is recurring landscape service connected to a customer relationship.

Rules:

- Every maintenance belongs to a project.
- Maintenance plans belong to a customer and company.
- Maintenance visits are generated from a plan and assigned to dates.
- Frequency, included services, start date, status, price, crew assignment, and visit history must be tracked.
- Completed, skipped, missed, canceled, and rescheduled visits must be explicit.
- Maintenance should support automated reminders, renewal prompts, and owner notifications.
- Maintenance revenue and costs contribute to project and customer profitability.

## Marketing

Marketing connects spend to leads, customers, projects, revenue, and profit.

Rules:

- Leads should preserve marketing source, campaign, referral, partner, or manual attribution where known.
- Marketing ROI must be based on closed revenue and profit, not just lead count.
- Customer lifetime value should be traceable back to original source where known.
- Advertising cost should be assignable to projects when possible and to campaigns/channels when not.
- Campaign reporting should include leads, site visits, estimates, quotes, wins, revenue, gross profit, net profit, close rate, average project value, and lifetime value.

## Expenses

Expenses represent costs required to sell, deliver, or support work.

Rules:

- Every expense belongs to a project.
- Expenses must have category, amount in integer cents, currency, date, vendor/payee where applicable, description, and source.
- Expenses can include material, labor, equipment, fuel, advertising, subcontractor, permit, disposal, delivery, and other costs.
- Expenses must contribute to gross profit and net profit calculations.
- Expenses should be auditable when created, edited, deleted, or reclassified.

## Employees

Employees and crew members represent labor capacity.

Rules:

- Crew members assigned to projects must be tracked.
- Hours worked must be tracked per project.
- Labor cost must be calculated from hours, rates, payroll cost, or configured labor costing rules.
- Employee roles and permissions are separate concerns: a worker on a project does not automatically gain admin system access.
- Timesheet changes that affect project cost must be auditable.
- Employee utilization should support future analytics.

## Materials

Materials are plants, soil, rock, mulch, irrigation parts, lighting parts, consumables, and other physical inputs.

Rules:

- Material costs must be assigned to a project.
- Material quantity, unit, unit cost, supplier, and total cost should be tracked.
- Material prices are stored as integer cents.
- Materials affect project profitability.
- Inventory may be introduced later, but project-level material cost is required for profitability.
- Material substitutions that affect quote, scope, or profit should be auditable.

## Profit

Profitability is a core product responsibility.

Rules:

- Gross Profit = Revenue - direct project costs.
- Net Profit = Revenue - all assigned project expenses.
- Profit Margin = profit divided by revenue, expressed as a percentage.
- Profit calculations must use integer money values and deterministic formulas.
- A project is not analytically complete until revenue, costs, hours, crew, and margin are available or intentionally marked unknown.
- Profit should be viewable by project, customer, service type, crew, marketing source, campaign, and time period.
- Profit reporting must be tenant scoped.

## Vera And Confirmed Data

Rules:

- Vera may extract proposed data from conversations.
- Vera may identify contradictions.
- Vera may ask clarification questions.
- Vera may recommend a site visit.
- Vera may not approve quotes.
- Vera may not send official quotes.
- Vera may not overwrite confirmed customer data.
- Vera may not mutate financial, permission, tenant, invoice, or quote approval state.
- Confirmed snapshots are immutable business records.

## Audit And Exposure

Rules:

- Audit records are internal business evidence.
- Public users never access audit logs.
- Admin audit access must be permission-gated and tenant-scoped.
- Audit data returned to admins must be shaped through safe DTOs.
- Internal DTOs, raw provider payloads, model prompts, model raw output, and system internals are not customer-facing product data.
