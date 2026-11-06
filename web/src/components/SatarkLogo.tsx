import React from 'react'

export interface SatarkLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: {
    title: 'text-base',
    badge: 'text-[9px] px-1 py-0.5',
  },
  md: {
    title: 'text-lg sm:text-xl',
    badge: 'text-[10px] px-1.5 py-0.5',
  },
  lg: {
    title: 'text-xl sm:text-2xl',
    badge: 'text-xs px-2 py-0.5',
  },
  xl: {
    title: 'text-2xl sm:text-3xl',
    badge: 'text-xs px-2 py-1',
  },
}

export const SatarkLogo: React.FC<SatarkLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const currentSize = SIZE_MAP[size] || SIZE_MAP.md

  return (
    <div className={`inline-flex items-center ${className}`}>
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
