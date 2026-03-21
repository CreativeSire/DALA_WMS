import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button } from '../components/ui'

export default function PartnerPerformancePage() {
  const { supabase, api, authMode } = useAuth()
  const [partners, setPartners] = useState([])
  const [selected, setSelected] = useState(null)
  const [partnerGRNs, setPartnerGRNs] = useState([])
  const [partnerStock, setPartnerStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    if (authMode === 'api') {
      const { partners } = await api.get('/api/partners/summary')
      setPartners(partners || [])
    } else {
      const { data } = await supabase.from('brand_partner_summary').select('*').order('partner_name')
      setPartners(data || [])
    }
    setLoading(false)
  }

  async function loadPartnerDetail(partner) {
    setSelected(partner)
    setDrillLoading(true)
    if (authMode === 'api') {
      const detail = await api.get(`/api/partners/${partner.partner_id}/detail`)
      setSelected(detail.summary)
      setPartnerGRNs(detail.grns || [])
      setPartnerStock(detail.stock || [])
    } else {
      const [{ data: grns }, { data: stock }] = await Promise.all([
        supabase.from('grn_records')
          .select('*, profiles(full_name), grn_items(quantity_received, products(name, sku_code))')
          .eq('brand_partner_id', partner.partner_id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('current_stock')
          .select('*')
          .order('product_name'),
      ])
      const { data: partnerProds } = await supabase
        .from('products')
        .select('id')
        .eq('brand_partner_id', partner.partner_id)
      const partnerProdIds = new Set((partnerProds || []).map(p => p.id))
      setPartnerGRNs(grns || [])
      setPartnerStock((stock || []).filter(s => partnerProdIds.has(s.product_id)))
    }
    setDrillLoading(false)
  }

  if (selected) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#4a6068', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← BACK TO ALL PARTNERS
          </button>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#e0e8ea', letterSpacing: '-0.02em' }}>{selected.partner_name}</div>
          {selected.contact_name && <div style={{ fontSize: 13, color: '#4a6068', marginTop: 4 }}>{selected.contact_name} {selected.contact_phone && `· ${selected.contact_phone}`}</div>}
        </div>

        {/* Partner stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Active SKUs', value: selected.total_skus, accent: '#4fc3f7' },
            { label: 'Stock Held', value: parseFloat(selected.total_stock_held).toFixed(1), accent: '#00e5a0' },
            { label: 'Near Expiry', value: selected.near_expiry_batches, accent: '#ffb547' },
            { label: 'Expired', value: selected.expired_batches, accent: '#ef4444' },
            { label: 'Total GRNs', value: selected.total_grns, accent: '#a78bfa' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#111618', border: '1px solid #1a2224', borderRadius: 8, padding: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.accent }} />
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: '#e0e8ea' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {drillLoading ? (
          <div style={{ color: '#4a6068', fontFamily: 'DM Mono, monospace', fontSize: 12, padding: 24 }}>Loading detail...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>

            {/* Current stock for this partner */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2224' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#e0e8ea' }}>Current Stock</div>
              </div>
              <Table
                headers={['SKU', 'Product', 'Stock', 'Status']}
                rows={partnerStock.map(s => {
                  const isLow = s.reorder_threshold > 0 && s.total_stock <= s.reorder_threshold
                  const hasExpiry = s.near_expiry_batches > 0 || s.expired_batches > 0
                  return [
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4a6068' }}>{s.sku_code}</span>,
                    <span style={{ fontSize: 13, color: '#e0e8ea' }}>{s.product_name}</span>,
                    <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14, color: isLow ? '#ffb547' : '#00e5a0' }}>
                      {parseFloat(s.total_stock).toFixed(2)}
                    </span>,
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {isLow && <Badge color="#ffb547">LOW</Badge>}
                      {hasExpiry && <Badge color="#ff6b35">EXPIRY</Badge>}
                      {!isLow && !hasExpiry && <Badge color="#00e5a0">OK</Badge>}
                    </div>,
                  ]
                })}
                empty="No current stock for this partner."
              />
            </Card>

            {/* Recent GRNs */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a2224' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#e0e8ea' }}>Recent GRNs</div>
              </div>
              <Table
                headers={['GRN #', 'Date', 'Lines', 'Received By']}
                rows={partnerGRNs.map(g => [
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#00e5a0' }}>{g.grn_number}</span>,
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                    {new Date(g.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>,
                  <Badge>{g.total_items}</Badge>,
                  <span style={{ fontSize: 12, color: '#5a7880' }}>{g.profiles?.full_name}</span>,
                ])}
                empty="No GRNs for this partner yet."
              />
            </Card>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Brand Partner Performance"
        subtitle="Stock held, expiry status and GRN history per brand partner"
      />

      {loading ? (
        <div style={{ color: '#4a6068', fontFamily: 'DM Mono, monospace', fontSize: 12, padding: 24 }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {partners.map(p => (
            <button
              key={p.partner_id}
              onClick={() => loadPartnerDetail(p)}
              style={{
                background: '#111618', border: '1px solid #1a2224', borderRadius: 10,
                padding: 22, textAlign: 'left', cursor: 'pointer',
                transition: 'border-color 0.15s, transform 0.1s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00e5a0'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2224'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {/* Top accent bar — color based on health */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: p.expired_batches > 0 ? '#ef4444' : p.near_expiry_batches > 0 ? '#ffb547' : '#00e5a0',
              }} />

              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#e0e8ea', marginBottom: 4 }}>
                {p.partner_name}
              </div>
              {p.contact_name && (
                <div style={{ fontSize: 12, color: '#4a6068', marginBottom: 16 }}>{p.contact_name}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Stat label="Active SKUs" value={p.total_skus} />
                <Stat label="Stock Held" value={parseFloat(p.total_stock_held).toFixed(1)} />
                <Stat label="Near Expiry" value={p.near_expiry_batches} color={p.near_expiry_batches > 0 ? '#ffb547' : '#4a6068'} />
                <Stat label="Expired" value={p.expired_batches} color={p.expired_batches > 0 ? '#ef4444' : '#4a6068'} />
              </div>

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1a2224', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068', letterSpacing: '0.08em' }}>
                  {p.total_grns} GRNs TOTAL
                </span>
                {p.last_grn_date && (
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068' }}>
                    Last: {new Date(p.last_grn_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>

              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#00e5a0', letterSpacing: '0.08em' }}>VIEW DETAIL →</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = '#e0e8ea' }) {
  return (
    <div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#3a5058', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color }}>{value}</div>
    </div>
  )
}
