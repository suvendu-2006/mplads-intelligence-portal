import React, { useEffect, useState } from 'react'
import { LucideIcon, Info } from 'lucide-react'
import { DeltaChip } from './DeltaChip'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  prefix?: string
  unit?: string
  delta?: number
  sparkline?: number[]
  description?: string
  tooltip?: string
  theme?: 'gold' | 'navy' | 'emerald' | 'amber' | 'red' | 'slate'
  gaugeValue?: number
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  prefix = '',
  unit = '',
  delta,
  sparkline,
  description,
  tooltip,
  theme = 'navy'
}) => {
  const [displayValue, setDisplayValue] = useState<string | number>(
    typeof value === 'number' ? 0 : value
  )

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value)
      return
    }

    const startVal = 0
    const endVal = value
    const duration = 800
    const startTime = performance.now()

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = startVal + (endVal - startVal) * easeOut

      if (endVal >= 1000) {
        setDisplayValue(Math.round(current).toLocaleString('en-IN'))
      } else if (Number.isInteger(endVal)) {
        setDisplayValue(Math.round(current))
      } else {
        setDisplayValue(current.toFixed(1))
      }

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        if (endVal >= 1000) {
          setDisplayValue(endVal.toLocaleString('en-IN'))
        } else if (Number.isInteger(endVal)) {
          setDisplayValue(endVal)
        } else {
          setDisplayValue(endVal.toFixed(1))
        }
      }
    }

    requestAnimationFrame(step)
  }, [value])

  const iconBgClasses = {
    gold: 'bg-[var(--brand-gold)]/15 text-[var(--brand-gold)] border-[var(--brand-gold)]/30',
    navy: 'bg-[var(--chart-navy)]/10 text-[var(--chart-navy)] border-[var(--chart-navy)]/25',
    emerald: 'bg-[var(--chart-emerald)]/10 text-[var(--chart-emerald)] border-[var(--chart-emerald)]/25',
    amber: 'bg-[var(--chart-amber)]/10 text-[var(--chart-amber)] border-[var(--chart-amber)]/25',
    red: 'bg-[var(--chart-rose)]/10 text-[var(--chart-rose)] border-[var(--chart-rose)]/25',
    slate: 'bg-[var(--neutral-500)]/15 text-[var(--neutral-700)] dark:text-[var(--neutral-300)] border-[var(--neutral-500)]/30'
  }[theme]

  const numeralClasses = {
    gold: 'text-[var(--brand-gold)]',
    navy: 'text-[var(--text-primary)]',
    emerald: 'text-[var(--chart-emerald)]',
    amber: 'text-[var(--chart-amber)]',
    red: 'text-[var(--chart-rose)]',
    slate: 'text-[var(--text-primary)]'
  }[theme]

  return (
    <div className="lux-card p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Top row: Icon + Label + Tooltip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBgClasses}`}>
            <Icon size={18} />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
            {label}
          </span>
        </div>
        {tooltip && (
          <div className="group relative cursor-help">
            <Info size={14} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors" />
            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-50 w-56 p-2.5 text-xs font-medium rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xl text-[var(--text-primary)]">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      {/* Main Stat */}
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-xl font-black text-[var(--text-primary)]">{prefix}</span>}
          <span className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${numeralClasses}`}>
            {displayValue}
          </span>
          {unit && <span className="text-sm font-extrabold text-[var(--text-primary)]">{unit}</span>}
        </div>
        {delta !== undefined && <DeltaChip value={delta} />}
      </div>

      {/* Bottom description */}
      {description && (
        <p className="text-[11px] font-semibold text-[var(--text-secondary)] mt-2 line-clamp-1">
          {description}
        </p>
      )}
    </div>
  )
}
