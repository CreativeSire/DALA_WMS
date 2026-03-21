// ── Shared UI primitives ─────────────────────────────────────

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#111618', border: '1px solid #1a2224',
      borderRadius: 8, padding: 24, ...style
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent = '#00e5a0', icon }) {
  return (
    <div style={{
      background: '#111618', border: '1px solid #1a2224', borderRadius: 8,
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: '#e0e8ea', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#4a6068', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', disabled = false, style = {} }) {
  const base = {
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '-0.01em',
    transition: 'opacity 0.15s', opacity: disabled ? 0.5 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  const sizes = {
    sm: { padding: '7px 14px', fontSize: 12 },
    md: { padding: '10px 20px', fontSize: 13 },
    lg: { padding: '13px 28px', fontSize: 14 },
  }
  const variants = {
    primary: { background: '#00e5a0', color: '#0b0f10' },
    secondary: { background: 'transparent', color: '#00e5a0', border: '1px solid #00e5a0' },
    danger: { background: 'rgba(255,107,53,0.1)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.2)' },
    ghost: { background: 'transparent', color: '#5a7880', border: '1px solid #1a2224' },
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

export function Input({ label, value, onChange, type = 'text', placeholder, required, style = {}, min, step }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && <label style={labelStyle}>{label}{required && ' *'}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        min={min} step={step}
        style={inputStyle}
      />
    </div>
  )
}

export function Select({ label, value, onChange, children, required, style = {} }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && <label style={labelStyle}>{label}{required && ' *'}</label>}
      <select value={value} onChange={onChange} required={required} style={inputStyle}>
        {children}
      </select>
    </div>
  )
}

export function Badge({ children, color = '#00e5a0' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 2,
      fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.08em',
      textTransform: 'uppercase',
      background: `${color}18`, color: color, border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }} />
      <div style={{
        position: 'relative', background: '#111618', border: '1px solid #1e2a2d',
        borderRadius: 10, padding: 28, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto', zIndex: 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: '#e0e8ea' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a6068', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Table({ headers, rows, empty = 'No records found.' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#4a6068', textAlign: 'left',
                padding: '10px 14px', borderBottom: '1px solid #1a2224', whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: '32px 14px', textAlign: 'center', color: '#4a6068', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                {empty}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #131a1c' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '12px 14px', color: '#a8bcc0', verticalAlign: 'middle' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#e0e8ea', letterSpacing: '-0.02em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: '#4a6068', marginTop: 4 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function Alert({ message, type = 'success' }) {
  if (!message) return null
  const colors = { success: '#00e5a0', error: '#ff6b35', warn: '#ffb547', info: '#4fc3f7' }
  const c = colors[type]
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 6, marginBottom: 20,
      background: `${c}10`, color: c, border: `1px solid ${c}30`,
      fontSize: 13, fontFamily: 'DM Sans, sans-serif',
    }}>
      {message}
    </div>
  )
}

// Shared styles
export const labelStyle = {
  display: 'block', fontFamily: 'DM Mono, monospace', fontSize: 10,
  letterSpacing: '0.1em', color: '#4a6068', textTransform: 'uppercase', marginBottom: 8,
}
export const inputStyle = {
  width: '100%', padding: '10px 13px', background: '#0b0f10',
  border: '1px solid #1e2a2d', borderRadius: 6, color: '#e0e8ea',
  fontFamily: 'DM Sans, sans-serif', fontSize: 13,
}

export function grid(cols = 'repeat(auto-fit, minmax(220px, 1fr))', gap = 16) {
  return { display: 'grid', gridTemplateColumns: cols, gap }
}
