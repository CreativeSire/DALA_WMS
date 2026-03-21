import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, Alert, Modal, Input, Select } from '../components/ui'

const STATUS_COLOR = { pending: '#ffb547', approved: '#00e5a0', rejected: '#ff6b35' }
const REASON_LABEL = { damaged: 'Damaged', expired: 'Expired', lost: 'Lost', theft: 'Theft', other: 'Other' }
const REASON_COLOR = { damaged: '#ff6b35', expired: '#ef4444', lost: '#ffb547', theft: '#a78bfa', other: '#4a6068' }

export default function CasualtyPage() {
  const { supabase, api, authMode, profile } = useAuth()
  const [casualties, setCasualties] = useState([])
  const [batches, setBatches] = useState([])
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('all') // all | pending | approved | rejected
  const [showLogModal, setShowLogModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ message: '', type: 'success' })
  const [rejectionReason, setRejectionReason] = useState('')

  const [form, setForm] = useState({ productId: '', batchId: '', reason: 'damaged', quantity: '', description: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    if (authMode === 'api') {
      const [{ casualties }, { products }] = await Promise.all([
        api.get('/api/casualties'),
        api.get('/api/products'),
      ])
      setCasualties(casualties || [])
      setProducts((products || []).filter((product) => product.is_active))
    } else {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('casualty_summary').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, sku_code').eq('is_active', true).order('name'),
      ])
      setCasualties(c || [])
      setProducts(p || [])
    }
    setLoading(false)
  }

  async function loadBatchesForProduct(productId) {
    if (authMode === 'api') {
      const { batches } = await api.get(`/api/inventory/products/${productId}/batches/available`)
      setBatches(batches || [])
    } else {
      const { data } = await supabase
        .from('stock_batches')
        .select('id, batch_number, quantity_remaining, expiry_date, status')
        .eq('product_id', productId)
        .not('status', 'in', '("depleted","written_off")')
        .gt('quantity_remaining', 0)
        .order('received_at', { ascending: true })
      setBatches(data || [])
    }
  }

  async function handleLog(e) {
    e.preventDefault()
    if (!form.batchId) return showAlert('Please select a batch.', 'error')
    const qty = parseFloat(form.quantity)
    const batch = batches.find(b => b.id === form.batchId)
    if (qty > batch?.quantity_remaining) {
      return showAlert(`Quantity exceeds available stock in this batch (${batch.quantity_remaining}).`, 'error')
    }
    setSubmitting(true)
    if (authMode === 'api') {
      await api.post('/api/casualties', {
        batchId: form.batchId,
        productId: form.productId,
        reason: form.reason,
        quantity: qty,
        description: form.description,
      })
    } else {
      const { error } = await supabase.from('casualties').insert({
        batch_id: form.batchId,
        product_id: form.productId,
        reason: form.reason,
        quantity: qty,
        description: form.description,
        logged_by: profile.id,
        status: 'pending',
      })
      if (error) { showAlert(error.message, 'error'); setSubmitting(false); return }
    }
    showAlert('Casualty logged. Awaiting approval.', 'success')
    setShowLogModal(false)
    setForm({ productId: '', batchId: '', reason: 'damaged', quantity: '', description: '' })
    setBatches([])
    loadData()
    setSubmitting(false)
  }

  async function handleApprove() {
    setSubmitting(true)
    if (authMode === 'api') {
      await api.post(`/api/casualties/${selected.id}/approve`, {})
    } else {
      const { data: casualty } = await supabase.from('casualties').select('*, stock_batches(quantity_remaining)').eq('id', selected.id).single()
      const newQty = (casualty?.stock_batches?.quantity_remaining || 0) - selected.quantity
      await supabase.from('stock_batches').update({
        quantity_remaining: Math.max(0, newQty),
        status: newQty <= 0 ? 'written_off' : 'active',
      }).eq('id', selected.batch_id)

      await supabase.from('stock_movements').insert({
        batch_id: selected.batch_id,
        product_id: selected.product_id,
        movement_type: 'write_off',
        quantity: -selected.quantity,
        unit_fraction: 1,
        balance_after: Math.max(0, newQty),
        reference_number: `CASUALTY-${selected.id.slice(0, 8).toUpperCase()}`,
        notes: `${REASON_LABEL[selected.reason]}: ${selected.description || ''}`,
        created_by: profile.id,
      })

      await supabase.from('casualties').update({
        status: 'approved',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      }).eq('id', selected.id)
    }
    showAlert(`Casualty approved. ${selected.quantity} units written off.`, 'success')
    setShowReviewModal(false)
    setSelected(null)
    loadData()
    setSubmitting(false)
  }

  async function handleReject() {
    if (!rejectionReason.trim()) return showAlert('Please enter a rejection reason.', 'error')
    setSubmitting(true)
    if (authMode === 'api') {
      await api.post(`/api/casualties/${selected.id}/reject`, { rejectionReason })
    } else {
      await supabase.from('casualties').update({
        status: 'rejected',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      }).eq('id', selected.id)
    }
    showAlert('Casualty rejected.', 'warn')
    setShowReviewModal(false)
    setSelected(null)
    setRejectionReason('')
    loadData()
    setSubmitting(false)
  }

  function showAlert(msg, type) {
    setAlert({ message: msg, type })
    setTimeout(() => setAlert({ message: '', type: 'success' }), 5000)
  }

  const canLog = ['admin', 'warehouse_manager'].includes(profile?.role)
  const canApprove = ['admin', 'operations'].includes(profile?.role)

  const displayed = casualties.filter(c => filter === 'all' || c.status === filter)
  const pendingCount = casualties.filter(c => c.status === 'pending').length

  return (
    <div>
      <PageHeader
        title="Casualty Management"
        subtitle="Log, review and approve stock write-offs"
        action={canLog && <Button onClick={() => { setShowLogModal(true); setForm({ productId: '', batchId: '', reason: 'damaged', quantity: '', description: '' }); setBatches([]) }}>+ Log Casualty</Button>}
      />

      <Alert message={alert.message} type={alert.type} />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Logged', value: casualties.length, accent: '#4fc3f7' },
          { label: 'Pending Approval', value: pendingCount, accent: '#ffb547' },
          { label: 'Approved', value: casualties.filter(c => c.status === 'approved').length, accent: '#00e5a0' },
          { label: 'Rejected', value: casualties.filter(c => c.status === 'rejected').length, accent: '#ff6b35' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111618', border: '1px solid #1a2224', borderRadius: 8, padding: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: '#e0e8ea' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '7px 14px', borderRadius: 5, border: '1px solid',
            borderColor: filter === v ? STATUS_COLOR[v] || '#00e5a0' : '#1a2224',
            background: filter === v ? `${STATUS_COLOR[v] || '#00e5a0'}12` : 'transparent',
            color: filter === v ? STATUS_COLOR[v] || '#00e5a0' : '#5a7880',
            fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
            cursor: 'pointer', textTransform: 'uppercase',
          }}>
            {label}{v === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#4a6068', fontFamily: 'DM Mono, monospace', fontSize: 12, padding: 24 }}>Loading...</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Product', 'Brand Partner', 'Batch', 'Reason', 'Qty', 'Logged By', 'Date', 'Status', 'Action']}
            rows={displayed.map(c => [
              <div>
                <div style={{ color: '#e0e8ea', fontWeight: 500, fontSize: 13 }}>{c.product_name}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068' }}>{c.sku_code}</div>
              </div>,
              <span style={{ fontSize: 13, color: '#a8bcc0' }}>{c.brand_partner}</span>,
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#5a7880' }}>{c.batch_number || 'No batch #'}</div>
                {c.expiry_date && <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068' }}>Exp: {new Date(c.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</div>}
              </div>,
              <Badge color={REASON_COLOR[c.reason]}>{REASON_LABEL[c.reason]}</Badge>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13, color: '#ff6b35' }}>
                -{parseFloat(c.quantity).toFixed(2)}
              </span>,
              <span style={{ fontSize: 12, color: '#5a7880' }}>{c.logged_by_name}</span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4a6068' }}>
                {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>,
              <div>
                <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
                {c.status === 'approved' && c.approved_by_name && (
                  <div style={{ fontSize: 10, color: '#4a6068', fontFamily: 'DM Mono, monospace', marginTop: 3 }}>by {c.approved_by_name}</div>
                )}
                {c.status === 'rejected' && c.rejection_reason && (
                  <div style={{ fontSize: 10, color: '#ff6b35', marginTop: 3, maxWidth: 120 }}>{c.rejection_reason}</div>
                )}
              </div>,
              c.status === 'pending' && canApprove ? (
                <Button size="sm" variant="secondary" onClick={() => { setSelected(c); setShowReviewModal(true); setRejectionReason('') }}>
                  Review
                </Button>
              ) : <span style={{ color: '#2a3840', fontSize: 12 }}>—</span>,
            ])}
            empty="No casualties logged yet."
          />
        </Card>
      )}

      {/* Log Casualty Modal */}
      {showLogModal && (
        <Modal title="Log Casualty / Write-Off" onClose={() => setShowLogModal(false)}>
          <form onSubmit={handleLog}>
            <Select label="Product" value={form.productId} onChange={e => {
              setForm(f => ({ ...f, productId: e.target.value, batchId: '' }))
              if (e.target.value) loadBatchesForProduct(e.target.value)
              else setBatches([])
            }} required>
              <option value="">Select product...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku_code})</option>)}
            </Select>

            {batches.length > 0 && (
              <Select label="Batch" value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))} required>
                <option value="">Select batch...</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number ? `Batch ${b.batch_number}` : 'No batch #'} — {parseFloat(b.quantity_remaining).toFixed(2)} remaining
                    {b.expiry_date ? ` — Exp: ${new Date(b.expiry_date).toLocaleDateString('en-GB')}` : ''}
                  </option>
                ))}
              </Select>
            )}
            {form.productId && batches.length === 0 && (
              <div style={{ fontSize: 13, color: '#ff6b35', marginBottom: 16, fontFamily: 'DM Mono, monospace' }}>
                No active batches found for this product.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Select label="Reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="lost">Lost</option>
                <option value="theft">Theft</option>
                <option value="other">Other</option>
              </Select>
              <Input label="Quantity to Write Off" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} type="number" min="0.01" step="0.01" placeholder="e.g. 2" required />
            </div>

            <Input label="Description / Notes" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the damage or circumstance..." />

            <div style={{ background: 'rgba(255,181,71,0.06)', border: '1px solid rgba(255,181,71,0.15)', borderRadius: 6, padding: 12, marginBottom: 20, fontSize: 12, color: '#ffb547' }}>
              ⚠ Stock will not be deducted until the casualty is approved by Operations or Admin.
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => setShowLogModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.batchId}>{submitting ? 'Saving...' : 'Log Casualty →'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Modal */}
      {showReviewModal && selected && (
        <Modal title="Review Casualty" onClose={() => { setShowReviewModal(false); setSelected(null); setRejectionReason('') }}>
          <div style={{ background: '#0b0f10', border: '1px solid #1a2224', borderRadius: 6, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <Field label="Product" value={selected.product_name} />
              <Field label="SKU" value={selected.sku_code} mono />
              <Field label="Brand Partner" value={selected.brand_partner} />
              <Field label="Batch #" value={selected.batch_number || 'No batch #'} mono />
              <Field label="Reason" value={REASON_LABEL[selected.reason]} />
              <Field label="Quantity" value={parseFloat(selected.quantity).toFixed(2)} mono />
              <Field label="Logged By" value={selected.logged_by_name} />
              <Field label="Date" value={new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>
            {selected.description && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1a2224' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#a8bcc0' }}>{selected.description}</div>
              </div>
            )}
          </div>

          <Input
            label="Rejection Reason (required if rejecting)"
            value={rejectionReason}
            onChange={e => setRejectionReason(e.target.value)}
            placeholder="Explain why this casualty is being rejected..."
          />

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="danger" onClick={handleReject} disabled={submitting}>
              {submitting ? '...' : '✕ Reject'}
            </Button>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting ? 'Processing...' : '✓ Approve Write-Off'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: mono ? 'DM Mono, monospace' : 'DM Sans, sans-serif', fontSize: 13, color: '#e0e8ea', fontWeight: mono ? 400 : 500 }}>{value}</div>
    </div>
  )
}
