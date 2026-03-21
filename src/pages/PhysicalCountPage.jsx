import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, Alert, Modal, Input } from '../components/ui'
import { planCountAdjustment } from '../lib/inventory'

const STATUS_COLOR = { open:'#4fc3f7', submitted:'#ffb547', approved:'#00e5a0', closed:'#4a6068' }

export default function PhysicalCountPage() {
  const { supabase, profile } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [countLines, setCountLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ message:'', type:'success' })
  const [showNewModal, setShowNewModal] = useState(false)
  const [newNotes, setNewNotes] = useState('')
  const [search, setSearch] = useState('')
  const [filterVariance, setFilterVariance] = useState(false)

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('count_sessions')
      .select('*, opener:profiles!opened_by(full_name), approver:profiles!approved_by(full_name)')
      .order('opened_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  async function openSession(session) {
    setActiveSession(session)
    const { data } = await supabase
      .from('count_detail')
      .select('*')
      .eq('session_id', session.id)
      .order('brand_partner')
    setCountLines(data || [])
  }

  async function createSession(e) {
    e.preventDefault()
    setSaving(true)

    // Snapshot current system quantities for all active products
    const { data: stock } = await supabase.from('current_stock').select('*')
    const { data: countRef } = await supabase.rpc('generate_count_ref')
    const ref = countRef || `CNT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`

    const { data: session, error } = await supabase.from('count_sessions').insert({
      session_ref: ref,
      notes: newNotes,
      opened_by: profile.id,
      status: 'open',
    }).select().single()

    if (error) { showAlert(error.message, 'error'); setSaving(false); return }

    // Insert count lines with system snapshot
    if (stock && stock.length > 0) {
      const lines = stock.map(s => ({
        session_id: session.id,
        product_id: s.product_id,
        system_quantity: s.total_stock,
        counted_quantity: null,
      }))
      await supabase.from('count_lines').insert(lines)
    }

    showAlert(`Count session ${ref} opened with ${stock?.length || 0} SKUs.`, 'success')
    setShowNewModal(false)
    setNewNotes('')
    await loadSessions()
    const { data: fresh } = await supabase.from('count_sessions').select('*').eq('id', session.id).single()
    openSession(fresh)
    setSaving(false)
  }

  async function saveCount(lineId, value) {
    const qty = value === '' ? null : parseFloat(value)
    await supabase.from('count_lines').update({
      counted_quantity: qty,
      counted_by: profile.id,
    }).eq('id', lineId)
    setCountLines(prev => prev.map(l =>
      l.line_id === lineId ? { ...l, counted_quantity: qty, variance: qty === null ? null : qty - l.system_quantity } : l
    ))
  }

  async function saveVarianceNote(lineId, note) {
    await supabase.from('count_lines').update({ variance_note: note }).eq('id', lineId)
    setCountLines(prev => prev.map(l => l.line_id === lineId ? { ...l, variance_note: note } : l))
  }

  async function submitSession() {
    setSaving(true)
    const uncounted = countLines.filter(l => l.counted_quantity === null || l.counted_quantity === undefined)
    if (uncounted.length > 0) {
      showAlert(`${uncounted.length} SKU${uncounted.length > 1 ? 's' : ''} still uncounted. Enter 0 if empty.`, 'warn')
      setSaving(false); return
    }
    await supabase.from('count_sessions').update({
      status: 'submitted',
      submitted_by: profile.id,
      submitted_at: new Date().toISOString(),
    }).eq('id', activeSession.id)
    showAlert('Count session submitted for approval.', 'success')
    loadSessions()
    const updated = { ...activeSession, status: 'submitted' }
    setActiveSession(updated)
    setSaving(false)
  }

  async function approveSession() {
    setSaving(true)
    try {
      // Apply adjustments for all lines with variance that are not zero
      const variantLines = countLines.filter(l =>
        l.counted_quantity !== null && l.variance !== 0
      )

      for (const line of variantLines) {
        // Apply against the newest active batch when one exists.
        const { data: batches } = await supabase
          .from('stock_batches')
          .select('*')
          .eq('product_id', line.product_id)
          .not('status', 'in', '("depleted","written_off")')
          .order('received_at', { ascending: false })
          .limit(1)

        const plan = planCountAdjustment(line, batches || [])

        if (plan.type === 'existing-batch') {
          const batch = plan.batch
          const newQty = Math.max(0, batch.quantity_remaining + line.variance)
          await supabase.from('stock_batches').update({
            quantity_remaining: newQty,
            status: newQty <= 0 ? 'depleted' : batch.status,
          }).eq('id', batch.id)

          await supabase.from('stock_movements').insert({
            batch_id: batch.id,
            product_id: line.product_id,
            movement_type: 'adjustment',
            quantity: line.variance,
            unit_fraction: 1,
            balance_after: newQty,
            reference_number: line.session_ref,
            notes: plan.movementNote,
            created_by: profile.id,
          })
        } else if (plan.type === 'new-batch') {
          const { data: newBatch, error: batchErr } = await supabase.from('stock_batches').insert({
            product_id: line.product_id,
            batch_number: plan.batchNumber,
            quantity_received: plan.quantity,
            quantity_remaining: plan.quantity,
            location: 'Main Warehouse',
            status: 'active',
            notes: plan.batchNote,
            created_by: profile.id,
          }).select().single()

          if (batchErr) throw batchErr

          await supabase.from('stock_movements').insert({
            batch_id: newBatch.id,
            product_id: line.product_id,
            movement_type: 'adjustment',
            quantity: line.variance,
            unit_fraction: 1,
            balance_after: line.variance,
            reference_number: line.session_ref,
            notes: plan.movementNote,
            created_by: profile.id,
          })
        } else if (plan.type !== 'none') {
          throw new Error(`Unsupported adjustment plan for ${line.product_name}.`)
        }

        await supabase.from('count_lines').update({ adjustment_approved: true }).eq('id', line.line_id)
      }

      await supabase.from('count_sessions').update({
        status: 'closed',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
      }).eq('id', activeSession.id)

      showAlert(`Session approved. ${variantLines.length} adjustments applied to ledger.`, 'success')
      loadSessions()
      setActiveSession(null)
      setCountLines([])
    } catch (err) {
      showAlert(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function exportVarianceCSV() {
    const rows = [
      ['SKU', 'Product', 'Brand Partner', 'System Qty', 'Counted Qty', 'Variance', 'Note'],
      ...countLines.map(l => [
        l.sku_code, l.product_name, l.brand_partner,
        l.system_quantity,
        l.counted_quantity ?? '',
        l.variance ?? '',
        l.variance_note ?? '',
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `DALA_Count_${activeSession?.session_ref}_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function showAlert(msg, type) {
    setAlert({ message: msg, type })
    setTimeout(() => setAlert({ message:'', type:'success' }), 5000)
  }

  const canAdmin = ['admin','operations'].includes(profile?.role)
  const canCount = ['admin','warehouse_manager','operations'].includes(profile?.role)

  const q = search.toLowerCase()
  const displayed = countLines.filter(l => {
    const matchSearch = !q || l.product_name?.toLowerCase().includes(q) || l.sku_code?.toLowerCase().includes(q) || l.brand_partner?.toLowerCase().includes(q)
    const matchVariance = !filterVariance || (l.variance !== null && l.variance !== 0)
    return matchSearch && matchVariance
  })

  const totalVariance = countLines.filter(l => l.variance !== null && l.variance !== 0).length
  const countedLines = countLines.filter(l => l.counted_quantity !== null).length

  // ── Active session view ─────────────────────────────────────
  if (activeSession) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => { setActiveSession(null); setCountLines([]) }}
            style={{ background:'none', border:'none', color:'#4a6068', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:12, letterSpacing:'0.08em', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
            ← BACK TO SESSIONS
          </button>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:22, color:'#e0e8ea', letterSpacing:'-0.02em' }}>
                {activeSession.session_ref}
              </div>
              <div style={{ fontSize:13, color:'#4a6068', marginTop:4 }}>
                Opened {new Date(activeSession.opened_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                {activeSession.notes && ` · ${activeSession.notes}`}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Badge color={STATUS_COLOR[activeSession.status]}>{activeSession.status.toUpperCase()}</Badge>
              {activeSession.status === 'open' && canCount && (
                <Button size="sm" variant="ghost" onClick={exportVarianceCSV}>↓ Export</Button>
              )}
              {activeSession.status === 'open' && canCount && (
                <Button size="sm" onClick={submitSession} disabled={saving}>
                  {saving ? 'Saving...' : '→ Submit for Approval'}
                </Button>
              )}
              {activeSession.status === 'submitted' && canAdmin && (
                <Button size="sm" onClick={approveSession} disabled={saving}>
                  {saving ? 'Applying...' : '✓ Approve & Apply Adjustments'}
                </Button>
              )}
              {(activeSession.status === 'closed' || activeSession.status === 'approved') && (
                <Button size="sm" variant="ghost" onClick={exportVarianceCSV}>↓ Export Report</Button>
              )}
            </div>
          </div>
        </div>

        <Alert message={alert.message} type={alert.type} />

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Total SKUs', value: countLines.length, accent:'#4fc3f7' },
            { label:'Counted', value:`${countedLines}/${countLines.length}`, accent:'#00e5a0' },
            { label:'With Variance', value: totalVariance, accent: totalVariance > 0 ? '#ffb547' : '#4a6068' },
          ].map((s,i) => (
            <div key={i} style={{ background:'#111618', border:'1px solid #1a2224', borderRadius:8, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:s.accent }} />
              <div style={{ fontFamily:'DM Mono, monospace', fontSize:10, color:'#4a6068', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:22, color:'#e0e8ea' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search product, SKU, brand partner..."
            style={{ padding:'8px 13px', background:'#111618', border:'1px solid #1a2224', borderRadius:6, color:'#e0e8ea', fontFamily:'DM Sans, sans-serif', fontSize:13, minWidth:240 }} />
          <button onClick={() => setFilterVariance(!filterVariance)} style={{
            padding:'7px 14px', borderRadius:5, border:'1px solid',
            borderColor: filterVariance ? '#ffb547' : '#1a2224',
            background: filterVariance ? 'rgba(255,181,71,0.08)' : 'transparent',
            color: filterVariance ? '#ffb547' : '#5a7880',
            fontFamily:'DM Mono, monospace', fontSize:11, letterSpacing:'0.08em', cursor:'pointer', textTransform:'uppercase',
          }}>
            {filterVariance ? '✓ Variances Only' : 'Show Variances Only'}
          </button>
        </div>

        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['SKU','Product','Brand Partner','System Qty','Physical Count','Variance','Note'].map((h,i) => (
                    <th key={i} style={{ fontFamily:'DM Mono, monospace', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#4a6068', textAlign:'left', padding:'10px 14px', borderBottom:'1px solid #1a2224', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding:'32px 14px', textAlign:'center', color:'#4a6068', fontFamily:'DM Mono, monospace', fontSize:12 }}>No lines match your filter.</td></tr>
                ) : displayed.map((line, i) => {
                  const hasVariance = line.variance !== null && line.variance !== 0
                  const isPositive = line.variance > 0
                  return (
                    <tr key={line.line_id} style={{ borderBottom:'1px solid #131a1c', background: hasVariance ? 'rgba(255,181,71,0.03)' : 'transparent' }}>
                      <td style={{ padding:'10px 14px', fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>{line.sku_code}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ color:'#e0e8ea', fontWeight:500 }}>{line.product_name}</div>
                      </td>
                      <td style={{ padding:'10px 14px', color:'#a8bcc0', fontSize:12 }}>{line.brand_partner}</td>
                      <td style={{ padding:'10px 14px', fontFamily:'DM Mono, monospace', fontWeight:600, color:'#4fc3f7' }}>
                        {parseFloat(line.system_quantity).toFixed(2)}
                      </td>
                      <td style={{ padding:'6px 14px' }}>
                        {activeSession.status === 'open' && canCount ? (
                          <input
                            type="number" min="0" step="0.01"
                            defaultValue={line.counted_quantity ?? ''}
                            onBlur={e => saveCount(line.line_id, e.target.value)}
                            placeholder="Enter count"
                            style={{ width:110, padding:'6px 10px', background:'#0b0f10', border:`1px solid ${hasVariance ? '#ffb547' : '#1e2a2d'}`, borderRadius:5, color:'#e0e8ea', fontFamily:'DM Mono, monospace', fontSize:13 }}
                          />
                        ) : (
                          <span style={{ fontFamily:'DM Mono, monospace', color: line.counted_quantity !== null ? '#e0e8ea' : '#3a5058' }}>
                            {line.counted_quantity !== null ? parseFloat(line.counted_quantity).toFixed(2) : '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        {line.variance !== null ? (
                          <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:13, color: line.variance === 0 ? '#4a6068' : isPositive ? '#00e5a0' : '#ff6b35' }}>
                            {isPositive ? '+' : ''}{parseFloat(line.variance).toFixed(2)}
                          </span>
                        ) : <span style={{ color:'#2a3840' }}>—</span>}
                      </td>
                      <td style={{ padding:'6px 14px' }}>
                        {hasVariance && activeSession.status === 'open' && canCount ? (
                          <input
                            type="text"
                            defaultValue={line.variance_note ?? ''}
                            onBlur={e => saveVarianceNote(line.line_id, e.target.value)}
                            placeholder="Explain variance..."
                            style={{ width:180, padding:'6px 10px', background:'#0b0f10', border:'1px solid #1e2a2d', borderRadius:5, color:'#e0e8ea', fontFamily:'DM Sans, sans-serif', fontSize:12 }}
                          />
                        ) : (
                          <span style={{ fontSize:12, color:'#5a7880' }}>{line.variance_note || (hasVariance ? <span style={{ color:'#ffb547', fontSize:11 }}>Note needed</span> : '—')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    )
  }

  // ── Sessions list view ──────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Physical Count"
        subtitle="Open count sessions, enter physical counts, reconcile variances"
        action={canCount && (
          <Button onClick={() => setShowNewModal(true)}>+ New Count Session</Button>
        )}
      />

      <Alert message={alert.message} type={alert.type} />

      {loading ? (
        <div style={{ color:'#4a6068', fontFamily:'DM Mono, monospace', fontSize:12, padding:24 }}>Loading...</div>
      ) : (
        <Card style={{ padding:0, overflow:'hidden' }}>
          <Table
            headers={['Session Ref','Status','Opened By','Opened At','Notes','Action']}
            rows={sessions.map(s => [
              <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'#4fc3f7' }}>{s.session_ref}</span>,
              <Badge color={STATUS_COLOR[s.status]}>{s.status.toUpperCase()}</Badge>,
              <span style={{ fontSize:13, color:'#a8bcc0' }}>{s.opener?.full_name || '—'}</span>,
              <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>
                {new Date(s.opened_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
              </span>,
              <span style={{ fontSize:12, color:'#5a7880' }}>{s.notes || '—'}</span>,
              <Button size="sm" variant={s.status === 'open' ? 'primary' : s.status === 'submitted' ? 'secondary' : 'ghost'}
                onClick={() => openSession(s)}>
                {s.status === 'open' ? 'Continue Counting' : s.status === 'submitted' ? 'Review & Approve' : 'View Report'}
              </Button>,
            ])}
            empty="No count sessions yet. Start your first physical count above."
          />
        </Card>
      )}

      {showNewModal && (
        <Modal title="Open New Count Session" onClose={() => setShowNewModal(false)}>
          <p style={{ fontSize:13, color:'#6b8085', marginBottom:20 }}>
            This will snapshot current system stock quantities for all active SKUs. Your team then enters physical counts against each one.
          </p>
          <form onSubmit={createSession}>
            <Input label="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="e.g. Monthly count — March 2026" />
            <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:8 }}>
              <Button type="button" variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Opening...' : 'Open Count Session →'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
