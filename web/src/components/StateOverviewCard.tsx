import React from 'react'
import { Link } from 'react-router-dom'
import { Users, TrendingUp, Check, ArrowRight } from 'lucide-react'
import { StateOverviewItem } from '../lib/allStatesData'
import { useTranslation, toNativeDigits, translateState } from '../lib/i18n'

interface StateOverviewCardProps {
  item: StateOverviewItem
}

export const StateOverviewCard: React.FC<StateOverviewCardProps> = ({ item }) => {
  const { t, lang } = useTranslation()
  // Format Crore amounts cleanly with native numerals
  const formatCr = (val: number) => {
    const isWhole = Math.abs(val - Math.round(val)) < 0.05
    const numStr = val >= 1000
      ? val.toLocaleString('en-IN', { minimumFractionDigits: val % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })
      : (isWhole ? String(Math.round(val)) : val.toFixed(1))
    return `₹${toNativeDigits(numStr, lang)} ${t('unit.cr')}`
  }

  return (
    <div className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-5 sm:p-6 shadow-xs hover:border-[var(--brand-accent)] hover:shadow-md transition-colors duration-150 flex flex-col justify-between group">
      <div>
        {/* Header: State Name + MPs + Rank Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/states/${encodeURIComponent(item.state)}`}
              className="text-lg sm:text-xl font-bold font-sans text-[var(--text-primary)] tracking-tight hover:text-[var(--brand-primary)] transition truncate block"
            >
              {translateState(item.state, lang)}
            </Link>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium mt-1">
              <Users size={13} className="text-[var(--text-tertiary)]" />
              <span>{toNativeDigits(item.mps, lang)} {t('unit.mps')}</span>
            </div>
          </div>

          {/* Rank Badge */}
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60 shrink-0">
            {t('label.rank')} #{toNativeDigits(item.rank, lang)} / {toNativeDigits(36, lang)}
          </span>
        </div>

        {/* Two-Column Metrics: ALLOCATED vs RECORDED EXPENDITURE */}
        <div className="mt-5 mb-4 grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)] h-8 flex items-end pb-0.5">
              {t('kpi.allocated')}
            </div>
            <div className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums leading-snug">
              {formatCr(item.allocatedCr)}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)] h-8 flex items-end pb-0.5">
              {t('kpi.used')}
            </div>
            <div className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums leading-snug">
              {formatCr(item.expenditureCr)}
            </div>
          </div>
        </div>

        {/* Expenditure Rate with TrendingUp icon + Uniform Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[var(--text-secondary)]">{t('kpi.utilization')}</span>
            <span className="font-bold flex items-center gap-0.5 tabular-nums text-rose-500 dark:text-rose-400">
              <TrendingUp size={14} className="shrink-0" />
              <span>{toNativeDigits(item.expenditureRate.toFixed(1), lang)}%</span>
            </span>
          </div>

          <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all duration-700 bg-[#B7791F] dark:bg-[#FF9E3B]"
              style={{ width: `${Math.min(100, Math.max(3, item.expenditureRate))}%` }}
            />
          </div>
        </div>

        {/* Works Completed & Completion Rate */}
        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-emerald-500 text-emerald-500 flex items-center justify-center shrink-0">
              <Check size={11} strokeWidth={3} />
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight tabular-nums">
                {toNativeDigits(item.completedWorks.toLocaleString(), lang)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-semibold leading-tight">
                {t('kpi.completed')}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-semibold">
              {t('kpi.completion_rate')}
            </div>
            <div className="text-sm sm:text-base font-bold text-sky-900 dark:text-sky-200 tabular-nums">
              {toNativeDigits(item.completionRate.toFixed(1), lang)}%
            </div>
          </div>
        </div>
      </div>

      {/* Footer Link */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-1 text-center">
        <Link
          to={`/states/${encodeURIComponent(item.state)}`}
          className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 inline-flex items-center justify-center gap-1 group-hover:underline transition"
        >
          <span>{t('btn.show_details')}</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
