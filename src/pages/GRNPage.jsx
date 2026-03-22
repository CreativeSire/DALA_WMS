import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, Button, Input, Select, Modal, Table, PageHeader, Alert, Badge, SectionCard, StatStrip, TextArea } from '../components/ui'
import { useIsCompact } from '../lib/useIsCompact'

export default function GRNPage() {
  const { supabase, api, authMode, profile } = useAuth()
  const isCompact = useIsCompact(860)
  const [grns, setGrns] = useState([])
  const [partners, setPartners] = useState([])
  const [products, setProducts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({ message: '', type: 'success' })

  // Form state
  const [partnerId, setPartnerId] = useState('')
  const [deliveryRef, setDeliveryRef] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([newLine()])

  function newLine() {
    return { productId: '', batchNumber: '', expiryDate: '', quantity: '', unitFraction: '1', unitCost: '' }
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    if (authMode === 'api') {
      const [{ grns }, { partners }, { products }] = await Promise.all([
        api.get('/api/grns'),
        api.get('/api/partners'),
        api.get('/api/products'),
      ])
      setGrns(grns || [])
      setPartners((partners || []).filter((partner) => partner.is_active))
      setProducts((products || []).filter((product) => product.is_active))
      return
    }

    const [{ data: g }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from('grn_records').select('*, brand_partners(name), profiles(full_name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('brand_partners').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ])
    setGrns(g || [])
    setPartners(p || [])
    setProducts(pr || [])
  }

  function updateLine(i, field, value) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!partnerId) return showAlert('Please select a brand partner.', 'error')
    const validLines = lines.filter(l => l.productId && l.quantity)
    if (validLines.length === 0) return showAlert('Add at least one product line.', 'error')

    setLoading(true)
    try {
      if (authMode === 'api') {
        const response = await api.post('/api/grns', {
          partnerId,
          deliveryRef,
          notes,
          lines: validLines,
        })
        showAlert(response.message, 'success')
      } else {
        const { data: grnNum } = await supabase.rpc('generate_grn_number')
        const grnNumber = grnNum || `GRN-${Date.now()}`

        const { data: grn, error: grnErr } = await supabase.from('grn_records').insert({
          grn_number: grnNumber,
          brand_partner_id: partnerId,
          received_by: profile.id,
          delivery_note_ref: deliveryRef,
          notes,
          total_items: validLines.length,
        }).select().single()
        if (grnErr) throw grnErr

        for (const line of validLines) {
          const qty = parseFloat(line.quantity) * parseFloat(line.unitFraction)
          const { data: batch, error: batchErr } = await supabase.from('stock_batches').insert({
            product_id: line.productId,
            batch_number: line.batchNumber || null,
            quantity_received: qty,
            quantity_remaining: qty,
            unit_cost: line.unitCost ? parseFloat(line.unitCost) : null,
            expiry_date: line.expiryDate || null,
            grn_reference: grn.grn_number,
            created_by: profile.id,
          }).select().single()
          if (batchErr) throw batchErr

          await supabase.from('grn_items').insert({
            grn_id: grn.id,
            product_id: line.productId,
            batch_id: batch.id,
            quantity_received: qty,
            unit_fraction: parseFloat(line.unitFraction),
            batch_number: line.batchNumber || null,
            expiry_date: line.expiryDate || null,
            unit_cost: line.unitCost ? parseFloat(line.unitCost) : null,
          })

          await supabase.from('stock_movements').insert({
            batch_id: batch.id,
            product_id: line.productId,
            movement_type: 'grn',
            quantity: qty,
            unit_fraction: parseFloat(line.unitFraction),
            balance_after: qty,
            reference_number: grn.grn_number,
            created_by: profile.id,
          })
        }

        showAlert(`GRN ${grn.grn_number} created successfully.`, 'success')
      }
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'error')
    }
    setLoading(false)
  }

  function resetForm() {
    setPartnerId(''); setDeliveryRef(''); setNotes('')
    setLines([newLine()])
  }

  function showAlert(message, type) {
    setAlert({ message, type })
    setTimeout(() => setAlert({ message: '', type: 'success' }), 5000)
  }

  const partnerProducts = products.filter(p => p.brand_partner_id === partnerId)

  return (
    <div>
      <PageHeader
        title="Stock Intake (GRN)"
        subtitle="Record goods received from brand partners"
        action={<Button onClick={() => setShowModal(true)}>+ New GRN</Button>}
      />

      <Alert message={alert.message} type={alert.type} />

      <SectionCard
        eyebrow="Inbound Control"
        title="Goods receipt desk"
        subtitle="Capture each inbound load against the correct partner, SKU, batch, and expiry profile so downstream FIFO and reporting stay clean."
        style={{ marginBottom: 20 }}
      >
        <StatStrip items={[
          { label: 'Recent GRNs', value: grns.length, accent: '#6dc6ff' },
          { label: 'Partners Live', value: partners.length, accent: '#2be3b4' },
          { label: 'SKUs Ready', value: products.length, accent: '#f5b85c' },
        ]} />
      </SectionCard>

      <SectionCard
        eyebrow="Mobile Workflow"
        title="How to receive stock on the floor"
        subtitle="Use this same order each time so the receiving team does not fall back to paper or spreadsheets."
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            ['1. Pick partner', 'Choose who supplied the goods first.'],
            ['2. Add line items', 'Enter SKU, quantity, unit, batch, and expiry.'],
            ['3. Review delivery note', 'Add the delivery reference and any short notes.'],
            ['4. Save immediately', 'Once saved, live stock and reporting update.'],
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
          headers={['GRN Number', 'Brand Partner', 'Items', 'Received By', 'Date', 'Ref']}
          rows={grns.map(g => [
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#00e5a0' }}>{g.grn_number}</span>,
            g.brand_partners?.name,
            <Badge>{g.total_items} lines</Badge>,
            g.profiles?.full_name,
            new Date(g.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4a6068' }}>{g.delivery_note_ref || '—'}</span>,
          ])}
          empty="No GRNs recorded yet. Create your first stock intake above."
        />
      </Card>

      {showModal && (
        <Modal title="New Goods Received Note (GRN)" onClose={() => { setShowModal(false); resetForm() }}>
          <form onSubmit={handleSubmit}>
            <Select label="Brand Partner" value={partnerId} onChange={e => { setPartnerId(e.target.value); setLines([newLine()]) }} required>
              <option value="">Select brand partner...</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>

            <Input label="Delivery Note Reference" value={deliveryRef} onChange={e => setDeliveryRef(e.target.value)} placeholder="e.g. DN-20240301-001" />

            <div style={{ borderTop: '1px solid #1a2224', paddingTop: 20, marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#e0e8ea', marginBottom: 16 }}>
                Product Lines
              </div>

              {lines.map((line, i) => (
                <div key={i} style={{ background: '#0b0f10', border: '1px solid #1a2224', borderRadius: 6, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', letterSpacing: '0.1em' }}>LINE {i + 1}</span>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines(l => l.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: 16 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Select label="Product" value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)} required>
                        <option value="">Select product...</option>
                        {(partnerId ? partnerProducts : products).map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku_code})</option>
                        ))}
                      </Select>
                    </div>
                    <Input label="Quantity" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} type="number" min="0.01" step="0.01" placeholder="e.g. 10" required />
                    <Select label="Unit" value={line.unitFraction} onChange={e => updateLine(i, 'unitFraction', e.target.value)}>
                      <option value="1">Full Carton (1.0)</option>
                      <option value="0.5">Half Carton (0.5)</option>
                      <option value="0.25">Quarter Carton (0.25)</option>
                    </Select>
                    <Input label="Batch Number" value={line.batchNumber} onChange={e => updateLine(i, 'batchNumber', e.target.value)} placeholder="Optional" />
                    <Input label="Expiry Date" value={line.expiryDate} onChange={e => updateLine(i, 'expiryDate', e.target.value)} type="date" />
                    <Input label="Unit Cost (₦)" value={line.unitCost} onChange={e => updateLine(i, 'unitCost', e.target.value)} type="number" min="0" step="0.01" placeholder="Optional" />
                  </div>
                </div>
              ))}

              <Button type="button" variant="ghost" size="sm" onClick={() => setLines(l => [...l, newLine()])}>
                + Add Line
              </Button>
            </div>

            <TextArea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for receiving, damages, shortages, or documentation checks..." rows={3} />

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
              <Button type="button" variant="ghost" onClick={() => { setShowModal(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Create GRN →'}</Button>
            </div>
          </form>
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
