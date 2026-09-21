import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  StatCard,
  SectionCard,
  EmptyState
} from '../components/shared'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ChartTooltip } from '../components/charts'
import { useChartTheme } from '../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import { DEFAULT_NATIONAL, DEFAULT_ANALYTICS, DEFAULT_TOP_STATES } from '../lib/defaultData'
import { StateOverviewCard } from '../components/StateOverviewCard'
import { ALL_36_STATES_OVERVIEW } from '../lib/allStatesData'
import {
  Landmark,
  Coins,
  Percent,
  AlertCircle,
  Users,
  Clock,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Video,
  X
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts'
import { useTranslation, toNativeDigits, translateState, translateSector } from '../lib/i18n'

const UNION_TERRITORIES = [
  'Andaman And Nicobar Islands',
  'Chandigarh',
  'The Dadra And Nagar Haveli And Daman And Diu',
  'Delhi',
  'Jammu And Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
]

export const NationalDashboard: React.FC = () => {
  const { t, lang } = useTranslation()
  const [national, setNational] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_data')
      return saved ? JSON.parse(saved) : DEFAULT_NATIONAL
    } catch { return DEFAULT_NATIONAL }
  })
  const [analytics, setAnalytics] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_analytics')
      return saved ? JSON.parse(saved) : DEFAULT_ANALYTICS
    } catch { return DEFAULT_ANALYTICS }
  })
  const [states, setStates] = useState<any[]>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_states')
      const parsed = saved ? JSON.parse(saved) : null
      return (parsed && parsed.length > 0) ? parsed : DEFAULT_TOP_STATES
    } catch { return DEFAULT_TOP_STATES }
  })
  const [loading, setLoading] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [leagueFilter, setLeagueFilter] = useState<'all' | 'states' | 'uts'>('all')

  const chartTheme = useChartTheme()

  useEffect(() => {
    async function loadData() {
      try {
        const [resNat, resStates, resAnalytics] = await Promise.all([
          fetch('/api/national'),
          fetch('/api/states?sort=red_pct&order=desc'),
          fetch('/api/national/analytics')
        ])

        if (resNat.ok) {
          const jsonNat = await resNat.json()
          setNational(jsonNat.data)
          try { sessionStorage.setItem('cached_nat_data', JSON.stringify(jsonNat.data)) } catch {}
        }
        if (resStates.ok) {
          const jsonStates = await resStates.json()
          setStates(jsonStates.data || [])
          try { sessionStorage.setItem('cached_nat_states', JSON.stringify(jsonStates.data || [])) } catch {}
        }
        if (resAnalytics.ok) {
          const jsonAnalytics = await resAnalytics.json()
          setAnalytics(jsonAnalytics.data)
          try { sessionStorage.setItem('cached_nat_analytics', JSON.stringify(jsonAnalytics.data)) } catch {}
        }
      } catch (e) {
        console.error('Error fetching national dashboard data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const [pieMode, setPieMode] = useState<'sectors' | 'status'>('status')

  if (loading) {
    return <LoadingSkeleton rows={8} height="h-28" />
  }

  // Real data calculations directly from central API
  const totalAllocCr = national ? Math.round((national.totalAllocated || 0) / 10000000) : 0
  const totalUsedCr = national ? Math.round((national.totalExpenditure || 0) / 10000000) : 0
  const utilRate = national?.utilizationPercentage ? Number(national.utilizationPercentage.toFixed(1)) : 0
  const paymentGap = national?.paymentGap ? Number(national.paymentGap.toFixed(1)) : 0

  const totalMps = national?.totalMPs ?? 0
  const pendingWorks = national?.pendingWorks ?? 0
  const completedWorks = national?.totalWorksCompleted ?? 0
  const activePayments = national ? Math.round((national.inProgressPayments || 0) / 10000000) : 0

  // Real sector distribution from expenditures.csv via /api/national/analytics
  const sectorColors = chartTheme.category
  const sectorData = analytics?.topSectors?.map((sec: any, idx: number) => {
    const crValue = Math.round(sec.amount / 10000000)
    const translatedName = translateSector(sec.name, lang)
    return {
      name: translatedName,
      fullName: translateSector(sec.fullName || sec.name, lang),
      rawName: sec.name,
      value: sec.sharePct,
      amount: sec.amount,
      crValue,
      count: sec.count,
      crores: `₹${toNativeDigits(crValue.toLocaleString('en-IN'), lang)} ${t('unit.cr')}`,
      color: sectorColors[idx % sectorColors.length]
    }
  }) || []

  const totalSectorCr = sectorData.reduce((sum: number, s: any) => sum + (s.crValue || 0), 0)

  // Real yearly multi-year trend from mplads_trends.csv via /api/national/analytics
  const yearlyTrendData = analytics?.yearlyTrends?.map((t: any) => ({
    period: t.label || String(t.year),
    disbursed: Math.round(t.amount / 10000000),
    transactions: t.count
  })) || []

  // Top 10 states by allocation for Chart 1
  const top10Allocated = [...states]
    .sort((a, b) => (b.totalAllocated || 0) - (a.totalAllocated || 0))
    .slice(0, 10)
    .map((s) => ({
      state: s.state,
      name: translateState(s.state, lang),
      allocated: Math.round((s.totalAllocated || 0) / 10000000),
      utilized: Math.round((s.totalExpenditure || 0) / 10000000)
    }))

  // Best to Worst states & UTs by utilization % for League Table
  const rankedStates = [...states]
    .filter((s) => {
      const isUT = UNION_TERRITORIES.includes(s.state)
      if (leagueFilter === 'states') return !isUT
      if (leagueFilter === 'uts') return isUT
      return true
    })
    .sort((a, b) => {
      const uA = Number(a.utilizationPercentage ?? a.utilizationRate ?? 0)
      const uB = Number(b.utilizationPercentage ?? b.utilizationRate ?? 0)
      return uB - uA
    })

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Primary Execution Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="kpi.total_mps"
          value={totalMps}
          description="stat.both_houses"
          tooltip="tooltip.total_mps"
          theme="espresso"
        />
        <StatCard
          icon={CheckCircle2}
          label="kpi.completed"
          value={completedWorks}
          theme="emerald"
          description="stat.verified_projects"
          tooltip="tooltip.completed"
        />
        <StatCard
          icon={Clock}
          label="kpi.pending"
          value={pendingWorks}
          theme="amber"
          description="stat.active_queue"
          tooltip="tooltip.pending"
        />
        <StatCard
          icon={Receipt}
          label="kpi.ongoing"
          value={activePayments}
          prefix="₹"
          unit="Cr"
          theme="espresso"
          description="stat.active_liabilities"
          tooltip="tooltip.ongoing"
        />
      </div>

      {/* National Financial Outlay & Expenditure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Landmark}
            label="kpi.allocated"
            value={totalAllocCr}
            prefix="₹"
            unit="Cr"
            theme="espresso"
            tooltip="tooltip.corpus"
          />
          <StatCard
            icon={Coins}
            label="kpi.used"
            value={totalUsedCr}
            prefix="₹"
            unit="Cr"
            theme="espresso"
            tooltip="tooltip.utilization"
          />
          <StatCard
            icon={Percent}
            label="kpi.utilization"
            value={utilRate}
            unit="%"
            theme={utilRate < 35 ? 'amber' : 'espresso'}
            gaugeValue={utilRate}
            tooltip="tooltip.utilization_desc"
          />
          <StatCard
            icon={AlertCircle}
            label="kpi.payment_gap"
            value={paymentGap}
            unit="%"
            theme="amber"
            tooltip="tooltip.payment_gap"
          />
        </div>

      {/* 3D. Story Charts (The Most Important Visual Section) */}
      <div className="space-y-6">
        {/* Row 1: Chart 1 (Allocated vs Utilized Top 10 States) + Chart 2 (Where the Money is Spent / Works Status) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            title={t('chart.top_states')}
            subtitle={t('chart.top_states_sub')}
            className="lg:col-span-2"
          >
            <div className="h-80 w-full chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10Allocated} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                  <defs>
                    <linearGradient id="barAllocatedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.allocated.hex} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartTheme.allocated.hex} stopOpacity={0.72} />
                    </linearGradient>
                    <linearGradient id="barUtilizedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.utilized.hex} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartTheme.utilized.hex} stopOpacity={0.72} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={chartTheme.textColor}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tickFormatter={(name) => (name.length > 13 ? name.slice(0, 11) + '..' : name)}
                  />
                  <YAxis stroke={chartTheme.textColor} fontSize={11} tickLine={false} tickFormatter={(v) => toNativeDigits(v, lang)} />
                  <Tooltip
                    content={<ChartTooltip formatter="crore" />}
                    cursor={{ fill: 'var(--surface-hover)', opacity: 0.5 }}
                  />
                  <Bar
                    dataKey="allocated"
                    name={t('chart.allocated_budget')}
                    fill="url(#barAllocatedGrad)"
                    radius={[6, 6, 0, 0]}
                    {...ANIMATION_CONFIG.getChartProps('bar')}
                  />
                  <Bar
                    dataKey="utilized"
                    name={t('chart.utilized_disbursal')}
                    fill="url(#barUtilizedGrad)"
                    radius={[6, 6, 0, 0]}
                    {...ANIMATION_CONFIG.getChartProps('bar')}
                    animationBegin={ANIMATION_CONFIG.timeline.charts + ANIMATION_CONFIG.delay.bar}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs shadow-xs" style={{ backgroundColor: chartTheme.allocated.hex }} />
                <span className="text-[var(--text-primary)] font-bold">{t('chart.allocated_budget')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs shadow-xs" style={{ backgroundColor: chartTheme.utilized.hex }} />
                <span className="text-[var(--text-primary)] font-bold">{t('chart.utilized_disbursal')}</span>
              </div>
            </div>
          </SectionCard>

          {/* Chart 2: Where the Money is Spent • Sectoral Expenditure */}
          <SectionCard
            title={t('chart.where_money_spent')}
            subtitle={t('chart.where_money_spent_sub')}
          >
            {sectorData.length > 0 ? (
              <div>
                <div className="h-60 relative flex items-center justify-center chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={96}
                        paddingAngle={2}
                        dataKey="value"
                        animationDuration={ANIMATION_CONFIG.duration.pie}
                        animationEasing={ANIMATION_CONFIG.easing.easeInOut}
                        animationBegin={ANIMATION_CONFIG.delay.medium}
                        isAnimationActive={ANIMATION_CONFIG.shouldAnimate()}
                      >
                        {sectorData.map((entry: any, idx: number) => (
                          <Cell key={`cell-top-${idx}`} fill={entry.color} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter="percent" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    <div className="max-w-[132px] flex flex-col items-center justify-center">
                      <span className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums leading-tight tracking-tight">
                        ₹{toNativeDigits(totalSectorCr.toLocaleString('en-IN'), lang)}
                        <span className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">
                          {t('unit.cr')}
                        </span>
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-[var(--text-tertiary)] font-bold tracking-normal leading-tight mt-0.5 max-w-[120px] text-center line-clamp-2">
                        {t('chart.total_disbursed')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-[var(--border-primary)] max-h-52 overflow-y-auto pr-1">
                  {sectorData.map((sec: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--surface-alt)]/60 border border-[var(--border-subtle)] hover:bg-[var(--surface-alt)] transition text-xs">
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: sec.color }} />
                        <div className="truncate">
                          <div className="font-bold text-[var(--text-primary)] truncate text-[11px]" title={sec.fullName || sec.name}>
                            {sec.name}
                          </div>
                          <div className="text-[9px] text-[var(--text-secondary)] font-semibold">
                            {toNativeDigits(sec.count?.toLocaleString('en-IN'), lang)} {t('chart.civil_works')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-[11px] text-[var(--text-primary)] tabular-nums">₹{toNativeDigits(sec.crValue.toLocaleString('en-IN'), lang)} {t('unit.cr')}</div>
                        <div className="text-[10px] font-bold text-[var(--brand-primary)] tabular-nums">{toNativeDigits(sec.value, lang)}% {t('chart.spend')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="No sectoral data" description="No sector breakdown available for the selected view." />
            )}
          </SectionCard>
        </div>

        {/* Row 2: Chart 3 (Works Delivery Status with By Field / Works Status toggle) + Chart 4 (Yearly Allocation vs Spend Trend) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 3: Works Delivery Status (with By Field / Works Status toggle) */}
          <SectionCard
            title={pieMode === 'sectors' ? t('chart.where_money_spent') : t('chart.works_delivery_status')}
            subtitle={
              pieMode === 'sectors'
                ? t('chart.where_money_spent_sub')
                : `${toNativeDigits('83,968', lang)} ${t('chart.sanctioned_works_sub')}`
            }
            action={
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-0.5 rounded-lg border border-[var(--border-primary)] text-[11px]">
                <button
                  type="button"
                  onClick={() => setPieMode('sectors')}
                  className={`px-2 py-1 rounded-md font-extrabold transition cursor-pointer ${
                    pieMode === 'sectors'
                      ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('chart.by_field')}
                </button>
                <button
                  type="button"
                  onClick={() => setPieMode('status')}
                  className={`px-2 py-1 rounded-md font-extrabold transition cursor-pointer ${
                    pieMode === 'status'
                      ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('chart.works_status')}
                </button>
              </div>
            }
          >
            {pieMode === 'sectors' ? (
              /* Sectoral Expenditure by Developmental Field (2-col layout) */
              sectorData.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="h-64 relative flex items-center justify-center chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sectorData}
                          cx="50%"
                          cy="50%"
                          innerRadius={72}
                          outerRadius={102}
                          paddingAngle={2}
                          dataKey="value"
                          animationDuration={ANIMATION_CONFIG.duration.pie}
                          animationEasing={ANIMATION_CONFIG.easing.easeInOut}
                          animationBegin={ANIMATION_CONFIG.delay.medium}
                          isAnimationActive={ANIMATION_CONFIG.shouldAnimate()}
                        >
                          {sectorData.map((entry: any, idx: number) => (
                            <Cell key={`cell-row2-${idx}`} fill={entry.color} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip formatter="percent" />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                      <div className="max-w-[138px] flex flex-col items-center justify-center">
                        <span className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums leading-tight tracking-tight">
                          ₹{toNativeDigits(totalSectorCr.toLocaleString('en-IN'), lang)}
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">
                            {t('unit.cr')}
                          </span>
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-[var(--text-tertiary)] font-bold tracking-normal leading-tight mt-0.5 max-w-[126px] text-center line-clamp-2">
                          {t('chart.total_disbursed')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {sectorData.map((sec: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-alt)]/60 border border-[var(--border-subtle)] hover:bg-[var(--surface-alt)] transition">
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <span className="w-3 h-3 rounded-sm shrink-0 shadow-xs" style={{ backgroundColor: sec.color }} />
                          <div className="truncate">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate" title={sec.fullName || sec.name}>
                              {sec.name}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] font-semibold">
                              {toNativeDigits(sec.count?.toLocaleString('en-IN'), lang)} {t('chart.civil_works')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-xs text-[var(--text-primary)] tabular-nums">₹{toNativeDigits(sec.crValue.toLocaleString('en-IN'), lang)} {t('unit.cr')}</div>
                          <div className="text-[11px] font-bold text-[var(--brand-primary)] tabular-nums">{toNativeDigits(sec.value, lang)}% {t('chart.spend')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="No sectoral data" description="No sector breakdown available for the selected view." />
              )
            ) : (
              /* Works Delivery Status (2-col layout) */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="h-56 relative flex items-center justify-center chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: t('chart.completed_certified'),
                            value: completedWorks,
                            amountCr: `₹${toNativeDigits('2,387', lang)} ${t('unit.cr')}`,
                            desc: `${toNativeDigits('43,735', lang)} ${t('chart.civil_works')} (52.1%)`
                          },
                          {
                            name: t('chart.active_in_queue'),
                            value: pendingWorks,
                            amountCr: `₹${toNativeDigits('1,577', lang)} ${t('unit.cr')}`,
                            desc: `${toNativeDigits('40,233', lang)} ${t('chart.civil_works')} (47.9%)`
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={64}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        {...ANIMATION_CONFIG.getChartProps('pie')}
                      >
                        <Cell fill={chartTheme.clean.hex} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                        <Cell fill={chartTheme.high.hex} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter="number" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {(() => {
                    const totalWorksCalc = completedWorks + pendingWorks
                    const compPct = totalWorksCalc > 0 ? ((completedWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                        <div className="max-w-[124px] flex flex-col items-center justify-center">
                          <span className="text-lg sm:text-xl font-black text-[var(--good)] tabular-nums leading-tight">
                            {toNativeDigits(compPct, lang)}%
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold tracking-normal text-[var(--text-tertiary)] mt-0.5 max-w-[110px] text-center leading-tight line-clamp-2">
                            {t('chart.delivered')}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {(() => {
                  const totalWorksCalc = completedWorks + pendingWorks
                  const compPct = totalWorksCalc > 0 ? ((completedWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
                  const pendPct = totalWorksCalc > 0 ? ((pendingWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
                  return (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-[var(--surface-alt)]/60 border border-[var(--border-subtle)] hover:bg-[var(--surface-alt)] transition">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: chartTheme.clean.hex }} />
                            <span className="font-bold text-[var(--text-primary)]">{t('chart.completed_certified')}</span>
                          </div>
                          <span className="text-xs font-black text-[var(--good)] tabular-nums">
                            {toNativeDigits(compPct, lang)}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-sm font-extrabold tabular-nums text-[var(--text-primary)]">
                            {toNativeDigits(completedWorks.toLocaleString('en-IN'), lang)} {t('chart.works')}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)] font-extrabold tabular-nums">₹{toNativeDigits('2,387', lang)} {t('unit.cr')}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--surface-alt)]/60 border border-[var(--border-subtle)] hover:bg-[var(--surface-alt)] transition">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: chartTheme.high.hex }} />
                            <span className="font-bold text-[var(--text-primary)]">{t('chart.active_in_queue')}</span>
                          </div>
                          <span className="text-xs font-black text-[var(--warn)] tabular-nums">
                            {toNativeDigits(pendPct, lang)}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-sm font-extrabold tabular-nums text-[var(--text-primary)]">
                            {toNativeDigits(pendingWorks.toLocaleString('en-IN'), lang)} {t('chart.works')}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)] font-extrabold tabular-nums">₹{toNativeDigits('1,577', lang)} {t('unit.cr')}</span>
                        </div>
                      </div>

                      {/* Dual Progress Bar */}
                      <div className="pt-0.5">
                        <div className="w-full h-2 rounded-full bg-[var(--surface-primary)] border border-[var(--border-primary)] overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${compPct}%` }}
                            title={`Completed: ${completedWorks.toLocaleString()} works (${compPct}%)`}
                          />
                          <div
                            className="h-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${pendPct}%` }}
                            title={`In Progress: ${pendingWorks.toLocaleString()} works (${pendPct}%)`}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </SectionCard>

          {/* Chart 4: Multi-Year Allocation vs Spend Trend */}
          <SectionCard
            title={t('chart.trend')}
            subtitle={t('chart.fiscal_trajectory_sub')}
            action={
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                {t('chart.annual_audited_ledger')}
              </span>
            }
          >
            {yearlyTrendData.length > 0 ? (
              <>
                <div className="h-60 w-full chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={yearlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartTheme.utilized.hex} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={chartTheme.utilized.hex} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
                      <XAxis dataKey="period" stroke={chartTheme.textColor} fontSize={11} tickLine={false} tickFormatter={(v) => toNativeDigits(v, lang)} />
                      <YAxis stroke={chartTheme.textColor} fontSize={11} tickLine={false} tickFormatter={(v) => toNativeDigits(v, lang)} />
                      <Tooltip content={<ChartTooltip formatter="crore" />} />
                      <Area
                        type="monotone"
                        dataKey="disbursed"
                        name={t('chart.audited_disbursal')}
                        stroke={chartTheme.utilized.hex}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#spentGrad)"
                        {...ANIMATION_CONFIG.getChartProps('area')}
                        dot={{ r: 4, fill: chartTheme.utilized.hex }}
                        activeDot={{
                          r: 6,
                          fill: chartTheme.tooltipBg,
                          stroke: chartTheme.utilized.hex,
                          strokeWidth: 3
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: chartTheme.utilized.hex }} />
                    <span className="text-[var(--text-secondary)] font-medium">{t('chart.liquid_treasury_disbursal')}</span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="No trend data" description="Multi-year treasury trajectory not available." />
            )}
          </SectionCard>
        </div>

        {/* Row 3: State & UT Performance League Table */}
        <SectionCard
          title={t('chart.league_table')}
          subtitle={t('chart.league_table_sub')}
          action={
            <div className="flex flex-wrap items-center gap-3">
              {/* Jurisdiction Filter Tabs */}
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-0.5 rounded-lg border border-[var(--border-primary)] text-[11px]">
                <button
                  type="button"
                  onClick={() => setLeagueFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-extrabold transition cursor-pointer ${
                    leagueFilter === 'all'
                      ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('filter.all')} ({toNativeDigits(36, lang)})
                </button>
                <button
                  type="button"
                  onClick={() => setLeagueFilter('states')}
                  className={`px-2.5 py-1 rounded-md font-extrabold transition cursor-pointer ${
                    leagueFilter === 'states'
                      ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('filter.states')} ({toNativeDigits(28, lang)})
                </button>
                <button
                  type="button"
                  onClick={() => setLeagueFilter('uts')}
                  className={`px-2.5 py-1 rounded-md font-extrabold transition cursor-pointer ${
                    leagueFilter === 'uts'
                      ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('filter.uts')} ({toNativeDigits(8, lang)})
                </button>
              </div>

              <Link
                to="/states"
                className="text-xs font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
              >
                <span>{t('btn.full_directory')}</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          }
        >
          <div className="space-y-2.5">
            {/* Column Headers */}
            <div className="grid grid-cols-[40px_1fr_100px_120px_80px] sm:grid-cols-[40px_1fr_120px_minmax(180px,1fr)_100px] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">
              <span>#</span>
              <span>{t('states.table_header_state_ut')}</span>
              <span className="text-right">{t('states.sort_allocated')}</span>
              <span className="text-center">{t('states.table_header_expenditure_rate')}</span>
              <span className="text-right">{t('states.table_header_completion')}</span>
            </div>

            {ALL_36_STATES_OVERVIEW
              .filter((s) => {
                if (leagueFilter === 'states') return !s.isUT
                if (leagueFilter === 'uts') return s.isUT
                return true
              })
              .slice(0, 10)
              .map((st, idx) => {
                const formatCr = (val: number) => {
                  const numStr = val >= 1000
                    ? val.toLocaleString('en-IN', { maximumFractionDigits: 1 })
                    : (Math.abs(val - Math.round(val)) < 0.05 ? String(Math.round(val)) : val.toFixed(1))
                  return `₹${toNativeDigits(numStr, lang)} ${t('unit.cr')}`
                }
                return (
                  <Link
                    key={st.state}
                    to={`/states/${encodeURIComponent(st.state)}`}
                    className="grid grid-cols-[40px_1fr_100px_120px_80px] sm:grid-cols-[40px_1fr_120px_minmax(180px,1fr)_100px] gap-3 items-center px-3 py-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-accent)] hover:shadow-sm transition-colors duration-100 group"
                  >
                    {/* Rank Number */}
                    <span className="text-sm font-black text-[var(--brand-primary)] tabular-nums">
                      {toNativeDigits(st.rank, lang)}
                    </span>

                    {/* State Name + MPs */}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--brand-primary)] transition-colors">
                        {translateState(st.state, lang)}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] font-medium">
                        {toNativeDigits(st.mps, lang)} {t('unit.mps')}
                      </div>
                    </div>

                    {/* Allocated Amount */}
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                        {formatCr(st.allocatedCr)}
                      </div>
                    </div>

                    {/* Expenditure Rate Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#B7791F] dark:bg-[#FF9E3B] transition-all duration-700"
                          style={{ width: `${Math.min(100, Math.max(3, st.expenditureRate))}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums w-10 text-right shrink-0">
                        {toNativeDigits(st.expenditureRate.toFixed(1), lang)}%
                      </span>
                    </div>

                    {/* Completion Rate */}
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {toNativeDigits(st.completionRate.toFixed(1), lang)}%
                      </span>
                    </div>
                  </Link>
                )
              })}
          </div>
        </SectionCard>
      </div>

      {/* 3E. Browse CTAs (Executive Glass Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <Link
          to="/states"
          className="group lux-card p-6 sm:p-8 relative overflow-hidden transition-colors duration-150 hover:border-[var(--brand-accent)] hover:shadow-md"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-[var(--brand-accent)]/10 blur-3xl pointer-events-none group-hover:bg-[var(--brand-accent)]/20 transition-colors" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center shadow-xs">
                <Landmark size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-1 group-hover:text-[var(--brand-primary)] transition-colors">
                  {t('cta.browse_states_title')}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
                  {t('cta.browse_states_desc')}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  {toNativeDigits(36, lang)} {t('cta.jurisdictions')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  {toNativeDigits('740+', lang)} {t('cta.districts')}
                </span>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] group-hover:bg-[var(--brand-primary)] group-hover:text-white text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] transition-colors duration-150">
                  <span>{t('cta.explore_states_dir')}</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/mps"
          className="group lux-card p-6 sm:p-8 relative overflow-hidden transition-colors duration-150 hover:border-[var(--brand-accent)] hover:shadow-md"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-[var(--brand-primary)]/10 blur-3xl pointer-events-none group-hover:bg-[var(--brand-primary)]/20 transition-colors" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shadow-xs">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-1 group-hover:text-[var(--brand-primary)] transition-colors">
                  {t('cta.browse_mps_title')}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
                  {t('cta.browse_mps_desc')}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  {toNativeDigits(543, lang)} {t('cta.lok_sabha')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  {toNativeDigits(231, lang)} {t('cta.rajya_sabha')}
                </span>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] group-hover:bg-[var(--brand-primary)] group-hover:text-white text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] transition-colors duration-150">
                  <span>{t('cta.inspect_parliamentary_seats')}</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Explainer Modal (Video / Briefing) */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="lux-card max-w-xl w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--surface-alt)]"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Video className="text-[var(--brand-gold)]" size={20} />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Understanding MPLADS Architecture
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
              The Member of Parliament Local Area Development Scheme (MPLADS) entitles each MP to recommend developmental civil works worth ₹5 Crores annually in their constituency. The District Magistrate examines feasibility, issues financial sanction, and disburses tranches to authorized Implementing Development Agencies (IDAs).
            </p>
            <div className="rounded-xl bg-[var(--surface-alt)] p-4 border border-[var(--border-primary)] space-y-2 text-xs">
              <div className="font-bold text-[var(--text-primary)]">Key Audited Metrics:</div>
              <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                <li><strong>Entitlement Corpus:</strong> ₹5 Crores per year (₹25 Cr total over 5-year tenure statutory guideline; actual audited avg ₹15.09 Cr/MP).</li>
                <li><strong>Utilization Rate:</strong> Ratio of liquid treasury releases vs sanctioned outlays.</li>
                <li><strong>Forensic Alerts:</strong> Algorithmic screening against CPWD benchmark costs and ghost works.</li>
              </ul>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowVideoModal(false)}
                className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
              >
                {t('btn.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
