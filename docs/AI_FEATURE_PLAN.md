# DALA WMS AI Feature Plan

This plan is tied to the current Railway deployment and backend structure in `server/src/routes` and `server/src/repositories`.

## Guiding rule

AI should suggest, warn, summarize, and prepare.  
AI should not silently change stock.

Every AI suggestion must still end in a normal warehouse action:
- create a GRN
- create a dispatch
- submit a count
- approve a casualty
- review a report

## What the current backend already gives us

The current Railway backend already exposes the data needed for the first AI features:

- `GET /api/inventory/dashboard`
  - current risk counts and movement summaries
- `GET /api/reports/*`
  - historical stock, movement, dispatch, GRN, casualty, and variance data
- `GET /api/inventory/products/:id/batches/available`
  - active batch sequence and available stock
- `GET /api/count-sessions/:id`
  - count line detail and variance review input
- `GET /api/dispatches`
  - dispatch history
- `GET /api/grns`
  - inbound history

The repository layer already centralizes most of the inventory logic in:
- [inventory-repository.js](C:/Users/HomePC/Desktop/DALA%20WMS/server/src/repositories/inventory-repository.js)

That is the correct place to add AI-ready query helpers.

## Phase 1: Rule-based AI assist

These do not need a model first. They can run from structured rules and scoring.

### 1. Anomaly detection for dispatch

Goal:
- warn when a dispatch is unusually large for a SKU

Backend work:
- add dispatch history aggregation by product and day/week
- calculate rolling average, median, and high-water mark
- return an anomaly score during dispatch creation preview

Suggested backend additions:
- `server/src/routes/dispatches.js`
- `server/src/repositories/inventory-repository.js`

Suggested API response:
- `dispatchWarnings: [{ productId, severity, message, baseline, current }]`

Frontend use:
- show a warning card in Dispatch before final save
- require user confirmation when severity is high

### 2. Smart batch alerts

Goal:
- tell the team which batches should move first this week

Backend work:
- combine expiry risk, days in stock, and stock pressure
- generate a ranked “move first” list

Suggested backend additions:
- extend `GET /api/inventory/dashboard`
- or add `GET /api/inventory/move-first`

Frontend use:
- dashboard card: “Move These First”
- expiry page: ranked recommendation strip

### 3. Count review help

Goal:
- show when variances appear connected

Backend work:
- group count differences by product, partner, and batch pattern
- flag repeated variance lines from the same source

Suggested backend additions:
- extend `GET /api/count-sessions/:id`
- add variance review summary

Frontend use:
- count approval page shows grouped warnings like:
  - “3 variance lines are tied to the same partner”
  - “2 high-variance lines are from one batch family”

### 4. Daily operations summary

Goal:
- give managers one plain-language summary every day

Backend work:
- combine dashboard, pending approvals, low stock, expiry, and unusual movement
- output a short structured summary

Suggested backend additions:
- `GET /api/admin/daily-summary`

Frontend use:
- dashboard summary panel
- later: email or WhatsApp digest

## Phase 2: Model-assisted workflow help

These can use an LLM once the data flow is stable.

### 5. Document capture for GRN

Goal:
- read delivery notes or invoices and suggest GRN lines

How it should work:
1. user uploads a delivery note, invoice, or image
2. OCR extracts text
3. AI maps lines to products, quantities, batch numbers, and dates
4. user reviews and confirms before GRN is saved

Backend work:
- add upload endpoint
- store document metadata
- call OCR + model extraction
- return a draft GRN payload

Suggested new backend pieces:
- `server/src/routes/grn-documents.js`
- `server/src/lib/document-parser.js`
- `server/src/repositories/grn-draft-repository.js`

Frontend use:
- new button in GRN:
  - `Upload delivery note`
- prefilled line items appear in the same GRN form

Important:
- AI should only suggest lines
- user must still confirm the final GRN

## Recommended technical path

### Short term

- start with rule-based scoring for dispatch anomalies and move-first alerts
- keep responses deterministic and explainable
- add warning objects to existing API responses

### Mid term

- add a small AI service layer on the Railway backend
- expose AI outputs as reviewable suggestions
- log every AI suggestion and user action for audit

### Long term

- support manager summaries by email
- support delivery note ingestion
- support assistant-style review of count sessions and stock risk

## Data and control requirements

Before AI is trusted, the app still needs strong capture discipline:

- users must record movements in the app, not later
- batch and expiry fields must be complete where required
- variances must carry notes
- exports must remain for reporting, not daily operations

If the source data is weak, AI will only make weak suggestions faster.

## Best order of implementation

1. Dispatch anomaly warnings
2. Move-first batch alerts
3. Count variance grouping
4. Daily manager summary
5. GRN document capture

## What this means for the product

AI in DALA WMS should reduce manual review, not replace warehouse control.

The best first result is not “AI inventory.”
The best first result is:

- fewer missed risks
- faster review
- fewer spreadsheet side checks
- clearer daily action lists
