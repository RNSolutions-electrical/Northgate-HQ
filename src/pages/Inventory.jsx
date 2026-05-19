import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../supabaseClient.js'
import QRScanner from '../components/inventory/QRScanner.jsx'

const s = {
  container: { padding: '24px', maxWidth: '800px', margin: '0 auto' },
  card: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginBottom: '12px' },
  btn: { padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  primary: { background: '#1a1a2e', color: '#fff' },
  accent: { background: '#e94560', color: '#fff' },
  ghost: { background: '#eee', color: '#333' },
  numInput: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '64px', textAlign: 'center' },
  label: { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' },
}

export default function Inventory() {
  const { user } = useUser()

  // Division
  const [divisions, setDivisions] = useState([])
  const [division, setDivision] = useState('Electrical')

  // Mode
  const [mode, setMode] = useState('home')

  // Scan result
  const [scanResult, setScanResult] = useState(null)
  const [scanType, setScanType] = useState(null)

  // Transaction
  const [transaction, setTransaction] = useState([])
  const [adjustments, setAdjustments] = useState({})
  const [jobNumber, setJobNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search
  const [broadCats, setBroadCats] = useState([])
  const [subCats, setSubCats] = useState([])
  const [selectedBroadCat, setSelectedBroadCat] = useState('')
  const [selectedSubCat, setSelectedSubCat] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // Status
  const [status, setStatus] = useState('')

  // --- Effects ---

  useEffect(() => {
    supabase.from('divisions').select('*').then(({ data }) => {
      if (data) setDivisions(data)
    })
  }, [])

  useEffect(() => {
    if (!divisions.length) return
    const div = divisions.find(d => d.name === division)
    if (!div) return
    supabase.from('items').select('broad_category').eq('division_id', div.id)
      .then(({ data }) => {
        if (data) setBroadCats([...new Set(data.map(d => d.broad_category).filter(Boolean))].sort())
      })
  }, [division, divisions])

  useEffect(() => {
    setSelectedSubCat('')
    setSubCats([])
    if (!selectedBroadCat) return
    const div = divisions.find(d => d.name === division)
    if (!div) return
    supabase.from('items').select('sub_category')
      .eq('division_id', div.id)
      .eq('broad_category', selectedBroadCat)
      .then(({ data }) => {
        if (data) setSubCats([...new Set(data.map(d => d.sub_category).filter(Boolean))].sort())
      })
  }, [selectedBroadCat])

  // --- Scan functions ---

  async function handleScan(code) {
    setStatus('Looking up ' + code + '...')

    const { data: bay } = await supabase
      .from('bays')
      .select(`id, bay_code, bins ( id, bin_code, position, number, bin_items ( id, quantity, min_quantity, items ( id, name, material_code, unit_of_measure, price_per_unit ) ) )`)
      .eq('bay_code', code)
      .single()

    if (bay) {
      setScanResult(bay); setScanType('bay'); setMode('result'); setStatus(''); return
    }

    const { data: bin } = await supabase
      .from('bins')
      .select(`id, bin_code, bin_items ( id, quantity, min_quantity, items ( id, name, material_code, unit_of_measure, price_per_unit ) )`)
      .eq('bin_code', code)
      .single()

    if (bin) {
      setScanResult(bin); setScanType('bin'); setMode('result'); setStatus(''); return
    }

    setStatus('⚠️ Code not found: ' + code)
    setMode('home')
  }

  function getBinItems() {
    if (!scanResult) return []
    if (scanType === 'bin') return scanResult.bin_items.map(bi => ({ ...bi, binCode: scanResult.bin_code }))
    return (scanResult.bins || [])
      .sort((a, b) => a.position - b.position)
      .flatMap(bin => bin.bin_items.map(bi => ({ ...bi, binCode: bin.bin_code })))
  }

  // --- Search functions ---

  async function runItemSearch() {
    const div = divisions.find(d => d.name === division)
    if (!div) return
    if (!selectedBroadCat && (!searchQuery || searchQuery.length < 2)) {
      setSearchResults([]); return
    }
    let q = supabase.from('items')
      .select(`
        id, name, material_code, unit_of_measure, price_per_unit,
        bin_items (
          id, quantity, min_quantity,
          bins ( id, bin_code, bays ( bay_code ) )
        )
      `)
      .eq('division_id', div.id)
      .limit(30)
    if (selectedBroadCat) q = q.eq('broad_category', selectedBroadCat)
    if (selectedSubCat) q = q.eq('sub_category', selectedSubCat)
    if (searchQuery && searchQuery.length >= 2) q = q.or(`name.ilike.%${searchQuery}%,material_code.ilike.%${searchQuery}%`)
    const { data } = await q
    if (data) setSearchResults(data)
  }

  function addSearchItemToTransaction(binItem, item) {
    const syntheticBinItem = {
      id: binItem.id,
      quantity: binItem.quantity,
      min_quantity: binItem.min_quantity,
      items: {
        id: item.id,
        name: item.name,
        material_code: item.material_code,
        unit_of_measure: item.unit_of_measure,
        price_per_unit: item.price_per_unit
      }
    }
    addToTransaction(syntheticBinItem, binItem.bins.bin_code)
  }

  // --- Transaction functions ---

  function updateAdj(id, field, value) {
    setAdjustments(prev => ({ ...prev, [id]: { ...prev[id], [field]: Math.max(0, parseInt(value) || 0) } }))
  }

  function addToTransaction(binItem, binCode) {
    const adj = adjustments[binItem.id] || {}
    const out = adj.out || 0
    const inn = adj.in || 0
    if (out === 0 && inn === 0) return

    const entry = {
      bin_item_id: binItem.id,
      bin_code: binCode,
      item_name: binItem.items.name,
      material_code: binItem.items.material_code,
      unit_of_measure: binItem.items.unit_of_measure,
      price_per_unit: binItem.items.price_per_unit,
      quantity_out: out,
      quantity_in: inn,
      current_quantity: binItem.quantity,
    }

    setTransaction(prev => {
      const idx = prev.findIndex(t => t.bin_item_id === binItem.id)
      if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u }
      return [...prev, entry]
    })
    setAdjustments(prev => ({ ...prev, [binItem.id]: { out: 0, in: 0 } }))
  }

  async function submitTransaction() {
    if (!transaction.length) return
    setIsSubmitting(true)
    try {
      const divId = divisions.find(d => d.name === division)?.id
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert({ user_id: user.id, division_id: divId, job_id: jobNumber || null, status: 'submitted' })
        .select().single()
      if (txnErr) throw txnErr

      const { error: itemsErr } = await supabase
        .from('transaction_items')
        .insert(transaction.map(t => ({
          transaction_id: txn.id,
          bin_item_id: t.bin_item_id,
          bin_code: t.bin_code || '',
          item_name: t.item_name,
          quantity_out: t.quantity_out,
          quantity_in: t.quantity_in,
        })))
      if (itemsErr) throw itemsErr

      for (const t of transaction) {
        await supabase.from('bin_items')
          .update({ quantity: Math.max(0, t.current_quantity - t.quantity_out + t.quantity_in), updated_at: new Date().toISOString() })
          .eq('id', t.bin_item_id)
      }

      setTransaction([]); setAdjustments({}); setJobNumber(''); setMode('home')
      setStatus('✅ Transaction submitted successfully')
    } catch (err) {
      setStatus('❌ Error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function clearSearch() {
    setMode('home')
    setSearchResults([])
    setSearchQuery('')
    setSelectedBroadCat('')
    setSelectedSubCat('')
  }

  // --- Render ---

  if (mode === 'scanning') return <QRScanner onScan={handleScan} onCancel={() => setMode('home')} />

  return (
    <div style={s.container}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={division} onChange={e => setDivision(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
            {divisions.map(d => <option key={d.id}>{d.name}</option>)}
          </select>
          <Link to="/inventory/admin" style={{ ...s.btn, ...s.ghost, textDecoration: 'none', fontSize: '13px' }}>⚙️ Admin</Link>
        </div>
      </div>

      {status && (
        <p style={{ color: status.startsWith('✅') ? 'green' : status.startsWith('❌') || status.startsWith('⚠️') ? '#c00' : '#333' }}>
          {status}
        </p>
      )}

      {/* HOME */}
      {mode === 'home' && (
        <>
          <button style={{ ...s.btn, ...s.primary, width: '100%', padding: '18px', fontSize: '18px', marginBottom: '10px' }}
            onClick={() => setMode('scanning')}>
            📷 Scan QR Code
          </button>
          <button style={{ ...s.btn, ...s.ghost, width: '100%', padding: '14px', fontSize: '16px', marginBottom: '20px' }}
            onClick={() => setMode('search')}>
            🔍 Search Inventory
          </button>

          {transaction.length > 0 && (
            <div style={s.card}>
              <h3 style={{ margin: '0 0 12px' }}>Current Transaction — {transaction.length} item{transaction.length !== 1 ? 's' : ''}</h3>
              {transaction.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{t.item_name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{t.bin_code}</div>
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    {t.quantity_out > 0 && <span style={{ color: '#e94560' }}>−{t.quantity_out} </span>}
                    {t.quantity_in > 0 && <span style={{ color: 'green' }}>+{t.quantity_in}</span>}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button style={{ ...s.btn, ...s.ghost }} onClick={() => setMode('scanning')}>+ Scan Another</button>
                <button style={{ ...s.btn, ...s.accent }} onClick={() => setMode('submit')}>Submit Transaction →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* SEARCH */}
      {mode === 'search' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button style={{ ...s.btn, ...s.ghost }} onClick={clearSearch}>← Back</button>
            {transaction.length > 0 && (
              <button style={{ ...s.btn, ...s.accent }} onClick={() => setMode('submit')}>Submit ({transaction.length})</button>
            )}
          </div>

          <h2>Search Inventory</h2>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <select value={selectedBroadCat}
              onChange={e => { setSelectedBroadCat(e.target.value); setSearchQuery(''); setSearchResults([]) }}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: 1, minWidth: '160px' }}>
              <option value=''>— All Categories —</option>
              {broadCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={selectedSubCat}
              onChange={e => setSelectedSubCat(e.target.value)}
              disabled={!selectedBroadCat}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: 1, minWidth: '160px', opacity: selectedBroadCat ? 1 : 0.5 }}>
              <option value=''>— All Sub-Categories —</option>
              {subCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input type="text" placeholder="Filter by name or material code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runItemSearch()}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 }} />
            <button style={{ ...s.btn, ...s.primary }} onClick={runItemSearch}>Search</button>
          </div>

          {searchResults.length === 0 && (selectedBroadCat || searchQuery.length >= 2) && (
            <p style={{ color: '#888' }}>No items found.</p>
          )}

          {searchResults.map(item => (
            <div key={item.id} style={{ ...s.card, marginBottom: '12px' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{item.material_code} · {item.unit_of_measure}</div>
              </div>

              {item.bin_items.length === 0 && (
                <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>Not assigned to any bin</p>
              )}

              {item.bin_items.map(bi => {
                const adj = adjustments[bi.id] || {}
                const inCart = transaction.find(t => t.bin_item_id === bi.id)
                return (
                  <div key={bi.id} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>📍 Bin {bi.bins?.bin_code}</span>
                        <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>Bay {bi.bins?.bays?.bay_code}</span>
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        Stock: <strong>{bi.quantity}</strong>
                        {inCart && <span style={{ marginLeft: '8px', background: '#e94560', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>In cart</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div>
                        <label style={s.label}>Taking out</label>
                        <input type="number" min="0" value={adj.out || ''}
                          onChange={e => updateAdj(bi.id, 'out', e.target.value)}
                          style={s.numInput} placeholder="0" />
                      </div>
                      <div>
                        <label style={s.label}>Putting back</label>
                        <input type="number" min="0" value={adj.in || ''}
                          onChange={e => updateAdj(bi.id, 'in', e.target.value)}
                          style={s.numInput} placeholder="0" />
                      </div>
                      <button
                        style={{ ...s.btn, ...s.primary, opacity: (!adj.out && !adj.in) ? 0.5 : 1 }}
                        onClick={() => addSearchItemToTransaction(bi, item)}
                        disabled={!adj.out && !adj.in}>
                        {inCart ? 'Update' : 'Add to Transaction'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}

      {/* SCAN RESULT */}
      {mode === 'result' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button style={{ ...s.btn, ...s.ghost }} onClick={() => setMode('home')}>← Back</button>
            <button style={{ ...s.btn, ...s.ghost }} onClick={() => setMode('scanning')}>Scan Another</button>
            {transaction.length > 0 && (
              <button style={{ ...s.btn, ...s.accent }} onClick={() => setMode('submit')}>Submit ({transaction.length})</button>
            )}
          </div>

          <h2>{scanType === 'bay' ? `Bay ${scanResult?.bay_code}` : `Bin ${scanResult?.bin_code}`}</h2>

          {getBinItems().length === 0 && <p style={{ color: '#888' }}>No items found in this {scanType}.</p>}

          {getBinItems().map(binItem => {
            const adj = adjustments[binItem.id] || {}
            const inCart = transaction.find(t => t.bin_item_id === binItem.id)
            return (
              <div key={binItem.id} style={{ ...s.card, borderLeft: inCart ? '4px solid #e94560' : '1px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{binItem.items?.name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {binItem.binCode} · {binItem.items?.material_code} · Stock: {binItem.quantity} {binItem.items?.unit_of_measure}
                    </div>
                  </div>
                  {inCart && <span style={{ fontSize: '12px', background: '#e94560', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>In cart</span>}
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={s.label}>Taking out</label>
                    <input type="number" min="0" value={adj.out || ''}
                      onChange={e => updateAdj(binItem.id, 'out', e.target.value)}
                      style={s.numInput} placeholder="0" />
                  </div>
                  <div>
                    <label style={s.label}>Putting back</label>
                    <input type="number" min="0" value={adj.in || ''}
                      onChange={e => updateAdj(binItem.id, 'in', e.target.value)}
                      style={s.numInput} placeholder="0" />
                  </div>
                  <button
                    style={{ ...s.btn, ...s.primary, opacity: (!adj.out && !adj.in) ? 0.5 : 1 }}
                    onClick={() => addToTransaction(binItem, binItem.binCode)}
                    disabled={!adj.out && !adj.in}>
                    {inCart ? 'Update' : 'Add to Transaction'}
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* SUBMIT */}
      {mode === 'submit' && (
        <div style={s.card}>
          <h2 style={{ margin: '0 0 8px' }}>Submit Transaction</h2>
          <p style={{ color: '#666', margin: '0 0 16px' }}>{transaction.length} item{transaction.length !== 1 ? 's' : ''}</p>

          {transaction.map((t, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{t.item_name}</strong> <span style={{ color: '#888', fontSize: '12px' }}>{t.bin_code}</span></span>
              <span>
                {t.quantity_out > 0 && <span style={{ color: '#e94560' }}>−{t.quantity_out} </span>}
                {t.quantity_in > 0 && <span style={{ color: 'green' }}>+{t.quantity_in}</span>}
              </span>
            </div>
          ))}

          <div style={{ marginTop: '20px' }}>
            <label style={{ ...s.label, fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Job Number (optional)</label>
            <input type="text" value={jobNumber} onChange={e => setJobNumber(e.target.value)}
              placeholder="Enter job number or leave blank"
              style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button style={{ ...s.btn, ...s.ghost }} onClick={() => setMode('home')}>← Back</button>
            <button style={{ ...s.btn, ...s.accent, flex: 1 }}
              onClick={submitTransaction} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : '✓ Confirm & Submit'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
