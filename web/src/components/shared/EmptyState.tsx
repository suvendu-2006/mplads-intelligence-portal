import React from 'react'
import { FolderSearch } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'Try adjusting your search criteria or clearing applied filters.',
  action,
  icon
}) => {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] mb-4 shadow-sm">
        {icon || <FolderSearch size={26} />}
      </div>
      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-5">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  )
}
