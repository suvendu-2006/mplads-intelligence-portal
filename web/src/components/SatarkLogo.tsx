import React from 'react'

export interface SatarkLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: {
    icon: 'w-6 h-6',
    title: 'text-base',
    badge: 'text-[9px] px-1 py-0.5',
    gap: 'gap-2',
  },
  md: {
    icon: 'w-8 h-8',
    title: 'text-lg sm:text-xl',
    badge: 'text-[10px] px-1.5 py-0.5',
    gap: 'gap-2.5',
  },
  lg: {
    icon: 'w-10 h-10',
    title: 'text-xl sm:text-2xl',
    badge: 'text-xs px-2 py-0.5',
    gap: 'gap-3',
  },
  xl: {
    icon: 'w-12 h-12',
    title: 'text-2xl sm:text-3xl',
    badge: 'text-xs px-2 py-1',
    gap: 'gap-3.5',
  },
}

export const SatarkLogo: React.FC<SatarkLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const currentSize = SIZE_MAP[size] || SIZE_MAP.md

  return (
    <div className={`inline-flex items-center ${currentSize.gap} ${className}`}>
      {/* Emblem SVG */}
      <img
        src="/satark-emblem.svg"
        alt="SATARK Sovereign Emblem"
        className={`${currentSize.icon} shrink-0 drop-shadow-sm transition-transform duration-200 group-hover:scale-105 select-none`}
        width={48}
        height={48}
      />

      {showText && (
        <div className="flex items-center gap-1.5 leading-none select-none">
          <span className={`font-black tracking-tight text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition ${currentSize.title}`}>
            SATARK
          </span>
          <span
            className={`font-semibold tracking-wider uppercase rounded font-mono bg-gradient-to-r from-amber-500/15 to-emerald-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${currentSize.badge}`}
          >
            MPLADS
          </span>
        </div>
      )}
    </div>
  )
}

export default SatarkLogo
