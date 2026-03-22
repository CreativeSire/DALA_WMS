import { Card, Badge, PageHeader } from '../components/ui'
import { coreRules, introGuide, maintenanceNote, pageGuides, roleGuides, victorJourney, workflowVisuals } from '../content/howItWorks'

export default function HowItWorksPage() {
  return (
    <div>
      <PageHeader
        title={introGuide.title}
        subtitle={introGuide.subtitle}
      />

      <div style={gridStyle}>
        <Card>
          <SectionTitle>Start Here</SectionTitle>
          {introGuide.promise.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </Card>

        <Card>
          <SectionTitle>Simple House Rules</SectionTitle>
          {coreRules.map((item) => (
            <Bullet key={item}>{item}</Bullet>
          ))}
        </Card>
      </div>

      <Card style={{ marginTop: 22, marginBottom: 22 }}>
        <SectionTitle>If Victor Is Using The System</SectionTitle>
        <div style={{ color: '#b9c0c2', fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
          <strong style={{ color: '#f5efee' }}>{victorJourney.name}</strong> is a <strong style={{ color: '#f5efee' }}>{victorJourney.role}</strong>. {victorJourney.summary}
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {victorJourney.steps.map((step) => (
            <div key={step.title} style={storyCardStyle}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f5efee', marginBottom: 8 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 14, color: '#b9c0c2', lineHeight: 1.7 }}>
                {step.detail}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <SectionTitle>Main Warehouse Flow</SectionTitle>
        <div style={{ display: 'grid', gap: 18 }}>
          {workflowVisuals.map((flow) => (
            <div key={flow.title} style={visualCardStyle}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f5efee', marginBottom: 12 }}>
                {flow.title}
              </div>
              <img src={flow.image} alt={flow.title} style={imageStyle} />
              <div style={{ fontSize: 14, color: '#b9c0c2', lineHeight: 1.7 }}>
                {flow.note}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <SectionTitle>Who Uses What</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {roleGuides.map((role) => (
            <div key={role.role} style={storyCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f5efee' }}>
                  {role.role}
                </div>
                <Badge color="#d48779">{role.role}</Badge>
              </div>
              <div style={{ fontSize: 14, color: '#b9c0c2', lineHeight: 1.7, marginBottom: 12 }}>
                {role.summary}
              </div>
              {role.responsibilities.map((item) => (
                <Bullet key={item}>{item}</Bullet>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <SectionTitle>Page Guide</SectionTitle>
        <div style={{ display: 'grid', gap: 14 }}>
          {pageGuides.map((page) => (
            <div key={page.id} style={storyCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f5efee' }}>
                  {page.title}
                </div>
                <Badge color="#c46d61">{page.id}</Badge>
              </div>
              <GuideLabel>What it is for</GuideLabel>
              <div style={guideTextStyle}>{page.purpose}</div>
              <GuideLabel style={{ marginTop: 12 }}>When to use it</GuideLabel>
              <div style={guideTextStyle}>{page.useWhen}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>How This Page Should Stay</SectionTitle>
        <div style={{ fontSize: 14, color: '#b9c0c2', lineHeight: 1.7 }}>
          {maintenanceNote}
        </div>
      </Card>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 21, color: '#f5efee', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function GuideLabel({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: 'DM Mono, monospace',
      fontSize: 10,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#8d746f',
      marginBottom: 8,
      ...style,
    }}>
      {children}
    </div>
  )
}

function Bullet({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
      <span style={{ color: '#d48779', fontFamily: 'DM Mono, monospace' }}>+</span>
      <span style={{ fontSize: 14, color: '#b9c0c2', lineHeight: 1.7 }}>{children}</span>
    </div>
  )
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
}

const storyCardStyle = {
  border: '1px solid rgba(171, 118, 108, 0.18)',
  borderRadius: 18,
  padding: 18,
  background: 'rgba(10, 10, 11, 0.34)',
}

const visualCardStyle = {
  border: '1px solid rgba(171, 118, 108, 0.18)',
  borderRadius: 18,
  padding: 18,
  background: 'rgba(10, 10, 11, 0.34)',
}

const imageStyle = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid rgba(171, 118, 108, 0.16)',
  marginBottom: 12,
  background: '#0a0b0d',
}

const guideTextStyle = {
  fontSize: 14,
  color: '#b9c0c2',
  lineHeight: 1.7,
}
