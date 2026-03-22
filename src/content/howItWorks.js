export const introGuide = {
  title: 'How It Works',
  subtitle: 'A simple guide for the people who receive stock, move stock, count stock, and review warehouse activity every day.',
  promise: [
    'Every stock movement should be recorded inside the system when it happens.',
    'The system is meant to reduce guesswork, reduce spreadsheet dependency, and make review easier.',
    'If a movement is not logged here, it should be treated as not yet completed.',
  ],
}

export const victorJourney = {
  name: 'Victor',
  role: 'Warehouse manager',
  summary: 'Victor uses DALA WMS to receive goods, check stock, watch expiry risk, prepare dispatch, and complete stock counts without relying on separate paper sheets or Excel workbooks.',
  steps: [
    {
      title: '1. Victor receives new goods',
      detail: 'Victor opens Stock Intake (GRN), selects the partner, adds the products received, enters batch and expiry details where needed, and saves the receipt. Once saved, stock is available in the system.',
    },
    {
      title: '2. Victor checks what is available',
      detail: 'Victor uses the Dashboard, Ledger, and Reorder pages to see current stock, low stock items, and unusual movement before operations continue.',
    },
    {
      title: '3. Victor prepares goods for dispatch',
      detail: 'Victor opens Dispatch, chooses the products going out, and lets the system allocate from the right batches. This helps the team move older stock first and keeps the audit trail complete.',
    },
    {
      title: '4. Victor manages risk before it becomes a loss',
      detail: 'Victor watches the Expiry and Casualties pages so near-expiry goods, damaged goods, and write-offs are acted on quickly and approved properly.',
    },
    {
      title: '5. Victor confirms what is physically on the floor',
      detail: 'Victor opens Physical Count, records what is actually in the warehouse, submits the count, and approves the result so the system reflects reality instead of assumptions.',
    },
  ],
}

export const coreRules = [
  'Receive stock with Stock Intake (GRN) before treating it as available.',
  'Dispatch stock from Dispatch so the movement is traced to the correct batch.',
  'Record damages, shortages, and write-offs in Casualties instead of adjusting stock silently.',
  'Use Physical Count to correct differences between the system and what is on the floor.',
  'Use Reports for review and export, not as the place where daily operations happen.',
]

export const workflowVisuals = [
  {
    title: 'Inbound flow',
    note: 'Goods come in, they are checked, they are entered in Stock Intake, and then they become part of live stock.',
    steps: [
      { label: 'Truck arrives', detail: 'Check delivery count, batch details, and expiry information.' },
      { label: 'GRN entered', detail: 'Save the delivery under the right partner and products.' },
      { label: 'Batch created', detail: 'The system creates live stock records for the goods received.' },
      { label: 'Risks watched', detail: 'Expiry and reorder alerts begin to work automatically.' },
    ],
  },
  {
    title: 'Outbound flow',
    note: 'Goods are selected for dispatch, batch allocation is recorded, the dispatch is confirmed, and the movement stays visible in the ledger.',
    steps: [
      { label: 'Order ready', detail: 'Create the dispatch note for the retailer and items going out.' },
      { label: 'FIFO applied', detail: 'Older available stock is used first where possible.' },
      { label: 'Gate check', detail: 'Security or operations confirms the load actually leaves.' },
      { label: 'Full trace', detail: 'The ledger keeps the history of who moved what and when.' },
    ],
  },
  {
    title: 'Count and correction flow',
    note: 'The team counts what is physically present, compares it with system stock, records any difference, and approves the final correction.',
    steps: [
      { label: 'Session opened', detail: 'The system snapshots current stock for counting.' },
      { label: 'Floor counted', detail: 'The team enters what is physically in the warehouse.' },
      { label: 'Variance reviewed', detail: 'Differences are explained instead of ignored.' },
      { label: 'Adjustment applied', detail: 'Approved corrections update the stock record properly.' },
    ],
  },
]

export const roleGuides = [
  {
    role: 'Admin',
    summary: 'Oversees setup, access, control, and final review.',
    responsibilities: [
      'Manage users, product setup, and partner setup.',
      'Review audit activity and sensitive changes.',
      'Support operations when approval or system oversight is needed.',
    ],
  },
  {
    role: 'Warehouse Manager',
    summary: 'Runs day-to-day stock control inside the warehouse.',
    responsibilities: [
      'Receive stock through GRN.',
      'Monitor expiry, low stock, and physical counts.',
      'Review stock movement and warehouse accuracy.',
    ],
  },
  {
    role: 'Operations',
    summary: 'Handles movement planning, approvals, and performance review.',
    responsibilities: [
      'Create and confirm dispatch activity.',
      'Review casualties and partner performance.',
      'Use reports to follow operational performance.',
    ],
  },
  {
    role: 'Finance',
    summary: 'Reviews numbers, risk, and reporting.',
    responsibilities: [
      'Monitor value-related reports and stock controls.',
      'Review expiry, reorder, and movement summaries.',
      'Use exports for reporting after operational work is already complete in the app.',
    ],
  },
  {
    role: 'Security',
    summary: 'Confirms outward stock movement at the gate or final control point.',
    responsibilities: [
      'Review dispatch details before release.',
      'Confirm that goods leaving match what was approved.',
      'Help maintain a clean dispatch audit trail.',
    ],
  },
]

export const pageGuides = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    purpose: 'Shows the quickest view of stock health, movement, and exceptions that need attention.',
    useWhen: 'Use this first when you want to know what needs action now.',
  },
  {
    id: 'grn',
    title: 'Stock Intake (GRN)',
    purpose: 'Records goods that have entered the warehouse and creates the stock batches the rest of the system depends on.',
    useWhen: 'Use this every time new stock arrives.',
  },
  {
    id: 'dispatch',
    title: 'Dispatch',
    purpose: 'Records goods leaving the warehouse and links the movement to the right stock batches.',
    useWhen: 'Use this every time stock is picked and sent out.',
  },
  {
    id: 'ledger',
    title: 'Ledger',
    purpose: 'Shows current stock and movement history so the team can review what happened and what remains.',
    useWhen: 'Use this to investigate stock position or movement history.',
  },
  {
    id: 'expiry',
    title: 'Expiry Tracking',
    purpose: 'Highlights batches that are close to expiry or already expired.',
    useWhen: 'Use this to prevent losses and move risky stock early.',
  },
  {
    id: 'casualties',
    title: 'Casualties',
    purpose: 'Records damaged, lost, or unusable goods that need review and approval.',
    useWhen: 'Use this when stock cannot be sold or used normally.',
  },
  {
    id: 'reorder',
    title: 'Reorder Alerts',
    purpose: 'Shows products that are low or out of stock based on the levels set for each item.',
    useWhen: 'Use this to plan replenishment before service is affected.',
  },
  {
    id: 'performance',
    title: 'Partner Performance',
    purpose: 'Shows how suppliers or brand partners are performing across stock activity.',
    useWhen: 'Use this during review meetings or supplier follow-up.',
  },
  {
    id: 'count',
    title: 'Physical Count',
    purpose: 'Helps the team compare the real warehouse count with the system and approve any correction properly.',
    useWhen: 'Use this for routine counts, spot checks, and reconciliation.',
  },
  {
    id: 'reports',
    title: 'Reports & Export',
    purpose: 'Provides reports, exports, and summaries for review, sharing, and documentation.',
    useWhen: 'Use this after warehouse activity has already been recorded in the app.',
  },
  {
    id: 'products',
    title: 'Products',
    purpose: 'Stores the product list and the rules that affect how each item behaves in the warehouse.',
    useWhen: 'Use this when adding or updating stock items.',
  },
  {
    id: 'partners',
    title: 'Brand Partners',
    purpose: 'Stores the suppliers or owners connected to the stock you manage.',
    useWhen: 'Use this when creating or reviewing partner records.',
  },
  {
    id: 'users',
    title: 'Users',
    purpose: 'Controls who can enter the system and what each person is allowed to do.',
    useWhen: 'Use this when onboarding staff or adjusting access.',
  },
  {
    id: 'admin-audit',
    title: 'Admin Audit',
    purpose: 'Shows sensitive admin activity so leadership can review who changed what and when.',
    useWhen: 'Use this when reviewing access changes or control activity.',
  },
]

export const maintenanceNote = 'Keep this page practical. When the system changes, update this guide with the new user process, not a technical changelog.'
