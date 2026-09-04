import React from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AlertCircle, Home, MapPin, Users, Globe2 } from 'lucide-react'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
]

export const NotFound: React.FC = () => {
  const location = useLocation()
  const rawPath = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '').trim()
  const parts = rawPath.split('/').filter(Boolean)
  const prefix = (parts[0] || '').toLowerCase()
  const lastPart = (parts[parts.length - 1] || '').toLowerCase()

  // 1. Direct prefix auto-recovery
  if (parts.length >= 2 && (prefix === 'districts' || prefix === 'district')) {
    return <Navigate to={`/districts/${encodeURIComponent(parts.slice(1).join('/'))}`} replace />
  }
  if (parts.length >= 2 && (prefix === 'states' || prefix === 'state')) {
    return <Navigate to={`/states/${encodeURIComponent(parts.slice(1).join('/'))}`} replace />
  }
  if (parts.length >= 2 && (prefix === 'mps' || prefix === 'mp')) {
    return <Navigate to={`/mps/${encodeURIComponent(parts.slice(1).join('/'))}`} replace />
  }

  // 2. Check if user typed a state name in the URL (e.g. /bihar or /Bihar)
  const matchedState = INDIAN_STATES.find(
    s => s.toLowerCase() === lastPart ||
         s.toLowerCase().replace(/\s+/g, '-') === lastPart
  )
  if (matchedState) {
    return <Navigate to={`/states/${encodeURIComponent(matchedState)}`} replace />
  }

  // 3. Check if user typed a district name in the URL (e.g. /patna or /Patna)
  for (const [st, dists] of Object.entries(STATE_DISTRICTS_MAP)) {
    const matchedDist = dists.find(d => d.toLowerCase() === lastPart)
    if (matchedDist) {
      return <Navigate to={`/districts/${encodeURIComponent(matchedDist)}`} replace />
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
      <div className="lux-card p-8 max-w-lg w-full shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">404 — Page Not Found</h1>
        <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
          The requested administrative view <code className="px-1.5 py-0.5 rounded bg-[var(--surface-alt)] font-mono text-[11px] text-[var(--brand-primary)]">{location.pathname}</code> does not exist in master records.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] hover:opacity-90 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm"
          >
            <Home className="w-3.5 h-3.5" /> Return to Dashboard
          </Link>
          <Link
            to="/states"
            className="px-4 py-2 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> Browse States &amp; UTs
          </Link>
          <Link
            to="/mps"
            className="px-4 py-2 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> MPs Performance
          </Link>
        </div>
      </div>
    </div>
  )
}

