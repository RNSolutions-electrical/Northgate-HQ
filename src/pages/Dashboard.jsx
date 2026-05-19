import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'

export default function Dashboard() {
  const [divisions, setDivisions] = useState([])
  const [status, setStatus] = useState('Connecting to database...')

  useEffect(() => {
    async function fetchDivisions() {
      const { data, error } = await supabase.from('divisions').select('*')
      if (error) {
        setStatus('❌ Database error: ' + error.message)
      } else {
        setDivisions(data)
        setStatus('✅ Supabase connected — ' + data.length + ' divisions found')
      }
    }
    fetchDivisions()
  }, [])

  return (
    <div style={{ padding: '40px' }}>
      <h1>Dashboard</h1>
      <p>{status}</p>
      <ul>
        {divisions.map(d => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
    </div>
  )
}