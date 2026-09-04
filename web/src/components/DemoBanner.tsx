import React from 'react'
import { useStore } from '@/store/useStore'
import { AlertCircle, X } from 'lucide-react'

export const DemoBanner: React.FC = () => {
  const { user, bannerDismissed, setBannerDismissed } = useStore()

  if (bannerDismissed) return null

  const getRoleDisplayName = () => {
    switch (user.role) {
      case 'state_nodal_officer':
        return `State Nodal Officer (${user.state || 'Assigned State'})`
      case 'auditor':
        return 'CAG / MoSPI Forensic Auditor (Audit Desk Unlocked)'
      case 'analyst':
        return 'Policy Data Analyst (Advanced Screening Unlocked)'
      case 'admin':
        return 'Central Ministry Administrator (Superuser)'
      default:
        return 'Public / Ministry Viewer (Read-Only Mode)'
    }
  }

  return (
    <div className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-primary)]"></span>
          </span>
          <AlertCircle className="w-3.5 h-3.5 text-[var(--brand-primary)] hidden sm:inline" />
          <span>
            <strong className="text-[var(--text-primary)]">🎭 DEMO MODE:</strong> Active persona as{' '}
            <span className="text-[var(--brand-primary)] font-bold">{getRoleDisplayName()}</span>.
            Role-based dashboard view active.
          </span>
        </div>
        <button
          onClick={() => setBannerDismissed(true)}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition p-1 rounded-lg hover:bg-[var(--surface-primary)]"
          title="Dismiss banner"
          aria-label="Dismiss demo banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
