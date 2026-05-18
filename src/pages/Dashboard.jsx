import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'

export default function Dashboard() {
  const [status, setStatus] = useState('Checking Supabase connection...')

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase.auth.getSession()
        if (error) {
          setStatus('❌ Supabase connection failed: ' + error.message)
        } else {
          setStatus('✅ Supabase connected successfully')
        }
      } catch (err) {
        setStatus('❌ Connection error: ' + err.message)
      }
    }
    testConnection()
  }, [])

  return (
    <div style={{ padding: '40px' }}>
      <h1>Dashboard</h1>
      <p>{status}</p>
    </div>
  )
}