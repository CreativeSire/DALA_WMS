// ── Products Page ────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { Card, Button, Input, Select, Modal, Table, PageHeader, Alert, Badge } from '../components/ui'

export function ProductsPage() {
  const { supabase } = useAuth()
  const [products, setProducts] = useState([])
  const [partners, setPartners] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [alert, setAlert] = useState({ message: '', type: 'success' })

  const [form, setForm] = useState(emptyForm())
  function emptyForm() {
    return { brand_partner_id: '', sku_code: '', name: '', category: '', unit_type: 'carton', allows_fractions: true, reorder_threshold: '', expiry_alert_days: '30' }
  }

  useEffect(() => { loadData() }, [])
  async function loadData() {
    const [{ data: p }, { data: bp }] = await Promise.all([
      supabase.from('products').select('*, brand_partners(name)').eq('is_active', true).order('name'),
      supabase.from('brand_partners').select('*').eq('is_active', true).order('name'),
    ])
    setProducts(p || []); setPartners(bp || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      ...form,
      reorder_threshold: parseFloat(form.reorder_threshold) || 0,
      expiry_alert_days: parseInt(form.expiry_alert_days) || 30,
    }
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload)
    if (error) return showAlert(error.message, 'error')
    showAlert(editing ? 'Product updated.' : 'Product created.', 'success')
    setShowModal(false); setEditing(null); setForm(emptyForm()); loadData()
  }

  function openEdit(p) {
    setEditing(p)
    setForm({ brand_partner_id: p.brand_partner_id, sku_code: p.sku_code, name: p.name, category: p.category || '', unit_type: p.unit_type, allows_fractions: p.allows_fractions, reorder_threshold: p.reorder_threshold || '', expiry_alert_days: p.expiry_alert_days || 30 })
    setShowModal(true)
  }

  function showAlert(message, type) { setAlert({ message, type }); setTimeout(() => setAlert({ message: '', type: 'success' }), 4000) }

  return (
    <div>
      <PageHeader title="Products (SKUs)" subtitle="Manage your product catalogue" action={<Button onClick={() => { setEditing(null); setForm(emptyForm()); setShowModal(true) }}>+ Add Product</Button>} />
      <Alert message={alert.message} type={alert.type} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['SKU', 'Product Name', 'Brand Partner', 'Category', 'Unit', 'Reorder At', 'Expiry Alert']}
          rows={products.map(p => [
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a6068' }}>{p.sku_code}</span>,
            <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', color: '#00e5a0', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: 13 }}>{p.name}</button>,
            p.brand_partners?.name,
            p.category || '—',
            p.unit_type,
            p.reorder_threshold > 0 ? <Badge color="#ffb547">{p.reorder_threshold}</Badge> : '—',
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{p.expiry_alert_days}d</span>,
          ])}
          empty="No products yet. Add your first SKU above."
        />
      </Card>

      {showModal && (
        <Modal title={editing ? 'Edit Product' : 'Add Product'} onClose={() => { setShowModal(false); setEditing(null); setForm(emptyForm()) }}>
          <form onSubmit={handleSubmit}>
            <Select label="Brand Partner" value={form.brand_partner_id} onChange={e => setForm(f => ({ ...f, brand_partner_id: e.target.value }))} required>
              <option value="">Select...</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input label="SKU Code" value={form.sku_code} onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))} required placeholder="e.g. MILO-400G" />
              <Input label="Product Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Milo 400g" />
              <Input label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Beverages" />
              <Select label="Unit Type" value={form.unit_type} onChange={e => setForm(f => ({ ...f, unit_type: e.target.value }))}>
                <option value="carton">Carton</option>
                <option value="piece">Piece</option>
                <option value="bag">Bag</option>
                <option value="crate">Crate</option>
              </Select>
              <Input label="Reorder Threshold" value={form.reorder_threshold} onChange={e => setForm(f => ({ ...f, reorder_threshold: e.target.value }))} type="number" min="0" step="0.01" placeholder="Min stock before alert" />
              <Input label="Expiry Alert (days)" value={form.expiry_alert_days} onChange={e => setForm(f => ({ ...f, expiry_alert_days: e.target.value }))} type="number" min="1" placeholder="30" />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => { setShowModal(false); setEditing(null); setForm(emptyForm()) }}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes →' : 'Add Product →'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ProductsPage

// ── Brand Partners Page ──────────────────────────────────────
export function BrandPartnersPage() {
  const { supabase } = useAuth()
  const [partners, setPartners] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [alert, setAlert] = useState({ message: '', type: 'success' })
  const [form, setForm] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '' })

  useEffect(() => { loadData() }, [])
  async function loadData() {
    const { data } = await supabase.from('brand_partners').select('*').eq('is_active', true).order('name')
    setPartners(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const { error } = editing
      ? await supabase.from('brand_partners').update(form).eq('id', editing.id)
      : await supabase.from('brand_partners').insert(form)
    if (error) return showAlert(error.message, 'error')
    showAlert(editing ? 'Partner updated.' : 'Partner added.', 'success')
    setShowModal(false); setEditing(null); setForm({ name: '', contact_name: '', contact_email: '', contact_phone: '' }); loadData()
  }

  function showAlert(message, type) { setAlert({ message, type }); setTimeout(() => setAlert({ message: '', type: 'success' }), 4000) }

  return (
    <div>
      <PageHeader title="Brand Partners" subtitle="Manage your supplier relationships" action={<Button onClick={() => { setEditing(null); setForm({ name: '', contact_name: '', contact_email: '', contact_phone: '' }); setShowModal(true) }}>+ Add Partner</Button>} />
      <Alert message={alert.message} type={alert.type} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Partner Name', 'Contact', 'Email', 'Phone']}
          rows={partners.map(p => [
            <button onClick={() => { setEditing(p); setForm({ name: p.name, contact_name: p.contact_name || '', contact_email: p.contact_email || '', contact_phone: p.contact_phone || '' }); setShowModal(true) }}
              style={{ background: 'none', border: 'none', color: '#00e5a0', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13 }}>{p.name}</button>,
            p.contact_name || '—',
            p.contact_email || '—',
            p.contact_phone || '—',
          ])}
          empty="No brand partners yet."
        />
      </Card>

      {showModal && (
        <Modal title={editing ? 'Edit Partner' : 'Add Brand Partner'} onClose={() => { setShowModal(false); setEditing(null) }}>
          <form onSubmit={handleSubmit}>
            <Input label="Company Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Nestlé Nigeria" />
            <Input label="Contact Person" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Optional" />
            <Input label="Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} type="email" placeholder="Optional" />
            <Input label="Phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="Optional" />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => { setShowModal(false); setEditing(null) }}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes →' : 'Add Partner →'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Users Page ───────────────────────────────────────────────
export function UsersPage() {
  const { supabase } = useAuth()
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [alert, setAlert] = useState({ message: '', type: 'success' })
  const [form, setForm] = useState({ action: 'invite', email: '', full_name: '', password: '', role: 'warehouse_manager' })
  const [loading, setLoading] = useState(false)

  const ROLE_COLORS = { admin: '#ff6b35', warehouse_manager: '#00e5a0', operations: '#4fc3f7', finance: '#ffb547', security: '#a78bfa' }

  useEffect(() => { loadUsers() }, [])
  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
  }

  async function toggleActive(user) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    loadUsers()
  }

  async function handleUserAction(e) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.functions.invoke('user-admin', {
      body: {
        action: form.action,
        email: form.email,
        full_name: form.full_name,
        password: form.action === 'create' ? form.password : undefined,
        role: form.role,
        redirectTo: window.location.origin,
      },
    })

    if (error || data?.error) {
      showAlert(`Error: ${error?.message || data?.error}`, 'error')
    } else {
      showAlert(data?.message || 'User action completed.', 'success')
      setShowModal(false)
      setForm({ action: 'invite', email: '', full_name: '', password: '', role: 'warehouse_manager' })
      setTimeout(loadUsers, 1000)
    }

    setLoading(false)
  }

  function showAlert(message, type) { setAlert({ message, type }); setTimeout(() => setAlert({ message: '', type: 'success' }), 5000) }

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage system access and roles" action={<Button onClick={() => setShowModal(true)}>+ Add User</Button>} />
      <Alert message={alert.message} type={alert.type} />

      <div style={{ background: 'rgba(255,181,71,0.05)', border: '1px solid rgba(255,181,71,0.15)', borderRadius: 6, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#ffb547' }}>
        User onboarding now uses the server-side `user-admin` Edge Function. Use Invite to send a setup email, or Create to issue an immediate account with a temporary password.
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          headers={['Name', 'Email', 'Role', 'Status', 'Action']}
          rows={users.map(u => [
            <span style={{ fontWeight: 500, color: '#e0e8ea' }}>{u.full_name}</span>,
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a6068' }}>{u.email}</span>,
            <Badge color={ROLE_COLORS[u.role] || '#4a6068'}>{u.role?.replace('_', ' ')}</Badge>,
            <Badge color={u.is_active ? '#00e5a0' : '#4a6068'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>,
            <Button size="sm" variant={u.is_active ? 'danger' : 'ghost'} onClick={() => toggleActive(u)}>
              {u.is_active ? 'Deactivate' : 'Activate'}
            </Button>,
          ])}
          empty="No users found."
        />
      </Card>

      {showModal && (
        <Modal title="Add User" onClose={() => setShowModal(false)}>
          <form onSubmit={handleUserAction}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {[
                { id: 'invite', label: 'Send Invite' },
                { id: 'create', label: 'Create Directly' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, action: mode.id, password: '' }))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: form.action === mode.id ? '#00e5a0' : '#1a2224',
                    background: form.action === mode.id ? 'rgba(0,229,160,0.08)' : 'transparent',
                    color: form.action === mode.id ? '#00e5a0' : '#5a7880',
                    cursor: 'pointer',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <Input label="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="e.g. Emeka Okonkwo" />
            <Input label="Email Address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" required placeholder="emeka@dala.ng" />
            <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="warehouse_manager">Warehouse Manager</option>
              <option value="operations">Operations</option>
              <option value="finance">Finance</option>
              <option value="security">Security / Logistics</option>
              <option value="admin">Admin</option>
            </Select>

            {form.action === 'create' && (
              <Input label="Temporary Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" required placeholder="At least 8 characters" />
            )}

            <div style={{ background: 'rgba(79,195,247,0.06)', border: '1px solid rgba(79,195,247,0.15)', borderRadius: 6, padding: '12px 14px', marginBottom: 18, fontSize: 12, color: '#4fc3f7' }}>
              {form.action === 'invite'
                ? 'Invite sends an email so the user can complete setup securely.'
                : 'Create provisions the account immediately and returns control to the admin after success.'}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Processing...' : form.action === 'invite' ? 'Send Invite →' : 'Create User →'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
