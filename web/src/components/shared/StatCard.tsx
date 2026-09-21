import React, { useEffect, useState } from 'react'
import { LucideIcon, Info } from 'lucide-react'
import { DeltaChip } from './DeltaChip'
import { useTranslation, toNativeDigits } from '../../lib/i18n'

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
  theme?: 'gold' | 'navy' | 'emerald' | 'amber' | 'red' | 'slate' | 'espresso'
  gaugeValue?: number
  decimals?: number
}

const formatStatValue = (val: number | string, decimals?: number): string | number => {
  if (typeof val === 'string') {
    const trimmed = val.replace(/,/g, '').trim()
    const parsed = parseFloat(trimmed)
    if (!isNaN(parsed) && String(parsed) === trimmed) {
      val = parsed
    } else {
      return val
    }
  }
  if (typeof val !== 'number' || isNaN(val)) return '0'
  if (decimals !== undefined) return val.toFixed(decimals)
  if (val >= 1000) return Math.round(val).toLocaleString('en-IN')
  if (Number.isInteger(val)) return val
  return val.toFixed(1)
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  prefix = '',
  unit = '',
  delta,
  description,
  tooltip,
  theme = 'espresso',
  decimals
}) => {
  const { lang, t } = useTranslation()
  const numVal = typeof value === 'string' ? parseFloat(value.replace(/,/g, '').trim()) : value
  const isNumeric = typeof numVal === 'number' && !isNaN(numVal)

  const [displayValue, setDisplayValue] = useState<string | number>(() => formatStatValue(value, decimals))

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(value)
      return
    }

    // Immediately display the real formatted value to prevent any 0-freeze
    setDisplayValue(formatStatValue(numVal, decimals))

    // Gracefully animate upward if requestAnimationFrame is available
    if (typeof window === 'undefined' || !window.requestAnimationFrame || numVal === 0) return

    const startVal = 0
    const endVal = numVal
    const duration = 600
    const startTime = performance.now()
    let frameId: number

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = startVal + (endVal - startVal) * easeOut

      setDisplayValue(formatStatValue(current, decimals))

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(formatStatValue(endVal, decimals))
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, decimals])

  const iconBgClasses = {
    gold: 'bg-[var(--tint-gold)] text-[var(--gold)] border-[var(--gold)]/30',
    espresso: 'bg-[var(--tint-neutral)] text-[var(--text-primary)] border-[var(--border-primary)]',
    navy: 'bg-[var(--tint-brand)] text-[var(--brand)] border-[var(--brand)]/25',
    emerald: 'bg-[var(--tint-good)] text-[var(--good)] border-[var(--good)]/25',
    amber: 'bg-[var(--tint-warn)] text-[var(--warn)] border-[var(--warn)]/25',
    red: 'bg-[var(--tint-danger)] text-[var(--danger)] border-[var(--danger)]/25',
    slate: 'bg-[var(--tint-neutral)] text-[var(--muted)] border-[var(--border-primary)]'
  }[theme]

  const numeralClasses = {
    gold: 'text-[var(--text-primary)]', // Plain facts neutral numbers (gold is never for text)
    espresso: 'text-[var(--text-primary)]',
    navy: 'text-[var(--text-primary)]',
    emerald: 'text-[var(--good)]',
    amber: 'text-[var(--warn)]',
    red: 'text-[var(--danger)]',
    slate: 'text-[var(--text-primary)]'
  }[theme]

  const rawTooltipText = tooltip || description
  const localizedLabel = t(label)
  const localizedTooltip = rawTooltipText ? toNativeDigits(t(rawTooltipText), lang) : ''
  const localizedDesc = description ? toNativeDigits(t(description), lang) : ''
  const localizedNum = toNativeDigits(displayValue, lang)
  const localizedUnit = unit === 'Cr' || unit === 'unit.cr' || unit === '₹ Cr'
    ? ` ${t('unit.cr')}`
    : unit === 'Lakh' || unit === 'unit.lakh' || unit === 'L'
    ? ` ${t('unit.lakh')}`
    : unit === '%'
    ? '%'
    : unit ? ` ${t(unit)}` : ''

  return (
    <div className="lux-card p-5 relative overflow-visible group/card hover:z-10 transition-colors duration-150 flex flex-col justify-between">
      {/* Top row: Icon + Label + Tooltip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBgClasses}`}>
            <Icon size={18} />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
            {localizedLabel}
          </span>
        </div>
        {localizedTooltip && (
          <div className="group relative cursor-help">
            <span
              tabIndex={0}
              role="button"
              aria-label={`Information about ${localizedLabel}`}
              className="p-1 -m-1 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition-colors focus:outline-none"
            >
              <Info size={14} />
            </span>
            <div
              role="tooltip"
              className="absolute right-0 top-full mt-2 hidden group-hover:block group-focus-within:block z-50 w-64 sm:w-72 p-3 text-xs font-normal leading-relaxed rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl text-[var(--text-primary)] pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="font-bold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                {localizedLabel}
              </div>
              <div className="text-[12px] text-[var(--text-primary)] leading-normal font-medium">
                {localizedTooltip}
              </div>
              <div className="absolute right-2.5 -top-1 w-2 h-2 rotate-45 bg-[var(--surface-primary)] border-l border-t border-[var(--border-primary)]" />
            </div>
          </div>
        )}
      </div>

      {/* Main Stat */}
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-xl font-black text-[var(--text-primary)]">{prefix}</span>}
          <span className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${numeralClasses}`}>
            {localizedNum}
          </span>
          {localizedUnit && <span className="text-sm font-extrabold text-[var(--text-primary)]">{localizedUnit}</span>}
        </div>
        {delta !== undefined && <DeltaChip value={delta} />}
      </div>

      {/* Bottom description */}
      {localizedDesc && (
        <p className="text-[11px] font-semibold text-[var(--text-secondary)] mt-2 line-clamp-1">
          {localizedDesc}
        </p>
      )}
    </div>
  )
}
