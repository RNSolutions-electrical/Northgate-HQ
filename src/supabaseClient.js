import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qpbuzinkjbjbvcdwvdfu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYnV6aW5ramJqYnZjZHd2ZGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDczMDAsImV4cCI6MjA5NDAyMzMwMH0.tZbKeh11VyzQKy6cTxgL8-RjoOMeJXr8ddu-S0veX70'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
