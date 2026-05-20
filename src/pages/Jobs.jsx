import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../supabaseClient.js'

const STATUS_COLORS = {
  'Pursuit': '#6366f1',
  'Estimate': '#f59e0b',
  'Procurement/Buyout': '#8b5cf6',
  'Active': '#10b981',
  'Completion': '#06b6d4',
  'Complete': '#059669',
  'Cancelled': '#ef4444',
}

const STATUSES = Object.keys(STATUS_COLORS)

const s = {
  container: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  btn: { padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  primary: { background: '#1a1a2e', color: '#fff' },
  ghost: { background: '#eee', color: '#333' },
  input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' },
  card: { background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginBottom: '10px' },
  badge: (status) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    background: STATUS_COLORS[status] + '22',
    color: STATUS_COLORS[status],
    border: `1px solid ${STATUS_COLORS[status]}44`,
  }),
  label: { fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '500' },
}

export default function Jobs() {
  const { user } = useUser()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState([])
  const [identifiers, setIdentifiers] = useState([])
  const [divisions, setDivisions] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)

  const [form, setForm] = useState({
    identifier_id: '', title: '', status: 'Pursuit', division_id: '', description: '',
    client_name: '', client_contact_name: '', client_contact_email: '', client_contact_phone: '',
    project_address: '', project_city: '', project_state: '',
    project_manager: '', superintendent: '', electrical_lead: '',
    full_budget: '', electrical_budget: '',
  })

  useEffect(() => {
    fetchJobs()
    supabase.from('job_identifiers').select('*').order('code').then(({ data }) => { if (data) setIdentifiers(data) })
    supabase.from('divisions').select('*').then(({ data }) => { if (data) setDivisions(data) })
  }, [])

  useEffect(() => { fetchJobs() }, [filterStatus, filterDivision])

  async function fetchJobs() {
    let q = supabase.from('jobs')
      .select('*, job_identifiers(code, label), divisions(name)')
      .order('created_at', { ascending: false })
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterDivision) q = q.eq('division_id', filterDivision)
    const { data } = await q
    if (data) setJobs(data)
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function createJob() {
    if (!form.identifier_id || !form.title) {
      setStatus('⚠️ Identifier and title are required'); return
    }
    setCreating(true)
    try {
      const identifier = identifiers.find(i => i.id === form.identifier_id)
      const year = new Date().getFullYear().toString().slice(-2)
      const { data: existing } = await supabase
        .from('jobs').select('sequence')
        .eq('identifier_id', form.identifier_id).eq('year', year)
        .order('sequence', { ascending: false }).limit(1)
      const nextSeq = existing && existing.length > 0 ? existing[0].sequence + 1 : 1
      const jobNumber = `${identifier.code}-${year}-${String(nextSeq).padStart(3, '0')}`
      const { data: newJob, error } = await supabase.from('jobs').insert({
        ...form,
        job_number: jobNumber, year, sequence: nextSeq,
        full_budget: parseFloat(form.full_budget) || 0,
        electrical_budget: parseFloat(form.electrical_budget) || 0,
        created_by: user.id,
      }).select().single()
      if (error) throw error
      setShowCreate(false)
      setForm({ identifier_id: '', title: '', status: 'Pursuit', division_id: '', description: '', client_name: '', client_contact_name: '', client_contact_email: '', client_contact_phone: '', project_address: '', project_city: '', project_state: '', project_manager: '', superintendent: '', electrical_lead: '', full_budget: '', electrical_budget: '' })
      setStatus(`✅ Job ${jobNumber} created`)
      fetchJobs()
      navigate(`/jobs/${newJob.id}`)
    } catch (err) {
      setStatus('❌ Error: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const filtered = jobs.filter(j =>
    !search || j.job_number.toLowerCase().includes(search.toLowerCase()) || j.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Jobs</h1>
        <button style={{ ...s.btn, ...s.primary }} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Job'}
        </button>
      </div>

      {status && <p style={{ color: status.startsWith('✅') ? 'green' : '#c00', marginBottom: '12px' }}>{status}</p>}

      {showCreate && (
        <div style={{ ...s.card, border: '2px solid #1a1a2e', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 20px' }}>New Job</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={s.label}>Identifier *</label>
              <select value={form.identifier_id} onChange={e => setField('identifier_id', e.target.value)} style={s.input}>
                <option value=''>— Select —</option>
                {identifiers.map(i => <option key={i.id} value={i.id}>{i.code} — {i.label}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Division</label>
              <select value={form.division_id} onChange={e => setField('division_id', e.target.value)} style={s.input}>
                <option value=''>— Select —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={s.label}>Job Title *</label>
            <input style={s.input} value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Diamonds Direct - Electrical Finish" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={s.label}>Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)} style={s.input}>
                {STATUSES.map(st => <option key={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Description</label>
              <input style={s.input} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Brief description" />
            </div>
          </div>

          <h3 style={{ margin: '0 0 12px', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '16px' }}>Client Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div><label style={s.label}>Client Name</label><input style={s.input} value={form.client_name} onChange={e => setField('client_name', e.target.value)} /></div>
            <div><label style={s.label}>Contact Name</label><input style={s.input} value={form.client_contact_name} onChange={e => setField('client_contact_name', e.target.value)} /></div>
            <div><label style={s.label}>Contact Email</label><input style={s.input} type="email" value={form.client_contact_email} onChange={e => setField('client_contact_email', e.target.value)} /></div>
            <div><label style={s.label}>Contact Phone</label><input style={s.input} type="tel" value={form.client_contact_phone} onChange={e => setField('client_contact_phone', e.target.value)} /></div>
          </div>

          <h3 style={{ margin: '0 0 12px', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '16px' }}>Project Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div><label style={s.label}>Address</label><input style={s.input} value={form.project_address} onChange={e => setField('project_address', e.target.value)} /></div>
            <div><label style={s.label}>City</label><input style={s.input} value={form.project_city} onChange={e => setField('project_city', e.target.value)} /></div>
            <div><label style={s.label}>State</label><input style={s.input} value={form.project_state} onChange={e => setField('project_state', e.target.value)} /></div>
          </div>

          <h3 style={{ margin: '0 0 12px', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '16px' }}>Personnel</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div><label style={s.label}>Project Manager</label><input style={s.input} value={form.project_manager} onChange={e => setField('project_manager', e.target.value)} /></div>
            <div><label style={s.label}>Superintendent</label><input style={s.input} value={form.superintendent} onChange={e => setField('superintendent', e.target.value)} /></div>
            <div><label style={s.label}>Electrical Lead</label><input style={s.input} value={form.electrical_lead} onChange={e => setField('electrical_lead', e.target.value)} /></div>
          </div>

          <h3 style={{ margin: '0 0 12px', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '16px' }}>Budget</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div><label style={s.label}>Full Job Budget ($)</label><input style={s.input} type="number" value={form.full_budget} onChange={e => setField('full_budget', e.target.value)} placeholder="0.00" /></div>
            <div><label style={s.label}>Electrical Budget ($)</label><input style={s.input} type="number" value={form.electrical_budget} onChange={e => setField('electrical_budget', e.target.value)} placeholder="0.00" /></div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.btn, ...s.ghost }} onClick={() => setShowCreate(false)}>Cancel</button>
            <button style={{ ...s.btn, ...s.primary }} onClick={createJob} disabled={creating}>
              {creating ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input placeholder="Search job # or title..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...s.input, width: '220px' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <option value=''>All Statuses</option>
          {STATUSES.map(st => <option key={st}>{st}</option>)}
        </select>
        <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)}
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <option value=''>All Divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 && <p style={{ color: '#888' }}>No jobs found.</p>}

      {filtered.map(job => (
        <Link key={job.id} to={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...s.card, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1a1a2e'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#ddd'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{job.job_number}</span>
                  <span style={s.badge(job.status)}>{job.status}</span>
                </div>
                <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>{job.title}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {job.client_name && <span>{job.client_name} · </span>}
                  {job.project_city && <span>{job.project_city}{job.project_state ? ', ' + job.project_state : ''} · </span>}
                  <span>{job.divisions?.name}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px', color: '#555' }}>
                {job.electrical_budget > 0 && <div>Elec: ${job.electrical_budget.toLocaleString()}</div>}
                {job.project_manager && <div style={{ fontSize: '12px', color: '#888' }}>PM: {job.project_manager}</div>}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
