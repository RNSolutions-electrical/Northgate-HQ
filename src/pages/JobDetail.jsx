import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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
const DOC_TYPES = ['Permit', 'Drawing', 'Other']

const s = {
  container: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  btn: { padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  primary: { background: '#1a1a2e', color: '#fff' },
  ghost: { background: '#eee', color: '#333' },
  danger: { background: '#fee2e2', color: '#c00' },
  input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' },
  card: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '16px' },
  label: { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' },
  value: { fontSize: '14px', color: '#222', fontWeight: '500', minHeight: '20px' },
  badge: (status) => ({
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 'bold',
    background: STATUS_COLORS[status] + '22',
    color: STATUS_COLORS[status],
    border: `1px solid ${STATUS_COLORS[status]}44`,
  }),
  sectionTitle: { fontSize: '15px', fontWeight: 'bold', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #eee', margin: '0 0 16px' },
}

function Field({ label, value, editing, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      {editing
        ? <input type={type} style={s.input} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <div style={s.value}>{value || <span style={{ color: '#bbb' }}>—</span>}</div>
      }
    </div>
  )
}

export default function JobDetail() {
  const { id } = useParams()
  const { user } = useUser()

  const [job, setJob] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [documents, setDocuments] = useState([])
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)
  const [addingDoc, setAddingDoc] = useState(false)
  const [docForm, setDocForm] = useState({ type: 'Permit', title: '', reference: '', url: '', notes: '' })

  useEffect(() => {
    fetchJob()
    fetchDocuments()
  }, [id])

  async function fetchJob() {
    const { data } = await supabase.from('jobs')
      .select('*, job_identifiers(code, label), divisions(name)')
      .eq('id', id).single()
    if (data) { setJob(data); setForm(data) }
  }

  async function fetchDocuments() {
    const { data } = await supabase.from('job_documents')
      .select('*').eq('job_id', id).order('type').order('created_at')
    if (data) setDocuments(data)
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveJob() {
    setSaving(true)
    const { error } = await supabase.from('jobs').update({
      ...form,
      full_budget: parseFloat(form.full_budget) || 0,
      electrical_budget: parseFloat(form.electrical_budget) || 0,
      committed_budget: parseFloat(form.committed_budget) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (!error) { setEditing(false); fetchJob(); setStatus('✅ Job saved') }
    else setStatus('❌ Error: ' + error.message)
    setSaving(false)
  }

  async function updateStatus(newStatus) {
    await supabase.from('jobs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    fetchJob()
  }

  async function approveBudget() {
    await supabase.from('jobs').update({
      committed_approved: true,
      committed_approved_by: user.id,
      committed_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    fetchJob()
    setStatus('✅ Committed budget approved')
  }

  async function addDocument() {
    if (!docForm.title) return
    setAddingDoc(true)
    const { error } = await supabase.from('job_documents').insert({
      job_id: id, ...docForm, added_by: user.id,
    })
    if (!error) {
      setShowDocForm(false)
      setDocForm({ type: 'Permit', title: '', reference: '', url: '', notes: '' })
      fetchDocuments()
    } else setStatus('❌ Error: ' + error.message)
    setAddingDoc(false)
  }

  async function deleteDocument(docId) {
    if (!confirm('Remove this document?')) return
    await supabase.from('job_documents').delete().eq('id', docId)
    fetchDocuments()
  }

  if (!job) return <div style={{ padding: '40px' }}>Loading...</div>

  const permits = documents.filter(d => d.type === 'Permit')
  const drawings = documents.filter(d => d.type === 'Drawing')
  const others = documents.filter(d => d.type === 'Other')

  return (
    <div style={s.container}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <Link to="/jobs" style={{ fontSize: '13px', color: '#666', textDecoration: 'none' }}>← Jobs</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{job.job_number}</h1>
            <span style={s.badge(job.status)}>{job.status}</span>
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>{job.title}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {editing
            ? <>
                <button style={{ ...s.btn, ...s.ghost }} onClick={() => { setEditing(false); setForm(job) }}>Cancel</button>
                <button style={{ ...s.btn, ...s.primary }} onClick={saveJob} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </>
            : <button style={{ ...s.btn, ...s.primary }} onClick={() => setEditing(true)}>✏️ Edit</button>
          }
        </div>
      </div>

      {status && <p style={{ color: status.startsWith('✅') ? 'green' : '#c00', marginBottom: '12px' }}>{status}</p>}

      {/* Status */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Status</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {STATUSES.map(st => (
            <button key={st} onClick={() => updateStatus(st)}
              style={{
                ...s.btn,
                background: job.status === st ? STATUS_COLORS[st] : STATUS_COLORS[st] + '22',
                color: job.status === st ? '#fff' : STATUS_COLORS[st],
                border: `1px solid ${STATUS_COLORS[st]}44`,
              }}>
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Client */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Client Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Client Name" value={form.client_name} editing={editing} onChange={v => setField('client_name', v)} />
          <Field label="Contact Name" value={form.client_contact_name} editing={editing} onChange={v => setField('client_contact_name', v)} />
          <Field label="Contact Email" value={form.client_contact_email} editing={editing} onChange={v => setField('client_contact_email', v)} type="email" />
          <Field label="Contact Phone" value={form.client_contact_phone} editing={editing} onChange={v => setField('client_contact_phone', v)} type="tel" />
        </div>
      </div>

      {/* Project */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Project Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <Field label="Address" value={form.project_address} editing={editing} onChange={v => setField('project_address', v)} />
          <Field label="City" value={form.project_city} editing={editing} onChange={v => setField('project_city', v)} />
          <Field label="State" value={form.project_state} editing={editing} onChange={v => setField('project_state', v)} />
        </div>
        <Field label="Description" value={form.description} editing={editing} onChange={v => setField('description', v)} />
      </div>

      {/* Personnel */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Personnel</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <Field label="Project Manager" value={form.project_manager} editing={editing} onChange={v => setField('project_manager', v)} />
          <Field label="Superintendent" value={form.superintendent} editing={editing} onChange={v => setField('superintendent', v)} />
          <Field label="Electrical Lead" value={form.electrical_lead} editing={editing} onChange={v => setField('electrical_lead', v)} />
        </div>
      </div>

      {/* Budget */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Budget</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={s.label}>Full Job Budget</label>
            {editing
              ? <input type="number" style={s.input} value={form.full_budget || ''} onChange={e => setField('full_budget', e.target.value)} />
              : <div style={{ ...s.value, fontSize: '20px' }}>${(job.full_budget || 0).toLocaleString()}</div>
            }
          </div>
          <div>
            <label style={s.label}>Electrical Budget</label>
            {editing
              ? <input type="number" style={s.input} value={form.electrical_budget || ''} onChange={e => setField('electrical_budget', e.target.value)} />
              : <div style={{ ...s.value, fontSize: '20px' }}>${(job.electrical_budget || 0).toLocaleString()}</div>
            }
          </div>
          <div>
            <label style={s.label}>
              Committed Budget
              {job.committed_approved && <span style={{ marginLeft: '6px', color: '#10b981', fontSize: '11px' }}>✓ Approved</span>}
            </label>
            {editing
              ? <input type="number" style={s.input} value={form.committed_budget || ''} onChange={e => setField('committed_budget', e.target.value)} />
              : <div style={{ ...s.value, fontSize: '20px' }}>${(job.committed_budget || 0).toLocaleString()}</div>
            }
            {!job.committed_approved && job.committed_budget > 0 && !editing && (
              <button style={{ ...s.btn, background: '#10b981', color: '#fff', marginTop: '8px', fontSize: '12px', padding: '6px 12px' }}
                onClick={approveBudget}>
                Approve
              </button>
            )}
            {job.committed_approved && job.committed_approved_at && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Approved {new Date(job.committed_approved_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={s.sectionTitle}>Documents</div>
          <button style={{ ...s.btn, ...s.primary }} onClick={() => setShowDocForm(!showDocForm)}>
            {showDocForm ? '✕ Cancel' : '+ Add Document'}
          </button>
        </div>

        {showDocForm && (
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={s.label}>Type</label>
                <select style={s.input} value={docForm.type} onChange={e => setDocForm(p => ({ ...p, type: e.target.value }))}>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Title *</label>
                <input style={s.input} value={docForm.title} onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Electrical Permit" />
              </div>
              <div>
                <label style={s.label}>Reference # (copyable)</label>
                <input style={s.input} value={docForm.reference} onChange={e => setDocForm(p => ({ ...p, reference: e.target.value }))} placeholder="e.g. EP-2026-1234" />
              </div>
              <div>
                <label style={s.label}>URL (optional)</label>
                <input style={s.input} value={docForm.url} onChange={e => setDocForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Notes</label>
              <input style={s.input} value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <button style={{ ...s.btn, ...s.primary }} onClick={addDocument} disabled={addingDoc || !docForm.title}>
              {addingDoc ? 'Adding...' : 'Add Document'}
            </button>
          </div>
        )}

        {[['Permits', permits], ['Drawings', drawings], ['Other', others]].map(([sectionLabel, docs]) =>
          docs.length > 0 && (
            <div key={sectionLabel} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>{sectionLabel}</div>
              {docs.map(doc => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px', background: '#fff', border: '1px solid #eee', borderRadius: '6px', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{doc.title}</div>
                    {doc.reference && (
                      <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{doc.reference}</span>
                        <button onClick={() => navigator.clipboard.writeText(doc.reference)}
                          style={{ fontSize: '11px', padding: '1px 6px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' }}>
                          Copy
                        </button>
                      </div>
                    )}
                    {doc.notes && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{doc.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        style={{ ...s.btn, ...s.primary, textDecoration: 'none', padding: '4px 10px' }}>
                        Open ↗
                      </a>
                    )}
                    <button style={{ ...s.btn, ...s.danger, padding: '4px 10px' }} onClick={() => deleteDocument(doc.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {documents.length === 0 && !showDocForm && (
          <p style={{ color: '#aaa', fontSize: '13px' }}>No documents added yet.</p>
        )}
      </div>
    </div>
  )
}
