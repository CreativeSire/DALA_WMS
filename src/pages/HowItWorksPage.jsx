import { Card, Badge, PageHeader } from '../components/ui'
import { adminSetupChecklist, backupChecklist, backupRunbook, gapComparison, latestChanges, pageGuides, remainingProductionWork, roadmapPhases, roleGuides, simpleGoals, spreadsheetEliminationMatrix, systemNarrative, workflowVisuals } from '../content/howItWorks'

export default function HowItWorksPage() {
  return (
    <div>
      <PageHeader
        title="How It Works"
        subtitle="Operator manual, role guide, and current-system workflow reference"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <SectionTitle>What This System Tries To Do</SectionTitle>
          {simpleGoals.map((item, index) => (
            <Bullet key={index}>{item}</Bullet>
          ))}
        </Card>
        <Card>
          <SectionTitle>How The System Thinks</SectionTitle>
          {systemNarrative.map((item, index) => (
            <Bullet key={index}>{item}</Bullet>
          ))}
        </Card>
        <Card style={{ gridColumn: '1 / -1' }}>
          <SectionTitle>Latest System Changes</SectionTitle>
          {latestChanges.map((item, index) => (
            <Bullet key={index}>{item}</Bullet>
          ))}
        </Card>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Simple Workflow Pictures</SectionTitle>
        <div style={{ display: 'grid', gap: 18 }}>
          {workflowVisuals.map((flow) => (
            <div key={flow.title} style={{ border: '1px solid #1a2224', borderRadius: 12, padding: 18, background: '#0b0f10' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#e0e8ea', marginBottom: 12 }}>{flow.title}</div>
              <img src={flow.image} alt={flow.title} style={{ width: '100%', borderRadius: 10, border: '1px solid #1a2224', marginBottom: 12 }} />
              <div style={{ fontSize: 13, color: '#9bb0b4', lineHeight: 1.6 }}>{flow.note}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Admin Setup Checklist</SectionTitle>
        {adminSetupChecklist.map((item, index) => (
          <Bullet key={index}>{item}</Bullet>
        ))}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Spreadsheet Elimination Matrix</SectionTitle>
        <div style={{ display: 'grid', gap: 14 }}>
          {spreadsheetEliminationMatrix.map((item) => (
            <div key={item.area} style={{ border: '1px solid #1a2224', borderRadius: 8, padding: 18, background: '#0b0f10' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#e0e8ea' }}>{item.area}</div>
                <Badge color={item.priority === 'P0' ? '#ff8552' : '#4fc3f7'}>{item.priority}</Badge>
              </div>
              <Label>Spreadsheet risk</Label>
              <Bullet>{item.spreadsheetRisk}</Bullet>
              <Label style={{ marginTop: 10 }}>Current state</Label>
              <Bullet>{item.currentState}</Bullet>
              <Label style={{ marginTop: 10 }}>Next control</Label>
              <Bullet>{item.nextControl}</Bullet>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>DALA WMS vs Excel vs Inventory Ark</SectionTitle>
        <div style={{ display: 'grid', gap: 14 }}>
          {gapComparison.map((row) => (
            <div key={row.capability} style={{ border: '1px solid #1a2224', borderRadius: 8, padding: 18, background: '#0b0f10' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#e0e8ea', marginBottom: 10 }}>{row.capability}</div>
              <Label>Excel / workbook</Label>
              <Bullet>{row.excel}</Bullet>
              <Label style={{ marginTop: 10 }}>Inventory Ark public positioning</Label>
              <Bullet>{row.inventoryArk}</Bullet>
              <Label style={{ marginTop: 10 }}>DALA WMS target position</Label>
              <Bullet>{row.dala}</Bullet>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Remaining High-Value Production Work</SectionTitle>
        {remainingProductionWork.map((item, index) => (
          <Bullet key={index}>{item}</Bullet>
        ))}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Backup And Restore Runbook</SectionTitle>
        <div style={{ border: '1px solid #1a2224', borderRadius: 12, padding: 18, background: '#0b0f10', marginBottom: 16 }}>
          <img src="/workflow-backup.svg" alt="Backup and restore workflow" style={{ width: '100%', borderRadius: 10, border: '1px solid #1a2224', marginBottom: 12 }} />
          <div style={{ fontSize: 13, color: '#9bb0b4', lineHeight: 1.6 }}>
            This is the simple rule: protect the data first, store the backup clearly, test recovery safely, and never guess during an incident.
          </div>
        </div>
        <Label>Simple steps</Label>
        {backupRunbook.map((item, index) => (
          <Bullet key={index}>{item}</Bullet>
        ))}
        <Label style={{ marginTop: 14 }}>What the team must always know</Label>
        {backupChecklist.map((item, index) => (
          <Bullet key={index}>{item}</Bullet>
        ))}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Implementation Roadmap</SectionTitle>
        <div style={{ display: 'grid', gap: 14 }}>
          {roadmapPhases.map((phase) => (
            <div key={phase.phase} style={{ border: '1px solid #1a2224', borderRadius: 8, padding: 18, background: '#0b0f10' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#e0e8ea' }}>{phase.phase}: {phase.title}</div>
              </div>
              <div style={{ fontSize: 13, color: '#8aa0a6', marginBottom: 12 }}>{phase.target}</div>
              {phase.actions.map((item, index) => (
                <Bullet key={index}>{item}</Bullet>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Roles</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {roleGuides.map((role) => (
            <div key={role.role} style={{ border: '1px solid #1a2224', borderRadius: 8, padding: 18, background: '#0b0f10' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#e0e8ea' }}>{role.role}</div>
                <Badge>{role.canAccess.length} pages</Badge>
              </div>
              <div style={{ fontSize: 13, color: '#8aa0a6', marginBottom: 12 }}>{role.summary}</div>
              <Label>Primary Responsibilities</Label>
              {role.keyResponsibilities.map((item, index) => (
                <Bullet key={index}>{item}</Bullet>
              ))}
              <Label style={{ marginTop: 14 }}>Access</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {role.canAccess.map((page) => <Badge key={page} color="#4fc3f7">{page}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Pages</SectionTitle>
        <div style={{ display: 'grid', gap: 14 }}>
          {pageGuides.map((page) => (
            <div key={page.id} style={{ border: '1px solid #1a2224', borderRadius: 8, padding: 18, background: '#0b0f10' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#e0e8ea' }}>{page.title}</div>
                <Badge color="#00e5a0">{page.id}</Badge>
              </div>
              <div style={{ fontSize: 13, color: '#b5c3c7', marginBottom: 10 }}>{page.purpose}</div>
              <Label>How it works</Label>
              {page.howItWorks.map((item, index) => (
                <Bullet key={index}>{item}</Bullet>
              ))}
              <Label style={{ marginTop: 12 }}>Use when</Label>
              <div style={{ fontSize: 13, color: '#8aa0a6' }}>{page.useWhen}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#e0e8ea', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function Label({ children, style = {} }) {
  return (
    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a6068', marginBottom: 8, ...style }}>
      {children}
    </div>
  )
}

function Bullet({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ color: '#00e5a0', fontFamily: 'DM Mono, monospace' }}>+</span>
      <span style={{ fontSize: 13, color: '#a8bcc0', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}
