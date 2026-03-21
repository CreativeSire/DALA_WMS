import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, SectionCard, Input, StatStrip } from '../components/ui'

const REPORTS = [
  { id: 'stock_summary',  label: 'Stock Summary',      icon: '◈', desc: 'Full current stock levels across all SKUs' },
  { id: 'abc',            label: 'ABC Analysis',        icon: '◉', desc: 'Classify SKUs by dispatch velocity (A/B/C)' },
  { id: 'stock_ageing',   label: 'Stock Ageing',        icon: '⏱', desc: 'How long each batch has been in the warehouse' },
  { id: 'movement_log',   label: 'Movement Log',        icon: '≡', desc: 'Full audit of all stock movements in a date range' },
  { id: 'dispatch_report',label: 'Dispatch Report',     icon: '↑', desc: 'Outbound movements by retailer and period' },
  { id: 'grn_report',     label: 'GRN Report',          icon: '↓', desc: 'All goods received in a date range' },
  { id: 'casualty_report',label: 'Casualty Report',     icon: '⚠', desc: 'Write-offs and losses by reason and period' },
  { id: 'variance_report',label: 'Count Variance Report',icon: '±', desc: 'Physical count variances from all closed sessions' },
]

export default function ReportsPage() {
  const { supabase, api, authMode } = useAuth()
  const [activeReport, setActiveReport] = useState(null)
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  async function runReport(reportId) {
    setActiveReport(reportId)
    setLoading(true)
    setReportData([])

    try {
      if (authMode === 'api') {
        const query = ['movement_log','dispatch_report','grn_report','casualty_report'].includes(reportId)
          ? `?from=${dateFrom}&to=${dateTo}`
          : ''
        const response = await api.get(`/api/reports/${reportId}${query}`)
        setReportData(formatApiReportRows(reportId, response.rows || []))
        setLoading(false)
        return
      }

      let data = []
      switch (reportId) {

        case 'stock_summary': {
          const { data: d } = await supabase.from('current_stock').select('*').order('brand_partner')
          data = (d || []).map(s => ({
            sku: s.sku_code, product: s.product_name, partner: s.brand_partner,
            category: s.category || '—', unit: s.unit_type,
            stock: parseFloat(s.total_stock).toFixed(2),
            active: s.active_batches, nearExpiry: s.near_expiry_batches, expired: s.expired_batches,
            reorderAt: s.reorder_threshold > 0 ? s.reorder_threshold : '—',
            earliestExpiry: s.earliest_expiry ? new Date(s.earliest_expiry).toLocaleDateString('en-GB') : '—',
            status: s.total_stock === 0 ? 'out_of_stock' : s.reorder_threshold > 0 && s.total_stock <= s.reorder_threshold ? 'low' : 'ok',
          }))
          break
        }

        case 'abc': {
          const { data: movements } = await supabase
            .from('stock_movements')
            .select('product_id, quantity, products(name, sku_code, brand_partners(name))')
            .eq('movement_type', 'dispatch')
          const totals = {}
          for (const m of movements || []) {
            const id = m.product_id
            if (!totals[id]) totals[id] = { product: m.products?.name, sku: m.products?.sku_code, partner: m.products?.brand_partners?.name, dispatched: 0 }
            totals[id].dispatched += Math.abs(m.quantity)
          }
          const sorted = Object.values(totals).sort((a, b) => b.dispatched - a.dispatched)
          const total = sorted.reduce((s, r) => s + r.dispatched, 0)
          let cumulative = 0
          data = sorted.map(r => {
            cumulative += r.dispatched
            const pct = total > 0 ? (cumulative / total) * 100 : 0
            return { ...r, dispatched: r.dispatched.toFixed(2), cumPct: pct.toFixed(1), class: pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C' }
          })
          break
        }

        case 'stock_ageing': {
          const { data: batches } = await supabase
            .from('stock_batches')
            .select('*, products(name, sku_code, brand_partners(name))')
            .not('status', 'in', '("depleted","written_off")')
            .gt('quantity_remaining', 0)
            .order('received_at', { ascending: true })
          const now = new Date()
          data = (batches || []).map(b => {
            const days = Math.floor((now - new Date(b.received_at)) / 86400000)
            return {
              sku: b.products?.sku_code, product: b.products?.name, partner: b.products?.brand_partners?.name,
              batch: b.batch_number || '—', qty: parseFloat(b.quantity_remaining).toFixed(2),
              receivedAt: new Date(b.received_at).toLocaleDateString('en-GB'),
              daysInStock: days,
              expiryDate: b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-GB') : '—',
              ageClass: days > 90 ? 'old' : days > 30 ? 'medium' : 'fresh',
            }
          })
          break
        }

        case 'movement_log': {
          const { data: d } = await supabase
            .from('stock_movements')
            .select('*, products(name, sku_code), profiles(full_name)')
            .gte('created_at', dateFrom + 'T00:00:00Z')
            .lte('created_at', dateTo + 'T23:59:59Z')
            .order('created_at', { ascending: false })
          data = (d || []).map(m => ({
            date: new Date(m.created_at).toLocaleDateString('en-GB'),
            time: new Date(m.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
            product: m.products?.name, sku: m.products?.sku_code,
            type: m.movement_type, qty: m.quantity, balanceAfter: m.balance_after,
            ref: m.reference_number || '—', retailer: m.retailer_name || '—',
            user: m.profiles?.full_name || '—',
          }))
          break
        }

        case 'dispatch_report': {
          const { data: d } = await supabase
            .from('dispatch_notes')
            .select('*, dispatched_by_profile:profiles!dispatched_by(full_name), dispatch_items(quantity_dispatched, products(name, sku_code))')
            .gte('created_at', dateFrom + 'T00:00:00Z')
            .lte('created_at', dateTo + 'T23:59:59Z')
            .order('created_at', { ascending: false })
          data = []
          for (const dispatch of (d || [])) {
            for (const item of (dispatch.dispatch_items || [])) {
              data.push({
                date: new Date(dispatch.created_at).toLocaleDateString('en-GB'),
                dispatch: dispatch.dispatch_number, retailer: dispatch.retailer_name,
                product: item.products?.name, sku: item.products?.sku_code,
                qty: parseFloat(item.quantity_dispatched).toFixed(2),
                status: dispatch.status, dispatchedBy: dispatch.dispatched_by_profile?.full_name || '—',
              })
            }
          }
          break
        }

        case 'grn_report': {
          const { data: d } = await supabase
            .from('grn_records')
            .select('*, brand_partners(name), profiles(full_name), grn_items(quantity_received, unit_fraction, expiry_date, products(name, sku_code))')
            .gte('created_at', dateFrom + 'T00:00:00Z')
            .lte('created_at', dateTo + 'T23:59:59Z')
            .order('created_at', { ascending: false })
          data = []
          for (const grn of (d || [])) {
            for (const item of (grn.grn_items || [])) {
              data.push({
                date: new Date(grn.created_at).toLocaleDateString('en-GB'),
                grn: grn.grn_number, partner: grn.brand_partners?.name,
                product: item.products?.name, sku: item.products?.sku_code,
                qty: parseFloat(item.quantity_received).toFixed(2),
                expiry: item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-GB') : '—',
                receivedBy: grn.profiles?.full_name || '—',
                ref: grn.delivery_note_ref || '—',
              })
            }
          }
          break
        }

        case 'casualty_report': {
          const { data: d } = await supabase
            .from('casualty_summary')
            .select('*')
            .gte('created_at', dateFrom + 'T00:00:00Z')
            .lte('created_at', dateTo + 'T23:59:59Z')
          data = (d || []).map(c => ({
            date: new Date(c.created_at).toLocaleDateString('en-GB'),
            product: c.product_name, sku: c.sku_code, partner: c.brand_partner,
            reason: c.reason, qty: parseFloat(c.quantity).toFixed(2),
            status: c.status, loggedBy: c.logged_by_name || '—',
            approvedBy: c.approved_by_name || '—',
            note: c.description || '—',
          }))
          break
        }

        case 'variance_report': {
          const { data: d } = await supabase
            .from('count_detail')
            .select('*')
            .not('variance', 'is', null)
            .neq('variance', 0)
            .order('session_ref')
          data = (d || []).map(l => ({
            session: l.session_ref, date: new Date(l.opened_at).toLocaleDateString('en-GB'),
            product: l.product_name, sku: l.sku_code, partner: l.brand_partner,
            systemQty: parseFloat(l.system_quantity).toFixed(2),
            countedQty: parseFloat(l.counted_quantity).toFixed(2),
            variance: parseFloat(l.variance).toFixed(2),
            note: l.variance_note || '—',
            status: l.session_status,
          }))
          break
        }

        default: break
      }
      setReportData(data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  function exportCSV() {
    if (!reportData.length) return
    const headers = Object.keys(reportData[0])
    const rows = [headers, ...reportData.map(r => headers.map(h => r[h] ?? ''))]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `DALA_${activeReport}_${dateFrom}_${dateTo}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const needsDates = ['movement_log','dispatch_report','grn_report','casualty_report'].includes(activeReport)
  const currentReport = REPORTS.find(r => r.id === activeReport)

  const renderTable = () => {
    if (!reportData.length) return (
      <div style={{ padding:'32px 14px', textAlign:'center', color:'#4a6068', fontFamily:'DM Mono, monospace', fontSize:12 }}>
        {loading ? 'Running report...' : 'No data for this period.'}
      </div>
    )

    switch (activeReport) {
      case 'stock_summary':
        return <Table headers={['SKU','Product','Partner','Stock','Active','Near Exp','Expired','Reorder At','Status']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>{r.sku}</span>,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            r.partner, r.stock, r.active,
            r.nearExpiry > 0 ? <Badge color="#ffb547">{r.nearExpiry}</Badge> : '—',
            r.expired > 0 ? <Badge color="#ef4444">{r.expired}</Badge> : '—',
            r.reorderAt,
            <Badge color={r.status==='out_of_stock'?'#ef4444':r.status==='low'?'#ffb547':'#00e5a0'}>
              {r.status==='out_of_stock'?'OUT':r.status==='low'?'LOW':'OK'}
            </Badge>,
          ])} />

      case 'abc':
        return <Table headers={['SKU','Product','Partner','Total Dispatched','Cum %','Class']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>{r.sku}</span>,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            r.partner,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'#00e5a0' }}>{r.dispatched}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'#4a6068' }}>{r.cumPct}%</span>,
            <Badge color={r.class==='A'?'#00e5a0':r.class==='B'?'#ffb547':'#4a6068'}>{r.class}</Badge>,
          ])} />

      case 'stock_ageing':
        return <Table headers={['SKU','Product','Partner','Batch','Qty','Received','Days In Stock','Expiry','Age']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>{r.sku}</span>,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            r.partner, r.batch,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'#e0e8ea' }}>{r.qty}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.receivedAt}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color: r.daysInStock>90?'#ff6b35':r.daysInStock>30?'#ffb547':'#00e5a0' }}>{r.daysInStock}d</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.expiryDate}</span>,
            <Badge color={r.ageClass==='old'?'#ff6b35':r.ageClass==='medium'?'#ffb547':'#00e5a0'}>{r.ageClass.toUpperCase()}</Badge>,
          ])} />

      case 'movement_log':
        return <Table headers={['Date','Time','Product','Type','Qty','Balance','Reference','User']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.date}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:10, color:'#4a6068' }}>{r.time}</span>,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            <Badge color={r.type==='grn'?'#00e5a0':r.type==='dispatch'?'#4fc3f7':r.type==='write_off'?'#ff6b35':'#ffb547'}>{r.type}</Badge>,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color: r.qty>0?'#00e5a0':'#ff6b35' }}>{r.qty>0?'+':''}{r.qty}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:12 }}>{r.balanceAfter}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>{r.ref}</span>,
            <span style={{ fontSize:12, color:'#5a7880' }}>{r.user}</span>,
          ])} />

      case 'dispatch_report':
        return <Table headers={['Date','Dispatch #','Retailer','Product','Qty','Status','By']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.date}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'#4fc3f7' }}>{r.dispatch}</span>,
            r.retailer,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'#ff6b35' }}>-{r.qty}</span>,
            <Badge color={r.status==='confirmed'?'#00e5a0':'#ffb547'}>{r.status}</Badge>,
            <span style={{ fontSize:12, color:'#5a7880' }}>{r.dispatchedBy}</span>,
          ])} />

      case 'grn_report':
        return <Table headers={['Date','GRN #','Partner','Product','Qty','Expiry','Received By','Ref']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.date}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:'#00e5a0' }}>{r.grn}</span>,
            r.partner,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'#00e5a0' }}>+{r.qty}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.expiry}</span>,
            <span style={{ fontSize:12, color:'#5a7880' }}>{r.receivedBy}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>{r.ref}</span>,
          ])} />

      case 'casualty_report':
        return <Table headers={['Date','Product','Partner','Reason','Qty','Status','Logged By']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.date}</span>,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            r.partner,
            <Badge color={r.reason==='expired'?'#ef4444':r.reason==='damaged'?'#ff6b35':'#ffb547'}>{r.reason}</Badge>,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'#ff6b35' }}>-{r.qty}</span>,
            <Badge color={r.status==='approved'?'#00e5a0':r.status==='rejected'?'#ff6b35':'#ffb547'}>{r.status}</Badge>,
            <span style={{ fontSize:12, color:'#5a7880' }}>{r.loggedBy}</span>,
          ])} />

      case 'variance_report':
        return <Table headers={['Session','Date','Product','Partner','System Qty','Counted Qty','Variance','Note','Status']}
          rows={reportData.map(r => [
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4fc3f7' }}>{r.session}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:11 }}>{r.date}</span>,
            <span style={{ color:'#e0e8ea', fontWeight:500 }}>{r.product}</span>,
            r.partner,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:12 }}>{r.systemQty}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontSize:12 }}>{r.countedQty}</span>,
            <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color: parseFloat(r.variance)>0?'#00e5a0':'#ff6b35' }}>
              {parseFloat(r.variance)>0?'+':''}{r.variance}
            </span>,
            <span style={{ fontSize:12, color:'#5a7880' }}>{r.note}</span>,
            <Badge color={STATUS_C[r.status]}>{r.status}</Badge>,
          ])} />

      default: return null
    }
  }

  const STATUS_C = { open:'#4fc3f7', submitted:'#ffb547', approved:'#00e5a0', closed:'#4a6068' }

  return (
    <div>
      <PageHeader title="Reports & Export" subtitle="Analyse stock movements, performance, and reconciliation" />

      <SectionCard
        eyebrow="Analytics"
        title="Report launcher"
        subtitle="Pick a report, apply a date range where needed, then export the exact dataset visible in the table."
        style={{ marginBottom: 24 }}
      >
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:12 }}>
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => runReport(r.id)} style={{
              background: activeReport===r.id ? 'rgba(43,227,180,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${activeReport===r.id ? 'rgba(43,227,180,0.36)' : 'rgba(126, 155, 160, 0.12)'}`,
              borderRadius:18, padding:'18px 18px', textAlign:'left', cursor:'pointer',
              transition:'all 0.15s',
            }}>
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:16 }}>{r.icon}</span>
                <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15, color: activeReport===r.id ? '#2be3b4' : '#e0e8ea' }}>{r.label}</span>
              </div>
              <div style={{ fontSize:12, color:'#70868c', lineHeight:1.5 }}>{r.desc}</div>
            </button>
          ))}
        </div>
      </SectionCard>

      {activeReport && (
        <>
          <SectionCard
            eyebrow="Execution"
            title={currentReport?.label}
            subtitle={needsDates ? 'This report is scoped by date range before export.' : 'This report is generated from the current live warehouse dataset.'}
            style={{ marginBottom: 20 }}
          >
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
            {needsDates && (
              <>
                <Input label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ marginBottom: 0, minWidth: 180 }} />
                <Input label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ marginBottom: 0, minWidth: 180 }} />
                <Button size="sm" onClick={() => runReport(activeReport)} disabled={loading}>
                  {loading ? 'Running...' : '↻ Run Report'}
                </Button>
              </>
            )}
            {reportData.length > 0 && (
              <Button size="sm" variant="ghost" onClick={exportCSV} style={{ marginLeft: needsDates ? 0 : 'auto' }}>
                ↓ Export CSV ({reportData.length} rows)
              </Button>
            )}
          </div>
          <StatStrip items={[
            { label: 'Rows', value: reportData.length, accent: '#6dc6ff' },
            { label: 'Date Filter', value: needsDates ? `${dateFrom} → ${dateTo}` : 'Live dataset', accent: '#2be3b4' },
            { label: 'Status', value: loading ? 'Running' : 'Ready', accent: loading ? '#f5b85c' : '#2be3b4' },
          ]} />
          </SectionCard>

          <Card style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #1a2224', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15, color:'#e0e8ea' }}>
                {currentReport?.label}
              </div>
              {reportData.length > 0 && (
                <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#4a6068' }}>
                  {reportData.length} row{reportData.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {renderTable()}
          </Card>
        </>
      )}
    </div>
  )
}

function formatApiReportRows(reportId, rows) {
  switch (reportId) {
    case 'stock_summary':
      return rows.map((s) => ({
        sku: s.sku_code,
        product: s.product_name,
        partner: s.brand_partner,
        category: s.category || '—',
        unit: s.unit_type,
        stock: Number(s.total_stock).toFixed(2),
        active: s.active_batches,
        nearExpiry: s.near_expiry_batches,
        expired: s.expired_batches,
        reorderAt: s.reorder_threshold > 0 ? s.reorder_threshold : '—',
        earliestExpiry: s.earliest_expiry ? new Date(s.earliest_expiry).toLocaleDateString('en-GB') : '—',
        status: Number(s.total_stock) === 0 ? 'out_of_stock' : s.reorder_threshold > 0 && Number(s.total_stock) <= Number(s.reorder_threshold) ? 'low' : 'ok',
      }))
    case 'abc': {
      const total = rows.reduce((sum, row) => sum + Number(row.dispatched || 0), 0)
      let cumulative = 0
      return rows.map((row) => {
        cumulative += Number(row.dispatched || 0)
        const pct = total > 0 ? (cumulative / total) * 100 : 0
        return {
          sku: row.sku,
          product: row.product,
          partner: row.partner,
          dispatched: Number(row.dispatched || 0).toFixed(2),
          cumPct: pct.toFixed(1),
          class: pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C',
        }
      })
    }
    case 'stock_ageing': {
      const now = new Date()
      return rows.map((row) => {
        const days = Math.floor((now - new Date(row.received_at)) / 86400000)
        return {
          sku: row.sku_code,
          product: row.product_name,
          partner: row.brand_partner,
          batch: row.batch_number || '—',
          qty: Number(row.quantity_remaining).toFixed(2),
          receivedAt: new Date(row.received_at).toLocaleDateString('en-GB'),
          daysInStock: days,
          expiryDate: row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('en-GB') : '—',
          ageClass: days > 90 ? 'old' : days > 30 ? 'medium' : 'fresh',
        }
      })
    }
    case 'movement_log':
      return rows.map((m) => ({
        date: new Date(m.created_at).toLocaleDateString('en-GB'),
        time: new Date(m.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
        product: m.products?.name,
        sku: m.products?.sku_code,
        type: m.movement_type,
        qty: m.quantity,
        balanceAfter: m.balance_after,
        ref: m.reference_number || '—',
        retailer: m.retailer_name || '—',
        user: m.profiles?.full_name || '—',
      }))
    case 'dispatch_report':
      return rows.map((r) => ({
        date: new Date(r.created_at).toLocaleDateString('en-GB'),
        dispatch: r.dispatch_number,
        retailer: r.retailer_name,
        product: r.product_name,
        sku: r.sku_code,
        qty: Number(r.quantity_dispatched).toFixed(2),
        status: r.status,
        dispatchedBy: r.dispatched_by_name || '—',
      }))
    case 'grn_report':
      return rows.map((r) => ({
        date: new Date(r.created_at).toLocaleDateString('en-GB'),
        grn: r.grn_number,
        partner: r.brand_partner_name,
        product: r.product_name,
        sku: r.sku_code,
        qty: Number(r.quantity_received).toFixed(2),
        expiry: r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('en-GB') : '—',
        receivedBy: r.received_by_name || '—',
        ref: r.delivery_note_ref || '—',
      }))
    case 'casualty_report':
      return rows.map((r) => ({
        date: new Date(r.created_at).toLocaleDateString('en-GB'),
        product: r.product_name,
        sku: r.sku_code,
        partner: r.brand_partner,
        reason: r.reason,
        qty: Number(r.quantity).toFixed(2),
        status: r.status,
        loggedBy: r.logged_by_name || '—',
        approvedBy: r.approved_by_name || '—',
        note: r.description || '—',
      }))
    case 'variance_report':
      return rows.map((r) => ({
        session: r.session_ref,
        date: new Date(r.opened_at).toLocaleDateString('en-GB'),
        product: r.product_name,
        sku: r.sku_code,
        partner: r.brand_partner,
        systemQty: Number(r.system_quantity).toFixed(2),
        countedQty: Number(r.counted_quantity).toFixed(2),
        variance: Number(r.variance).toFixed(2),
        note: r.variance_note || '—',
        status: r.session_status,
      }))
    default:
      return rows
  }
}
