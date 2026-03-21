import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, Alert, Modal, Input, Select } from '../components/ui'

const LEVEL_COLOR = { expired: '#ef4444', near_expiry: '#ffb547', ok: '#00e5a0' }
const LEVEL_LABEL = { expired: 'EXPIRED', near_expiry: 'NEAR EXPIRY', ok: 'OK' }

export default function ExpiryPage() {
  const { supabase, profile } = useAuth()
  const [batches, setBatches] = useState([])
  const [filter, setFilter] = useState('all') // all | near_expiry | expired
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState({ message: '', type: 'success' })
  const [showThresholdModal, setShowThresholdModal] = useState(false)
  const [products, setProducts] = useState([])
  const [thresholdForm, setThresholdForm] = useState({ productId: '', days: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('expiry_alerts')
      .select('*')
      .order('days_until_expiry', { ascending: true })
    setBatches(data || [])

    const { data: prods } = await supabase
      .from('products')
      .select('id, name, sku_code, expiry_alert_days')
      .eq('is_active', true)
      .order('name')
    setProducts(prods || [])
    setLoading(false)
  }

  async function runExpiryUpdate() {
    await supabase.rpc('update_batch_statuses')
    showAlert('Expiry statuses refreshed.', 'success')
    loadData()
  }

  async function handleThresholdUpdate(e) {
    e.preventDefault()
    const { error } = await supabase
      .from('products')
      .update({ expiry_alert_days: parseInt(thresholdForm.days) })
      .eq('id', thresholdForm.productId)
    if (error) return showAlert(error.message, 'error')
    showAlert('Alert threshold updated.', 'success')
    setShowThresholdModal(false)
    setThresholdForm({ productId: '', days: '' })
    loadData()
  }

  function showAlert(msg, type) {
    setAlert({ message: msg, type })
    setTimeout(() => setAlert({ message: '', type: 'success' }), 4000)
  }

  function exportCSV() {
    const rows = [
      ['SKU', 'Product', 'Brand Partner', 'Batch #', 'Qty Remaining', 'Expiry Date', 'Days Until Expiry', 'Status'],
      ...displayed.map(b => [
        b.sku_code, b.product_name, b.brand_partner,
        b.batch_number || '—',
        parseFloat(b.quantity_remaining).toFixed(2),
        b.expiry_date,
        b.days_until_expiry,
        b.alert_level,
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DALA_Expiry_Report_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const q = search.toLowerCase()
  const displayed = batches.filter(b => {
    const matchFilter = filter === 'all' || b.alert_level === filter
    const matchSearch = !q || b.product_name?.toLowerCase().includes(q) || b.sku_code?.toLowerCase().includes(q) || b.brand_partner?.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const expiredCount = batches.filter(b => b.alert_level === 'expired').length
  const nearCount = batches.filter(b => b.alert_level === 'near_expiry').length

  const canEdit = ['admin', 'warehouse_manager', 'operations'].includes(profile?.role)

  return (
    <div>
      <PageHeader
        title="Expiry Tracking"
        subtitle="Monitor batch expiry dates across all active stock"
        action={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setShowThresholdModal(true)}>
                ⚙ Alert Thresholds
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={runExpiryUpdate}>↻ Refresh</Button>
            <Button variant="ghost" size="sm" onClick={exportCSV}>↓ Export CSV</Button>
          </div>
        }
      />

      <Alert message={alert.message} type={alert.type} />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <SummaryCard label="Total Tracked Batches" value={batches.length} accent="#4fc3f7" />
        <SummaryCard label="Near Expiry" value={nearCount} accent="#ffb547" />
        <SummaryCard label="Expired" value={expiredCount} accent="#ef4444" />
        <SummaryCard label="Healthy Batches" value={batches.length - nearCount - expiredCount} accent="#00e5a0" />
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', 'All'], ['near_expiry', 'Near Expiry'], ['expired', 'Expired']].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '7px 14px', borderRadius: 5, border: '1px solid',
              borderColor: filter === v ? (v === 'expired' ? '#ef4444' : v === 'near_expiry' ? '#ffb547' : '#00e5a0') : '#1a2224',
              background: filter === v ? (v === 'expired' ? 'rgba(239,68,68,0.08)' : v === 'near_expiry' ? 'rgba(255,181,71,0.08)' : 'rgba(0,229,160,0.08)') : 'transparent',
              color: filter === v ? (v === 'expired' ? '#ef4444' : v === 'near_expiry' ? '#ffb547' : '#00e5a0') : '#5a7880',
              fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
              cursor: 'pointer', textTransform: 'uppercase',
            }}>
              {label}
            </button>
          ))}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search product, SKU, brand partner..."
          style={{ padding: '8px 13px', background: '#111618', border: '1px solid #1a2224', borderRadius: 6, color: '#e0e8ea', fontFamily: 'DM Sans, sans-serif', fontSize: 13, minWidth: 240 }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#4a6068', fontFamily: 'DM Mono, monospace', fontSize: 12, padding: 24 }}>Loading...</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Product', 'Brand Partner', 'Batch #', 'Qty Remaining', 'Expiry Date', 'Days Left', 'Alert Threshold', 'Status']}
            rows={displayed.map(b => [
              <div>
                <div style={{ color: '#e0e8ea', fontWeight: 500, fontSize: 13 }}>{b.product_name}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', marginTop: 2 }}>{b.sku_code}</div>
              </div>,
              <span style={{ fontSize: 13, color: '#a8bcc0' }}>{b.brand_partner}</span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a6068' }}>{b.batch_number || '—'}</span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 13, color: '#e0e8ea' }}>
                {parseFloat(b.quantity_remaining).toFixed(2)}
              </span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                {new Date(b.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>,
              <span style={{
                fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13,
                color: b.days_until_expiry < 0 ? '#ef4444' : b.days_until_expiry <= 14 ? '#ff6b35' : b.days_until_expiry <= 30 ? '#ffb547' : '#00e5a0',
              }}>
                {b.days_until_expiry < 0 ? `${Math.abs(b.days_until_expiry)}d ago` : `${b.days_until_expiry}d`}
              </span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a6068' }}>{b.expiry_alert_days}d</span>,
              <Badge color={LEVEL_COLOR[b.alert_level]}>{LEVEL_LABEL[b.alert_level]}</Badge>,
            ])}
            empty="No batches with expiry dates found. Expiry dates are set when creating a GRN."
          />
        </Card>
      )}

      {/* Threshold modal */}
      {showThresholdModal && (
        <Modal title="Set Expiry Alert Threshold" onClose={() => setShowThresholdModal(false)}>
          <p style={{ fontSize: 13, color: '#6b8085', marginBottom: 20 }}>
            Set how many days before expiry a batch should be flagged as "Near Expiry" for a specific product.
          </p>
          <form onSubmit={handleThresholdUpdate}>
            <Select label="Product" value={thresholdForm.productId} onChange={e => {
              const prod = products.find(p => p.id === e.target.value)
              setThresholdForm({ productId: e.target.value, days: prod?.expiry_alert_days || '' })
            }} required>
              <option value="">Select product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku_code}) — current: {p.expiry_alert_days}d</option>
              ))}
            </Select>
            <Input
              label="Alert Threshold (days before expiry)"
              value={thresholdForm.days}
              onChange={e => setThresholdForm(f => ({ ...f, days: e.target.value }))}
              type="number" min="1" max="365" placeholder="e.g. 30" required
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setShowThresholdModal(false)}>Cancel</Button>
              <Button type="submit">Save Threshold →</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div style={{ background: '#111618', border: '1px solid #1a2224', borderRadius: 8, padding: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: '#e0e8ea', lineHeight: 1 }}>{value}</div>
    </div>
  )
}
