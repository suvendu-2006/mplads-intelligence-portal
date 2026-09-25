import React from 'react'
import { fmtCrore, fmtLakh } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'

export interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  formatter?: 'crore' | 'lakh' | 'percent' | 'number'
}

/**
 * Universal custom tooltip for all Recharts components
 * Replaces generic white box with branded, ₹-formatted tooltip
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = React.memo(({
  active,
  payload,
  label,
  formatter = 'crore',
}) => {
  const { t, toNativeDigits } = useTranslation()
  if (!active || !payload || payload.length === 0) return null

  const formatValue = (value: number): string => {
    switch (formatter) {
      case 'crore':
        // If already scaled in Crores (e.g. 150 Cr vs 1500000000)
        if (Math.abs(value) < 100000) {
          const formatted = toNativeDigits(value.toLocaleString('en-IN', { maximumFractionDigits: 1 }))
          return `₹${formatted} ${t('unit.cr')}`
        }
        return `₹${toNativeDigits(fmtCrore(value, 2))} ${t('unit.cr')}`
      case 'lakh':
        if (Math.abs(value) < 100000) {
          const formatted = toNativeDigits(value.toLocaleString('en-IN', { maximumFractionDigits: 1 }))
          return `₹${formatted} ${t('unit.lakh')}`
        }
        return `₹${toNativeDigits(fmtLakh(value, 2))} ${t('unit.lakh')}`
      case 'percent':
        return `${toNativeDigits(value.toFixed(1))}%`
      case 'number':
      default:
        return toNativeDigits(value.toLocaleString('en-IN'))
    }
  }

  return (
    <div
      className="rounded-xl border shadow-xl pointer-events-none relative z-50"
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderColor: 'var(--border-primary)',
        padding: '10px 14px',
        zIndex: 999999,
      }}
    >
      {label && (
        <div className="text-xs font-bold text-[var(--text-secondary)] mb-2">
          {toNativeDigits(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-xs shrink-0"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-[var(--text-secondary)] font-medium">
              {entry.name}:
            </span>
            <span className="text-[var(--text-primary)] font-bold tabular-nums ml-auto">
              {formatValue(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})

