export default function MiniTrendChart({ title, subtitle, series, color, valueKey }) {
  const width = 320
  const height = 96
  const padding = 12
  const values = series.map((item) => Number(item[valueKey] || 0))
  const max = Math.max(...values, 1)
  const stepX = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0
  const points = series.map((item, index) => {
    const x = padding + index * stepX
    const y = height - padding - ((Number(item[valueKey] || 0) / max) * (height - padding * 2))
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div>
          <div style={titleStyle}>{title}</div>
          <div style={subtitleStyle}>{subtitle}</div>
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: '#f4efee' }}>
          {values[values.length - 1] || 0}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 110, marginTop: 10 }}>
        <defs>
          <linearGradient id={`fill-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <polygon
          fill={`url(#fill-${valueKey})`}
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        />
      </svg>
      <div style={footerStyle}>
        {series.slice(-5).map((item) => (
          <div key={`${valueKey}-${item.day}`} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#8f8482' }}>
              {item.day.slice(5)}
            </div>
            <div style={{ fontSize: 12, color: '#cdbfbc' }}>
              {item[valueKey]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const cardStyle = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'rgba(255,255,255,0.02)',
}

const titleStyle = {
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  fontSize: 17,
  color: '#f4efee',
}

const subtitleStyle = {
  marginTop: 5,
  fontSize: 12,
  color: '#b8acab',
  lineHeight: 1.5,
}

const footerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 8,
}
