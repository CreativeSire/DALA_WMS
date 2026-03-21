import { Card, Badge, PageHeader } from '../components/ui'
import { adminSetupChecklist, latestChanges, pageGuides, roleGuides, systemNarrative } from '../content/howItWorks'

export default function HowItWorksPage() {
  return (
    <div>
      <PageHeader
        title="How It Works"
        subtitle="Operator manual, role guide, and current-system workflow reference"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <SectionTitle>System Model</SectionTitle>
          {systemNarrative.map((item, index) => (
            <Bullet key={index}>{item}</Bullet>
          ))}
        </Card>
        <Card>
          <SectionTitle>Latest System Changes</SectionTitle>
          {latestChanges.map((item, index) => (
            <Bullet key={index}>{item}</Bullet>
          ))}
        </Card>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <SectionTitle>Admin Setup Checklist</SectionTitle>
        {adminSetupChecklist.map((item, index) => (
          <Bullet key={index}>{item}</Bullet>
        ))}
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
