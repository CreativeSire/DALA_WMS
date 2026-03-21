export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(18,29,32,0.92) 0%, rgba(12,21,23,0.94) 100%)',
      border: '1px solid rgba(126, 155, 160, 0.12)',
      borderRadius: 22,
      padding: 24,
      boxShadow: '0 16px 48px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
      backdropFilter: 'blur(14px)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent = '#2be3b4' }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 20,
      border: '1px solid rgba(126, 155, 160, 0.1)',
      background: 'linear-gradient(160deg, rgba(16,28,31,0.96) 0%, rgba(10,18,20,0.96) 100%)',
      padding: 22,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at top right, ${accent}24 0%, transparent 30%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ ...labelStyle, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 30, color: '#f3f8f7', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: 8, fontSize: 12, color: '#6f858d' }}>{sub}</div>}
    </div>
  )
}

export function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', disabled = false, style = {} }) {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 12, borderRadius: 12 },
    md: { padding: '11px 18px', fontSize: 13, borderRadius: 14 },
    lg: { padding: '14px 24px', fontSize: 14, borderRadius: 16 },
  }

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #2be3b4 0%, #7bffdb 100%)',
      color: '#04110f',
      border: '1px solid rgba(43, 227, 180, 0.46)',
      boxShadow: '0 12px 30px rgba(43, 227, 180, 0.18)',
    },
    secondary: {
      background: 'rgba(109, 198, 255, 0.08)',
      color: '#8fd8ff',
      border: '1px solid rgba(109, 198, 255, 0.2)',
    },
    danger: {
      background: 'rgba(255, 133, 82, 0.12)',
      color: '#ff9a72',
      border: '1px solid rgba(255, 133, 82, 0.24)',
    },
    ghost: {
      background: 'rgba(255,255,255,0.02)',
      color: '#9fb3b9',
      border: '1px solid rgba(126, 155, 160, 0.14)',
    },
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.48 : 1,
        transition: 'transform 0.14s ease, opacity 0.14s ease, box-shadow 0.14s ease',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Input({ label, value, onChange, type = 'text', placeholder, required, style = {}, min, step }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && <label style={labelStyle}>{label}{required && ' *'}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
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

export function Badge({ children, color = '#2be3b4' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 9px',
      borderRadius: 999,
      fontFamily: 'DM Mono, monospace',
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      background: `${color}18`,
      color,
      border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(2,7,8,0.76)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 620,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 28,
        borderRadius: 24,
        border: '1px solid rgba(126, 155, 160, 0.14)',
        background: 'linear-gradient(180deg, rgba(18,29,32,0.98) 0%, rgba(10,18,20,0.98) 100%)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#f3f8f7' }}>{title}</div>
          <button onClick={onClose} style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: '1px solid rgba(126, 155, 160, 0.14)',
            background: 'rgba(255,255,255,0.03)',
            color: '#88a0a7',
            cursor: 'pointer',
            fontSize: 18,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Table({ headers, rows, empty = 'No records found.' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} style={{
                ...labelStyle,
                padding: '0 14px 12px',
                textAlign: 'left',
                borderBottom: '1px solid rgba(126, 155, 160, 0.12)',
                whiteSpace: 'nowrap',
              }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{
                padding: '34px 14px',
                textAlign: 'center',
                color: '#61777e',
                fontFamily: 'DM Mono, monospace',
                fontSize: 12,
              }}>
                {empty}
              </td>
            </tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{
                  padding: '14px',
                  color: '#c6d4d2',
                  verticalAlign: 'middle',
                  borderBottom: rowIndex === rows.length - 1 ? 'none' : '1px solid rgba(126, 155, 160, 0.08)',
                }}>
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
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 28,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: '#f4f9f7', letterSpacing: '-0.03em' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 14, color: '#72868d', marginTop: 6, maxWidth: 760 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function Alert({ message, type = 'success' }) {
  if (!message) return null
  const colors = {
    success: '#2be3b4',
    error: '#ff8552',
    warn: '#f5b85c',
    info: '#6dc6ff',
  }
  const color = colors[type]
  return (
    <div style={{
      marginBottom: 20,
      padding: '14px 16px',
      borderRadius: 16,
      border: `1px solid ${color}26`,
      borderLeft: `4px solid ${color}`,
      background: `${color}10`,
      color,
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
}

export const labelStyle = {
  display: 'block',
  fontFamily: 'DM Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.14em',
  color: '#6c8389',
  textTransform: 'uppercase',
  marginBottom: 8,
}

export const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid rgba(126, 155, 160, 0.14)',
  background: 'rgba(5,10,12,0.66)',
  color: '#eef6f4',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 13,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
}

export function grid(cols = 'repeat(auto-fit, minmax(220px, 1fr))', gap = 16) {
  return { display: 'grid', gridTemplateColumns: cols, gap }
}
