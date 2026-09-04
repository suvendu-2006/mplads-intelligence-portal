import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NationalDashboard } from './pages/NationalDashboard'
import { BrowseStates } from './pages/BrowseStates'
import { StateDetail } from './pages/StateDetail'
import { BrowseMPs } from './pages/BrowseMPs'
import { MPDetail } from './pages/MPDetail'
import { MyState } from './pages/MyState'
import { DistrictDashboard } from './pages/DistrictDashboard'
import { MPDashboard } from './pages/MPDashboard'
import { AuditDesk } from './pages/AuditDesk'
import { GISMap } from './pages/GISMap'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'

import { ScrollToTop } from './components/ScrollToTop'

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
