import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { QRCodeSVG } from 'qrcode.react'

const s = {
  container: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  card: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginBottom: '12px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' },
  btn: { padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  primary: { background: '#1a1a2e', color: '#fff' },
  ghost: { background: '#eee', color: '#333' },
  danger: { background: '#fee2e2', color: '#c00' },
  input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
  addRow: { display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' },
  crumb: { cursor: 'pointer', color: '#1a1a2e', textDecoration: 'underline', fontSize: '14px' },
}

export default function InventoryAdmin() {
  const [divisions, setDivisions] = useState([])
  const [division, setDivision] = useState(null)
  const [unit, setUnit] = useState(null)
  const [shelf, setShelf] = useState(null)
  const [bay, setBay] = useState(null)
  const [bin, setBin] = useState(null)
  const [units, setUnits] = useState([])
  const [shelves, setShelves] = useState([])
  const [bays, setBays] = useState([])
  const [bins, setBins] = useState([])
  const [binItems, setBinItems] = useState([])
  const [allItems, setAllItems] = useState([])
  const [newUnitCode, setNewUnitCode] = useState('')
  const [newUnitLabel, setNewUnitLabel] = useState('')
  const [newShelfNum, setNewShelfNum] = useState('')
  const [newBayNum, setNewBayNum] = useState('')
  const [newBinNum, setNewBinNum] = useState('')
  const [newBinPos, setNewBinPos] = useState('')
  const [selectedItem, setSelectedItem] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newMinQty, setNewMinQty] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [qrTarget, setQrTarget] = useState(null)
  const [status, setStatus] = useState('')
  const [broadCats, setBroadCats] = useState([])
  const [subCats, setSubCats] = useState([])
  const [selectedBroadCat, setSelectedBroadCat] = useState('')
  const [selectedSubCat, setSelectedSubCat] = useState('')
  useEffect(() => {
    supabase.from('divisions').select('*').then(({ data }) => {
      if (data) { setDivisions(data); setDivision(data.find(d => d.name === 'Electrical') || data[0]) }
    })
  }, [])

  useEffect(() => { if (division) { setUnit(null); setShelf(null); setBay(null); setBin(null); fetchUnits() } }, [division])
  useEffect(() => { if (unit) { setShelf(null); setBay(null); setBin(null); fetchShelves() } }, [unit])
  useEffect(() => { if (shelf) { setBay(null); setBin(null); fetchBays() } }, [shelf])
  useEffect(() => { if (bay) { setBin(null); fetchBins() } }, [bay])
  useEffect(() => { if (bin) fetchBinItems() }, [bin])
  useEffect(() => {
  if (!division) return
  supabase.from('items').select('broad_category').eq('division_id', division.id)
    .then(({ data }) => {
      if (data) setBroadCats([...new Set(data.map(d => d.broad_category).filter(Boolean))].sort())
    })
}, [division])

useEffect(() => {
  setSelectedSubCat('')
  setSubCats([])
  if (!selectedBroadCat || !division) return
  supabase.from('items').select('sub_category')
    .eq('division_id', division.id)
    .eq('broad_category', selectedBroadCat)
    .then(({ data }) => {
      if (data) setSubCats([...new Set(data.map(d => d.sub_category).filter(Boolean))].sort())
    })
  runSearch(itemSearch)
}, [selectedBroadCat])

useEffect(() => {
  runSearch(itemSearch)
}, [selectedSubCat])
  async function fetchUnits() {
    const { data } = await supabase.from('units').select('*').eq('division_id', division.id).order('code')
    if (data) setUnits(data)
  }
  async function fetchShelves() {
    const { data } = await supabase.from('shelves').select('*').eq('unit_id', unit.id).order('number')
    if (data) setShelves(data)
  }
  async function fetchBays() {
    const { data } = await supabase.from('bays').select('*').eq('shelf_id', shelf.id).order('number')
    if (data) setBays(data)
  }
  async function fetchBins() {
    const { data } = await supabase.from('bins').select('*').eq('bay_id', bay.id).order('position')
    if (data) setBins(data)
  }
  async function fetchBinItems() {
    const { data } = await supabase.from('bin_items').select('*, items(*)').eq('bin_id', bin.id)
    if (data) setBinItems(data)
  }

  async function runSearch(query) {
  if (!selectedBroadCat && (!query || query.length < 2)) { setAllItems([]); return }
  let q = supabase.from('items')
    .select('id, name, material_code, unit_of_measure, sub_category')
    .eq('division_id', division.id)
    .limit(40)
  if (selectedBroadCat) q = q.eq('broad_category', selectedBroadCat)
  if (selectedSubCat) q = q.eq('sub_category', selectedSubCat)
  if (query && query.length >= 2) q = q.or(`name.ilike.%${query}%,material_code.ilike.%${query}%`)
  const { data } = await q
  if (data) setAllItems(data)
}

async function searchItems(query) {
  setItemSearch(query)
  runSearch(query)
}
  async function deleteUnit(id) {
    if (!confirm('Delete this unit and all its contents?')) return
    await supabase.from('units').delete().eq('id', id); fetchUnits()
  }
  async function addShelf() {
    if (!newShelfNum) return
    const { error } = await supabase.from('shelves').insert({ unit_id: unit.id, number: parseInt(newShelfNum) })
    if (!error) { setNewShelfNum(''); fetchShelves() } else setStatus('Error: ' + error.message)
  }
  async function deleteShelf(id) {
    if (!confirm('Delete this shelf and all its contents?')) return
    await supabase.from('shelves').delete().eq('id', id); fetchShelves()
  }
  async function addBay() {
    if (!newBayNum) return
    const bayCode = unit.code + shelf.number + newBayNum
    const { error } = await supabase.from('bays').insert({ shelf_id: shelf.id, number: parseInt(newBayNum), bay_code: bayCode })
    if (!error) { setNewBayNum(''); fetchBays() } else setStatus('Error: ' + error.message)
  }
  async function deleteBay(id) {
    if (!confirm('Delete this bay and all its contents?')) return
    await supabase.from('bays').delete().eq('id', id); fetchBays()
  }
  async function addBin() {
    if (!newBinNum) return
    const binCode = bay.bay_code + newBinNum
    const { error } = await supabase.from('bins').insert({ bay_id: bay.id, number: parseInt(newBinNum), bin_code: binCode, position: parseInt(newBinPos) || bins.length + 1 })
    if (!error) { setNewBinNum(''); setNewBinPos(''); fetchBins() } else setStatus('Error: ' + error.message)
  }
  async function deleteBin(id) {
    if (!confirm('Delete this bin and all its contents?')) return
    await supabase.from('bins').delete().eq('id', id); fetchBins()
  }
  async function addBinItem() {
    if (!selectedItem || !newQty) return
    const { error } = await supabase.from('bin_items').insert({ bin_id: bin.id, item_id: selectedItem, quantity: parseFloat(newQty), min_quantity: parseFloat(newMinQty) || 0 })
    if (!error) { setSelectedItem(''); setNewQty(''); setNewMinQty(''); setItemSearch(''); setAllItems([]); fetchBinItems() }
    else setStatus('Error: ' + error.message)
  }
  async function updateQty(id, field, value) {
    await supabase.from('bin_items').update({ [field]: parseFloat(value), updated_at: new Date().toISOString() }).eq('id', id)
  }
  async function removeBinItem(id) {
    if (!confirm('Remove this item from the bin?')) return
    await supabase.from('bin_items').delete().eq('id', id); fetchBinItems()
  }

  const level = bin ? 'bin' : bay ? 'bins' : shelf ? 'bays' : unit ? 'shelves' : 'units'

  return (
    <div style={s.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Inventory Admin</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={division?.id || ''} onChange={e => setDivision(divisions.find(d => d.id === e.target.value))} style={s.input}>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Link to="/inventory" style={{ ...s.btn, ...s.ghost, textDecoration: 'none' }}>← Back</Link>
        </div>
      </div>

      {status && <p style={{ color: 'red' }}>{status}</p>}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', fontSize: '14px' }}>
        <span style={s.crumb} onClick={() => { setUnit(null); setShelf(null); setBay(null); setBin(null) }}>Units</span>
        {unit && <><span>›</span><span style={s.crumb} onClick={() => { setShelf(null); setBay(null); setBin(null) }}>Unit {unit.code}</span></>}
        {shelf && <><span>›</span><span style={s.crumb} onClick={() => { setBay(null); setBin(null) }}>Shelf {shelf.number}</span></>}
        {bay && <><span>›</span><span style={s.crumb} onClick={() => setBin(null)}>Bay {bay.bay_code}</span></>}
        {bin && <><span>›</span><span>Bin {bin.bin_code}</span></>}
      </div>

      {level === 'units' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px' }}>Shelving Units — {division?.name}</h3>
          {units.length === 0 && <p style={{ color: '#888' }}>No units yet.</p>}
          {units.map(u => (
            <div key={u.id} style={s.row}>
              <div><strong>Unit {u.code}</strong>{u.label && <span style={{ color: '#666', marginLeft: '8px', fontSize: '13px' }}>{u.label}</span>}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ ...s.btn, ...s.primary }} onClick={() => setUnit(u)}>Open →</button>
                <button style={{ ...s.btn, ...s.danger }} onClick={() => deleteUnit(u.id)}>Delete</button>
              </div>
            </div>
          ))}
          <div style={s.addRow}>
            <input placeholder="Code (e.g. A)" value={newUnitCode} onChange={e => setNewUnitCode(e.target.value)} style={{ ...s.input, width: '80px' }} />
            <input placeholder="Label (optional)" value={newUnitLabel} onChange={e => setNewUnitLabel(e.target.value)} style={{ ...s.input, width: '200px' }} />
            <button style={{ ...s.btn, ...s.primary }} onClick={addUnit}>+ Add Unit</button>
          </div>
        </div>
      )}

      {level === 'shelves' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px' }}>Shelves — Unit {unit?.code}</h3>
          {shelves.length === 0 && <p style={{ color: '#888' }}>No shelves yet.</p>}
          {shelves.map(sh => (
            <div key={sh.id} style={s.row}>
              <strong>Shelf {sh.number}</strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ ...s.btn, ...s.primary }} onClick={() => setShelf(sh)}>Open →</button>
                <button style={{ ...s.btn, ...s.danger }} onClick={() => deleteShelf(sh.id)}>Delete</button>
              </div>
            </div>
          ))}
          <div style={s.addRow}>
            <input type="number" placeholder="Shelf #" value={newShelfNum} onChange={e => setNewShelfNum(e.target.value)} style={{ ...s.input, width: '100px' }} />
            <button style={{ ...s.btn, ...s.primary }} onClick={addShelf}>+ Add Shelf</button>
          </div>
        </div>
      )}

      {level === 'bays' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px' }}>Bays — Shelf {shelf?.number} (Unit {unit?.code})</h3>
          {bays.length === 0 && <p style={{ color: '#888' }}>No bays yet.</p>}
          {bays.map(b => (
            <div key={b.id} style={s.row}>
              <div><strong>Bay {b.bay_code}</strong><span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>#{b.number}</span></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ ...s.btn, ...s.ghost }} onClick={() => setQrTarget({ code: b.bay_code, label: 'Bay ' + b.bay_code })}>QR</button>
                <button style={{ ...s.btn, ...s.primary }} onClick={() => setBay(b)}>Open →</button>
                <button style={{ ...s.btn, ...s.danger }} onClick={() => deleteBay(b.id)}>Delete</button>
              </div>
            </div>
          ))}
          <div style={s.addRow}>
            <input type="number" placeholder="Bay #" value={newBayNum} onChange={e => setNewBayNum(e.target.value)} style={{ ...s.input, width: '100px' }} />
            {newBayNum && <span style={{ fontSize: '13px', color: '#666' }}>→ Code: {unit?.code}{shelf?.number}{newBayNum}</span>}
            <button style={{ ...s.btn, ...s.primary }} onClick={addBay}>+ Add Bay</button>
          </div>
        </div>
      )}

      {level === 'bins' && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 12px' }}>Bins — Bay {bay?.bay_code}</h3>
          {bins.length === 0 && <p style={{ color: '#888' }}>No bins yet.</p>}
          {bins.map(b => (
            <div key={b.id} style={s.row}>
              <div><strong>Bin {b.bin_code}</strong><span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>Position {b.position}</span></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ ...s.btn, ...s.ghost }} onClick={() => setQrTarget({ code: b.bin_code, label: 'Bin ' + b.bin_code })}>QR</button>
                <button style={{ ...s.btn, ...s.primary }} onClick={() => setBin(b)}>Items →</button>
                <button style={{ ...s.btn, ...s.danger }} onClick={() => deleteBin(b.id)}>Delete</button>
              </div>
            </div>
          ))}
          <div style={s.addRow}>
            <input type="number" placeholder="Bin #" value={newBinNum} onChange={e => setNewBinNum(e.target.value)} style={{ ...s.input, width: '80px' }} />
            <input type="number" placeholder="Position" value={newBinPos} onChange={e => setNewBinPos(e.target.value)} style={{ ...s.input, width: '80px' }} />
            {newBinNum && <span style={{ fontSize: '13px', color: '#666' }}>→ Code: {bay?.bay_code}{newBinNum}</span>}
            <button style={{ ...s.btn, ...s.primary }} onClick={addBin}>+ Add Bin</button>
          </div>
        </div>
      )}

      {level === 'bin' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Bin {bin?.bin_code} — Items</h3>
            <button style={{ ...s.btn, ...s.ghost }} onClick={() => setQrTarget({ code: bin.bin_code, label: 'Bin ' + bin.bin_code })}>🔲 QR Code</button>
          </div>
          {binItems.length === 0 && <p style={{ color: '#888' }}>No items in this bin yet.</p>}
          {binItems.map(bi => (
            <div key={bi.id} style={s.row}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{bi.items?.name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{bi.items?.material_code} · {bi.items?.unit_of_measure}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>Qty</div>
                  <input type="number" defaultValue={bi.quantity} style={{ ...s.input, width: '70px', textAlign: 'center' }}
                    onBlur={e => updateQty(bi.id, 'quantity', e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>Min</div>
                  <input type="number" defaultValue={bi.min_quantity} style={{ ...s.input, width: '70px', textAlign: 'center' }}
                    onBlur={e => updateQty(bi.id, 'min_quantity', e.target.value)} />
                </div>
                <button style={{ ...s.btn, ...s.danger }} onClick={() => removeBinItem(bi.id)}>Remove</button>
              </div>
            </div>
          ))}
<div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px' }}>Add Item to Bin</h4>
            <div style={{ position: 'relative' }}>
              <input placeholder="Search by name or material code..." value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); searchItems(e.target.value) }}
                style={{ ...s.input, width: '100%', boxSizing: 'border-box' }} />
              {allItems.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: '4px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                  {allItems.map(item => (
                    <div key={item.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '13px' }}
                      onClick={() => { setSelectedItem(item.id); setItemSearch(item.name); setAllItems([]) }}>
                      <strong>{item.name}</strong>
                      <span style={{ color: '#888', marginLeft: '8px' }}>{item.material_code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.addRow}>
              <input type="number" placeholder="Qty" value={newQty} onChange={e => setNewQty(e.target.value)} style={{ ...s.input, width: '80px' }} />
              <input type="number" placeholder="Min Qty" value={newMinQty} onChange={e => setNewMinQty(e.target.value)} style={{ ...s.input, width: '80px' }} />
              <button style={{ ...s.btn, ...s.primary }} onClick={addBinItem} disabled={!selectedItem || !newQty}>+ Add to Bin</button>
            </div>
          </div>
        </div>
      )}

      {qrTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setQrTarget(null)}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <QRCodeSVG value={qrTarget.code} size={220} />
            <div style={{ marginTop: '16px', fontWeight: 'bold', fontSize: '20px' }}>{qrTarget.label}</div>
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>{qrTarget.code}</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button style={{ ...s.btn, ...s.primary }} onClick={() => window.print()}>🖨️ Print</button>
              <button style={{ ...s.btn, ...s.ghost }} onClick={() => setQrTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}