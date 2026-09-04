import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  StatCard,
  SectionCard,
  EmptyState
} from '../components/shared'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ChartTooltip } from '../components/charts'
import { fmtCrore } from '../lib/currency'
import { useChartTheme } from '../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import {
  Landmark,
  Coins,
  Percent,
  AlertCircle,
  Users,
  Clock,
  CheckCircle2,
  Receipt,
  Activity,
  ArrowRight,
  ShieldCheck,
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
import { t } from '../lib/i18n'

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
  const [national, setNational] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_data')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [analytics, setAnalytics] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_analytics')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [states, setStates] = useState<any[]>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_states')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('cached_nat_data')
    } catch { return true }
  })
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

  const [pieMode, setPieMode] = useState<'sectors' | 'status'>('sectors')

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
  const expenditureRate = national?.completionRate ? Number(national.completionRate.toFixed(1)) : 0

  // Real sector distribution from expenditures.csv via /api/national/analytics
  const sectorColors = chartTheme.category
  const sectorData = analytics?.topSectors?.map((sec: any, idx: number) => ({
    name: sec.name,
    fullName: sec.fullName,
    value: sec.sharePct,
    amount: sec.amount,
    count: sec.count,
    crores: `₹${Math.round(sec.amount / 10000000).toLocaleString('en-IN')} Cr`,
    color: sectorColors[idx % sectorColors.length]
  })) || []

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
      name: s.state.length > 13 ? s.state.slice(0, 11) + '..' : s.state,
      fullName: s.state,
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
          label={t('kpi.total_mps')}
          value={totalMps}
          theme="navy"
        />
        <StatCard
          icon={CheckCircle2}
          label={t('kpi.completed')}
          value={completedWorks}
          theme="emerald"
          description="Verified civil projects"
        />
        <StatCard
          icon={Clock}
          label={t('kpi.pending')}
          value={pendingWorks}
          theme="amber"
          description="Active in queue"
        />
        <StatCard
          icon={Receipt}
          label={t('kpi.ongoing')}
          value={activePayments}
          prefix="₹"
          unit="Cr"
          theme="navy"
        />
      </div>

      {/* National Financial Outlay & Expenditure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Landmark}
            label={t('kpi.allocated')}
            value={totalAllocCr}
            prefix="₹"
            unit="Cr"
            theme="navy"
            tooltip={t('tooltip.corpus')}
          />
          <StatCard
            icon={Coins}
            label={t('kpi.used')}
            value={totalUsedCr}
            prefix="₹"
            unit="Cr"
            theme="navy"
            tooltip={t('tooltip.utilization')}
          />
          <StatCard
            icon={Percent}
            label={t('kpi.utilization')}
            value={utilRate}
            unit="%"
            theme="emerald"
            gaugeValue={utilRate}
            tooltip={t('tooltip.utilization')}
          />
          <StatCard
            icon={AlertCircle}
            label={t('kpi.payment_gap')}
            value={paymentGap}
            unit="%"
            theme="amber"
            tooltip={t('tooltip.payment_gap')}
          />
        </div>

      {/* 3D. Story Charts (The Most Important Visual Section) */}
      <div className="space-y-6">
        {/* Row 1: Chart 1 (Allocated vs Utilized Top 10 States) + Chart 2 (Where the Money is Spent / Works Status) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard
            title={t('chart.top_states')}
            subtitle="Top 10 States & UTs by Outlay (₹ Crores)"
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
                  />
                  <YAxis stroke={chartTheme.textColor} fontSize={11} tickLine={false} />
                  <Tooltip
                    content={<ChartTooltip formatter="crore" />}
                    cursor={{ fill: 'var(--surface-hover)', opacity: 0.5 }}
                  />
                  <Bar
                    dataKey="allocated"
                    name="Allocated Budget"
                    fill="url(#barAllocatedGrad)"
                    radius={[6, 6, 0, 0]}
                    {...ANIMATION_CONFIG.getChartProps('bar')}
                  />
                  <Bar
                    dataKey="utilized"
                    name="Utilized Disbursal"
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
                <span className="text-[var(--text-primary)] font-bold">Allocated Budget (₹ Cr)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs shadow-xs" style={{ backgroundColor: chartTheme.utilized.hex }} />
                <span className="text-[var(--text-primary)] font-bold">Utilized Disbursal (₹ Cr)</span>
              </div>
            </div>
          </SectionCard>

          {/* Chart 2: Where the Money is Spent (Sectoral Expenditure & Delivery Status) */}
          <SectionCard
            title={pieMode === 'sectors' ? 'Where Money is Spent' : 'Works Delivery Status'}
            subtitle={
              pieMode === 'sectors'
                ? 'Audited spend breakdown by developmental field'
                : '83,968 Total Sanctioned Civil Works'
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
                  By Field
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
                  Works Status
                </button>
              </div>
            }
          >
            {pieMode === 'sectors' ? (
              /* Sectoral Expenditure by Developmental Field */
              <div>
                <div className="h-60 relative flex items-center justify-center chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={92}
                        paddingAngle={2}
                        dataKey="value"
                        animationDuration={ANIMATION_CONFIG.duration.pie}
                        animationEasing={ANIMATION_CONFIG.easing.easeInOut}
                        animationBegin={ANIMATION_CONFIG.delay.medium}
                        isAnimationActive={ANIMATION_CONFIG.shouldAnimate()}
                      >
                        {sectorData.map((entry: any, idx: number) => (
                          <Cell key={`sec-cell-${idx}`} fill={entry.color} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<ChartTooltip formatter="percent" />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-xl font-black text-[var(--text-primary)] tabular-nums">
                      ₹3,964 Cr
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider">
                      Money Spent
                    </span>
                  </div>
                </div>

                {/* Clear Breakdown List with Field Names, Money Spent & Share */}
                <div className="space-y-2 pt-3 border-t border-[var(--border-primary)] max-h-48 overflow-y-auto pr-1">
                  {sectorData.slice(0, 5).map((sec: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1 rounded-md hover:bg-[var(--surface-alt)] transition">
                      <div className="flex items-center gap-2 truncate mr-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                        <span className="font-bold text-[var(--text-primary)] truncate text-[11px]" title={sec.fullName || sec.name}>
                          {sec.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-[var(--text-primary)] tabular-nums">{sec.crores}</span>
                        <span className="text-[11px] text-[var(--text-secondary)] font-bold ml-1.5 tabular-nums">({sec.value}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Works Delivery Status */
              <div>
                <div className="h-60 relative flex items-center justify-center chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Completed & Certified',
                            value: completedWorks,
                            amountCr: '₹2,387 Cr',
                            desc: '43,735 civil projects certified complete (52.1%)'
                          },
                          {
                            name: 'Active in Progress Queue',
                            value: pendingWorks,
                            amountCr: '₹1,577 Cr',
                            desc: '40,233 civil projects in execution pipeline (47.9%)'
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={92}
                        paddingAngle={3}
                        dataKey="value"
                        {...ANIMATION_CONFIG.getChartProps('pie')}
                      >
                        <Cell fill={chartTheme.clean.hex} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                        <Cell fill={chartTheme.utilized.hex} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                      </Pie>
                      <Tooltip
                        content={<ChartTooltip formatter="number" />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
                      {((completedWorks + pendingWorks) / 1000).toFixed(1)}k
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold tracking-wider">
                      Total Civil Works
                    </span>
                  </div>
                </div>

                {(() => {
                  const totalWorksCalc = completedWorks + pendingWorks
                  const compPct = totalWorksCalc > 0 ? ((completedWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
                  const pendPct = totalWorksCalc > 0 ? ((pendingWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
                  return (
                    <div className="space-y-2.5 pt-3 border-t border-[var(--border-primary)]">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartTheme.clean.hex }} />
                          <span className="font-bold text-[var(--text-primary)]">Completed & Certified</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold tabular-nums text-[var(--text-primary)]">
                            {completedWorks.toLocaleString('en-IN')} ({compPct}%)
                          </span>
                          <span className="text-[11px] text-[var(--text-secondary)] font-bold ml-2">₹2,387 Cr</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartTheme.utilized.hex }} />
                          <span className="font-bold text-[var(--text-primary)]">Active in Progress Queue</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold tabular-nums text-[var(--text-primary)]">
                            {pendingWorks.toLocaleString('en-IN')} ({pendPct}%)
                          </span>
                          <span className="text-[11px] text-[var(--text-secondary)] font-bold ml-2">₹1,577 Cr</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Row 2: Chart 3 (Where the Money is Spent • Comprehensive Sector Portfolio) + Chart 4 (Yearly Allocation vs Spend Trend) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 3: Where the Money is Spent • Sectoral Expenditure Donut */}
          <SectionCard
            title="Where the Money is Spent • Sectoral Expenditure"
            subtitle="Audited liquid expenditure and works breakdown by developmental field"
          >
            {sectorData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="h-64 relative flex items-center justify-center chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                        animationDuration={ANIMATION_CONFIG.duration.pie}
                        animationEasing={ANIMATION_CONFIG.easing.easeInOut}
                        animationBegin={ANIMATION_CONFIG.delay.medium}
                        isAnimationActive={ANIMATION_CONFIG.shouldAnimate()}
                      >
                        {sectorData.map((entry: any, idx: number) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<ChartTooltip formatter="percent" />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-xl font-black text-[var(--text-primary)] tabular-nums">
                      ₹3,964 Cr
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider">
                      Total Disbursed
                    </span>
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
                            {sec.count?.toLocaleString('en-IN')} civil works
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-xs text-[var(--text-primary)] tabular-nums">{sec.crores}</div>
                        <div className="text-[11px] font-bold text-[var(--brand-primary)] tabular-nums">{sec.value}% spend</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="No sectoral data" description="No sector breakdown available for the selected view." />
            )}
          </SectionCard>

          {/* Chart 4: Multi-Year Allocation vs Spend Trend */}
          <SectionCard
            title={t('chart.trend')}
            subtitle="Fiscal Outlay vs Expenditure Trajectory"
            action={
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                Annual Audited Ledger
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
                      <XAxis dataKey="period" stroke={chartTheme.textColor} fontSize={11} tickLine={false} />
                      <YAxis stroke={chartTheme.textColor} fontSize={11} tickLine={false} />
                      <Tooltip content={<ChartTooltip formatter="crore" />} />
                      <Area
                        type="monotone"
                        dataKey="disbursed"
                        name="Audited Disbursal"
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
                    <span className="text-[var(--text-secondary)] font-medium">Liquid Treasury Disbursal (₹ Crores)</span>
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
          title="State & UT Performance League Table"
          subtitle="Comparative Fund Absorption & Expenditure Velocity across 36 Jurisdictions"
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
                  All (36)
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
                  States (28)
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
                  Union Territories (8)
                </button>
              </div>

              <Link
                to="/states"
                className="text-xs font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
              >
                <span>Full Directory</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rankedStates.slice(0, 10).map((st, idx) => {
              const util = Number(st.utilizationPercentage ?? st.utilizationRate ?? 0)
              const isTop3 = idx < 3
              const isUT = UNION_TERRITORIES.includes(st.state)
              const allocCr = Math.round((st.totalAllocated || 0) / 10000000)
              const spentCr = Math.round((st.totalExpenditure || 0) / 10000000)
              const distCount = st.districtCount || 0
              const mpCount = st.activeMpCount || st.totalMPs || 0

              return (
                <Link
                  to={`/states/${encodeURIComponent(st.state)}`}
                  key={st.state}
                  className="lux-card p-4 flex flex-col justify-between hover:border-[var(--brand-accent)] hover:shadow-md transition-all group cursor-pointer"
                >
                  {/* Top Row: Rank Badge + Name + Tag + Utilization */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-transform group-hover:scale-105 ${
                          isTop3 && idx === 0
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-2xs font-black'
                            : isTop3 && idx === 1
                            ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-2xs font-black'
                            : isTop3 && idx === 2
                            ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-2xs font-black'
                            : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border-primary)]'
                        }`}
                      >
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition truncate">
                            {st.state}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 ${
                              isUT
                                ? 'bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30'
                                : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                            }`}
                          >
                            {isUT ? 'UT' : 'State'}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">
                          {distCount} Districts &bull; {mpCount} MPs
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm sm:text-base font-black tabular-nums text-[var(--gold-text)]">
                        {util.toFixed(1)}%
                      </span>
                      <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                        Absorption
                      </span>
                    </div>
                  </div>

                  {/* Financial Mini-Bar */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium mb-2 pt-2 border-t border-[var(--border-subtle)]">
                    <span className="tabular-nums">
                      <strong className="text-[var(--text-primary)]">₹{spentCr.toLocaleString('en-IN')} Cr</strong> spent
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                      of ₹{allocCr.toLocaleString('en-IN')} Cr outlay
                    </span>
                  </div>

                  {/* Modern Dual-tone Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(2, util))}%` }}
                    />
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
          className="group lux-card p-6 sm:p-8 relative overflow-hidden transition-all hover:scale-[1.008] hover:border-[var(--brand-accent)] hover:shadow-lg"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-[var(--brand-accent)]/10 blur-3xl pointer-events-none group-hover:bg-[var(--brand-accent)]/20 transition-colors" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center shadow-xs">
                <Landmark size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-1 group-hover:text-[var(--brand-primary)] transition">
                  Browse by State & UT
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
                  Census directory across 28 States & 8 Union Territories with interactive district drill-downs, Nodal Authority oversight, and financial ledgers.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  36 Jurisdictions
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  740+ Districts
                </span>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] group-hover:bg-[var(--brand-primary)] group-hover:text-white text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] transition-all">
                  <span>Explore State & UT Directory</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/mps"
          className="group lux-card p-6 sm:p-8 relative overflow-hidden transition-all hover:scale-[1.008] hover:border-[var(--brand-accent)] hover:shadow-lg"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-[var(--brand-primary)]/10 blur-3xl pointer-events-none group-hover:bg-[var(--brand-primary)]/20 transition-colors" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shadow-xs">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-1 group-hover:text-[var(--brand-primary)] transition">
                  Browse by Member of Parliament
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
                  Explore all 774 Members of Parliament across Lok Sabha (543 seats) and Rajya Sabha (231 seats). Inspect individual recommendations and ledger cards.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  543 Lok Sabha
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  231 Rajya Sabha
                </span>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] group-hover:bg-[var(--brand-primary)] group-hover:text-white text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] transition-all">
                  <span>Inspect Parliamentary Seats</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Explainer Modal (Video / Briefing) */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
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
