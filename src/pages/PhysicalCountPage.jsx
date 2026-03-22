import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, Alert, Modal, Input, SectionCard, StatStrip, SegmentedControl, TextArea } from '../components/ui'
import { planCountAdjustment } from '../lib/inventory'
import { useIsCompact } from '../lib/useIsCompact'

const STATUS_COLOR = { open:'#4fc3f7', submitted:'#ffb547', approved:'#00e5a0', closed:'#4a6068' }

export default function PhysicalCountPage() {
  const { supabase, api, authMode, profile } = useAuth()
  const isCompact = useIsCompact(860)
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
  const [varianceInsights, setVarianceInsights] = useState([])

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    setLoading(true)
    if (authMode === 'api') {
      const { sessions } = await api.get('/api/count-sessions')
      setSessions(sessions || [])
    } else {
      const { data } = await supabase
        .from('count_sessions')
        .select('*, opener:profiles!opened_by(full_name), approver:profiles!approved_by(full_name)')
        .order('opened_at', { ascending: false })
      setSessions(data || [])
    }
    setLoading(false)
  }

  async function openSession(session) {
    setActiveSession(session)
    if (authMode === 'api') {
      const detail = await api.get(`/api/count-sessions/${session.id}`)
      setActiveSession(detail.session)
      setCountLines(detail.lines || [])
      setVarianceInsights(detail.insights || [])
    } else {
      const { data } = await supabase
        .from('count_detail')
        .select('*')
        .eq('session_id', session.id)
        .order('brand_partner')
      setCountLines(data || [])
      setVarianceInsights([])
    }
  }

  async function createSession(e) {
    e.preventDefault()
    setSaving(true)
    if (authMode === 'api') {
      const response = await api.post('/api/count-sessions', { notes: newNotes })
      showAlert(response.message, 'success')
      setShowNewModal(false)
      setNewNotes('')
      await loadSessions()
      const detail = await api.get(`/api/count-sessions/${response.session.id}`)
      setActiveSession(detail.session)
      setCountLines(detail.lines || [])
      setVarianceInsights(detail.insights || [])
      setSaving(false)
      return
    }

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
    if (authMode === 'api') {
      await api.patch(`/api/count-sessions/lines/${lineId}`, { countedQuantity: qty })
    } else {
      await supabase.from('count_lines').update({
        counted_quantity: qty,
        counted_by: profile.id,
      }).eq('id', lineId)
    }
    setCountLines(prev => prev.map(l =>
      l.line_id === lineId ? { ...l, counted_quantity: qty, variance: qty === null ? null : qty - l.system_quantity } : l
    ))
  }

  async function saveVarianceNote(lineId, note) {
    if (authMode === 'api') {
      await api.patch(`/api/count-sessions/lines/${lineId}`, { varianceNote: note })
    } else {
      await supabase.from('count_lines').update({ variance_note: note }).eq('id', lineId)
    }
    setCountLines(prev => prev.map(l => l.line_id === lineId ? { ...l, variance_note: note } : l))
  }

  async function submitSession() {
    setSaving(true)
    const uncounted = countLines.filter(l => l.counted_quantity === null || l.counted_quantity === undefined)
    if (uncounted.length > 0) {
      showAlert(`${uncounted.length} SKU${uncounted.length > 1 ? 's' : ''} still uncounted. Enter 0 if empty.`, 'warn')
      setSaving(false); return
    }
    if (authMode === 'api') {
      await api.post(`/api/count-sessions/${activeSession.id}/submit`, {})
    } else {
      await supabase.from('count_sessions').update({
        status: 'submitted',
        submitted_by: profile.id,
        submitted_at: new Date().toISOString(),
      }).eq('id', activeSession.id)
    }
    showAlert('Count session submitted for approval.', 'success')
    loadSessions()
    const updated = { ...activeSession, status: 'submitted' }
    setActiveSession(updated)
    setSaving(false)
  }

  async function approveSession() {
    setSaving(true)
    try {
      if (authMode === 'api') {
        const response = await api.post(`/api/count-sessions/${activeSession.id}/approve`, {})
        showAlert(response.message, 'success')
        loadSessions()
        setActiveSession(null)
        setCountLines([])
        return
      }

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
      setVarianceInsights([])
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
          <button onClick={() => { setActiveSession(null); setCountLines([]); setVarianceInsights([]) }}
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

        <SectionCard
          eyebrow="Count Session"
          title="Count progress"
          subtitle="Track completion, isolate variances quickly, and only approve once notes explain the deltas."
          style={{ marginBottom: 18 }}
        >
          <StatStrip items={[
            { label:'Total SKUs', value: countLines.length, accent:'#4fc3f7' },
            { label:'Counted', value:`${countedLines}/${countLines.length}`, accent:'#00e5a0' },
            { label:'With Variance', value: totalVariance, accent: totalVariance > 0 ? '#ffb547' : '#4a6068' },
          ]} />
        </SectionCard>

        {varianceInsights.length > 0 && (
          <SectionCard
            eyebrow="AI Assist"
            title="Variance review help"
            subtitle="These links do not change stock. They help the approver focus on the most likely shared causes first."
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {varianceInsights.map((insight) => (
                <div key={insight.title} style={{
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${insight.severity === 'high' ? 'rgba(188, 102, 88, 0.22)' : 'rgba(210, 155, 111, 0.22)'}`,
                  background: insight.severity === 'high' ? 'rgba(188, 102, 88, 0.10)' : 'rgba(210, 155, 111, 0.08)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#f4efee' }}>{insight.title}</div>
                    <Badge color={insight.severity === 'high' ? '#bc6658' : '#d29b6f'}>{insight.severity}</Badge>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: '#d0c3c0' }}>{insight.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard style={{ marginBottom: 16 }}>
          <div style={{ display:'flex', gap:12, marginBottom:0, flexWrap:'wrap', alignItems:'flex-end' }}>
            <Input
              label="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product, SKU, brand partner..."
              style={{ marginBottom: 0, minWidth: 240, flex: '1 1 260px' }}
            />
            <SegmentedControl
              value={filterVariance ? 'variance' : 'all'}
              onChange={(next) => setFilterVariance(next === 'variance')}
              options={[
                { value: 'all', label: 'All Lines' },
                { value: 'variance', label: 'Variances Only' },
              ]}
            />
          </div>
        </SectionCard>

        {isCompact ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {displayed.length === 0 ? (
              <EmptyCard text="No lines match your filter." />
            ) : displayed.map((line) => {
              const hasVariance = line.variance !== null && line.variance !== 0
              const isPositive = line.variance > 0
              return (
                <Card key={line.line_id} style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f4efee' }}>{line.product_name}</div>
                      <div style={{ fontSize: 12, color: '#a89997', marginTop: 4 }}>{line.brand_partner}</div>
                    </div>
                    <Badge color={hasVariance ? (isPositive ? '#d48779' : '#bc6658') : '#8d7f7d'}>{line.sku_code}</Badge>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
                    <Metric label="System" value={parseFloat(line.system_quantity).toFixed(2)} />
                    <Metric label="Variance" value={line.variance !== null ? `${isPositive ? '+' : ''}${parseFloat(line.variance).toFixed(2)}` : '—'} accent={hasVariance ? (isPositive ? '#d48779' : '#bc6658') : '#8d7f7d'} />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8d7f7d', marginBottom: 8 }}>Physical Count</div>
                    {activeSession.status === 'open' && canCount ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={line.counted_quantity ?? ''}
                        onBlur={e => saveCount(line.line_id, e.target.value)}
                        placeholder="Enter counted quantity"
                        style={{ width: '100%', padding: '12px 14px', background: '#141111', border: `1px solid ${hasVariance ? '#d29b6f' : '#3b2c29'}`, borderRadius: 14, color: '#f4efee', fontFamily: 'DM Mono, monospace', fontSize: 15 }}
                      />
                    ) : (
                      <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(212, 135, 121, 0.12)', color: '#f4efee', fontFamily: 'DM Mono, monospace' }}>
                        {line.counted_quantity !== null ? parseFloat(line.counted_quantity).toFixed(2) : '—'}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8d7f7d', marginBottom: 8 }}>Variance Note</div>
                    {hasVariance && activeSession.status === 'open' && canCount ? (
                      <textarea
                        defaultValue={line.variance_note ?? ''}
                        onBlur={e => saveVarianceNote(line.line_id, e.target.value)}
                        placeholder="Explain what caused the difference..."
                        rows={3}
                        style={{ width: '100%', padding: '12px 14px', background: '#141111', border: '1px solid #3b2c29', borderRadius: 14, color: '#f4efee', fontFamily: 'DM Sans, sans-serif', fontSize: 14, resize: 'vertical' }}
                      />
                    ) : (
                      <div style={{ color: '#b9aeac', fontSize: 13, lineHeight: 1.6 }}>
                        {line.variance_note || (hasVariance ? 'Note needed before approval.' : 'No variance note needed.')}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
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
        )}
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

      <SectionCard
        eyebrow="Mobile Workflow"
        title="How to count on the floor"
        subtitle="Open the session, walk the warehouse, enter the real quantity, explain any difference, then submit for approval."
        style={{ marginBottom: 18 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            ['1. Open session', 'Freeze the system view before the team starts counting.'],
            ['2. Count physically', 'Enter the quantity seen on the floor, not what you expect.'],
            ['3. Explain variance', 'Shortages and extras need notes before approval.'],
            ['4. Approve correction', 'Only approved sessions adjust the stock record.'],
          ].map(([title, copy]) => (
            <div key={title} style={mobileWorkflowCardStyle}>
              <div style={mobileWorkflowTitleStyle}>{title}</div>
              <div style={mobileWorkflowCopyStyle}>{copy}</div>
            </div>
          ))}
        </div>
      </SectionCard>

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
            <TextArea label="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="e.g. Monthly count — March 2026, fast movers first, cold chain excluded" rows={3} />
            <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:8, flexWrap:'wrap' }}>
              <Button type="button" variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Opening...' : 'Open Count Session →'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Metric({ label, value, accent = '#d48779' }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(212, 135, 121, 0.12)', padding: 12, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8d7f7d', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: accent }}>{value}</div>
    </div>
  )
}

function EmptyCard({ text }) {
  return (
    <Card>
      <div style={{ color: '#a89997', fontSize: 13, fontFamily: 'DM Mono, monospace' }}>{text}</div>
    </Card>
  )
}

const mobileWorkflowCardStyle = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'rgba(255,255,255,0.02)',
}

const mobileWorkflowTitleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 17,
  color: '#f4efee',
  marginBottom: 8,
}

const mobileWorkflowCopyStyle = {
  fontSize: 13,
  lineHeight: 1.6,
  color: '#b9aeac',
}
