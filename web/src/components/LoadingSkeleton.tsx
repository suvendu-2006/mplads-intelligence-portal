import React from 'react'

export const LoadingSkeleton: React.FC<{ rows?: number; height?: string }> = ({
  rows = 4,
  height = 'h-16',
}) => {
  return (
    <div className="space-y-3 animate-pulse w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`w-full ${height} rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]`}
        />
      ))}
    </div>
  )
}
