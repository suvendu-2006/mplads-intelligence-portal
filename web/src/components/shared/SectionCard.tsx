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
    <div className={`lux-card overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-primary)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-primary)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {title}
            </h2>
            {tooltip && (
              <div className="group relative cursor-help">
                <Info size={14} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 text-xs rounded-lg bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xl text-[var(--text-secondary)] font-normal">
                  {tooltip}
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
