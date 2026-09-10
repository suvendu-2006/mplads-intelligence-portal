import React from 'react'
import { Building2 } from 'lucide-react'

export interface AgencyBadgeProps {
  agency?: string | null
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'neutral' | 'warning' | 'critical' | 'success'
  className?: string
  showIcon?: boolean
}

export const AgencyBadge: React.FC<AgencyBadgeProps> = ({
  agency,
  size = 'sm',
  variant = 'default',
  className = '',
  showIcon = true
}) => {
  const displayAgency = (agency || 'District Authority').trim()

  const variantStyles = {
    default: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 hover:bg-blue-500/15',
    neutral: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    critical: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  }[variant] || 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'

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
      className={`inline-flex items-center font-medium border rounded-lg max-w-[280px] whitespace-nowrap overflow-hidden text-ellipsis transition-colors shadow-2xs ${variantStyles} ${sizeStyles} ${className}`}
      title={displayAgency}
    >
      {showIcon && <Building2 size={iconSizes} className="shrink-0 opacity-80" />}
      <span className="truncate">{displayAgency}</span>
    </span>
  )
}
