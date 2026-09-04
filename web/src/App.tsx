import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NationalDashboard } from './pages/NationalDashboard'
import { LoadingSkeleton } from './components/LoadingSkeleton'
import { ScrollToTop } from './components/ScrollToTop'

const BrowseStates = React.lazy(() => import('./pages/BrowseStates').then(m => ({ default: m.BrowseStates })))
const StateDetail = React.lazy(() => import('./pages/StateDetail').then(m => ({ default: m.StateDetail })))
const BrowseMPs = React.lazy(() => import('./pages/BrowseMPs').then(m => ({ default: m.BrowseMPs })))
const MPDetail = React.lazy(() => import('./pages/MPDetail').then(m => ({ default: m.MPDetail })))
const MyState = React.lazy(() => import('./pages/MyState').then(m => ({ default: m.MyState })))
const DistrictDashboard = React.lazy(() => import('./pages/DistrictDashboard').then(m => ({ default: m.DistrictDashboard })))
const MPDashboard = React.lazy(() => import('./pages/MPDashboard').then(m => ({ default: m.MPDashboard })))
const AuditDesk = React.lazy(() => import('./pages/AuditDesk').then(m => ({ default: m.AuditDesk })))
const GISMap = React.lazy(() => import('./pages/GISMap').then(m => ({ default: m.GISMap })))
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const NotFound = React.lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })))

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
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
          <Route path="mp-dashboard" element={<MPDashboard />} />
          <Route path="mp-console" element={<MPDashboard />} />
          <Route path="district-dashboard" element={<DistrictDashboard />} />
          <Route path="district-console" element={<DistrictDashboard />} />
          <Route path="districts/:district" element={<DistrictDashboard />} />
          <Route path="districts" element={<DistrictDashboard />} />
          <Route path="district/:district" element={<DistrictDashboard />} />
          <Route path="district" element={<DistrictDashboard />} />
          <Route path="my-state" element={<MyState />} />
          <Route path="state-console" element={<MyState />} />
          <Route path="audit" element={<AuditDesk />} />
          <Route path="map" element={<GISMap />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
