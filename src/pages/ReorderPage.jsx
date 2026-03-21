import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, Alert, Modal, Input } from '../components/ui'

export default function ReorderPage() {
  const { supabase, api, authMode, profile } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [allStock, setAllStock] = useState([])
  const [view, setView] = useState('alerts') // alerts | all
  const [showSetModal, setShowSetModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [newThreshold, setNewThreshold] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ message: '', type: 'success' })
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    if (authMode === 'api') {
      const [{ alerts }, { stock }] = await Promise.all([
        api.get('/api/inventory/reorder-alerts'),
        api.get('/api/inventory/stock/current'),
      ])
      setAlerts(alerts || [])
      setAllStock(stock || [])
    } else {
      const [{ data: a }, { data: s }] = await Promise.all([
        supabase.from('reorder_alerts').select('*'),
        supabase.from('current_stock').select('*').order('brand_partner'),
      ])
      setAlerts(a || [])
      setAllStock(s || [])
    }
    setLoading(false)
  }

  async function handleSetThreshold(e) {
    e.preventDefault()
    setSubmitting(true)
    if (authMode === 'api') {
      await api.patch(`/api/products/${selectedProduct.product_id}/reorder-threshold`, {
        reorder_threshold: parseFloat(newThreshold),
      })
    } else {
      const { error } = await supabase
        .from('products')
        .update({ reorder_threshold: parseFloat(newThreshold) })
        .eq('id', selectedProduct.product_id)
      if (error) { showAlert(error.message, 'error'); setSubmitting(false); return }
    }
    showAlert(`Reorder threshold updated for ${selectedProduct.product_name}.`, 'success')
    setShowSetModal(false)
    setSelectedProduct(null)
    setNewThreshold('')
    loadData()
    setSubmitting(false)
  }

  function showAlert(msg, type) {
    setAlert({ message: msg, type })
    setTimeout(() => setAlert({ message: '', type: 'success' }), 4000)
  }

  function exportCSV() {
    const data = view === 'alerts' ? filteredAlerts : filteredAll
    const rows = [
      ['SKU', 'Product', 'Brand Partner', 'Total Stock', 'Reorder Threshold', 'Shortfall', 'Status'],
      ...data.map(s => [
        s.sku_code, s.product_name, s.brand_partner,
        parseFloat(s.total_stock).toFixed(2),
        parseFloat(s.reorder_threshold || 0).toFixed(2),
        parseFloat(s.shortfall || (s.reorder_threshold - s.total_stock) || 0).toFixed(2),
        s.alert_level || (s.total_stock <= s.reorder_threshold && s.reorder_threshold > 0 ? 'low_stock' : 'ok'),
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `DALA_Reorder_Report_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const canEdit = ['admin', 'warehouse_manager', 'operations'].includes(profile?.role)
  const q = search.toLowerCase()

  const filteredAlerts = alerts.filter(a =>
    !q || a.product_name?.toLowerCase().includes(q) || a.sku_code?.toLowerCase().includes(q) || a.brand_partner?.toLowerCase().includes(q)
  )
  const filteredAll = allStock.filter(s =>
    !q || s.product_name?.toLowerCase().includes(q) || s.sku_code?.toLowerCase().includes(q) || s.brand_partner?.toLowerCase().includes(q)
  )

  const outOfStock = alerts.filter(a => a.alert_level === 'out_of_stock').length
  const lowStock = alerts.filter(a => a.alert_level === 'low_stock').length

  return (
    <div>
      <PageHeader
        title="Reorder Alerts"
        subtitle="Track stock levels against reorder thresholds"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" size="sm" onClick={exportCSV}>↓ Export CSV</Button>
            <Button variant="ghost" size="sm" onClick={loadData}>↻ Refresh</Button>
          </div>
        }
      />

      <Alert message={alert.message} type={alert.type} />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Out of Stock', value: outOfStock, accent: '#ef4444' },
          { label: 'Low Stock', value: lowStock, accent: '#ffb547' },
          { label: 'Total SKUs', value: allStock.length, accent: '#4fc3f7' },
          { label: 'SKUs with Threshold Set', value: allStock.filter(s => s.reorder_threshold > 0).length, accent: '#00e5a0' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111618', border: '1px solid #1a2224', borderRadius: 8, padding: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: '#e0e8ea' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* View toggle + search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['alerts', `Alerts Only (${alerts.length})`], ['all', `All SKUs (${allStock.length})`]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 14px', borderRadius: 5, border: '1px solid',
              borderColor: view === v ? '#00e5a0' : '#1a2224',
              background: view === v ? 'rgba(0,229,160,0.08)' : 'transparent',
              color: view === v ? '#00e5a0' : '#5a7880',
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
      ) : view === 'alerts' ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Product', 'Brand Partner', 'Unit', 'Current Stock', 'Reorder At', 'Shortfall', 'Status', canEdit ? 'Action' : '']}
            rows={filteredAlerts.map(a => [
              <div>
                <div style={{ color: '#e0e8ea', fontWeight: 500, fontSize: 13 }}>{a.product_name}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', marginTop: 2 }}>{a.sku_code}</div>
              </div>,
              a.brand_partner,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5a7880' }}>{a.unit_type}</span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14, color: a.alert_level === 'out_of_stock' ? '#ef4444' : '#ffb547' }}>
                {parseFloat(a.total_stock).toFixed(2)}
              </span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a6068' }}>
                {parseFloat(a.reorder_threshold).toFixed(2)}
              </span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: 13, color: '#ff6b35' }}>
                -{parseFloat(a.shortfall).toFixed(2)}
              </span>,
              <Badge color={a.alert_level === 'out_of_stock' ? '#ef4444' : '#ffb547'}>
                {a.alert_level === 'out_of_stock' ? 'OUT OF STOCK' : 'LOW STOCK'}
              </Badge>,
              canEdit ? (
                <Button size="sm" variant="ghost" onClick={() => {
                  setSelectedProduct(a)
                  setNewThreshold(a.reorder_threshold || '')
                  setShowSetModal(true)
                }}>
                  Edit Threshold
                </Button>
              ) : null,
            ])}
            empty="No stock alerts. All SKUs are above their reorder thresholds."
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Product', 'Brand Partner', 'Unit', 'Current Stock', 'Reorder Threshold', 'Status', canEdit ? 'Action' : '']}
            rows={filteredAll.map(s => {
              const isLow = s.reorder_threshold > 0 && s.total_stock <= s.reorder_threshold
              const isOut = s.total_stock === 0
              return [
                <div>
                  <div style={{ color: '#e0e8ea', fontWeight: 500, fontSize: 13 }}>{s.product_name}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', marginTop: 2 }}>{s.sku_code}</div>
                </div>,
                s.brand_partner,
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#5a7880' }}>{s.unit_type}</span>,
                <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14, color: isOut ? '#ef4444' : isLow ? '#ffb547' : '#00e5a0' }}>
                  {parseFloat(s.total_stock).toFixed(2)}
                </span>,
                s.reorder_threshold > 0
                  ? <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a6068' }}>{parseFloat(s.reorder_threshold).toFixed(2)}</span>
                  : <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2a3840' }}>Not set</span>,
                isOut ? <Badge color="#ef4444">OUT OF STOCK</Badge>
                  : isLow ? <Badge color="#ffb547">LOW STOCK</Badge>
                  : <Badge color="#00e5a0">OK</Badge>,
                canEdit ? (
                  <Button size="sm" variant="ghost" onClick={() => {
                    setSelectedProduct({ product_id: s.product_id, product_name: s.product_name, reorder_threshold: s.reorder_threshold })
                    setNewThreshold(s.reorder_threshold || '')
                    setShowSetModal(true)
                  }}>
                    {s.reorder_threshold > 0 ? 'Edit' : 'Set Threshold'}
                  </Button>
                ) : null,
              ]
            })}
            empty="No products found."
          />
        </Card>
      )}

      {showSetModal && selectedProduct && (
        <Modal title="Set Reorder Threshold" onClose={() => { setShowSetModal(false); setSelectedProduct(null); setNewThreshold('') }}>
          <p style={{ fontSize: 13, color: '#6b8085', marginBottom: 20 }}>
            Set the minimum stock level for <strong style={{ color: '#e0e8ea' }}>{selectedProduct.product_name}</strong>. An alert will appear on the dashboard when stock drops to or below this quantity.
          </p>
          <form onSubmit={handleSetThreshold}>
            <Input
              label="Reorder Threshold (units)"
              value={newThreshold}
              onChange={e => setNewThreshold(e.target.value)}
              type="number" min="0" step="0.01"
              placeholder="e.g. 10 (set to 0 to disable alert)"
              required
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => { setShowSetModal(false); setSelectedProduct(null); setNewThreshold('') }}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Threshold →'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
