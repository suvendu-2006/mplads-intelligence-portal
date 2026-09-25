import React from 'react'

interface ProgressRingProps {
  value: number // 0 - 100
  size?: number
  strokeWidth?: number
  color?: string
  textColor?: string
  label?: string
  sublabel?: string
  semiCircle?: boolean
}

export const ProgressRing: React.FC<ProgressRingProps> = React.memo(({
  value,
  size = 120,
  strokeWidth = 9,
  color = 'var(--success)',
  textColor,
  label,
  sublabel,
  semiCircle = false
}) => {
  const clamped = Math.max(0, Math.min(100, isNaN(value) ? 0 : value))

  if (semiCircle) {
    const radius = (size - strokeWidth) / 2
    const arcLength = Math.PI * radius
    const strokeDashoffset = arcLength - (clamped / 100) * arcLength

    return (
      <div className="flex flex-col items-center justify-center">
        <svg width={size} height={size / 2 + 10} className="overflow-visible">
          {/* Background track arc */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="var(--neutral-200, var(--border-primary))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc with calibrated smooth curve */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 500ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>
        <div className="-mt-6 text-center">
          <div className="text-xl font-extrabold tabular-nums text-[var(--text-primary)]">
            {label !== undefined ? label : `${clamped.toFixed(1)}%`}
          </div>
          {sublabel && (
            <div className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-wider">
              {sublabel}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Full Circle Ring
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  // Dynamic font sizing so text never overflows the circle or clashes with stroke
  let fontSizeClass = 'text-xs font-bold'
  if (size <= 44) {
    fontSizeClass = clamped >= 100 ? 'text-[9px] font-black' : 'text-[10px] font-black'
  } else if (size <= 60) {
    fontSizeClass = 'text-[11px] font-bold'
  } else if (size <= 84) {
    fontSizeClass = 'text-sm font-bold'
  } else {
    fontSizeClass = 'text-base font-extrabold'
  }

  const effectiveTextColor = textColor || color || 'var(--text-primary)'

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--neutral-200, var(--border-primary))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          style={{
            transition: 'stroke-dashoffset 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>
      {/* Centered Percentage / Numeric Text */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-center select-none ${fontSizeClass}`}
        style={{ color: effectiveTextColor }}
      >
        <span className="tabular-nums leading-none tracking-tight">
          {label !== undefined ? label : `${clamped.toFixed(0)}%`}
        </span>
        {sublabel && (
          <span className="text-[8px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5 leading-none">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
})
