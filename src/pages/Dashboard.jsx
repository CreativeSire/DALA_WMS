import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, Badge } from '../components/ui'

export default function Dashboard({ setPage }) {
  const { supabase, profile } = useAuth()
  const [data, setData] = useState({ totalProducts:0, lowStock:0, outOfStock:0, nearExpiry:0, expired:0, pendingCasualties:0, recentMovements:[], stockAlerts:[], expiryAlerts:[] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [
      { count: totalProducts },
      { data: reorderData },
      { data: expiryData },
      { count: pendingCasualties },
      { data: movements },
    ] = await Promise.all([
      supabase.from('products').select('*', { count:'exact', head:true }).eq('is_active', true),
      supabase.from('reorder_alerts').select('*'),
      supabase.from('expiry_alerts').select('*').in('alert_level', ['near_expiry','expired']).order('days_until_expiry', { ascending:true }).limit(6),
      supabase.from('casualties').select('*', { count:'exact', head:true }).eq('status', 'pending'),
      supabase.from('stock_movements').select('*, products(name,sku_code), profiles(full_name)').order('created_at', { ascending:false }).limit(8),
    ])
    setData({
      totalProducts: totalProducts || 0,
      lowStock: (reorderData||[]).filter(r => r.alert_level==='low_stock').length,
      outOfStock: (reorderData||[]).filter(r => r.alert_level==='out_of_stock').length,
      nearExpiry: (expiryData||[]).filter(e => e.alert_level==='near_expiry').length,
      expired: (expiryData||[]).filter(e => e.alert_level==='expired').length,
      pendingCasualties: pendingCasualties || 0,
      recentMovements: movements || [],
      stockAlerts: reorderData || [],
      expiryAlerts: expiryData || [],
    })
    setLoading(false)
  }

  const TC = { grn:'#00e5a0', dispatch:'#4fc3f7', adjustment:'#ffb547', write_off:'#ff6b35', transfer:'#a78bfa' }
  const TL = { grn:'GRN', dispatch:'Dispatch', adjustment:'Adjust', write_off:'Write-Off', transfer:'Transfer' }
  const totalAlerts = data.lowStock + data.outOfStock + data.nearExpiry + data.expired + data.pendingCasualties

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:22, color:'#e0e8ea', letterSpacing:'-0.02em' }}>
          Good {getGreeting()}, {profile?.full_name?.split(' ')[0]}
        </div>
        <div style={{ fontSize:13, color:'#4a6068', marginTop:4 }}>
          {totalAlerts > 0 ? `${totalAlerts} item${totalAlerts>1?'s':''} need${totalAlerts===1?'s':''} your attention today.` : 'All systems healthy — warehouse looking good.'}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(145px,1fr))', gap:12, marginBottom:24 }}>
        <SC label="Active SKUs"       value={loading?'—':data.totalProducts} accent="#4fc3f7" />
        <SC label="Out of Stock"      value={loading?'—':data.outOfStock}    accent="#ef4444" alert={data.outOfStock>0}      nav="reorder"     setPage={setPage} />
        <SC label="Low Stock"         value={loading?'—':data.lowStock}      accent="#ffb547" alert={data.lowStock>0}        nav="reorder"     setPage={setPage} />
        <SC label="Near Expiry"       value={loading?'—':data.nearExpiry}    accent="#ff6b35" alert={data.nearExpiry>0}      nav="expiry"      setPage={setPage} />
        <SC label="Expired"           value={loading?'—':data.expired}       accent="#ef4444" alert={data.expired>0}         nav="expiry"      setPage={setPage} />
        <SC label="Pending Write-offs" value={loading?'—':data.pendingCasualties} accent="#a78bfa" alert={data.pendingCasualties>0} nav="casualties" setPage={setPage} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:16 }}>

        <Card>
          <SectionHeader label="🔔 Reorder Alerts" page="reorder" setPage={setPage} />
          {loading ? <Skel /> : data.stockAlerts.length===0 ? <Empty text="All stock levels healthy ✓" /> :
            data.stockAlerts.slice(0,5).map((s,i) => (
              <Row key={i} last={i>=Math.min(data.stockAlerts.length,5)-1}>
                <div>
                  <div style={{ fontSize:13, color:'#e0e8ea', fontWeight:500 }}>{s.product_name}</div>
                  <div style={{ fontSize:11, color:'#4a6068', fontFamily:'DM Mono, monospace', marginTop:1 }}>{s.brand_partner}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'flex-end' }}>
                  <Badge color={s.alert_level==='out_of_stock'?'#ef4444':'#ffb547'}>{s.alert_level==='out_of_stock'?'OUT':'LOW'}</Badge>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:'#ff6b35' }}>{parseFloat(s.total_stock).toFixed(1)} left</span>
                </div>
              </Row>
            ))}
        </Card>

        <Card>
          <SectionHeader label="⏱ Expiry Alerts" page="expiry" setPage={setPage} />
          {loading ? <Skel /> : data.expiryAlerts.length===0 ? <Empty text="No near-expiry or expired batches ✓" /> :
            data.expiryAlerts.map((e,i) => (
              <Row key={i} last={i>=data.expiryAlerts.length-1}>
                <div>
                  <div style={{ fontSize:13, color:'#e0e8ea', fontWeight:500 }}>{e.product_name}</div>
                  <div style={{ fontSize:11, color:'#4a6068', fontFamily:'DM Mono, monospace', marginTop:1 }}>
                    {e.batch_number?`Batch ${e.batch_number}`:'No batch #'} · {parseFloat(e.quantity_remaining).toFixed(1)} left
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'flex-end' }}>
                  <Badge color={e.alert_level==='expired'?'#ef4444':'#ffb547'}>{e.alert_level==='expired'?'EXPIRED':'NEAR EXP'}</Badge>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:11, color:e.days_until_expiry<0?'#ef4444':'#ffb547' }}>
                    {e.days_until_expiry<0?`${Math.abs(e.days_until_expiry)}d ago`:`${e.days_until_expiry}d left`}
                  </span>
                </div>
              </Row>
            ))}
        </Card>

        <Card>
          <SectionHeader label="Recent Movements" page="ledger" setPage={setPage} />
          {loading ? <Skel /> : data.recentMovements.length===0 ? <Empty text="No movements yet." /> :
            data.recentMovements.map((m,i) => (
              <Row key={i} last={i>=data.recentMovements.length-1}>
                <div>
                  <div style={{ fontSize:13, color:'#e0e8ea', fontWeight:500 }}>{m.products?.name}</div>
                  <div style={{ fontSize:11, color:'#4a6068', fontFamily:'DM Mono, monospace', marginTop:1 }}>
                    {m.profiles?.full_name} · {new Date(m.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                  <Badge color={TC[m.movement_type]||'#4a6068'}>{TL[m.movement_type]||m.movement_type}</Badge>
                  <span style={{ fontFamily:'DM Mono, monospace', fontSize:12, color:m.quantity>0?'#00e5a0':'#ff6b35' }}>
                    {m.quantity>0?'+':''}{parseFloat(m.quantity).toFixed(2)}
                  </span>
                </div>
              </Row>
            ))}
        </Card>

        {data.pendingCasualties > 0 && (
          <Card style={{ borderColor:'rgba(167,139,250,0.25)' }}>
            <SectionHeader label="⚠ Pending Approvals" page="casualties" setPage={setPage} color="#a78bfa" />
            <div style={{ background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)', borderRadius:6, padding:'14px 16px' }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:28, color:'#a78bfa' }}>{data.pendingCasualties}</div>
              <div style={{ fontSize:13, color:'#6b8085', marginTop:4 }}>
                {data.pendingCasualties===1?'casualty':'casualties'} awaiting Operations approval
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}

function SC({ label, value, accent, alert: isAlert, nav, setPage }) {
  return (
    <div onClick={() => isAlert && nav && setPage(nav)}
      style={{ background:'#111618', border:`1px solid ${isAlert?`${accent}35`:'#1a2224'}`, borderRadius:8, padding:'15px 16px', position:'relative', overflow:'hidden', cursor:isAlert&&nav?'pointer':'default' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:isAlert?accent:'#1a2224' }} />
      <div style={{ fontFamily:'DM Mono, monospace', fontSize:10, letterSpacing:'0.1em', color:'#4a6068', textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:26, color:isAlert?accent:'#e0e8ea', lineHeight:1 }}>{value}</div>
      {isAlert && nav && <div style={{ fontFamily:'DM Mono, monospace', fontSize:9, color:accent, letterSpacing:'0.08em', marginTop:5, opacity:0.7 }}>TAP →</div>}
    </div>
  )
}

function SectionHeader({ label, page, setPage, color='#00e5a0' }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
      <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15, color:'#e0e8ea' }}>{label}</div>
      <button onClick={() => setPage(page)} style={{ background:'none', border:'none', fontFamily:'DM Mono, monospace', fontSize:10, color, cursor:'pointer', letterSpacing:'0.08em' }}>VIEW →</button>
    </div>
  )
}

function Row({ children, last }) {
  return <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:last?'none':'1px solid #131a1c' }}>{children}</div>
}

function Empty({ text }) {
  return <div style={{ color:'#2a3840', fontSize:13, padding:'12px 0', fontFamily:'DM Mono, monospace' }}>{text}</div>
}

function Skel() {
  return <div>{[1,2,3].map(i => <div key={i} style={{ height:13, background:'#161e20', borderRadius:3, marginBottom:10, opacity:1-i*0.25 }} />)}</div>
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}
