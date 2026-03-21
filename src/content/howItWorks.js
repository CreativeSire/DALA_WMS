// Update this file whenever a workflow, permission, or operational step changes.
export const latestChanges = [
  'User administration now runs through a server-side Supabase Edge Function for invite/create operations instead of attempting admin auth calls in the browser.',
  'Dispatch allocation now validates against freshly fetched batch data and uses FIFO consistently during save.',
  'Physical count approvals now create reconciliation batches for positive variances when no active stock batch exists.',
  'A deploy script is now included for the user-admin Edge Function so admin onboarding can be shipped consistently.',
  'This in-app manual was added so operators can review the current process without leaving the system.',
]

export const adminSetupChecklist = [
  'Deploy the user-admin Edge Function with `npm run deploy:user-admin` after exporting `SUPABASE_SERVICE_ROLE_KEY` in your shell.',
  'If the Supabase project is not linked locally, pass the project reference to the script with `-ProjectRef <project-ref>`.',
  'Open the Users page as an admin and choose either Invite User or Create User.',
  'Use Invite when the person should set their own password from email. Use Create when you need to hand over a temporary password directly.',
  'Confirm that every new user has the correct role because page access and database permissions depend on it.',
  'When workflow, permissions, or onboarding rules change, update this manual file in the same code change.',
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
      'Admin users can invite new users by email or create them with a temporary password through a server-side function.',
      'The page also toggles profile active status for existing users.',
      'User roles determine page access and RLS permissions in the database.',
    ],
    useWhen: 'Use for onboarding, access control, and offboarding.',
  },
]

export const systemNarrative = [
  'The system is batch-based. Every inbound receipt becomes one or more stock batches, and every outbound or corrective action adjusts those batch balances.',
  'The ledger is immutable. Stock movements are appended for GRNs, dispatches, write-offs, and count adjustments instead of editing history in place.',
  'Operational dashboards and alert pages depend on SQL views, not duplicated frontend calculations, so stock, expiry, reorder, and reconciliation screens stay aligned.',
  'Roles are enforced twice: in the app navigation and inside Supabase Row Level Security.',
]
