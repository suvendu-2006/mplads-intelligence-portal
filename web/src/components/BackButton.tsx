import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  fallback?: string
  label?: string
  className?: string
  showLabel?: boolean
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallback = '/',
  label = 'Back',
  className = '',
  showLabel = true
}) => {
  const navigate = useNavigate()

  const handleBack = () => {
    // Check if there is a previous page within our SPA navigation history
    if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label || 'Go back to previous page'}
      title="Go back to the exact previous page"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-primary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer group shrink-0 select-none ${className}`}
    >
      <ArrowLeft size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] group-hover:-translate-x-0.5 transition-transform duration-150 shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  )
}

export default BackButton
