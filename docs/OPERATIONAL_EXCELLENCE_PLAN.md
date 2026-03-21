# DALA WMS Operational Excellence Plan

## Objective

Eliminate spreadsheet dependence for daily warehouse operations by making DALA WMS the fastest, strictest, and easiest system for FMCG inventory control, audit readiness, and exception management.

Core rule:

`No stock movement, stock correction, count, approval, or audit explanation should require Excel to complete.`

## Anti-spreadsheet design principles

1. Capture data at the point of work.
2. Validate before save.
3. Use exception workflows instead of offline corrections.
4. Make audit and review easier inside the app than outside it.
5. Allow exports for reporting, not for operational completion.

## What has now been implemented

- Invite emails can be sent from the Railway backend when SMTP settings are added.
- Password reset emails can be sent from the Railway backend when SMTP settings are added.
- Admin audit logs now record key access-control actions.
- The live app now includes a plain-language backup and restore runbook in `How It Works`.
- Visual workflow pictures are now embedded in the manual so operators can follow the main warehouse flows more easily.

## Spreadsheet-elimination feature matrix

| Operational need | Spreadsheet failure mode | DALA WMS current state | Gap to close | Priority |
| --- | --- | --- | --- | --- |
| Goods receiving | Manual entry, duplicate rows, missing batch/expiry, delayed posting | GRN flow exists with batch and expiry capture | Add scan-first receiving, mandatory rules by SKU class, draft receiving queue | P0 |
| Dispatch | Wrong stock issue, no FIFO discipline, delayed confirmation | FIFO dispatch and confirmation exist | Add pick/pack workflow, barcode verification, exception queue for shortages | P0 |
| Expiry control | Manual review, late action, hidden risk | Expiry alerts exist | Add action queue, FEFO prompts, liquidation/return workflow | P0 |
| Cycle count | Counts done offline then typed later | Count sessions and variance approval exist | Add mobile count mode, blind count mode, bin/zone sequencing | P0 |
| Reconciliation | Variance resolved in private sheets | Ledger and count adjustments exist | Add discrepancy inbox, root-cause coding, approval SLA tracking | P1 |
| Reorder planning | Thresholds tracked in ad hoc sheets | Reorder alerts exist | Add demand-aware reorder recommendations and supplier follow-up queue | P1 |
| Audit review | Investigations happen outside the app | Ledger/reporting exist | Add SKU timeline, batch timeline, admin audit log, period close dashboard | P0 |
| User onboarding | Invites and resets handled informally | Invite, create, reset, password change now exist | Add email delivery, first-login forced rotation, audit trail for admin actions | P0 |
| Management reporting | Manual spreadsheet assembly | CSV reports exist | Add PDF board packs with charts, commentary, loss exposure, and ageing summary | P1 |
| Disaster recovery | No clear restore path | Not yet documented in-app | Add backup/restore runbook and recovery drill checklist | P0 |

## DALA WMS vs Excel vs Inventory Ark

| Capability | Excel / workbook | Inventory Ark public positioning | DALA WMS target position |
| --- | --- | --- | --- |
| Source of truth | Fragmented and editable | Centralized multi-channel dashboard | Warehouse system of record with immutable movement ledger |
| Data validation | Weak and optional | Not clear from public feature page | Strict SKU, unit, batch, expiry, and role validation |
| FMCG batch control | Manual | Not emphasized publicly | Core behavior with FIFO, expiry, casualties, and reconciliation |
| Auditability | Poor | Secure data management mentioned | Full operational trace by SKU, batch, user, and approval |
| Warehouse execution | Usually offline-first and error-prone | Workflow automation mentioned broadly | Point-of-operation receiving, dispatch, count, and exception handling |
| Alerting | Manual formulas | Real-time sync and analytics | Reorder, expiry, discrepancies, pending approvals, and SLA alerts |
| Ease of use | Familiar but unsafe | Centralized dashboard | Simpler task queues and guided flows tuned to DALA operations |
| Offline spreadsheet need | Core operating method | Unknown from public page | Reduced to reporting/export only |

Reference:
- Inventory Ark public features page emphasizes centralized management, real-time sync, analytics, customizable workflows, and secure data management rather than deep warehouse-floor exception control.

## DALA-specific operating model

### What matters most for DALA

- Fast-moving consumer goods require tight expiry and depletion visibility.
- Batch integrity matters because wrong issue sequence creates hidden loss.
- Daily discrepancies must become visible immediately, not at month-end.
- Operations, warehouse, finance, and security need different views of the same truth.
- The system must be easier than paper-plus-Excel, or adoption degrades.

### DALA control outcomes

- Every inward stock event creates a valid GRN, batch, and ledger movement.
- Every outward stock event creates a valid dispatch, allocation, and confirmation trail.
- Every variance has an owner, reason, and approval outcome.
- Every exception appears in a queue, not in a private workbook.
- Every manager can answer “what changed, who changed it, and why” from the app.

## Remaining high-value production work

### P0

- Email delivery for invite links and reset notifications
- Admin audit log views for user creation, reset, deactivation, and role changes
- Backup/restore runbook inside the app manual
- SKU and batch audit timeline pages
- Mobile-first cycle count flow
- Exception inbox for shortages, expiry, pending approvals, and unresolved variances
- First-login password rotation enforcement

### P1

- FEFO support for expiry-sensitive SKUs
- PDF reporting packs with charts and operational commentary
- Demand-aware reorder recommendations
- Zone/bin-aware count and receiving flows
- Approval SLA alerts and overdue escalations

### P2

- Role-specific home dashboards
- Guided partner/vendor review packs
- Recovery drill history and sign-off tracking

## Codebase-aligned implementation roadmap

### Phase 1: Operational control hardening

Targets:
- `server/src/routes/users.js`
- `server/src/routes/auth.js`
- `src/pages/ProductsPage.jsx`
- `src/components/Layout.jsx`

Work:
- Add email delivery for invite and reset flows. Done.
- Add forced password rotation flag on newly created or reset accounts. Remaining.
- Add admin action audit writes for invite, create, reset, activate, deactivate. Done.
- Expose admin audit views in a new app page. Done.

### Phase 2: Exception-led warehouse workflow

Targets:
- `server/src/repositories/inventory-repository.js`
- `server/src/routes/inventory.js`
- `src/pages/Dashboard.jsx`
- `src/pages/GRNPage.jsx`
- `src/pages/DispatchPage.jsx`
- `src/pages/ExpiryPage.jsx`
- `src/pages/PhysicalCountPage.jsx`

Work:
- Add exception queue endpoints for low stock, near expiry, unresolved variances, pending confirmations, and pending casualty approvals.
- Redesign dashboard around “work to do now” instead of only stats.
- Enforce reason codes on critical exceptions.
- Add FEFO prompts where expiry sensitivity demands it.

### Phase 3: Audit superiority over spreadsheets

Targets:
- `server/src/routes/reports.js`
- `server/src/repositories/inventory-repository.js`
- new pages for audit timeline and admin audit log
- `src/pages/LedgerPage.jsx`
- `src/pages/ReportsPage.jsx`

Work:
- Add SKU timeline and batch timeline drilldown endpoints.
- Add admin audit log endpoints and UI.
- Add locked period reporting and close-pack exports.
- Add PDF report generation with charts and summary commentary.

### Phase 4: Resilience and operational runbook

Targets:
- `src/content/howItWorks.js`
- `src/pages/HowItWorksPage.jsx`
- `README.md`
- `server/README.md`

Work:
- Add backup/restore runbook into the app manual. Done.
- Add Railway recovery checklist and credential rotation steps. Partly done in the manual and repo docs.
- Add recovery drill checklist and ownership mapping. Remaining.

## Railway deployment alignment

Frontend:
- Canonical domain: `https://dalawms.up.railway.app`

API:
- `https://dala-wms-api-production.up.railway.app`

Database:
- Railway Postgres

Operational requirement:
- Changes to auth, audit, backup, or onboarding must be documented in both the repo docs and the embedded in-app manual in the same release.

## Success metrics

- Percentage of warehouse tasks completed without spreadsheet fallback
- Count of unresolved variances older than 24 hours
- Count of pending approvals older than SLA
- Number of expired batches acted on before expiry date
- Time to trace a stock discrepancy from dashboard to root cause
- Time to onboard a new operator without manual credential handling
- Monthly number of CSV exports used for reporting versus used for operations
