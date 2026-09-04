import React from 'react'
import { fmtCrore, fmtLakh } from '../../lib/currency'

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
export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  formatter = 'crore',
}) => {
  if (!active || !payload || payload.length === 0) return null

  const formatValue = (value: number): string => {
    switch (formatter) {
      case 'crore':
        // If already scaled in Crores (e.g. 150 Cr vs 1500000000)
        if (Math.abs(value) < 100000) {
          return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`
        }
        return `₹${fmtCrore(value, 2)} Cr`
      case 'lakh':
        if (Math.abs(value) < 100000) {
          return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`
        }
        return `₹${fmtLakh(value, 2)} L`
      case 'percent':
        return `${value.toFixed(1)}%`
      case 'number':
      default:
        return value.toLocaleString('en-IN')
    }
  }

  return (
    <div
      className="rounded-xl border shadow-lg backdrop-blur-sm"
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderColor: 'var(--border-primary)',
        padding: '12px 16px',
      }}
    >
      {label && (
        <div className="text-xs font-bold text-[var(--text-secondary)] mb-2">
          {label}
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
}
