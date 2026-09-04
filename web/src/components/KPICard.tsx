import React, { useEffect, useState } from 'react'
import { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  description?: string
  icon?: LucideIcon
  accentColor?: string
}

function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start = 0
    const duration = 800
    const startTime = performance.now()

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = start + (value - start) * ease
      setDisplay(current)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setDisplay(value)
      }
    }

    const handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [value])

  return (
    <span>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  description,
  icon: Icon,
  accentColor = 'var(--brand-accent)',
}) => {
  return (
    <div className="lux-card relative overflow-hidden group flex flex-col justify-between">
      <div
        className="h-1 rounded-t-xl transition-all duration-500 group-hover:h-1.5"
        style={{
          backgroundColor: accentColor,
          transform: 'scaleX(1)',
          transformOrigin: 'left',
        }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {label}
          </span>
          {Icon && (
            <div
              className="p-1.5 rounded-lg border border-[var(--border-primary)]"
              style={{ backgroundColor: 'var(--surface-alt)' }}
            >
              <Icon className="w-4 h-4 text-[var(--brand-primary)]" />
            </div>
          )}
        </div>

        <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tabular-nums tracking-tight">
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        </div>

        {description && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5 font-medium leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
