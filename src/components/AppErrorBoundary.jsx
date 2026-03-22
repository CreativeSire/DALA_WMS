import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'The app hit an unexpected error.',
    }
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={shellStyle}>
          <div style={cardStyle}>
            <div style={eyebrowStyle}>Recovery</div>
            <div style={titleStyle}>Something broke on this page</div>
            <div style={copyStyle}>
              {this.state.message}
            </div>
            <button type="button" onClick={() => window.location.reload()} style={buttonStyle}>
              Reload app
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const shellStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#171312',
}

const cardStyle = {
  width: '100%',
  maxWidth: 620,
  borderRadius: 24,
  border: '1px solid rgba(212, 135, 121, 0.12)',
  background: 'linear-gradient(180deg, rgba(32,26,24,0.96) 0%, rgba(20,16,15,0.98) 100%)',
  padding: 28,
  boxShadow: '0 24px 70px rgba(0,0,0,0.26)',
}

const eyebrowStyle = {
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.16em',
  color: '#d48779',
  textTransform: 'uppercase',
}

const titleStyle = {
  marginTop: 10,
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 34,
  lineHeight: 1.05,
  letterSpacing: '-0.04em',
  color: '#f4efee',
}

const copyStyle = {
  marginTop: 14,
  color: '#c2b7b5',
  fontSize: 15,
  lineHeight: 1.7,
}

const buttonStyle = {
  marginTop: 20,
  borderRadius: 14,
  border: '1px solid rgba(212, 135, 121, 0.18)',
  background: 'rgba(212, 135, 121, 0.08)',
  color: '#f3e9e7',
  padding: '12px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Mono, monospace',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}
