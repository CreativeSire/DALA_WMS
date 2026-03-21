// Update this file whenever a workflow, permission, or operational step changes.
export const latestChanges = [
  'The live deployment now runs against the Railway backend and Railway Postgres instead of frontend-direct Supabase queries.',
  'Inventory pages, reports, partner summaries, and count sessions are now wired to the Railway API for production review.',
  'Dispatch allocation validates against freshly fetched batch data and applies FIFO consistently during save.',
  'Physical count approvals create reconciliation batches for positive variances when no active stock batch exists.',
  'The app shell, shared UI system, and operator manual are embedded directly in the live product so training and operations stay aligned.',
]

export const adminSetupChecklist = [
  'Set `VITE_API_BASE_URL` on the Railway frontend service to the public API URL of the Railway backend service.',
  'Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, and the bootstrap admin credentials on the Railway API service.',
  'Run the backend bootstrap against Railway Postgres whenever schema changes are introduced so live tables stay in sync.',
  'Open the Users page as an admin and create or invite users with the correct roles before broad team access.',
  'Rotate the bootstrap admin password immediately after first login and keep environment secrets in Railway only.',
  'When workflow, permissions, infrastructure, or onboarding rules change, update this manual in the same code change.',
]

export const roleGuides = [
  {
    role: 'Admin',
    summary: 'Full-system control. Owns user administration, threshold policy, approvals, and final operational oversight.',
    canAccess: ['Dashboard', 'How it Works', 'GRN', 'Dispatch', 'Ledger', 'Expiry', 'Casualties', 'Reorder', 'Partner Performance', 'Physical Count', 'Reports', 'Products', 'Brand Partners', 'Users'],
    keyResponsibilities: [
      'Create or invite users through the Users page.',
      'Approve casualty write-offs and physical count adjustments when needed.',
      'Manage master data such as products, partners, reorder thresholds, and expiry thresholds.',
      'Review all exports and audit trails.',
    ],
  },
  {
    role: 'Warehouse Manager',
    summary: 'Runs daily warehouse execution. Owns receiving, stock accuracy, batch visibility, and operational data quality.',
    canAccess: ['Dashboard', 'How it Works', 'GRN', 'Dispatch', 'Ledger', 'Expiry', 'Casualties', 'Reorder', 'Physical Count', 'Reports', 'Products'],
    keyResponsibilities: [
      'Record all stock intake accurately as GRNs with correct batch and expiry data.',
      'Prepare dispatches and maintain batch integrity.',
      'Log damages/losses as casualties for approval.',
      'Lead physical counts and enter variances with notes.',
    ],
  },
  {
    role: 'Operations',
    summary: 'Controls approvals, outbound flow, and inventory governance.',
    canAccess: ['Dashboard', 'How it Works', 'Dispatch', 'Ledger', 'Expiry', 'Casualties', 'Reorder', 'Partner Performance', 'Physical Count', 'Reports', 'Products', 'Brand Partners'],
    keyResponsibilities: [
      'Approve or reject casualties.',
      'Review and approve count sessions so ledger adjustments are posted.',
      'Manage dispatch confirmations and partner-facing operational performance.',
      'Maintain product/partner setup alongside admin users.',
    ],
  },
  {
    role: 'Finance',
    summary: 'Reads stock risk, ageing, and reconciliation outputs to understand exposure and reporting.',
    canAccess: ['Dashboard', 'How it Works', 'Ledger', 'Expiry', 'Reorder', 'Partner Performance', 'Reports'],
    keyResponsibilities: [
      'Monitor expired and near-expiry exposure.',
      'Track low-stock and out-of-stock positions against demand.',
      'Review reconciliation and casualty reports for loss visibility.',
    ],
  },
  {
    role: 'Security',
    summary: 'Verifies that prepared outbound stock physically exits the warehouse.',
    canAccess: ['Dashboard', 'How it Works', 'Dispatch'],
    keyResponsibilities: [
      'Confirm pending dispatches at gate after physical load verification.',
      'Use the dispatch number as the operational reference during truck departure checks.',
    ],
  },
]

export const pageGuides = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    purpose: 'Operational command center for the day.',
    howItWorks: [
      'Reads live counts from current stock, reorder alerts, expiry alerts, casualties, and stock movements.',
      'Highlights shortages, expiry risks, and pending approvals.',
      'Each alert card routes directly into the page where the issue can be worked.',
    ],
    useWhen: 'Use first at the start of every shift to see what needs attention.',
  },
  {
    id: 'how-it-works',
    title: 'How it Works',
    purpose: 'Embedded operator manual and change log.',
    howItWorks: [
      'Explains each role and page in the live app.',
      'Lists the latest workflow changes so operators can adapt without separate documentation.',
      'Should be updated whenever product behavior or process rules change.',
    ],
    useWhen: 'Use for onboarding, refresher training, and process confirmation.',
  },
  {
    id: 'grn',
    title: 'Stock Intake (GRN)',
    purpose: 'Records inbound goods from brand partners.',
    howItWorks: [
      'Creates one GRN header for the receipt and one or more GRN lines for the products received.',
      'Each line creates a stock batch with quantity, expiry date, cost, and batch number where available.',
      'Each line also writes a positive stock movement, so the ledger and current stock update immediately.',
    ],
    useWhen: 'Use every time physical stock is received into the warehouse.',
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    purpose: 'Creates and confirms outbound stock movements.',
    howItWorks: [
      'Checks available stock by product using active batches only.',
      'Allocates stock FIFO from the oldest received batches first.',
      'Creates a pending dispatch note, deducts batch balances, records dispatch items, and writes negative stock movements.',
      'Security or authorized operations staff later confirm the truck departure.',
    ],
    useWhen: 'Use when shipping stock out to a retailer or destination.',
  },
  {
    id: 'ledger',
    title: 'Ledger',
    purpose: 'Shows live stock and the full audit trail of inventory movement.',
    howItWorks: [
      'Current Stock uses a SQL view that aggregates batch balances per SKU.',
      'Movement History reads from the immutable stock_movements table.',
      'Exports are available for both views.',
    ],
    useWhen: 'Use for stock verification, audits, investigations, and export.',
  },
  {
    id: 'expiry',
    title: 'Expiry Tracking',
    purpose: 'Tracks near-expiry and expired stock by batch.',
    howItWorks: [
      'Uses each batch expiry date and each product alert threshold in days.',
      'Refresh can trigger the batch-status update function in the database.',
      'Thresholds can be changed per product by authorized users.',
    ],
    useWhen: 'Use for routine risk review and before promotional or liquidation decisions.',
  },
  {
    id: 'casualties',
    title: 'Casualties',
    purpose: 'Logs and approves stock write-offs.',
    howItWorks: [
      'Warehouse staff log a casualty against a real batch and quantity.',
      'No stock is deducted at logging time.',
      'Operations/Admin approves or rejects the record.',
      'Approval writes off the quantity from the batch and records a write_off movement.',
    ],
    useWhen: 'Use for damages, expiry loss, theft, missing stock, or other write-off events.',
  },
  {
    id: 'reorder',
    title: 'Reorder Alerts',
    purpose: 'Highlights SKUs at or below configured reorder thresholds.',
    howItWorks: [
      'Reads the reorder_alerts SQL view, which compares current stock to each SKU threshold.',
      'Shows out-of-stock and low-stock items separately.',
      'Authorized users can edit thresholds directly from the page.',
    ],
    useWhen: 'Use when planning replenishment or escalation to suppliers.',
  },
  {
    id: 'performance',
    title: 'Brand Partner Performance',
    purpose: 'Summarizes partner stock, expiry risk, and receiving history.',
    howItWorks: [
      'Reads a partner summary view for high-level metrics.',
      'Loads partner-specific stock and recent GRNs when drilling into a single partner.',
      'Helps compare who has stock risk, ageing risk, or active inbound activity.',
    ],
    useWhen: 'Use for supplier reviews and internal planning with Operations or Finance.',
  },
  {
    id: 'count',
    title: 'Physical Count',
    purpose: 'Reconciles physical warehouse stock against system stock.',
    howItWorks: [
      'Opening a session snapshots system stock for every active SKU.',
      'Counters enter physical quantities and variance notes.',
      'Submitting the session freezes it for approval.',
      'Approval posts adjustment movements. Positive variances with no active batch create a reconciliation batch.',
    ],
    useWhen: 'Use during cycle counts, full counts, and post-incident reconciliation.',
  },
  {
    id: 'reports',
    title: 'Reports & Export',
    purpose: 'Generates operational and analytical exports.',
    howItWorks: [
      'Runs report queries against views and transactional tables.',
      'Supports stock summary, ABC analysis, ageing, movement, dispatch, GRN, casualty, and variance outputs.',
      'Exports the currently generated report to CSV.',
    ],
    useWhen: 'Use for management reporting, partner communication, and audit support.',
  },
  {
    id: 'products',
    title: 'Products',
    purpose: 'Maintains the SKU master list.',
    howItWorks: [
      'Stores partner ownership, SKU code, name, unit type, reorder threshold, and expiry alert days.',
      'These settings drive downstream reorder and expiry behavior.',
    ],
    useWhen: 'Use when creating or updating a product master record.',
  },
  {
    id: 'partners',
    title: 'Brand Partners',
    purpose: 'Maintains supplier/partner records.',
    howItWorks: [
      'Stores partner identity and contact details.',
      'Partners connect products, GRNs, and reporting views.',
    ],
    useWhen: 'Use when onboarding or maintaining a supplier relationship.',
  },
  {
    id: 'users',
    title: 'Users',
    purpose: 'Administers system access.',
    howItWorks: [
      'Admin users can create or invite users through the Railway backend user administration flow.',
      'The page also toggles profile active status for existing users.',
      'User roles determine page access and backend authorization permissions.',
    ],
    useWhen: 'Use for onboarding, access control, and offboarding.',
  },
]

export const systemNarrative = [
  'The system is batch-based. Every inbound receipt becomes one or more stock batches, and every outbound or corrective action adjusts those batch balances.',
  'The ledger is immutable. Stock movements are appended for GRNs, dispatches, write-offs, and count adjustments instead of editing history in place.',
  'Operational dashboards and alert pages depend on backend read models and aggregated stock queries so stock, expiry, reorder, and reconciliation screens stay aligned.',
  'Roles are enforced in both the app navigation and the Railway backend authorization layer.',
]
