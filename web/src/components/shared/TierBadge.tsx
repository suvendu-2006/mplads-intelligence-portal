import React from 'react'
import {
  OctagonAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle
} from 'lucide-react'

export type RiskTier =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'clear'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'clean'

interface TierBadgeProps {
  tier: RiskTier | string
  count?: number | string
  showLabel?: boolean
  showIcon?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export const TierBadge: React.FC<TierBadgeProps> = React.memo(({
  tier,
  count,
  showLabel = true,
  showIcon = true,
  size = 'md',
  className = ''
}) => {
  const normalized = (tier || '').toLowerCase().trim()

  const config = {
    critical: {
      label: 'CRITICAL',
      bg: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
      Icon: OctagonAlert,
    },
    red: {
      label: 'CRITICAL',
      bg: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
      Icon: OctagonAlert,
    },
    high: {
      label: 'HIGH',
      bg: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
      Icon: AlertTriangle,
    },
    orange: {
      label: 'HIGH',
      bg: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
      Icon: AlertTriangle,
    },
    medium: {
      label: 'MEDIUM',
      bg: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
      Icon: AlertCircle,
    },
    yellow: {
      label: 'MEDIUM',
      bg: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
      Icon: AlertCircle,
    },
    low: {
      label: 'LOW',
      bg: 'bg-[#E0F2FE] text-[#075985] border-[#BAE6FD]',
      Icon: Info,
    },
    clear: {
      label: 'CLEAR',
      bg: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
      Icon: CheckCircle,
    },
    clean: {
      label: 'CLEAR',
      bg: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
      Icon: CheckCircle,
    },
    green: {
      label: 'CLEAR',
      bg: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
      Icon: CheckCircle,
    },
  }[normalized] || {
    label: (tier || 'CLEAR').toUpperCase(),
    bg: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
    Icon: Info,
  }

  const { Icon } = config
  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  const iconSize = size === 'sm' ? 12 : 13

  const formattedCount =
    typeof count === 'number'
      ? count <= 1 && count > 0
        ? count.toFixed(2)
        : count.toLocaleString('en-IN')
      : count

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-bold border ${config.bg} ${paddingClass} tabular-nums shadow-2xs whitespace-nowrap shrink-0 ${className}`}
    >
      {showIcon && <Icon size={iconSize} className="shrink-0" />}
      {showLabel && <span>{config.label}</span>}
      {formattedCount !== undefined && (
        <span className={showLabel ? 'opacity-85 font-mono text-[10px]' : ''}>
          {showLabel ? `(${formattedCount})` : `Score: ${formattedCount}`}
        </span>
      )}
    </span>
  )
})
