import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, PageHeader, Table, Badge, Button, Input, SectionCard, SegmentedControl, StatStrip } from '../components/ui'

export default function LedgerPage() {
  const { supabase, api, authMode } = useAuth()
  const [view, setView] = useState('stock') // stock | movements
  const [stockData, setStockData] = useState([])
  const [movements, setMovements] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [view])

  async function loadData() {
    setLoading(true)
    if (view === 'stock') {
      if (authMode === 'api') {
        const { stock } = await api.get('/api/inventory/stock/current')
        setStockData(stock || [])
      } else {
        const { data } = await supabase.from('current_stock').select('*').order('brand_partner')
        setStockData(data || [])
      }
    } else {
      if (authMode === 'api') {
        const { movements } = await api.get('/api/inventory/movements?limit=200')
        setMovements(movements || [])
      } else {
        const { data } = await supabase
          .from('stock_movements')
          .select('*, products(name, sku_code), profiles(full_name), stock_batches(batch_number, expiry_date)')
          .order('created_at', { ascending: false })
          .limit(200)
        setMovements(data || [])
      }
    }
    setLoading(false)
  }

  function exportCSV() {
    if (view === 'stock') {
      const rows = [
        ['SKU', 'Product', 'Brand Partner', 'Category', 'Total Stock', 'Active Batches', 'Near Expiry', 'Expired', 'Earliest Expiry', 'Reorder Threshold'],
        ...filteredStock.map(s => [s.sku_code, s.product_name, s.brand_partner, s.category || '', s.total_stock, s.active_batches, s.near_expiry_batches, s.expired_batches, s.earliest_expiry || '', s.reorder_threshold]),
      ]
      downloadCSV(rows, 'DALA_Stock_Ledger')
    } else {
      const rows = [
        ['Date', 'Product', 'SKU', 'Type', 'Quantity', 'Balance After', 'Reference', 'Retailer', 'User'],
        ...filteredMovements.map(m => [
          new Date(m.created_at).toLocaleString('en-GB'),
          m.products?.name, m.products?.sku_code, m.movement_type,
          m.quantity, m.balance_after, m.reference_number || '', m.retailer_name || '', m.profiles?.full_name || '',
        ]),
      ]
      downloadCSV(rows, 'DALA_Stock_Movements')
    }
  }

  function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const q = search.toLowerCase()
  const filteredStock = stockData.filter(s =>
    !q || s.product_name?.toLowerCase().includes(q) || s.sku_code?.toLowerCase().includes(q) || s.brand_partner?.toLowerCase().includes(q)
  )
  const filteredMovements = movements.filter(m =>
    !q || m.products?.name?.toLowerCase().includes(q) || m.reference_number?.toLowerCase().includes(q) || m.retailer_name?.toLowerCase().includes(q)
  )

  const typeColor = { grn: '#00e5a0', dispatch: '#4fc3f7', adjustment: '#ffb547', write_off: '#ff6b35', transfer: '#a78bfa' }
  const currentRows = filteredStock.length
  const movementRows = filteredMovements.length

  return (
    <div>
      <PageHeader
        title="Inventory Ledger"
        subtitle="Live stock levels and full movement history"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" size="sm" onClick={exportCSV}>↓ Export CSV</Button>
          </div>
        }
      />

      <SectionCard
        eyebrow="Traceability"
        title={view === 'stock' ? 'Live stock positions' : 'Movement audit trail'}
        subtitle={view === 'stock'
          ? 'Use this view for what is physically available by SKU, partner, and batch health.'
          : 'Use this ledger for who moved what, when, and under which reference number.'}
        action={(
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'stock', label: 'Current Stock' },
              { value: 'movements', label: 'Movement History' },
            ]}
          />
        )}
        style={{ marginBottom: 18 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view === 'stock' ? 'Search by product name, SKU, or brand partner...' : 'Search by product, reference, or retailer...'}
            style={{ marginBottom: 0 }}
          />
          <StatStrip items={view === 'stock'
            ? [
                { label: 'Visible Rows', value: currentRows, accent: '#6dc6ff' },
                { label: 'Low Stock', value: filteredStock.filter((item) => item.reorder_threshold > 0 && item.total_stock <= item.reorder_threshold).length, accent: '#f5b85c' },
                { label: 'Expiry Flags', value: filteredStock.filter((item) => item.near_expiry_batches > 0 || item.expired_batches > 0).length, accent: '#ff8552' },
              ]
            : [
                { label: 'Visible Rows', value: movementRows, accent: '#6dc6ff' },
                { label: 'Dispatches', value: filteredMovements.filter((item) => item.movement_type === 'dispatch').length, accent: '#4fc3f7' },
                { label: 'Adjustments', value: filteredMovements.filter((item) => item.movement_type === 'adjustment' || item.movement_type === 'write_off').length, accent: '#ff8552' },
              ]}
          />
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ color: '#4a6068', fontFamily: 'DM Mono, monospace', fontSize: 12, padding: 24 }}>Loading...</div>
      ) : view === 'stock' ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['SKU', 'Product', 'Brand Partner', 'Total Stock', 'Active', 'Near Expiry', 'Expired', 'Earliest Expiry', 'Status']}
            rows={filteredStock.map(s => {
              const isLow = s.reorder_threshold > 0 && s.total_stock <= s.reorder_threshold
              const hasExpiry = s.near_expiry_batches > 0 || s.expired_batches > 0
              return [
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4a6068' }}>{s.sku_code}</span>,
                <span style={{ color: '#e0e8ea', fontWeight: 500 }}>{s.product_name}</span>,
                s.brand_partner,
                <span style={{
                  fontFamily: 'DM Mono, monospace', fontWeight: 700,
                  color: isLow ? '#ff6b35' : '#00e5a0', fontSize: 14,
                }}>
                  {parseFloat(s.total_stock).toFixed(2)}
                </span>,
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{s.active_batches}</span>,
                s.near_expiry_batches > 0 ? <Badge color="#ffb547">{s.near_expiry_batches}</Badge> : <span style={{ color: '#2a3840' }}>—</span>,
                s.expired_batches > 0 ? <Badge color="#ff6b35">{s.expired_batches}</Badge> : <span style={{ color: '#2a3840' }}>—</span>,
                s.earliest_expiry ? (
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                    {new Date(s.earliest_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                ) : <span style={{ color: '#2a3840' }}>—</span>,
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {isLow && <Badge color="#ffb547">LOW</Badge>}
                  {hasExpiry && <Badge color="#ff6b35">EXPIRY</Badge>}
                  {!isLow && !hasExpiry && <Badge color="#00e5a0">OK</Badge>}
                </div>,
              ]
            })}
            empty="No stock data. Start by creating a GRN."
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Date & Time', 'Product', 'Type', 'Quantity', 'Balance After', 'Reference', 'Retailer / Note', 'User']}
            rows={filteredMovements.map(m => [
              <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#e0e8ea' }}>
                  {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068' }}>
                  {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>,
              <div>
                <div style={{ color: '#e0e8ea', fontWeight: 500, fontSize: 13 }}>{m.products?.name}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4a6068' }}>{m.products?.sku_code}</div>
              </div>,
              <Badge color={typeColor[m.movement_type] || '#4a6068'}>{m.movement_type?.replace('_', ' ')}</Badge>,
              <span style={{
                fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13,
                color: m.quantity > 0 ? '#00e5a0' : '#ff6b35',
              }}>
                {m.quantity > 0 ? '+' : ''}{parseFloat(m.quantity).toFixed(2)}
              </span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#a8bcc0' }}>
                {parseFloat(m.balance_after).toFixed(2)}
              </span>,
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4a6068' }}>{m.reference_number || '—'}</span>,
              <span style={{ fontSize: 12, color: '#a8bcc0' }}>{m.retailer_name || m.notes || '—'}</span>,
              <span style={{ fontSize: 12, color: '#5a7880' }}>{m.profiles?.full_name || '—'}</span>,
            ])}
            empty="No movements recorded yet."
          />
        </Card>
      )}
    </div>
  )
}
