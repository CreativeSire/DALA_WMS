import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Input } from './ui'

export default function ScanAssistCard({ title, copy, placeholder, onResolve }) {
  const [scanValue, setScanValue] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)

  async function handleScan(code) {
    if (!code.trim()) return
    const result = await onResolve(code.trim())
    setScanMessage(result?.message || '')
    if (result?.ok) setScanValue('')
  }

  async function startCamera() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Camera scanning is not available in this browser. Use a handheld scanner or type the barcode.')
      return
    }

    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
      })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOpen(true)
      setCameraStatus('Point the camera at a product barcode.')
    } catch (error) {
      setCameraStatus(error.message || 'Could not start the camera scanner.')
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !detectorRef.current) return undefined

    const tick = async () => {
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current)
        if (barcodes?.length) {
          const code = barcodes[0].rawValue
          stopCamera()
          handleScan(code)
          return
        }
      } catch (_error) {
        // keep scanning
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cameraOpen])

  useEffect(() => () => stopCamera(), [])

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={copyStyle}>{copy}</div>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <Input
          label="Scan code"
          value={scanValue}
          onChange={(event) => setScanValue(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleScan(scanValue)
            }
          }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="button" size="sm" onClick={() => handleScan(scanValue)}>
            Add scanned item
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cameraOpen ? stopCamera : startCamera}>
            {cameraOpen ? 'Stop camera' : 'Use camera'}
          </Button>
        </div>
        {cameraStatus && (
          <div style={{ fontSize: 12, color: '#bbaead', lineHeight: 1.6 }}>{cameraStatus}</div>
        )}
        {cameraOpen && (
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(212, 135, 121, 0.12)', background: '#080707' }}
          />
        )}
        {scanMessage && (
          <Badge color="#6dc6ff">{scanMessage}</Badge>
        )}
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
  fontSize: 16,
  color: '#f4efee',
}

const copyStyle = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.6,
  color: '#b8acab',
}
