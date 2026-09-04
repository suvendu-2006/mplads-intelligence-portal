import React from 'react'

export type RiskTier = 'critical' | 'high' | 'medium' | 'low' | 'red' | 'orange' | 'yellow' | 'green'

interface TierBadgeProps {
  tier: RiskTier | string
  count?: number | string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  count,
  showLabel = true,
  size = 'md'
}) => {
  const normalized = (tier || '').toLowerCase().trim()

  const config = {
    critical: {
      label: 'Priority Audit',
      bg: 'bg-[var(--surface-alt)] text-rose-600 dark:text-rose-400 border-[var(--border-primary)]'
    },
    red: {
      label: 'Priority Audit',
      bg: 'bg-[var(--surface-alt)] text-rose-600 dark:text-rose-400 border-[var(--border-primary)]'
    },
    high: {
      label: 'Elevated Review',
      bg: 'bg-[var(--surface-alt)] text-amber-600 dark:text-amber-400 border-[var(--border-primary)]'
    },
    orange: {
      label: 'Elevated Review',
      bg: 'bg-[var(--surface-alt)] text-amber-600 dark:text-amber-400 border-[var(--border-primary)]'
    },
    medium: {
      label: 'Routine Check',
      bg: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]'
    },
    yellow: {
      label: 'Routine Check',
      bg: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]'
    },
    low: {
      label: 'Compliant',
      bg: 'bg-[var(--surface-alt)] text-emerald-600 dark:text-emerald-400 border-[var(--border-primary)]'
    },
    green: {
      label: 'Compliant',
      bg: 'bg-[var(--surface-alt)] text-emerald-600 dark:text-emerald-400 border-[var(--border-primary)]'
    }
  }[normalized] || {
    label: tier || 'Standard',
    bg: 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border-[var(--border-primary)]'
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  const formattedCount =
    typeof count === 'number'
      ? count <= 1 && count > 0
        ? count.toFixed(2)
        : count.toLocaleString('en-IN')
      : count

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-bold border ${config.bg} ${paddingClass} tabular-nums shadow-2xs`}
    >
      {showLabel && <span>{config.label}</span>}
      {formattedCount !== undefined && (
        <span className={showLabel ? 'opacity-80 font-mono text-[10px]' : ''}>
          {showLabel ? `(${formattedCount})` : `Score: ${formattedCount}`}
        </span>
      )}
    </span>
  )
}
