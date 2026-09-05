import React from 'react'
import { Info } from 'lucide-react'

interface SectionCardProps {
  title: string
  subtitle?: string
  tooltip?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  tooltip,
  action,
  children,
  className = '',
  noPadding = false
}) => {
  return (
    <div className={`lux-card overflow-visible relative flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-primary)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-primary)] rounded-t-[14px]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {title}
            </h2>
            {tooltip && (
              <div className="group relative cursor-help">
                <span
                  tabIndex={0}
                  role="button"
                  aria-label={`Information about ${title}`}
                  className="p-1 -m-1 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition-colors focus:outline-none"
                >
                  <Info size={14} />
                </span>
                <div
                  role="tooltip"
                  className="absolute left-0 bottom-full mb-2.5 hidden group-hover:block group-focus-within:block z-50 w-72 p-3 text-xs font-normal leading-relaxed rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl text-[var(--text-primary)] pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="font-bold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    {title}
                  </div>
                  <div className="text-[12px] text-[var(--text-primary)] leading-normal font-medium">
                    {tooltip}
                  </div>
                  <div className="absolute left-2.5 -bottom-1 w-2 h-2 rotate-45 bg-[var(--surface-primary)] border-r border-b border-[var(--border-primary)]" />
                </div>
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {/* Body */}
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  )
}
