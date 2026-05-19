import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn, UserButton } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

import Dashboard from './pages/Dashboard.jsx'
import Inventory from './pages/Inventory.jsx'
import InventoryAdmin from './pages/InventoryAdmin.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Vehicles from './pages/Vehicles.jsx'
import QuickTakeoff from './pages/QuickTakeoff.jsx'
import Estimator from './pages/Estimator.jsx'
import ImportExport from './pages/ImportExport.jsx'
import Customization from './pages/Customization.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import FileStorage from './pages/FileStorage.jsx'
import Billing from './pages/Billing.jsx'

const navLinks = [
  { path: '/', label: 'Dashboard' },
  { path: '/inventory', label: 'Inventory' },
  { path: '/jobs', label: 'Jobs' },
  { path: '/vehicles', label: 'Vehicles' },
  { path: '/quick-takeoff', label: 'Quick Takeoff' },
  { path: '/estimator', label: 'Estimator' },
  { path: '/import-export', label: 'Import / Export' },
  { path: '/customization', label: 'Customization' },
  { path: '/ai-assistant', label: 'AI Assistant' },
  { path: '/file-storage', label: 'File Storage' },
  { path: '/billing', label: 'Billing' },
]

function NavBar() {
  return (
    <nav style={{
      background: '#1a1a2e',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <span style={{ color: '#e94560', fontWeight: 'bold', fontSize: '18px', marginRight: '8px' }}>
        Northgate HQ
      </span>
      {navLinks.map(link => (
        <Link
          key={link.path}
          to={link.path}
          style={{ color: '#cccccc', textDecoration: 'none', fontSize: '14px' }}
        >
          {link.label}
        </Link>
      ))}
      <div style={{ marginLeft: 'auto' }}>
        <UserButton />
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <>
      <SignedIn>
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/admin" element={<InventoryAdmin />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/quick-takeoff" element={<QuickTakeoff />} />
          <Route path="/estimator" element={<Estimator />} />
          <Route path="/import-export" element={<ImportExport />} />
          <Route path="/customization" element={<Customization />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/file-storage" element={<FileStorage />} />
          <Route path="/billing" element={<Billing />} />
        </Routes>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
