import React from 'react'
import { Building2 } from 'lucide-react'

export interface AgencyBadgeProps {
  agency?: string | null
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'neutral' | 'warning' | 'critical' | 'success' | 'teal'
  className?: string
  showIcon?: boolean
}

export const AgencyBadge: React.FC<AgencyBadgeProps> = React.memo(({
  agency,
  size = 'sm',
  variant = 'default',
  className = '',
  showIcon = true
}) => {
  const displayAgency = (agency || 'District Authority').trim()

  const variantStyles = {
    default: 'bg-[#E0F2FE] text-[#075985] border-[#BAE6FD] hover:bg-[#BAE6FD]/40',
    neutral: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
    warning: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
    critical: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
    success: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
    teal: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
  }[variant] || 'bg-[#E0F2FE] text-[#075985] border-[#BAE6FD]'

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2'
  }[size]

  const iconSizes = {
    sm: 11,
    md: 13,
    lg: 15
  }[size]

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-md transition-colors shadow-2xs leading-snug break-words text-left ${variantStyles} ${sizeStyles} ${className}`}
      title={displayAgency}
    >
      {showIcon && <Building2 size={iconSizes} className="shrink-0 opacity-80 mt-0.5 self-start" />}
      <span className="break-words whitespace-normal">{displayAgency}</span>
    </span>
  )
})
