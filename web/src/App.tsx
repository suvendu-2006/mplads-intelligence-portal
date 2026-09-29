import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ScrollToTop } from './components/ScrollToTop'

import { RouteErrorBoundary } from './components/RouteErrorBoundary'

function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>
) {
  return React.lazy(async () => {
    let hasRefreshed = false
    try {
      hasRefreshed = typeof window !== 'undefined' && sessionStorage.getItem('chunk_force_refreshed') === 'true'
    } catch {}

    try {
      const component = await componentImport()
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('chunk_force_refreshed', 'false')
        } catch {}
      }
      return 'default' in component ? component : { default: component }
    } catch (error: any) {
      if (!hasRefreshed && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('chunk_force_refreshed', 'true')
        } catch {}
        window.location.reload()
        return new Promise<{ default: T }>((_, reject) => {
          setTimeout(() => reject(new Error('Chunk reload initiated')), 1500)
        })
      }
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('chunk_force_refreshed')
        } catch {}
      }
      throw error
    }
  })
}

const NationalDashboard = lazyWithRetry(() => import('./pages/NationalDashboard').then(m => ({ default: m.NationalDashboard })))
const BrowseStates = lazyWithRetry(() => import('./pages/BrowseStates').then(m => ({ default: m.BrowseStates })))
const StateDetail = lazyWithRetry(() => import('./pages/StateDetail').then(m => ({ default: m.StateDetail })))
const BrowseMPs = lazyWithRetry(() => import('./pages/BrowseMPs').then(m => ({ default: m.BrowseMPs })))
const MPDetail = lazyWithRetry(() => import('./pages/MPDetail').then(m => ({ default: m.MPDetail })))
const ConstituencyDetail = lazyWithRetry(() => import('./pages/ConstituencyDetail').then(m => ({ default: m.ConstituencyDetail })))
const MyState = lazyWithRetry(() => import('./pages/MyState').then(m => ({ default: m.MyState })))
const DistrictDashboard = lazyWithRetry(() => import('./pages/DistrictDashboard').then(m => ({ default: m.DistrictDashboard })))
const MPDashboard = lazyWithRetry(() => import('./pages/MPDashboard').then(m => ({ default: m.MPDashboard })))
const AuditDesk = lazyWithRetry(() => import('./pages/AuditDesk').then(m => ({ default: m.AuditDesk })))
const GISMap = lazyWithRetry(() => import('./pages/GISMap').then(m => ({ default: m.GISMap })))
const Login = lazyWithRetry(() => import('./pages/Login').then(m => ({ default: m.Login })))
const NotFound = lazyWithRetry(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })))

import { ProtectedRoute } from './components/ProtectedRoute'

export const App: React.FC = () => {
  React.useEffect(() => {
    // Eagerly pre-warm all primary route JS chunks immediately for 0ms light-speed tab switches
    const timer = setTimeout(() => {
      import('./pages/BrowseStates').catch(() => {})
      import('./pages/BrowseMPs').catch(() => {})
      import('./pages/StateDetail').catch(() => {})
      import('./pages/MPDetail').catch(() => {})
      import('./pages/DistrictDashboard').catch(() => {})
      import('./pages/MyState').catch(() => {})
      import('./pages/MPDashboard').catch(() => {})
      import('./pages/ConstituencyDetail').catch(() => {})
      import('./pages/AuditDesk').catch(() => {})
      import('./pages/GISMap').catch(() => {})
      import('./pages/Login').catch(() => {})
    }, 50)

    return () => clearTimeout(timer)
  }, [])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<NationalDashboard />} />
            <Route path="login" element={<Login />} />
            <Route path="states" element={<BrowseStates />} />
            <Route path="states/:state" element={<StateDetail />} />
            <Route path="state/:state" element={<StateDetail />} />
            <Route path="state" element={<BrowseStates />} />
            <Route path="mps" element={<BrowseMPs />} />
            <Route path="mps/:id" element={<MPDetail />} />
            <Route path="mp/:id" element={<MPDetail />} />
            <Route path="mp" element={<BrowseMPs />} />
            <Route path="constituency/:name" element={<ConstituencyDetail />} />
            <Route path="constituencies/:name" element={<ConstituencyDetail />} />
            <Route path="constituency" element={<BrowseMPs />} />
            <Route path="constituencies" element={<BrowseMPs />} />
            <Route path="mp-dashboard" element={<MPDashboard />} />
            <Route path="mp-dashboard/:id" element={<MPDashboard />} />
            <Route path="mp-console" element={<MPDashboard />} />
            <Route path="mp-console/:id" element={<MPDashboard />} />
            <Route path="district-dashboard" element={<DistrictDashboard />} />
            <Route path="district-console" element={<DistrictDashboard />} />
            <Route path="districts/:district" element={<DistrictDashboard />} />
            <Route path="districts" element={<DistrictDashboard />} />
            <Route path="district/:district" element={<DistrictDashboard />} />
            <Route path="district" element={<DistrictDashboard />} />
            <Route path="my-state" element={<ProtectedRoute allowedRoles={['state_nodal_officer', 'mospi']} roleName="State Nodal Officer"><MyState /></ProtectedRoute>} />
            <Route path="state-console" element={<ProtectedRoute allowedRoles={['state_nodal_officer', 'mospi']} roleName="State Nodal Officer"><MyState /></ProtectedRoute>} />
            <Route path="audit" element={<ProtectedRoute allowedRoles={['mospi']} roleName="MoSPI Central Authority"><AuditDesk /></ProtectedRoute>} />
            <Route path="map" element={<GISMap />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  )
}

export default App
