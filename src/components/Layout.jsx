import { useState } from 'react'
import { useAuth } from '../App'

const NAV = [
  { section: 'OVERVIEW' },
  { id:'dashboard',   label:'Dashboard',          icon:'◈', roles:['admin','warehouse_manager','operations','finance','security'] },
  { id:'how-it-works',label:'How It Works',       icon:'?', roles:['admin','warehouse_manager','operations','finance','security'] },
  { section: 'STOCK OPERATIONS' },
  { id:'grn',         label:'Stock Intake (GRN)', icon:'↓', roles:['admin','warehouse_manager'] },
  { id:'dispatch',    label:'Dispatch',           icon:'↑', roles:['admin','operations','warehouse_manager','security'] },
  { id:'ledger',      label:'Ledger',             icon:'≡', roles:['admin','warehouse_manager','operations','finance'] },
  { section: 'INTELLIGENCE' },
  { id:'expiry',      label:'Expiry Tracking',    icon:'⏱', roles:['admin','warehouse_manager','operations','finance'] },
  { id:'casualties',  label:'Casualties',         icon:'⚠', roles:['admin','warehouse_manager','operations'] },
  { id:'reorder',     label:'Reorder Alerts',     icon:'🔔', roles:['admin','warehouse_manager','operations','finance'] },
  { id:'performance', label:'Partner Performance',icon:'◇', roles:['admin','operations','finance'] },
  { section: 'RECONCILIATION' },
  { id:'count',       label:'Physical Count',     icon:'✓', roles:['admin','warehouse_manager','operations'] },
  { id:'reports',     label:'Reports & Export',   icon:'↗', roles:['admin','warehouse_manager','operations','finance'] },
  { section: 'SETUP' },
  { id:'products',    label:'Products',           icon:'◉', roles:['admin','warehouse_manager','operations'] },
  { id:'partners',    label:'Brand Partners',     icon:'○', roles:['admin','operations'] },
  { id:'users',       label:'Users',              icon:'⊕', roles:['admin'] },
]

const ROLE_COLORS = {
  admin:'#ff6b35', warehouse_manager:'#00e5a0',
  operations:'#4fc3f7', finance:'#ffb547', security:'#a78bfa',
}

export default function Layout({ children, page, setPage }) {
  const { profile, supabase } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentLabel = NAV.find(n => n.id === page)?.label || 'Dashboard'

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0b0f10', fontFamily:'DM Sans, sans-serif' }}>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:40 }} />
      )}

      <aside style={{
        width:234, background:'#0f1416', borderRight:'1px solid #1a2224',
        display:'flex', flexDirection:'column',
        position:'fixed', top:0, bottom:0, left:0, zIndex:50,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.22s ease',
      }} className="sidebar">

        {/* Logo */}
        <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid #1a2224', flexShrink:0 }}>
          <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:19, color:'#fff', letterSpacing:'-0.02em' }}>
            DALA <span style={{ color:'#00e5a0' }}>WMS</span>
          </div>
          <div style={{ fontFamily:'DM Mono, monospace', fontSize:10, color:'#2a3840', letterSpacing:'0.12em', marginTop:3, textTransform:'uppercase' }}>
            Warehouse Management System
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 10px', overflowY:'auto' }}>
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{ fontFamily:'DM Mono, monospace', fontSize:9, color:'#1e2c30', letterSpacing:'0.18em', textTransform:'uppercase', padding:'12px 10px 4px', marginTop: i > 0 ? 2 : 0 }}>
                {item.section}
              </div>
            )
            if (!item.roles.includes(profile?.role)) return null
            const active = page === item.id
            return (
              <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false) }}
                style={{
                  width:'100%', display:'flex', alignItems:'center', gap:9,
                  padding:'9px 10px', borderRadius:5, border:'none', cursor:'pointer',
                  background: active ? 'rgba(0,229,160,0.08)' : 'transparent',
                  color: active ? '#00e5a0' : '#4a6068',
                  fontFamily:'DM Sans, sans-serif', fontSize:13, fontWeight: active ? 600 : 400,
                  marginBottom:1, textAlign:'left',
                  borderLeft: active ? '2px solid #00e5a0' : '2px solid transparent',
                  transition:'all 0.12s',
                }}>
                <span style={{ fontSize:11, width:16, textAlign:'center' }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding:'14px 18px', borderTop:'1px solid #1a2224', flexShrink:0 }}>
          <div style={{ fontSize:13, color:'#e0e8ea', fontWeight:500, marginBottom:3 }}>{profile?.full_name}</div>
          <div style={{
            display:'inline-block', fontFamily:'DM Mono, monospace', fontSize:10,
            padding:'2px 8px', borderRadius:2, marginBottom:12,
            background:`${ROLE_COLORS[profile?.role]}18`, color:ROLE_COLORS[profile?.role],
            letterSpacing:'0.08em', textTransform:'uppercase',
          }}>
            {profile?.role?.replace('_',' ')}
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{
            width:'100%', padding:'8px 0', border:'1px solid #1a2224',
            background:'transparent', color:'#3a5058', borderRadius:4,
            fontFamily:'DM Mono, monospace', fontSize:11, letterSpacing:'0.08em',
            cursor:'pointer', textTransform:'uppercase',
          }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', marginLeft:0 }} className="main-content">
        <header style={{
          height:54, background:'#0f1416', borderBottom:'1px solid #1a2224',
          display:'flex', alignItems:'center', padding:'0 20px', gap:16,
          position:'sticky', top:0, zIndex:30, flexShrink:0,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background:'none', border:'none', color:'#00e5a0', cursor:'pointer', fontSize:20, padding:'2px 4px', lineHeight:1 }}>
            ☰
          </button>
          <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15, color:'#e0e8ea' }}>
            {currentLabel}
          </div>
          <div style={{ marginLeft:'auto', fontFamily:'DM Mono, monospace', fontSize:11, color:'#2a3840' }}>
            {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
          </div>
        </header>

        <main style={{ flex:1, padding:'24px 20px', overflowY:'auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#0b0f10; }
        @media (min-width:768px) {
          .sidebar { transform:translateX(0) !important; }
          .main-content { margin-left:234px !important; }
        }
        input:focus, select:focus, textarea:focus {
          outline:none !important;
          border-color:#00e5a0 !important;
          box-shadow:0 0 0 3px rgba(0,229,160,0.06) !important;
        }
        button:focus { outline:none; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1a2224; border-radius:2px; }
      `}</style>
    </div>
  )
}
