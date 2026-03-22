const COLORS = {
  accent: '#d48779',
  accentStrong: '#bc6658',
  accentSoft: '#e4b0a6',
  surface: 'linear-gradient(180deg, rgba(31,26,24,0.96) 0%, rgba(22,18,17,0.98) 100%)',
  border: 'rgba(212, 135, 121, 0.12)',
  text: '#f4efee',
  textMuted: '#b7aeac',
  label: '#8e807e',
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 22,
      padding: 24,
      boxShadow: '0 16px 44px rgba(0,0,0,0.16)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent = COLORS.accent }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 20,
      border: `1px solid ${COLORS.border}`,
      background: 'linear-gradient(160deg, rgba(34,28,26,0.96) 0%, rgba(22,18,17,0.96) 100%)',
      padding: 22,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at top right, ${accent}26 0%, transparent 32%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ ...labelStyle, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 30, color: COLORS.text, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: 8, fontSize: 12, color: COLORS.label }}>{sub}</div>}
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
      background: 'linear-gradient(135deg, #bc6658 0%, #d48779 100%)',
      color: '#fff5f2',
      border: '1px solid rgba(212, 135, 121, 0.34)',
      boxShadow: '0 12px 28px rgba(188, 102, 88, 0.18)',
    },
    secondary: {
      background: 'rgba(212, 135, 121, 0.08)',
      color: '#e4b0a6',
      border: '1px solid rgba(212, 135, 121, 0.16)',
    },
    danger: {
      background: 'rgba(176, 69, 58, 0.16)',
      color: '#f0b1a8',
      border: '1px solid rgba(176, 69, 58, 0.26)',
    },
    ghost: {
      background: 'rgba(255,255,255,0.02)',
      color: '#c3b9b7',
      border: '1px solid rgba(255,255,255,0.08)',
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

export function TextArea({ label, value, onChange, placeholder, required, rows = 4, style = {} }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && <label style={labelStyle}>{label}{required && ' *'}</label>}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        style={{ ...inputStyle, resize: 'vertical', minHeight: rows * 24 }}
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

export function Badge({ children, color = COLORS.accent }) {
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,8,0.76)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 620,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 28,
        borderRadius: 24,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: COLORS.text }}>{title}</div>
          <button onClick={onClose} style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#b7aeac',
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
                borderBottom: '1px solid rgba(212, 135, 121, 0.12)',
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
                color: COLORS.label,
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
                  color: '#d0c8c6',
                  verticalAlign: 'middle',
                  borderBottom: rowIndex === rows.length - 1 ? 'none' : '1px solid rgba(212, 135, 121, 0.08)',
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
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: COLORS.text, letterSpacing: '-0.03em' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 14, color: COLORS.label, marginTop: 6, maxWidth: 760 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function SectionCard({ eyebrow, title, subtitle, action, children, style = {} }) {
  return (
    <Card style={style}>
      {(eyebrow || title || subtitle || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            {eyebrow && <div style={{ ...labelStyle, marginBottom: 10 }}>{eyebrow}</div>}
            {title && <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: COLORS.text, letterSpacing: '-0.03em' }}>{title}</div>}
            {subtitle && <div style={{ marginTop: 6, color: COLORS.label, fontSize: 13, lineHeight: 1.6 }}>{subtitle}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </Card>
  )
}

export function StatStrip({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} style={{
          borderRadius: 18,
          border: `1px solid ${COLORS.border}`,
          background: 'rgba(255,255,255,0.02)',
          padding: 18,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at top right, ${(item.accent || COLORS.accent)}22 0%, transparent 36%)` }} />
          <div style={labelStyle}>{item.label}</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: COLORS.text, lineHeight: 1 }}>{item.value}</div>
          {item.sub && <div style={{ marginTop: 7, fontSize: 12, color: COLORS.label }}>{item.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function SegmentedControl({ value, onChange, options, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex',
      gap: 8,
      padding: 6,
      borderRadius: 16,
      border: `1px solid ${COLORS.border}`,
      background: 'rgba(255,255,255,0.03)',
      ...style,
    }}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '10px 14px',
              background: active ? 'linear-gradient(135deg, rgba(188,102,88,0.92) 0%, rgba(212,135,121,0.78) 100%)' : 'transparent',
              color: active ? '#fff4f1' : '#b7aeac',
              cursor: 'pointer',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ title, copy }) {
  return (
    <div style={{
      padding: '34px 20px',
      textAlign: 'center',
      borderRadius: 18,
      border: '1px dashed rgba(212, 135, 121, 0.18)',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: COLORS.text }}>{title}</div>
      <div style={{ marginTop: 8, color: COLORS.label, fontSize: 13, lineHeight: 1.6 }}>{copy}</div>
    </div>
  )
}

export function Alert({ message, type = 'success' }) {
  if (!message) return null
  const colors = {
    success: '#d48779',
    error: '#bc6658',
    warn: '#d29b6f',
    info: '#c7a484',
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
  color: COLORS.label,
  textTransform: 'uppercase',
  marginBottom: 8,
}

export const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: 'rgba(14, 12, 12, 0.72)',
  color: COLORS.text,
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 13,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
}

export function grid(cols = 'repeat(auto-fit, minmax(220px, 1fr))', gap = 16) {
  return { display: 'grid', gridTemplateColumns: cols, gap }
}
