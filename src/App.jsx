import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import GRNPage from './pages/GRNPage'
import DispatchPage from './pages/DispatchPage'
import LedgerPage from './pages/LedgerPage'
import ExpiryPage from './pages/ExpiryPage'
import CasualtyPage from './pages/CasualtyPage'
import ReorderPage from './pages/ReorderPage'
import PartnerPerformancePage from './pages/PartnerPerformancePage'
import PhysicalCountPage from './pages/PhysicalCountPage'
import ReportsPage from './pages/ReportsPage'
import HowItWorksPage from './pages/HowItWorksPage'
import { ProductsPage, BrandPartnersPage, UsersPage } from './pages/ProductsPage'
import Layout from './components/Layout'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function App() {
  const previewMode = globalThis.__DALA_PREVIEW__ || new URLSearchParams(window.location.search).get('preview')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

  if (previewMode === 'manual') {
    return <HowItWorksPage />
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0b0f10', color:'#00e5a0', fontFamily:'DM Mono, monospace', fontSize:13, letterSpacing:'0.1em' }}>
      LOADING DALA WMS...
    </div>
  )

  if (!session) return (
    <AuthContext.Provider value={{ session, profile, supabase }}>
      <LoginPage />
    </AuthContext.Provider>
  )

  const can = (roles) => roles.includes(profile?.role)

  const renderPage = () => {
    switch (page) {
      // ── Core ──────────────────────────────────────────────
      case 'dashboard':    return <Dashboard setPage={setPage} />
      case 'how-it-works': return <HowItWorksPage />
      // ── Phase 1 — Stock ───────────────────────────────────
      case 'grn':          return can(['admin','warehouse_manager']) ? <GRNPage /> : <AccessDenied />
      case 'dispatch':     return can(['admin','operations','warehouse_manager','security']) ? <DispatchPage /> : <AccessDenied />
      case 'ledger':       return <LedgerPage />
      // ── Phase 2 — Intelligence ────────────────────────────
      case 'expiry':       return can(['admin','warehouse_manager','operations','finance']) ? <ExpiryPage /> : <AccessDenied />
      case 'casualties':   return can(['admin','warehouse_manager','operations']) ? <CasualtyPage /> : <AccessDenied />
      case 'reorder':      return can(['admin','warehouse_manager','operations','finance']) ? <ReorderPage /> : <AccessDenied />
      case 'performance':  return can(['admin','operations','finance']) ? <PartnerPerformancePage /> : <AccessDenied />
      // ── Phase 3 — Reconciliation ──────────────────────────
      case 'count':        return can(['admin','warehouse_manager','operations']) ? <PhysicalCountPage /> : <AccessDenied />
      case 'reports':      return can(['admin','warehouse_manager','operations','finance']) ? <ReportsPage /> : <AccessDenied />
      // ── Setup ─────────────────────────────────────────────
      case 'products':     return can(['admin','warehouse_manager','operations']) ? <ProductsPage /> : <AccessDenied />
      case 'partners':     return can(['admin','operations']) ? <BrandPartnersPage /> : <AccessDenied />
      case 'users':        return can(['admin']) ? <UsersPage /> : <AccessDenied />
      default:             return <Dashboard setPage={setPage} />
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, supabase }}>
      <Layout page={page} setPage={setPage}>{renderPage()}</Layout>
    </AuthContext.Provider>
  )
}

function AccessDenied() {
  return (
    <div style={{ padding:48, textAlign:'center', color:'#ff6b35', fontFamily:'DM Mono, monospace', fontSize:13 }}>
      ACCESS DENIED — Your role does not permit viewing this page.
    </div>
  )
}
