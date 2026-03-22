import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Badge, Button, Card, EmptyState, Input, PageHeader, SectionCard, StatStrip } from '../components/ui'
import { useIsCompact } from '../lib/useIsCompact'

export default function Dashboard({ setPage }) {
  const { supabase, api, authMode, profile } = useAuth()
  const isCompact = useIsCompact(860)
  const [data, setData] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    nearExpiry: 0,
    expired: 0,
    pendingCasualties: 0,
    recentMovements: [],
    stockAlerts: [],
    expiryAlerts: [],
    moveFirstBatches: [],
  })
  const [opsSummary, setOpsSummary] = useState(null)
  const [summaryState, setSummaryState] = useState({ preferences: null, deliveries: [] })
  const [savingSummaryPrefs, setSavingSummaryPrefs] = useState(false)
  const [sendingSummary, setSendingSummary] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (authMode === 'api') {
      const [dashboard, summary, deliveryState] = await Promise.all([
        api.get('/api/inventory/dashboard'),
        api.get('/api/inventory/ops-summary'),
        api.get('/api/inventory/ops-summary/preferences'),
      ])
      setData(dashboard)
      setOpsSummary(summary)
      setSummaryState(deliveryState)
      setLoading(false)
      return
    }

    const [
      { count: totalProducts },
      { data: reorderData },
      { data: expiryData },
      { count: pendingCasualties },
      { data: movements },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reorder_alerts').select('*'),
      supabase.from('expiry_alerts').select('*').in('alert_level', ['near_expiry', 'expired']).order('days_until_expiry', { ascending: true }).limit(6),
      supabase.from('casualties').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('stock_movements').select('*, products(name,sku_code), profiles(full_name)').order('created_at', { ascending: false }).limit(8),
    ])

    setData({
      totalProducts: totalProducts || 0,
      lowStock: (reorderData || []).filter((item) => item.alert_level === 'low_stock').length,
      outOfStock: (reorderData || []).filter((item) => item.alert_level === 'out_of_stock').length,
      nearExpiry: (expiryData || []).filter((item) => item.alert_level === 'near_expiry').length,
      expired: (expiryData || []).filter((item) => item.alert_level === 'expired').length,
      pendingCasualties: pendingCasualties || 0,
      recentMovements: movements || [],
      stockAlerts: reorderData || [],
      expiryAlerts: expiryData || [],
      moveFirstBatches: [],
    })
    setOpsSummary(null)
    setLoading(false)
  }

  async function updateSummaryPrefs(patch) {
    if (authMode !== 'api') return
    setSavingSummaryPrefs(true)
    try {
      const { preferences } = await api.patch('/api/inventory/ops-summary/preferences', patch)
      setSummaryState((prev) => ({ ...prev, preferences }))
    } finally {
      setSavingSummaryPrefs(false)
    }
  }

  async function sendSummaryNow() {
    if (authMode !== 'api') return
    setSendingSummary(true)
    try {
      const result = await api.post('/api/inventory/ops-summary/send-now', {})
      setOpsSummary(result.summary)
      const refreshed = await api.get('/api/inventory/ops-summary/preferences')
      setSummaryState(refreshed)
    } finally {
      setSendingSummary(false)
    }
  }

  const totalAlerts = data.lowStock + data.outOfStock + data.nearExpiry + data.expired + data.pendingCasualties
  const tasks = [
    { label: 'Out of stock', value: data.outOfStock, page: 'reorder', color: '#bc6658' },
    { label: 'Low stock', value: data.lowStock, page: 'reorder', color: '#d29b6f' },
    { label: 'Near expiry', value: data.nearExpiry, page: 'expiry', color: '#d48779' },
    { label: 'Expired', value: data.expired, page: 'expiry', color: '#bc6658' },
    { label: 'Pending write-offs', value: data.pendingCasualties, page: 'casualties', color: '#b285a9' },
    ...((opsSummary?.taskWarnings || []).map((warning) => ({
      label: warning.title,
      value: 'AI',
      page: warning.page,
      color: '#6dc6ff',
      detail: warning.detail,
    }))),
  ]
  const activeTasks = tasks.filter((task) => task.value > 0)

  return (
    <div>
      <PageHeader
        title={`Good ${getGreeting()}, ${profile?.full_name?.split(' ')[0] || 'Team'}`}
        subtitle={totalAlerts > 0
          ? `${totalAlerts} items need attention today. Start with the task queue below.`
          : 'The warehouse is stable right now. Use the quick actions below to continue work.'}
      />

      <SectionCard
        eyebrow="Today"
        title="Warehouse command view"
        subtitle="Use this page to know what needs action now, move to the right module quickly, and keep daily warehouse work from drifting into manual follow-up."
        style={{ marginBottom: 18 }}
      >
        <StatStrip items={[
          { label: 'Active SKUs', value: loading ? '—' : data.totalProducts, accent: '#c7a484' },
          { label: 'Attention Items', value: loading ? '—' : totalAlerts, accent: totalAlerts > 0 ? '#d48779' : '#8d7f7d' },
          { label: 'Recent Movements', value: loading ? '—' : data.recentMovements.length, accent: '#d48779' },
        ]} />
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.1fr 0.9fr', gap: 16, marginBottom: 18 }}>
        <SectionCard
          eyebrow="Quick Actions"
          title="Move fast"
          subtitle="Start the right warehouse task without searching through the whole menu."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <ActionCard label="Receive stock" copy="Open GRN" onClick={() => setPage('grn')} />
            <ActionCard label="Send stock out" copy="Open Dispatch" onClick={() => setPage('dispatch')} />
            <ActionCard label="Count warehouse" copy="Open Physical Count" onClick={() => setPage('count')} />
            <ActionCard label="Review reports" copy="Open Reports" onClick={() => setPage('reports')} />
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Task Queue"
          title="What needs action"
          subtitle="This should replace the habit of checking separate sheets before acting."
        >
          {loading ? (
            <SkeletonList />
          ) : activeTasks.length === 0 ? (
            <EmptyState title="No urgent tasks" copy="Low stock, expiry risk, and pending write-offs are under control right now." />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {activeTasks.map((task) => (
                <TaskRow key={task.label} task={task} onOpen={() => setPage(task.page)} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {authMode === 'api' && summaryState.preferences && (
        <SectionCard
          eyebrow="Delivery"
          title="Daily manager brief"
          subtitle="Choose whether the daily ops summary lands inside the app, by email, or both."
          style={{ marginBottom: 18 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <ToggleCard
                title="In-app summary"
                copy="Save the daily brief inside your dashboard."
                active={summaryState.preferences.in_app_enabled}
                onToggle={() => updateSummaryPrefs({ in_app_enabled: !summaryState.preferences.in_app_enabled })}
                disabled={savingSummaryPrefs}
              />
              <ToggleCard
                title="Email summary"
                copy="Send the same brief to your email address."
                active={summaryState.preferences.email_enabled}
                onToggle={() => updateSummaryPrefs({ email_enabled: !summaryState.preferences.email_enabled })}
                disabled={savingSummaryPrefs}
              />
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#bbaead' }}>Delivery hour</div>
                <Input
                  value={summaryState.preferences.delivery_hour}
                  onChange={(event) => updateSummaryPrefs({ delivery_hour: Number(event.target.value || 0) })}
                  type="number"
                  min="0"
                  max="23"
                />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button size="sm" onClick={sendSummaryNow} disabled={sendingSummary}>
                  {sendingSummary ? 'Sending…' : 'Send today’s brief now'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {(summaryState.deliveries || []).length === 0 ? (
                <EmptyState title="No summary delivered yet" copy="Once the daily brief runs, recent in-app and email deliveries will appear here." />
              ) : summaryState.deliveries.slice(0, 5).map((delivery) => (
                <div key={delivery.id} style={deliveryRowStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#f4efee' }}>
                      {delivery.channel === 'email' ? 'Email brief' : 'In-app brief'}
                    </div>
                    <Badge color={delivery.delivery_status === 'sent' ? '#2be3b4' : '#d48779'}>{delivery.delivery_status}</Badge>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#c2b7b5' }}>
                    {delivery.summary_date}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#b8acab', lineHeight: 1.6 }}>
                    {delivery.summary?.headline || 'Daily ops summary delivered.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {opsSummary && (
        <SectionCard
          eyebrow="AI Assist"
          title="Daily ops summary"
          subtitle={opsSummary.headline}
          style={{ marginBottom: 18 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.1fr 0.9fr', gap: 16 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              {opsSummary.summaryLines.map((line) => (
                <div key={line} style={summaryLineStyle}>{line}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {opsSummary.priorities.length === 0 ? (
                <EmptyState title="No urgent manager actions" copy="The summary does not see any urgent stock-control work right now." />
              ) : opsSummary.priorities.map((priority) => (
                <button key={priority.title} type="button" onClick={() => setPage(priority.page)} style={priorityCardStyle}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#f4efee', marginBottom: 6 }}>{priority.title}</div>
                  <div style={{ fontSize: 13, color: '#c2b7b5', lineHeight: 1.6 }}>{priority.detail}</div>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <SectionCard
          eyebrow="Stock Risk"
          title="Reorder watch"
          subtitle="Products at risk of going low or empty."
        >
          {loading ? <SkeletonList /> : data.stockAlerts.length === 0 ? <EmptyState title="Stock levels healthy" copy="No low-stock or out-of-stock items are waiting here." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {data.stockAlerts.slice(0, 5).map((item) => (
                <InfoRow
                  key={`${item.product_id}-${item.alert_level}`}
                  title={item.product_name}
                  sub={item.brand_partner}
                  badgeLabel={item.alert_level === 'out_of_stock' ? 'Out' : 'Low'}
                  badgeColor={item.alert_level === 'out_of_stock' ? '#bc6658' : '#d29b6f'}
                  meta={`${parseFloat(item.total_stock).toFixed(1)} left`}
                />
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Button variant="ghost" size="sm" onClick={() => setPage('reorder')}>Open Reorder Alerts</Button>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Expiry Risk"
          title="Move these first"
          subtitle="Batches close to expiry should be visible before they become a write-off."
        >
          {loading ? <SkeletonList /> : data.moveFirstBatches.length === 0 ? <EmptyState title="Expiry under control" copy="No priority batches are waiting here." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {data.moveFirstBatches.slice(0, 5).map((item) => (
                <InfoRow
                  key={`${item.productId}-${item.batchNumber}-${item.score}`}
                  title={item.productName}
                  sub={item.batchNumber ? `Batch ${item.batchNumber}` : 'No batch number'}
                  badgeLabel="Move first"
                  badgeColor={item.daysUntilExpiry != null && item.daysUntilExpiry < 0 ? '#bc6658' : '#d29b6f'}
                  meta={item.reason}
                />
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Button variant="ghost" size="sm" onClick={() => setPage('expiry')}>Open Expiry Tracking</Button>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Recent Activity"
          title="Latest movement"
          subtitle="Quick view of who moved stock most recently."
        >
          {loading ? <SkeletonList /> : data.recentMovements.length === 0 ? <EmptyState title="No movements yet" copy="Stock movements will appear here after receipts, dispatches, and adjustments." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {data.recentMovements.slice(0, 5).map((item) => (
                <InfoRow
                  key={item.id || `${item.reference_number}-${item.created_at}`}
                  title={item.products?.name || 'Unknown product'}
                  sub={`${item.profiles?.full_name || 'Unknown user'} · ${new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  badgeLabel={(item.movement_type || 'move').replace('_', ' ')}
                  badgeColor={movementColor(item.movement_type)}
                  meta={`${item.quantity > 0 ? '+' : ''}${parseFloat(item.quantity).toFixed(2)}`}
                />
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Button variant="ghost" size="sm" onClick={() => setPage('ledger')}>Open Ledger</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function ActionCard({ label, copy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 18,
        padding: 16,
        border: '1px solid rgba(212, 135, 121, 0.12)',
        background: 'rgba(255,255,255,0.02)',
        color: '#f4efee',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#b9aeac' }}>{copy}</div>
    </button>
  )
}

function TaskRow({ task, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        border: `1px solid ${task.color}20`,
        background: `${task.color}10`,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#f4efee' }}>{task.label}</div>
          <div style={{ fontSize: 12, color: '#c2b7b5' }}>{task.detail || 'Open the related module now'}</div>
        </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Badge color={task.color}>{task.value}</Badge>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: task.color }}>OPEN</span>
      </div>
    </button>
  )
}

function ToggleCard({ title, copy, active, onToggle, disabled }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled} style={{
      borderRadius: 16,
      padding: 14,
      border: `1px solid ${active ? 'rgba(43,227,180,0.22)' : 'rgba(212,135,121,0.12)'}`,
      background: active ? 'rgba(43,227,180,0.08)' : 'rgba(255,255,255,0.02)',
      textAlign: 'left',
      cursor: 'pointer',
      opacity: disabled ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#f4efee' }}>{title}</div>
        <Badge color={active ? '#2be3b4' : '#8d7f7d'}>{active ? 'On' : 'Off'}</Badge>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#b8acab', lineHeight: 1.6 }}>{copy}</div>
    </button>
  )
}

function InfoRow({ title, sub, badgeLabel, badgeColor, meta }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(212, 135, 121, 0.08)' }}>
      <div>
        <div style={{ fontSize: 14, color: '#f4efee', fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9d8f8d', marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <Badge color={badgeColor}>{badgeLabel}</Badge>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#d0c2bf' }}>{meta}</span>
      </div>
    </div>
  )
}

function SkeletonList() {
  return <div>{[1, 2, 3].map((item) => <div key={item} style={{ height: 16, background: '#26201f', borderRadius: 6, marginBottom: 10, opacity: 1 - item * 0.18 }} />)}</div>
}

const summaryLineStyle = {
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'rgba(255,255,255,0.02)',
  color: '#cdbfbc',
  fontSize: 14,
  lineHeight: 1.6,
}

const priorityCardStyle = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(212, 135, 121, 0.14)',
  background: 'rgba(212, 135, 121, 0.08)',
  textAlign: 'left',
  cursor: 'pointer',
}

const deliveryRowStyle = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'rgba(255,255,255,0.02)',
}

function movementColor(type) {
  return {
    grn: '#d48779',
    dispatch: '#c7a484',
    adjustment: '#d29b6f',
    write_off: '#bc6658',
    transfer: '#b285a9',
  }[type] || '#8d7f7d'
}

function getGreeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}
