import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function QRScanner({ onScan, onCancel }) {
  const scannerRef = useRef(null)
  const startedRef = useRef(false)
  const elementId = 'qr-reader'

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        scanner.stop().then(() => onScan(decodedText.trim())).catch(() => onScan(decodedText.trim()))
      },
      () => {}
    ).catch(err => console.error('Camera error:', err))

    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  return (
    <div style={{ padding: '20px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Scan QR Code</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>Point camera at a bay or bin QR code</p>
      <div id={elementId} style={{ width: '100%' }} />

      <div style={{ marginTop: '16px' }}>
        <p style={{ fontSize: '13px', color: '#888' }}>Or enter code manually:</p>
        <input
          type="text"
          placeholder="e.g. A12 or A123"
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginRight: '8px', width: '120px' }}
          onKeyDown={e => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
    }
    onScan(e.target.value.trim().toUpperCase())
  }
}}
        />
        <span style={{ fontSize: '12px', color: '#888' }}>Press Enter to scan</span>
      </div>

      <button
        onClick={() => { scannerRef.current?.stop().catch(() => {}); onCancel() }}
        style={{ marginTop: '16px', padding: '12px 32px', background: '#e94560', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
      >
        Cancel
      </button>
    </div>
  )
}