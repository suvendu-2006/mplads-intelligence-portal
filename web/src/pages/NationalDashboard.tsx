import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  StatCard,
  SectionCard,
  EmptyState
} from '../components/shared'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ChartTooltip } from '../components/charts'
import { useChartTheme } from '../hooks/useChartTheme'
import { useInView } from '../hooks/useInView'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import { DEFAULT_NATIONAL, DEFAULT_ANALYTICS, DEFAULT_TOP_STATES } from '../lib/defaultData'
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
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Sector
} from 'recharts'
import { useTranslation, toNativeDigits, translateState, translateSector, LangMode } from '../lib/i18n'

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

const SECTOR_PIE_COLORS_LIGHT = [
  '#7C3AED', // 1. Roads & Pathways: Royal Deep Violet (32.6%)
  '#F59E0B', // 2. Public Space Lighting: Luminous Amber Gold (11.9%)
  '#E11D48', // 3. Community Centers & Halls: Vivid Crimson Rose (7.9%)
  '#C026D3', // 4. Solar & Municipal Street Lights: Electric Orchid Magenta (4.3%)
  '#EA580C', // 5. School & College Classrooms: Vibrant Coral Tangerine (3.8%)
  '#64748B', // 6. Other Socio-Economic Sectors: Executive Slate Charcoal (39.5%)
]

const SECTOR_PIE_COLORS_DARK = [
  '#38BDF8', // 1. Sky Blue
  '#FB923C', // 2. Warm Orange
  '#2FD0A0', // 3. Mint Emerald
  '#FACC15', // 4. Amber Yellow
  '#F472B6', // 5. Rose Pink
  '#818CF8', // 6. Indigo Violet
]

interface SectorExpenditureCardProps {
  sectorData: any[]
  totalSectorCr: number
}

/**
 * 60 FPS Animated Value for Donut Center Labels
 * Smoothly animates from 0 to target on mount/refresh
 */
function AnimatedDonutValue({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const { lang } = useTranslation()
  const spanRef = React.useRef<HTMLSpanElement>(null)
  const prevValRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!spanRef.current) return
    const finalStr = toNativeDigits(value.toLocaleString('en-IN'), lang)
    if (prevValRef.current === value) {
      spanRef.current.textContent = finalStr
      return
    }

    const startVal = prevValRef.current ?? 0
    prevValRef.current = value

    if (typeof window === 'undefined' || !window.requestAnimationFrame || value === 0 || startVal === value) {
      spanRef.current.textContent = finalStr
      return
    }

    const duration = 750
    const startTime = performance.now()
    let frameId: number

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Quartic ease-out: rapid initial roll with an ultra-smooth, silky glide to rest
      const easeOut = 1 - Math.pow(1 - progress, 4)
      const current = Math.round(startVal + (value - startVal) * easeOut)

      if (spanRef.current) {
        spanRef.current.textContent = toNativeDigits(current.toLocaleString('en-IN'), lang)
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else if (spanRef.current) {
        spanRef.current.textContent = finalStr
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, lang])

  return (
    <span>
      {prefix}
      <span ref={spanRef}>{toNativeDigits(value.toLocaleString('en-IN'), lang)}</span>
      {suffix}
    </span>
  )
}

/**
 * 60 FPS Animated Percentage for Donut Center Labels
 */
function AnimatedDonutPercent({ value }: { value: number }) {
  const { lang } = useTranslation()
  const spanRef = React.useRef<HTMLSpanElement>(null)
  const prevValRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!spanRef.current) return
    const finalStr = `${toNativeDigits(value.toFixed(1), lang)}%`
    if (prevValRef.current === value) {
      spanRef.current.textContent = finalStr
      return
    }

    const startVal = prevValRef.current ?? 0
    prevValRef.current = value

    if (typeof window === 'undefined' || !window.requestAnimationFrame || value === 0 || startVal === value) {
      spanRef.current.textContent = finalStr
      return
    }

    const duration = 750
    const startTime = performance.now()
    let frameId: number

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Quartic ease-out: rapid initial roll with an ultra-smooth, silky glide to rest
      const easeOut = 1 - Math.pow(1 - progress, 4)
      const current = (startVal + (value - startVal) * easeOut).toFixed(1)

      if (spanRef.current) {
        spanRef.current.textContent = `${toNativeDigits(current, lang)}%`
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else if (spanRef.current) {
        spanRef.current.textContent = finalStr
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, lang])

  return <span ref={spanRef}>{toNativeDigits(value.toFixed(1), lang)}%</span>
}

/**
 * Viewport-triggered Multi-Year Allocation vs Spend Trend Area Chart
 * Runs a silky 1100ms sweep animation only when scrolled into view
 */
function TrendAreaChart({
  yearlyTrendData,
  chartTheme,
  lang,
  t
}: {
  yearlyTrendData: any[]
  chartTheme: any
  lang: LangMode
  t: (key: string) => string
}) {
  const [animKey, setAnimKey] = useState(0)
  const hasTriggeredRef = React.useRef(false)
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || hasTriggeredRef.current) return
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true
          // Re-trigger the smooth sweep animation right when entering view
          setAnimKey(prev => prev + 1)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '60px 0px 60px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="h-60 w-full chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          key={`trend-area-${animKey}`}
          data={yearlyTrendData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284C7" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0284C7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
          <XAxis
            dataKey="period"
            stroke={chartTheme.textColor}
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => toNativeDigits(v, lang)}
          />
          <YAxis
            stroke={chartTheme.textColor}
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => toNativeDigits(v, lang)}
          />
          <Tooltip
            content={<ChartTooltip formatter="crore" />}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 999999, pointerEvents: 'none' }}
          />
          <Area
            type="monotone"
            dataKey="disbursed"
            name={t('chart.audited_disbursal')}
            stroke="#0284C7"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#spentGrad)"
            isAnimationActive={true}
            animationDuration={850}
            animationEasing="ease-out"
            animationBegin={0}
            dot={{ r: 4, fill: '#0284C7' }}
            activeDot={{
              r: 6,
              fill: chartTheme.tooltipBg,
              stroke: '#0284C7',
              strokeWidth: 3
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Isolated, memoized Sectoral Expenditure Pie Chart
 * Self-contained hover/click state guarantees zero layout shift or parent re-renders
 */
const SectorExpenditureCard: React.FC<SectorExpenditureCardProps> = React.memo(({
  sectorData,
  totalSectorCr,
}) => {
  const { t, toNativeDigits } = useTranslation()
  const [selectedSectorIndex, setSelectedSectorIndex] = useState<number | null>(null)
  const [hoveredSectorIndex, setHoveredSectorIndex] = useState<number | null>(null)
  const activeSectorIndex = hoveredSectorIndex !== null ? hoveredSectorIndex : selectedSectorIndex
  const activeSector = activeSectorIndex !== null ? sectorData[activeSectorIndex] : null

  const handleToggleSector = (idx: number) => {
    setSelectedSectorIndex(prev => prev === idx ? null : idx)
  }

  // Crisp native SVG geometry expansion with guaranteed fill color for all sectors
  const renderActiveSector = React.useCallback((props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props
    const sliceColor = fill || payload?.color || payload?.fill || '#64748B'
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={sliceColor}
          stroke="var(--surface-primary)"
          strokeWidth={3}
          cursor="pointer"
        />
      </g>
    )
  }, [])

  if (!sectorData || sectorData.length === 0) {
    return <EmptyState title="No sectoral data" description="No sector breakdown available for the selected view." />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
      {/* Left Column: Donut Pie Chart (5 cols) */}
      <div className="lg:col-span-5 h-80 relative flex items-center justify-center chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sectorData}
              cx="50%"
              cy="50%"
              innerRadius={78}
              outerRadius={114}
              paddingAngle={3}
              cornerRadius={5}
              dataKey="value"
              {...({
                activeIndex: activeSectorIndex ?? undefined,
                activeShape: renderActiveSector
              } as any)}
              animationDuration={ANIMATION_CONFIG.duration.pie}
              animationEasing="ease-out"
              animationBegin={0}
              isAnimationActive={true}
              onClick={(_, idx) => handleToggleSector(idx)}
              onMouseEnter={(_, idx) => setHoveredSectorIndex(idx)}
              onMouseLeave={() => setHoveredSectorIndex(null)}
            >
              {sectorData.map((entry: any, idx: number) => {
                const isHovered = activeSectorIndex === idx
                return (
                  <Cell
                    key={`cell-sec-pie-${idx}`}
                    fill={entry.color}
                    stroke="var(--surface-primary)"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{
                      opacity: activeSectorIndex === null || isHovered ? 1 : 0.4,
                      cursor: 'pointer',
                      transition: 'opacity 150ms ease-out'
                    }}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Interactive Donut Center Label (Guaranteed Zero Overlap: fixed-dimension 3-tier layout) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center select-none px-2">
          <div className="w-[144px] h-[92px] flex flex-col items-center justify-center overflow-hidden">
            {/* Tier 1: Category Header / Context */}
            <div className="h-[26px] flex items-center justify-center w-full px-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] line-clamp-1 leading-tight">
                {activeSector ? t('chart.selected_share') : t('chart.total_disbursed')}
              </span>
            </div>

            {/* Tier 2: Big Numeral / Percentage */}
            <div className="h-[38px] flex items-center justify-center w-full my-0.5">
              <span className="text-2xl sm:text-[26px] font-black text-[var(--text-primary)] tabular-nums tracking-tight leading-none">
                {activeSector ? (
                  `${toNativeDigits(activeSector.value)}%`
                ) : (
                  <>
                    <AnimatedDonutValue value={totalSectorCr} prefix="₹" />
                    <span className="text-xs font-bold text-[var(--text-secondary)] ml-1">
                      {t('unit.cr')}
                    </span>
                  </>
                )}
              </span>
            </div>

            {/* Tier 3: Value in Crores or Category Count */}
            <div className="h-[24px] flex items-center justify-center w-full px-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-[var(--brand-primary)] tabular-nums leading-tight line-clamp-1">
                {activeSector ? (
                  `₹${toNativeDigits(activeSector.crValue.toLocaleString('en-IN'))} ${t('unit.cr')}`
                ) : (
                  t('chart.six_priority_sectors')
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: All 6 Sector Cards with Socio-Economic Progress Bar (7 cols) - NO SCROLL, ALL VISIBLE */}
      <div className="lg:col-span-7 flex flex-col gap-2">
        {sectorData.map((sec: any, idx: number) => {
          const isHovered = activeSectorIndex === idx
          return (
            <div
              key={idx}
              onClick={() => handleToggleSector(idx)}
              onMouseEnter={() => setHoveredSectorIndex(idx)}
              onMouseLeave={() => setHoveredSectorIndex(null)}
              className={`p-2.5 rounded-xl border transition-[border-color,box-shadow,background-color] duration-150 cursor-pointer ${
                isHovered
                  ? 'bg-[var(--surface-primary)] border-[#7C3AED] shadow-md ring-1 ring-[#7C3AED]/30'
                  : 'bg-[var(--surface-alt)]/70 border-[var(--border-primary)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 text-xs">
                {/* Sector Full Name: NO TRUNCATE / NO ELLIPSIS */}
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0 mt-0.5 shadow-xs"
                    style={{ backgroundColor: sec.color }}
                  />
                  <span
                    className={`font-bold leading-snug break-words ${
                      isHovered ? 'text-[#7C3AED]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {sec.name}
                  </span>
                </div>

                {/* Amount and Percentage */}
                <div className="text-right shrink-0 flex items-center gap-2.5">
                  <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                    ₹{toNativeDigits(sec.crValue.toLocaleString('en-IN'))} {t('unit.cr')}
                  </span>
                  <span
                    className="font-black tabular-nums text-xs min-w-[42px] text-right"
                    style={{ color: sec.color }}
                  >
                    {toNativeDigits(sec.value)}%
                  </span>
                </div>
              </div>

              {/* Socio-Economic Visual Progress Bar */}
              <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, sec.value)}%`,
                    backgroundColor: sec.color
                  }}
                />
              </div>

              {/* Sub-label */}
              <div className="text-[10px] text-[var(--text-secondary)] font-semibold flex items-center justify-between mt-1">
                <span>{toNativeDigits(sec.count?.toLocaleString('en-IN'))} {t('chart.works')} funded</span>
                {isHovered && (
                  <span className="text-[9px] font-bold text-[#7C3AED] uppercase tracking-wider">
                    {selectedSectorIndex === idx ? 'Selected (Click to deselect)' : 'Active Hover'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

interface WorksDeliveryCardProps {
  completedWorks: number
  pendingWorks: number
}

/**
 * Isolated, memoized Works Delivery Status Donut Chart
 */
const WorksDeliveryCard: React.FC<WorksDeliveryCardProps> = React.memo(({
  completedWorks,
  pendingWorks,
}) => {
  const { t, toNativeDigits } = useTranslation()
  const [selectedStatusIndex, setSelectedStatusIndex] = useState<number | null>(null)
  const [hoveredStatusIndex, setHoveredStatusIndex] = useState<number | null>(null)
  const activeStatusIndex = hoveredStatusIndex !== null ? hoveredStatusIndex : selectedStatusIndex

  const totalWorksCalc = completedWorks + pendingWorks
  const compPct = totalWorksCalc > 0 ? ((completedWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
  const pendPct = totalWorksCalc > 0 ? ((pendingWorks / totalWorksCalc) * 100).toFixed(1) : '0.0'
  const worksPieData = React.useMemo(() => [
    {
      name: t('chart.completed_certified'),
      value: completedWorks,
      color: '#7C3AED',
      pct: compPct
    },
    {
      name: t('chart.active_in_queue'),
      value: pendingWorks,
      color: '#F59E0B',
      pct: pendPct
    }
  ], [completedWorks, pendingWorks, compPct, pendPct, t])

  const activeStatus = activeStatusIndex !== null ? worksPieData[activeStatusIndex] : null

  const handleToggleStatus = (idx: number) => {
    setSelectedStatusIndex(prev => prev === idx ? null : idx)
  }

  const renderActiveStatus = React.useCallback((props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props
    const sliceColor = fill || payload?.color || '#7C3AED'
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={sliceColor}
          stroke="var(--surface-primary)"
          strokeWidth={3}
          cursor="pointer"
        />
      </g>
    )
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
      <div className="lg:col-span-5 h-80 relative flex items-center justify-center chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={worksPieData}
              cx="50%"
              cy="50%"
              innerRadius={78}
              outerRadius={114}
              paddingAngle={3}
              cornerRadius={5}
              dataKey="value"
              {...({
                activeIndex: activeStatusIndex ?? undefined,
                activeShape: renderActiveStatus
              } as any)}
              animationDuration={ANIMATION_CONFIG.duration.pie}
              animationEasing="ease-out"
              animationBegin={0}
              isAnimationActive={true}
              onClick={(_, idx) => handleToggleStatus(idx)}
              onMouseEnter={(_, idx) => setHoveredStatusIndex(idx)}
              onMouseLeave={() => setHoveredStatusIndex(null)}
            >
              {worksPieData.map((entry: any, idx: number) => {
                const isHovered = activeStatusIndex === idx
                return (
                  <Cell
                    key={`cell-status-pie-${idx}`}
                    fill={entry.color}
                    stroke="var(--surface-primary)"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{
                      opacity: activeStatusIndex === null || isHovered ? 1 : 0.4,
                      cursor: 'pointer',
                      transition: 'opacity 150ms ease-out'
                    }}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Interactive Donut Center Label (Fixed 3-Tier Layout, Zero Overlap) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center select-none px-2">
          <div className="w-[144px] h-[92px] flex flex-col items-center justify-center overflow-hidden">
            {/* Tier 1 */}
            <div className="h-[26px] flex items-center justify-center w-full px-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] line-clamp-1 leading-tight">
                {activeStatus ? activeStatus.name : t('chart.delivery_rate')}
              </span>
            </div>

            {/* Tier 2 */}
            <div className="h-[38px] flex items-center justify-center w-full my-0.5">
              <span className="text-2xl sm:text-[26px] font-black text-[var(--text-primary)] tabular-nums tracking-tight leading-none">
                {activeStatus ? (
                  `${toNativeDigits(activeStatus.pct)}%`
                ) : (
                  <AnimatedDonutPercent value={Number(compPct)} />
                )}
              </span>
            </div>

            {/* Tier 3 */}
            <div className="h-[24px] flex items-center justify-center w-full px-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-[var(--text-secondary)] tabular-nums leading-tight line-clamp-1">
                {activeStatus
                  ? `${toNativeDigits(activeStatus.value.toLocaleString('en-IN'))} ${t('chart.works')}`
                  : `${toNativeDigits(completedWorks.toLocaleString('en-IN'))} ${t('status.completed')}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-3">
        <div
          onClick={() => handleToggleStatus(0)}
          onMouseEnter={() => setHoveredStatusIndex(0)}
          onMouseLeave={() => setHoveredStatusIndex(null)}
          className={`p-3.5 rounded-xl border transition-[border-color,box-shadow,background-color] duration-150 cursor-pointer ${
            activeStatusIndex === 0
              ? 'bg-[var(--surface-primary)] border-[#7C3AED] shadow-md ring-1 ring-[#7C3AED]/30'
              : 'bg-[var(--surface-alt)]/70 border-[var(--border-primary)] hover:bg-[var(--surface-alt)]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: '#7C3AED' }} />
              <span className="break-words leading-tight">{t('chart.completed_certified')}</span>
            </span>
            <span className="font-black text-sm text-[#7C3AED] tabular-nums">{toNativeDigits(compPct)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden my-2">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${compPct}%`, backgroundColor: '#7C3AED' }}
            />
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <div className="text-base font-black text-[var(--text-primary)] tabular-nums">
              {toNativeDigits(completedWorks.toLocaleString('en-IN'))} {t('chart.works')}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-bold">
              Disbursed: ₹{toNativeDigits('2,546')} {t('unit.cr')}
            </div>
          </div>
        </div>

        <div
          onClick={() => handleToggleStatus(1)}
          onMouseEnter={() => setHoveredStatusIndex(1)}
          onMouseLeave={() => setHoveredStatusIndex(null)}
          className={`p-3.5 rounded-xl border transition-[border-color,box-shadow,background-color] duration-150 cursor-pointer ${
            activeStatusIndex === 1
              ? 'bg-[var(--surface-primary)] border-[#F59E0B] shadow-md ring-1 ring-[#F59E0B]/30'
              : 'bg-[var(--surface-alt)]/70 border-[var(--border-primary)] hover:bg-[var(--surface-alt)]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: '#F59E0B' }} />
              <span className="break-words leading-tight">{t('chart.active_in_queue')}</span>
            </span>
            <span className="font-black text-sm text-[#F59E0B] tabular-nums">{toNativeDigits(pendPct)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden my-2">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pendPct}%`, backgroundColor: '#F59E0B' }}
            />
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <div className="text-base font-black text-[var(--text-primary)] tabular-nums">
              {toNativeDigits(pendingWorks.toLocaleString('en-IN'))} {t('chart.works')}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-bold">
              Committed: ₹{toNativeDigits('1,578')} {t('unit.cr')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

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
      return (parsed && parsed.length >= 30) ? parsed : []
    } catch { return [] }
  })
  // If cache already has the full 36 states, load immediately; otherwise wait 3ms for the fresh API call so Recharts mounts once
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem('cached_nat_states')
      const parsed = saved ? JSON.parse(saved) : null
      return !(parsed && parsed.length >= 30)
    } catch { return true }
  })
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [leagueFilter, setLeagueFilter] = useState<'all' | 'states' | 'uts'>('all')
  const [stateChartFilter, setStateChartFilter] = useState<'all' | 'states' | 'uts' | 'top10'>('all')
  const [stateChartSort, setStateChartSort] = useState<'allocated' | 'utilized' | 'rate'>('allocated')

  const chartTheme = useChartTheme()

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        const [resNat, resStates, resAnalytics] = await Promise.all([
          fetch('/api/national'),
          fetch('/api/states?sort=red_pct&order=desc'),
          fetch('/api/national/analytics')
        ])

        if (!isMounted) return

        if (resNat.ok) {
          const jsonNat = await resNat.json()
          if (jsonNat.data) {
            setNational((prev: any) => {
              if (
                prev &&
                Math.round(prev.totalAllocated || 0) === Math.round(jsonNat.data.totalAllocated || 0) &&
                Math.round(prev.totalExpenditure || 0) === Math.round(jsonNat.data.totalExpenditure || 0)
              ) {
                return prev // Reference stability prevents Recharts animation abort
              }
              return jsonNat.data
            })
            try { sessionStorage.setItem('cached_nat_data', JSON.stringify(jsonNat.data)) } catch {}
          }
        }
        if (resStates.ok) {
          const jsonStates = await resStates.json()
          const fetchedStates = jsonStates.data || []
          if (fetchedStates.length > 0) {
            setStates((prev: any[]) => {
              if (
                prev &&
                prev.length === fetchedStates.length &&
                prev[0]?.state === fetchedStates[0]?.state &&
                Math.round(prev[0]?.totalAllocated || 0) === Math.round(fetchedStates[0]?.totalAllocated || 0)
              ) {
                return prev // Reference stability prevents Recharts animation abort
              }
              return fetchedStates
            })
            try { sessionStorage.setItem('cached_nat_states', JSON.stringify(fetchedStates)) } catch {}
          }
        }
        if (resAnalytics.ok) {
          const jsonAnalytics = await resAnalytics.json()
          if (jsonAnalytics.data) {
            setAnalytics((prev: any) => {
              if (
                prev &&
                Math.round(prev.totalExpenditure || 0) === Math.round(jsonAnalytics.data.totalExpenditure || 0)
              ) {
                return prev // Reference stability prevents Recharts animation abort
              }
              return jsonAnalytics.data
            })
            try { sessionStorage.setItem('cached_nat_analytics', JSON.stringify(jsonAnalytics.data)) } catch {}
          }
        }
      } catch (e) {
        console.error('Error fetching national dashboard data:', e)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  const [pieMode, setPieMode] = useState<'sectors' | 'status'>('sectors')

  // Real data calculations directly from central API
  const totalAllocCr = national ? Math.round((national.totalAllocated || 0) / 10000000) : 0
  const totalUsedCr = national ? Math.round((national.totalExpenditure || 0) / 10000000) : 0
  const utilRate = national?.utilizationPercentage ? Number(national.utilizationPercentage.toFixed(1)) : 0
  const paymentGap = national?.paymentGap ? Number(national.paymentGap.toFixed(1)) : 0

  const totalMps = national?.totalMPs ?? 0
  const pendingWorks = national?.pendingWorks ?? 0
  const completedWorks = national?.totalWorksCompleted ?? 0
  const activePayments = national ? Math.round((national.inProgressPayments || 0) / 10000000) : 0

  const sectorData = React.useMemo(() => {
    const piePalette = chartTheme.isDark ? SECTOR_PIE_COLORS_DARK : SECTOR_PIE_COLORS_LIGHT
    return analytics?.topSectors?.map((sec: any, idx: number) => {
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
        color: piePalette[idx % piePalette.length]
      }
    }) || []
  }, [analytics?.topSectors, lang, chartTheme.isDark, t])

  const totalSectorCr = React.useMemo(() => {
    return sectorData.reduce((sum: number, s: any) => sum + (s.crValue || 0), 0)
  }, [sectorData])

  // Real yearly multi-year trend from mplads_trends.csv via /api/national/analytics
  const yearlyTrendData = analytics?.yearlyTrends?.map((t: any) => ({
    period: t.label || String(t.year),
    disbursed: Math.round(t.amount / 10000000),
    transactions: t.count
  })) || []

  // Complete dataset for All 36 States & UTs
  const statesPool = React.useMemo(() => {
    if (states && states.length >= 30) {
      return states.map((s) => {
        const isUT = UNION_TERRITORIES.includes(s.state)
        const alloc = Math.round((s.totalAllocated || 0) / 10000000)
        const util = Math.round((s.totalExpenditure || 0) / 10000000)
        const rate = alloc > 0 ? Math.round((util / alloc) * 1000) / 10 : 0
        return {
          state: s.state,
          name: translateState(s.state, lang),
          isUT,
          allocated: alloc,
          utilized: util,
          rate,
          completedWorks: s.totalWorksCompleted || s.completedWorksCount || 0
        }
      })
    }
    return ALL_36_STATES_OVERVIEW.map((s) => ({
      state: s.state,
      name: translateState(s.state, lang),
      isUT: s.isUT,
      allocated: Math.round(s.allocatedCr),
      utilized: Math.round(s.expenditureCr),
      rate: s.expenditureRate,
      completedWorks: s.completedWorks
    }))
  }, [states, lang])

  const chartStatesData = React.useMemo(() => {
    let list = [...statesPool]
    if (stateChartFilter === 'states') {
      list = list.filter((s) => !s.isUT)
    } else if (stateChartFilter === 'uts') {
      list = list.filter((s) => s.isUT)
    } else if (stateChartFilter === 'top10') {
      return [...list].sort((a, b) => b.allocated - a.allocated).slice(0, 10)
    }

    if (stateChartSort === 'allocated') {
      list.sort((a, b) => b.allocated - a.allocated)
    } else if (stateChartSort === 'utilized') {
      list.sort((a, b) => b.utilized - a.utilized)
    } else if (stateChartSort === 'rate') {
      list.sort((a, b) => b.rate - a.rate)
    }
    // Retain Top 20 jurisdictions to ensure clear, uncluttered visualization
    return list.slice(0, 20)
  }, [statesPool, stateChartFilter, stateChartSort])

  if (loading) {
    return <LoadingSkeleton rows={8} height="h-28" />
  }

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
          theme="slate"
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
          borderHighlight="amber"
          description="stat.active_queue"
          tooltip="tooltip.pending"
        />
        <StatCard
          icon={Receipt}
          label="kpi.ongoing"
          value={activePayments}
          prefix="₹"
          unit="Cr"
          theme="slate"
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
            theme="slate"
            tooltip="tooltip.corpus"
          />
          <StatCard
            icon={Coins}
            label="kpi.used"
            value={totalUsedCr}
            prefix="₹"
            unit="Cr"
            theme="slate"
            tooltip="tooltip.utilization"
          />
          <StatCard
            icon={Percent}
            label="kpi.utilization"
            value={utilRate}
            unit="%"
            theme="emerald"
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
        {/* Row 1: Full-Width Top 20 States & Union Territories Bar Diagram */}
        <SectionCard
          title={
            stateChartFilter === 'all'
              ? t('chart.top_states')
              : stateChartFilter === 'states'
              ? 'Top 20 States MPLADS Outlay & Expenditure'
              : stateChartFilter === 'uts'
              ? '8 Union Territories MPLADS Outlay & Expenditure'
              : 'Top 10 States & UTs by Allocation'
          }
          subtitle={
            stateChartFilter === 'all'
              ? t('chart.top_states_sub')
              : `Statutory allocation ceiling vs audited disbursal across ${chartStatesData.length} jurisdictions (in ₹ Crores)`
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* Scope filter */}
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs">
                {(
                  [
                    { id: 'all', label: 'Top 20' },
                    { id: 'states', label: 'States (20)' },
                    { id: 'uts', label: 'UTs (8)' },
                    { id: 'top10', label: 'Top 10' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStateChartFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      stateChartFilter === tab.id
                        ? 'bg-[var(--surface-primary)] text-[#4338CA] shadow-xs border border-[var(--border-subtle)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort filter */}
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs">
                {(
                  [
                    { id: 'allocated', label: 'By Budget' },
                    { id: 'utilized', label: 'By Spend' },
                    { id: 'rate', label: 'By Util %' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStateChartSort(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      stateChartSort === tab.id
                        ? 'bg-[var(--surface-primary)] text-[#D97706] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div className="w-full overflow-x-auto pb-2">
            <div className="h-[440px] min-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={`bar-chart-${stateChartFilter}-${stateChartSort}`}
                  data={chartStatesData}
                  margin={{ top: 15, right: 20, left: 10, bottom: 65 }}
                  barGap={chartStatesData.length > 20 ? 1 : 3}
                  barCategoryGap={chartStatesData.length > 20 ? '16%' : '24%'}
                >
                  <defs>
                    <linearGradient id="barAllocatedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.isDark ? '#5DA1F3' : '#4F46E5'} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartTheme.isDark ? '#3B82F6' : '#3730A3'} stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="barUtilizedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.isDark ? '#FF9E5E' : '#F59E0B'} stopOpacity={1} />
                      <stop offset="100%" stopColor={chartTheme.isDark ? '#E58F39' : '#D97706'} stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    fontSize={chartStatesData.length > 20 ? 10 : 11}
                    fontWeight={600}
                    tickLine={false}
                    interval={0}
                    angle={-48}
                    textAnchor="end"
                    height={84}
                    tickFormatter={(name) => translateState(name, lang)}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    tickFormatter={(v) => `₹${toNativeDigits(v, lang)}`}
                  />
                  <Tooltip
                    content={<ChartTooltip formatter="crore" />}
                    cursor={{ fill: 'var(--surface-hover)', opacity: 0.35 }}
                    isAnimationActive={false}
                    wrapperStyle={{ zIndex: 999999, pointerEvents: 'none' }}
                  />
                  <Bar
                    dataKey="allocated"
                    name={t('chart.allocated_budget')}
                    fill="url(#barAllocatedGrad)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                    isAnimationActive={true}
                    animationDuration={ANIMATION_CONFIG.duration.bar}
                    animationEasing="ease-out"
                    animationBegin={0}
                  />
                  <Bar
                    dataKey="utilized"
                    name={t('chart.utilized_disbursal')}
                    fill="url(#barUtilizedGrad)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                    isAnimationActive={true}
                    animationDuration={ANIMATION_CONFIG.duration.bar}
                    animationEasing="ease-out"
                    animationBegin={0}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Color Legend tailored for pure white background */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--border-subtle)] text-xs">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs shadow-xs" style={{ backgroundColor: chartTheme.isDark ? '#5DA1F3' : '#4338CA' }} />
                <span className="text-[var(--text-primary)] font-bold">
                  {t('chart.allocated_budget')}
                  <span className="text-[var(--text-secondary)] font-normal ml-1">(₹ Cr statutory limit)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs shadow-xs" style={{ backgroundColor: chartTheme.isDark ? '#E58F39' : '#D97706' }} />
                <span className="text-[var(--text-primary)] font-bold">
                  {t('chart.utilized_disbursal')}
                  <span className="text-[var(--text-secondary)] font-normal ml-1">(₹ Cr actual spent)</span>
                </span>
              </div>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live MoSPI eSAKSHI Verified • Displaying Top {chartStatesData.length} Jurisdictions
            </div>
          </div>
        </SectionCard>

        {/* Row 2: Chart 3 (Works Delivery Status with By Field / Works Status toggle) + Chart 4 (Yearly Allocation vs Spend Trend) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 3: Sectoral Expenditure Pie Chart & Works Delivery */}
          <SectionCard
            title={pieMode === 'sectors' ? t('chart.where_money_spent') : t('chart.works_delivery_status')}
            subtitle={
              pieMode === 'sectors'
                ? t('chart.where_money_spent_sub')
                : `${toNativeDigits((completedWorks + pendingWorks).toLocaleString('en-IN'), lang)} ${t('chart.sanctioned_works_sub')}`
            }
            action={
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-0.5 rounded-lg border border-[var(--border-primary)] text-[11px]">
                <button
                  type="button"
                  onClick={() => setPieMode('sectors')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    pieMode === 'sectors'
                      ? 'bg-[var(--surface-primary)] text-[#4338CA] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('chart.by_field')}
                </button>
                <button
                  type="button"
                  onClick={() => setPieMode('status')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    pieMode === 'status'
                      ? 'bg-[var(--surface-primary)] text-[#4338CA] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('chart.works_status')}
                </button>
              </div>
            }
          >
            {pieMode === 'sectors' ? (
              <SectorExpenditureCard
                sectorData={sectorData}
                totalSectorCr={totalSectorCr}
              />
            ) : (
              <WorksDeliveryCard
                completedWorks={completedWorks}
                pendingWorks={pendingWorks}
              />
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
                <TrendAreaChart
                  yearlyTrendData={yearlyTrendData}
                  chartTheme={chartTheme}
                  lang={lang}
                  t={t}
                />
                <div className="flex items-center justify-center gap-6 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#0284C7' }} />
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
              .map((st) => {
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
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
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
      {showVideoModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowVideoModal(false) }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
        >
          <div className="lux-card max-w-xl w-full p-5 sm:p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--surface-alt)] cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Video className="text-[var(--primary-700)]" size={20} />
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
                className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow cursor-pointer"
              >
                Close Explainer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
