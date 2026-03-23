import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, Button, Input, Select, Modal, Table, PageHeader, Alert, Badge, SectionCard, StatStrip, TextArea } from '../components/ui'
import ScanAssistCard from '../components/ScanAssistCard'
import { allocateFIFOFromBatches, getAvailableQuantity } from '../lib/inventory'
import { useIsCompact } from '../lib/useIsCompact'
import { describePackRule, getProductUnitOptions } from '../lib/units'

export default function DispatchPage() {
  const { supabase, api, authMode, profile } = useAuth()
  const isCompact = useIsCompact(860)
  const [dispatches, setDispatches] = useState([])
  const [products, setProducts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedDispatch, setSelectedDispatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({ message: '', type: 'success' })

  const [retailerName, setRetailerName] = useState('')
  const [retailerAddress, setRetailerAddress] = useState('')
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [lines, setLines] = useState([newLine()])
  const [availableBatches, setAvailableBatches] = useState({}) // productId -> batches
  const [dispatchWarnings, setDispatchWarnings] = useState([])
  const [analyzing, setAnalyzing] = useState(false)

  function newLine() { return { productId: '', quantity: '', unitFraction: '1' } }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    if (authMode === 'api') {
      const [{ dispatches }, { products }] = await Promise.all([
        api.get('/api/dispatches'),
        api.get('/api/products'),
      ])
      setDispatches(dispatches || [])
      setProducts((products || []).filter((product) => product.is_active))
      return
    }

    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('dispatch_notes')
        .select('*, profiles!dispatched_by(full_name), confirmedBy:profiles!confirmed_by(full_name)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ])
    setDispatches(d || [])
    setProducts(p || [])
  }

  async function fetchAvailableBatches(productId) {
    if (!productId) return []
    if (availableBatches[productId]) return availableBatches[productId]
    const batches = authMode === 'api'
      ? (await api.get(`/api/inventory/products/${productId}/batches/available`)).batches || []
      : (await supabase
        .from('stock_batches')
        .select('*')
        .eq('product_id', productId)
        .not('status', 'in', '("depleted","written_off")')
        .gt('quantity_remaining', 0)
        .order('received_at', { ascending: true })).data || []
    setAvailableBatches(prev => ({ ...prev, [productId]: batches }))
    return batches
  }

  function updateLine(i, field, value) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, [field]: value }
      if (field === 'productId' && value) fetchAvailableBatches(value)
      return updated
    }))
  }

  function getProductMeta(productId) {
    return products.find((item) => item.id === productId)
  }

  useEffect(() => {
    if (!showModal || authMode !== 'api') {
      setDispatchWarnings([])
      setAnalyzing(false)
      return
    }

    const validLines = lines.filter((line) => line.productId && line.quantity)
    if (!validLines.length) {
      setDispatchWarnings([])
      setAnalyzing(false)
      return
    }

    const timer = setTimeout(async () => {
      setAnalyzing(true)
      try {
        const response = await api.post('/api/dispatches/analyze', { lines: validLines })
        setDispatchWarnings(response.warnings || [])
      } catch (_error) {
        setDispatchWarnings([])
      } finally {
        setAnalyzing(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [showModal, authMode, lines])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!retailerName) return showAlert('Please enter retailer name.', 'error')
    const validLines = lines.filter(l => l.productId && l.quantity)
    if (validLines.length === 0) return showAlert('Add at least one product line.', 'error')

    // Check stock availability
    for (const line of validLines) {
      const qty = parseFloat(line.quantity) * parseFloat(line.unitFraction)
      const batches = await fetchAvailableBatches(line.productId)
      const totalAvail = getAvailableQuantity(batches)
      if (totalAvail < qty) {
        const prod = products.find(p => p.id === line.productId)
        return showAlert(`Insufficient stock for ${prod?.name}. Available: ${totalAvail.toFixed(2)}`, 'error')
      }
    }

    setLoading(true)
    try {
      if (authMode === 'api') {
        const response = await api.post('/api/dispatches', {
          retailerName,
          retailerAddress,
          notes: dispatchNotes,
          lines: validLines,
        })
        showAlert(`${response.message} Awaiting security confirmation.`, 'success')
      } else {
        const { data: dispatchNum } = await supabase.rpc('generate_dispatch_number')
        const dispatchNumber = dispatchNum || `DSP-${Date.now()}`

        const { data: dispatch, error: dErr } = await supabase.from('dispatch_notes').insert({
          dispatch_number: dispatchNumber,
          retailer_name: retailerName,
          retailer_address: retailerAddress,
          dispatched_by: profile.id,
          notes: dispatchNotes,
          status: 'pending',
        }).select().single()
        if (dErr) throw dErr

        const batchCache = {}
        for (const line of validLines) {
          const qty = parseFloat(line.quantity) * parseFloat(line.unitFraction)
          const sourceBatches = batchCache[line.productId] || await fetchAvailableBatches(line.productId)
          if (!batchCache[line.productId]) {
            batchCache[line.productId] = sourceBatches.map(batch => ({ ...batch }))
          }
          const { allocations, shortfall } = allocateFIFOFromBatches(batchCache[line.productId], qty)
          if (shortfall > 0) throw new Error('Stock allocation failed — insufficient stock.')

          for (const alloc of allocations) {
            const batch = batchCache[line.productId].find(b => b.id === alloc.batchId)
            const newQty = batch.quantity_remaining - alloc.quantity
            await supabase.from('stock_batches').update({
              quantity_remaining: newQty,
              status: newQty <= 0 ? 'depleted' : batch.status,
            }).eq('id', alloc.batchId)
            batch.quantity_remaining = newQty
            if (newQty <= 0) batch.status = 'depleted'

            await supabase.from('dispatch_items').insert({
              dispatch_id: dispatch.id,
              product_id: line.productId,
              batch_id: alloc.batchId,
              quantity_dispatched: alloc.quantity,
              unit_fraction: parseFloat(line.unitFraction),
            })

            await supabase.from('stock_movements').insert({
              batch_id: alloc.batchId,
              product_id: line.productId,
              movement_type: 'dispatch',
              quantity: -alloc.quantity,
              unit_fraction: parseFloat(line.unitFraction),
              balance_after: newQty,
              reference_number: dispatchNumber,
              retailer_name: retailerName,
              created_by: profile.id,
            })
          }
        }

        showAlert(`Dispatch ${dispatchNumber} created. Awaiting security confirmation.`, 'success')
      }
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'error')
    }
    setLoading(false)
  }

  async function handleConfirm(dispatch) {
    setLoading(true)
    if (authMode === 'api') {
      const response = await api.post(`/api/dispatches/${dispatch.id}/confirm`, {})
      showAlert(response.message, 'success')
    } else {
      await supabase.from('dispatch_notes').update({
        status: 'confirmed',
        confirmed_by: profile.id,
        confirmed_at: new Date().toISOString(),
      }).eq('id', dispatch.id)
      showAlert(`Dispatch ${dispatch.dispatch_number} confirmed by security.`, 'success')
    }
    setShowConfirmModal(false)
    setSelectedDispatch(null)
    loadData()
    setLoading(false)
  }

  function resetForm() {
    setRetailerName(''); setRetailerAddress(''); setDispatchNotes('')
    setLines([newLine()]); setAvailableBatches({}); setDispatchWarnings([])
  }

  function showAlert(message, type) {
    setAlert({ message, type })
    setTimeout(() => setAlert({ message: '', type: 'success' }), 6000)
  }

  const canConfirm = ['admin', 'security', 'operations'].includes(profile?.role)
  function resolveProductFromScan(code) {
    const normalized = code.trim().toLowerCase()
    return products.find((product) =>
      product.sku_code?.toLowerCase() === normalized
      || product.barcode_value?.toLowerCase() === normalized
      || product.internal_barcode_value?.toLowerCase() === normalized
      || (product.product_aliases || []).some((alias) => alias.toLowerCase() === normalized)
    )
  }

  async function handleScannedProduct(code) {
    const product = resolveProductFromScan(code)
    if (!product) {
      return { ok: false, message: 'No SKU matched that scan.' }
    }

    await fetchAvailableBatches(product.id)
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.productId === product.id)
      if (existingIndex >= 0) {
        return current.map((line, index) => index === existingIndex
          ? { ...line, quantity: String((Number(line.quantity || 0) + 1) || 1) }
          : line)
      }

      const emptyIndex = current.findIndex((line) => !line.productId)
      if (emptyIndex >= 0) {
        return current.map((line, index) => index === emptyIndex
          ? { ...line, productId: product.id, quantity: line.quantity || '1' }
          : line)
      }

      return [...current, { ...newLine(), productId: product.id, quantity: '1' }]
    })

    return { ok: true, message: `${product.name} added from scan.` }
  }

  const statusColor = { pending: '#ffb547', confirmed: '#00e5a0', cancelled: '#ff6b35' }

  return (
    <div>
      <PageHeader
        title="Dispatch"
        subtitle="Create and confirm outbound stock movements. FIFO is enforced automatically."
        action={['admin','operations','warehouse_manager'].includes(profile?.role) && (
          <Button onClick={() => setShowModal(true)}>+ New Dispatch</Button>
        )}
      />

      <Alert message={alert.message} type={alert.type} />

      <SectionCard
        eyebrow="Outbound Control"
        title="Dispatch queue"
        subtitle="Create dispatch notes, allocate stock FIFO, and hand loads over to security confirmation with a clean audit trail."
        style={{ marginBottom: 20 }}
      >
        <StatStrip items={[
          { label: 'Open Dispatches', value: dispatches.filter((item) => item.status === 'pending').length, accent: '#f5b85c' },
          { label: 'Confirmed', value: dispatches.filter((item) => item.status === 'confirmed').length, accent: '#2be3b4' },
          { label: 'Active SKUs', value: products.length, accent: '#6dc6ff' },
        ]} />
      </SectionCard>

      <SectionCard
        eyebrow="Mobile Workflow"
        title="How to dispatch from the floor"
        subtitle="Keep dispatch simple: prepare the order, let FIFO guide stock selection, then confirm at the gate."
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            ['1. Enter retailer', 'Start with the customer and destination.'],
            ['2. Add items', 'Choose products and quantity to move.'],
            ['3. Let FIFO guide', 'The system checks available stock and older batches first.'],
            ['4. Confirm departure', 'Security confirms the load actually left the warehouse.'],
          ].map(([title, copy]) => (
            <div key={title} style={workflowCardStyle}>
              <div style={workflowTitleStyle}>{title}</div>
              <div style={workflowCopyStyle}>{copy}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Dispatch #', 'Retailer', 'Dispatched By', 'Date', 'Status', 'Action']}
          rows={dispatches.map(d => [
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4fc3f7' }}>{d.dispatch_number}</span>,
            <div>
              <div style={{ fontWeight: 500, color: '#e0e8ea' }}>{d.retailer_name}</div>
              {d.retailer_address && <div style={{ fontSize: 11, color: '#4a6068' }}>{d.retailer_address}</div>}
            </div>,
            d.profiles?.full_name || '—',
            new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            <Badge color={statusColor[d.status] || '#4a6068'}>{d.status}</Badge>,
            d.status === 'pending' && canConfirm ? (
              <Button size="sm" variant="secondary" onClick={() => { setSelectedDispatch(d); setShowConfirmModal(true) }}>
                Confirm Load
              </Button>
            ) : (
              <span style={{ fontSize: 12, color: '#4a6068', fontFamily: 'DM Mono, monospace' }}>
                {d.status === 'confirmed' ? `✓ ${d.confirmedBy?.full_name || 'Confirmed'}` : '—'}
              </span>
            ),
          ])}
          empty="No dispatches yet. Create your first dispatch above."
        />
      </Card>

      {/* New Dispatch Modal */}
      {showModal && (
        <Modal title="New Dispatch Note" onClose={() => { setShowModal(false); resetForm() }}>
          <form onSubmit={handleSubmit}>
            <Input label="Retailer Name" value={retailerName} onChange={e => setRetailerName(e.target.value)} required placeholder="e.g. ShopRite Ikeja" />
            <Input label="Retailer Address" value={retailerAddress} onChange={e => setRetailerAddress(e.target.value)} placeholder="Optional delivery address" />

            <div style={{ marginBottom: 16 }}>
              <ScanAssistCard
                title="Scan-first dispatch"
                copy="Scan products directly into the dispatch note. DALA scan codes, supplier barcodes, SKUs, and saved aliases all work here and reduce the chance of picking the wrong SKU."
                placeholder="Scan DALA code, supplier barcode, or SKU"
                onResolve={handleScannedProduct}
              />
            </div>

            <div style={{ borderTop: '1px solid #1a2224', paddingTop: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#e0e8ea' }}>Product Lines</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#00e5a0', letterSpacing: '0.08em' }}>FIFO AUTO-ENFORCED</div>
              </div>

              {(analyzing || dispatchWarnings.length > 0) && (
                <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                  {analyzing && (
                    <div style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(212, 135, 121, 0.12)', background: 'rgba(212, 135, 121, 0.06)', color: '#d9b6af', fontSize: 13 }}>
                      Checking whether any dispatch line looks unusually large for its SKU...
                    </div>
                  )}
                  {dispatchWarnings.map((warning) => (
                    <div key={`${warning.productId}-${warning.severity}`} style={{
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${warning.severity === 'high' ? 'rgba(188, 102, 88, 0.24)' : 'rgba(210, 155, 111, 0.24)'}`,
                      background: warning.severity === 'high' ? 'rgba(188, 102, 88, 0.10)' : 'rgba(210, 155, 111, 0.08)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#f4efee' }}>{warning.productName}</div>
                        <Badge color={warning.severity === 'high' ? '#bc6658' : warning.severity === 'medium' ? '#d29b6f' : '#d48779'}>
                          {warning.severity} anomaly
                        </Badge>
                      </div>
                      <div style={{ fontSize: 13, color: '#d0c3c0', lineHeight: 1.6 }}>{warning.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {lines.map((line, i) => {
                const batches = availableBatches[line.productId] || []
                const totalAvail = getAvailableQuantity(batches)
                const product = getProductMeta(line.productId)
                const unitOptions = getProductUnitOptions(product)
                return (
                  <div key={i} style={{ background: '#0b0f10', border: '1px solid #1a2224', borderRadius: 6, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', letterSpacing: '0.1em' }}>LINE {i + 1}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {line.productId && (
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: totalAvail > 0 ? '#00e5a0' : '#ff6b35' }}>
                            {totalAvail.toFixed(2)} available
                          </span>
                        )}
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines(l => l.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: 16 }}>×</button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Select label="Product" value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)} required>
                          <option value="">Select product...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku_code})</option>)}
                        </Select>
                      </div>
                      {product && (
                        <div style={{ gridColumn: '1 / -1', marginTop: -2, marginBottom: 2, fontSize: 12, color: '#b8acab' }}>
                          Pack rule: {describePackRule(product)}
                        </div>
                      )}
                      <Input label="Quantity" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} type="number" min="0.01" step="0.01" placeholder="e.g. 5" required />
                      <Select label="Unit" value={line.unitFraction} onChange={e => updateLine(i, 'unitFraction', e.target.value)}>
                        {unitOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )
              })}
              <Button type="button" variant="ghost" size="sm" onClick={() => setLines(l => [...l, newLine()])}>
                + Add Line
              </Button>
            </div>

            <TextArea label="Notes" value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)} placeholder="Driver, vehicle, route, or retailer handling notes..." rows={3} />

            <div style={{ background: 'rgba(255,181,71,0.06)', border: '1px solid rgba(255,181,71,0.15)', borderRadius: 6, padding: 12, marginBottom: 20, fontSize: 12, color: '#ffb547' }}>
              ⚠ Dispatch will be in PENDING status until confirmed by security at gate.
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button type="button" variant="ghost" onClick={() => { setShowModal(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Processing...' : 'Create Dispatch →'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && selectedDispatch && (
        <Modal title="Confirm Load Departure" onClose={() => { setShowConfirmModal(false); setSelectedDispatch(null) }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4fc3f7', marginBottom: 8 }}>{selectedDispatch.dispatch_number}</div>
            <div style={{ fontSize: 14, color: '#e0e8ea', marginBottom: 4 }}>Retailer: <strong>{selectedDispatch.retailer_name}</strong></div>
            {selectedDispatch.retailer_address && (
              <div style={{ fontSize: 13, color: '#4a6068' }}>{selectedDispatch.retailer_address}</div>
            )}
          </div>
          <div style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 6, padding: 14, marginBottom: 20, fontSize: 13, color: '#a0c8b0' }}>
            By confirming, you are verifying that the physical load has been checked and the truck has departed the warehouse.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => { setShowConfirmModal(false); setSelectedDispatch(null) }}>Cancel</Button>
            <Button onClick={() => handleConfirm(selectedDispatch)} disabled={loading}>
              {loading ? 'Confirming...' : '✓ Confirm Load Departed'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const workflowCardStyle = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'rgba(255,255,255,0.02)',
}

const workflowTitleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 17,
  color: '#f4efee',
  marginBottom: 8,
}

const workflowCopyStyle = {
  fontSize: 13,
  lineHeight: 1.6,
  color: '#b9aeac',
}
