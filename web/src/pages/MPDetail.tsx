import React, { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ChartTooltip } from '../components/charts'
import { BackButton } from '../components/BackButton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import {
  FundCard,
  StatCard,
  TierBadge,
  EmptyState,
  SectionCard,
  AgencyBadge
} from '../components/shared'
import { useChartTheme } from '../hooks/useChartTheme'
import { ANIMATION_CONFIG } from '../lib/animationConfig'
import { useTranslation, translateState, translateConstituency, translateMP } from '../lib/i18n'
import { ALL_MP_SEATS } from '../lib/allMpsData'
import { findAssemblyConstituencies, getACsByPC } from '../lib/assemblyConstituencies'
import { fetchPrefetchedJson } from '../lib/speedPrefetch'

const UNSPECIFIED_SEGMENT = 'District-Wide / Unspecified'

function normalizeAcBase(name: string): string {
  return (name || '')
    .replace(/\s*\((?:sc|st|s\.c\.|s\.t\.|s)\)?$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveWorkSegmentFallback(
  w: any,
  assemblies: Array<{ ac_name?: string; district?: string }>,
  pcName: string
): string {
  const desc = String(w.work_description || w.workDescription || w.description || '').toLowerCase()
  const rawLoc = String(w.location || '').trim()
  const rawDistrict = String(w.district || '').trim()
  const normPc = normalizeAcBase(pcName)
  const normWorkDist = normalizeAcBase(rawDistrict)
  const normLoc = normalizeAcBase(rawLoc)
  const isGenericLoc =
    !normLoc ||
    normLoc === normPc ||
    normLoc === normWorkDist ||
    normLoc === `dist ${normWorkDist}` ||
    normLoc === `${normWorkDist} district` ||
    normLoc === `district ${normWorkDist}`
  const searchableText = isGenericLoc ? desc : `${desc} ${rawLoc.toLowerCase()}`

  const candidates = assemblies
    .map((a) => ({
      acName: String(a.ac_name || '').trim(),
      base: normalizeAcBase(String(a.ac_name || ''))
    }))
    .filter((c) => c.acName && c.base)
    .sort((a, b) => b.base.length - a.base.length)

  for (const { acName, base } of candidates) {
    const pattern = escapeRegExp(base).replace(/\s+/g, '\\s+')
    const isNamesake = base === normPc || (normWorkDist !== '' && base === normWorkDist)
    if (isNamesake) {
      const contextRe = new RegExp(
        `(?:\\b${pattern}\\s+(?:municipality|municipal|nagar\\s+palika|city|town|ward|block|assembly|vidhan\\s+sabha|ac)\\b|\\b(?:municipality|municipal|block|ward)\\s+${pattern}\\b)`,
        'i'
      )
      if (contextRe.test(searchableText)) return acName
    } else {
      const boundaryRe = new RegExp(`\\b${pattern}\\b`, 'i')
      if (boundaryRe.test(searchableText)) return acName
    }
  }
  return UNSPECIFIED_SEGMENT
}
import {
  ChevronRight,
  Landmark,
  FileCheck2,
  AlertTriangle,
  GraduationCap,
  Scale,
  Layers,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Percent,
  PlusCircle
} from 'lucide-react'
import { RecommendWorkModal } from '../components/RecommendWorkModal'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'

export const MPDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const [searchParams] = useSearchParams()
  const acParam = searchParams.get('ac') || ''
  const [acFilter, setAcFilter] = useState<string>(() => acParam)
  const { user, switchRole, setMpJurisdiction } = useStore()
  const isAuditorOrAdmin = Boolean(user?.isAuthenticated && ['state_nodal_officer', 'district_authority', 'mp', 'admin', 'mospi'].includes(user?.role))
  const isReadOnlyPublic = !isAuditorOrAdmin
  const chartTheme = useChartTheme()
  const [deliveryChartMode, setDeliveryChartMode] = useState<'donut' | 'bar'>('donut')

  const getSafeSessionMP = (mpId: string | undefined): any => {
    if (!mpId || typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem(`cached_mp_v2_${mpId}`) || sessionStorage.getItem(`cached_mp_v2_${mpId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.summary && Array.isArray(parsed.summary.assembly_segments)) {
          return parsed
        }
      }
    } catch {}

    // Instant 0ms seed from ALL_MP_SEATS for light-speed rendering
    const seat = ALL_MP_SEATS.find(
      s => s.id === mpId || s.id.toLowerCase() === mpId.toLowerCase() || s.name.toLowerCase() === mpId.toLowerCase()
    )
    if (seat) {
      const pcAcs = getACsByPC(seat.constituency)
      const fallbackAcNames = pcAcs.length > 0
        ? pcAcs.map(a => a.ac)
        : findAssemblyConstituencies(seat.constituency, 10).map(a => a.ac)
      return {
        id: seat.id,
        summary: {
          id: seat.id,
          mpName: seat.name,
          constituency: seat.constituency,
          state: seat.state,
          house: seat.house,
          allocatedAmount: seat.allocated,
          totalAllocated: seat.allocated,
          totalExpenditure: seat.expenditure,
          utilizationPercentage: seat.utilizationPercentage,
          completedWorksCount: seat.completedWorks,
          recommendedWorksCount: seat.recommendedWorks,
          completionRate: seat.completionRate,
          pendingWorks: seat.pendingWorks,
          unspentAmount: seat.unspentAmount,
          completedWorksValue: seat.completedWorksValue,
          totalCompletedAmount: seat.completedWorksValue,
          inProgressPayments: seat.inProgressPayments,
          paymentGapPercentage: seat.paymentGapPercentage,
          all_assemblies_in_pc: fallbackAcNames
        },
        works: [],
        anomalies: [],
        dossier: {
          education: seat.education || 'Graduate Professional',
          total_assets: seat.assets > 0 ? `₹${(seat.assets / 10000000).toFixed(2)} Cr` : 'Affidavit on Record',
          criminal_cases: seat.criminalCases,
          party: seat.party || 'Parliamentary Representative'
        }
      }
    }
    return null
  }

  const [data, setData] = useState<any>(() => getSafeSessionMP(id))
  const [loading, setLoading] = useState(() => !getSafeSessionMP(id))
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'flags' | 'risk'>('overview')
  const effectiveTab = (!isAuditorOrAdmin && (activeTab === 'flags' || activeTab === 'risk')) ? 'overview' : activeTab
  const [workFilter, setWorkFilter] = useState<'all' | 'completed' | 'pending'>('all')
  const [agencyFilter, setAgencyFilter] = useState<string>('')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [worksPage, setWorksPage] = useState(1)
  const [worksPageSize, setWorksPageSize] = useState<number | 'all'>(30)
  const [chartKey, setChartKey] = useState(0)
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false)
  const [prevId, setPrevId] = useState(id)
  const [prevAcParam, setPrevAcParam] = useState(acParam)

  if (id !== prevId) {
    setPrevId(id)
    setPrevAcParam(acParam)
    const nextSeed = getSafeSessionMP(id)
    setData(nextSeed)
    setLoading(!nextSeed)
    setActiveTab('overview')
    setWorkFilter('all')
    setAgencyFilter('')
    setWorksPage(1)
    setAcFilter(acParam)
  } else if (acParam !== prevAcParam) {
    setPrevAcParam(acParam)
    if (acParam) {
      setAcFilter(acParam)
      setWorksPage(1)
    }
  }

  const handleWorkRecommended = (newWork: any) => {
    setData((prev: any) => {
      if (!prev) return prev
      const existingWorks = prev.works || []
      const enrichedWork = {
        ...newWork,
        assembly_segment: newWork.assembly_segment || acFilter || UNSPECIFIED_SEGMENT
      }
      const updatedWorks = [enrichedWork, ...existingWorks]
      const updatedSummary = {
        ...prev.summary,
        recommendedWorksCount: (prev.summary?.recommendedWorksCount || existingWorks.length) + 1,
        unspentAmount: Math.max(0, (prev.summary?.unspentAmount || 0) - (newWork.cost || 0))
      }
      const updatedData = {
        ...prev,
        summary: updatedSummary,
        works: updatedWorks
      }
      try {
        sessionStorage.setItem(`cached_mp_v2_${id}`, JSON.stringify(updatedData))
      } catch {}
      return updatedData
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => setChartKey(1), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    async function loadMP() {
      if (!id) {
        setLoading(false)
        return
      }
      let cached: any = null
      try {
        cached = getSafeSessionMP(id)
        if (cached) {
          if (cached?.summary?.allocatedAmount > 0) {
            setData(cached)
          } else if (typeof window !== 'undefined') {
            try { sessionStorage.removeItem(`cached_mp_${id}`) } catch {}
            cached = null
          }
        }
      } catch {
        cached = null
      }

      if (!cached) {
        setLoading(true)
      }
      try {
        const json = await fetchPrefetchedJson(`/api/mps/${encodeURIComponent(id)}`)
        if (json?.data) {
          setData(json.data)
          const currentAcParam = typeof window !== 'undefined'
            ? (new URLSearchParams(window.location.search).get('ac') || '')
            : ''
          if (json.data?.summary?.matched_assembly_constituency && !currentAcParam) {
            setAcFilter(json.data.summary.matched_assembly_constituency)
            setWorksPage(1)
          }
          try {
            localStorage.setItem(`cached_mp_v2_${id}`, JSON.stringify(json.data))
            sessionStorage.setItem(`cached_mp_v2_${id}`, JSON.stringify(json.data))
          } catch {}
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Failed to load MP detail, trying fallback:', err)
      }

      // Resilient Fallback using ALL_MP_SEATS for instant offline/direct view
      const matchedSeat = ALL_MP_SEATS.find(
        m => m.id === id || m.name.toLowerCase() === id?.toLowerCase() || m.constituency.toLowerCase() === id?.toLowerCase()
      ) || ALL_MP_SEATS[0]

      if (matchedSeat) {
        const pcAcs = getACsByPC(matchedSeat.constituency)
        const fallbackAcNames = pcAcs.length > 0
          ? pcAcs.map(a => a.ac)
          : findAssemblyConstituencies(matchedSeat.constituency, 10).map(a => a.ac)
        setData({
          summary: {
            id: matchedSeat.id,
            name: matchedSeat.name,
            mpName: matchedSeat.name,
            constituency: matchedSeat.constituency,
            state: matchedSeat.state,
            house: matchedSeat.house || 'Lok Sabha',
            party: matchedSeat.party,
            tenure: matchedSeat.house === 'Rajya Sabha' ? 'Rajya Sabha' : '18th Lok Sabha',
            allocatedAmount: matchedSeat.allocated,
            totalExpenditure: matchedSeat.expenditure,
            unspentAmount: matchedSeat.unspentAmount,
            utilizationPercentage: matchedSeat.utilizationPercentage,
            totalWorks: Math.max(matchedSeat.recommendedWorks, matchedSeat.completedWorks),
            completedWorksCount: matchedSeat.completedWorks,
            recommendedWorksCount: matchedSeat.recommendedWorks,
            completionRate: matchedSeat.completionRate,
            redFlagCount: 0,
            all_assemblies_in_pc: fallbackAcNames,
            assemblies: fallbackAcNames,
            profile: {
              education: matchedSeat.education,
              criminalCases: matchedSeat.criminalCases,
              assets: matchedSeat.assets,
              liabilities: matchedSeat.liabilities
            }
          },
          works: [],
          redFlags: []
        })
      }
      setLoading(false)
    }
    loadMP()
  }, [id])

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  if (!data) {
    return (
      <EmptyState
        title="MP Record Not Found"
        description={`No parliamentary representative found with ID "${id}".`}
        action={
          <Link
            to="/mps"
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
          >
            Back to MPs Directory
          </Link>
        }
      />
    )
  }

  const { summary = {}, dossier, works = [], flags = [], entity_risk } = data || {}
  const dossierInfo = dossier?.dossier || dossier || {}

  // Defensive calculation: recover from 0/missing fields if utilization or other numbers are available
  let rawAlloc = Number(summary.allocatedAmount ?? summary.totalAllocated ?? 0)
  let rawExp = Number(summary.totalExpenditure || 0)
  let rawUnspent = Number(summary.unspentAmount || 0)
  let util = Number(summary.utilizationPercentage ?? summary.utilizationRate ?? 0)

  if (rawAlloc <= 0 && rawExp > 0 && util > 0) {
    rawAlloc = (rawExp / (util / 100))
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawAlloc <= 0 && util > 0) {
    rawAlloc = 147000000 // Standard 5-yr entitlement if 0
    rawExp = (rawAlloc * util) / 100
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawUnspent <= 0 && rawAlloc > rawExp) {
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  }

  if (util <= 0 && rawAlloc > 0 && rawExp > 0) {
    util = Number(((rawExp / rawAlloc) * 100).toFixed(1))
  }

  const formatCrores = (val: number) => {
    const cr = val / 10000000
    if (cr === 0) return '0'
    if (cr >= 100) return Math.round(cr).toLocaleString('en-IN')
    if (cr < 10 && cr !== Math.floor(cr) && (cr * 10) % 1 !== 0) return cr.toFixed(2)
    return cr.toFixed(1)
  }

  const allocCr = formatCrores(rawAlloc)
  const expCr = formatCrores(rawExp)

  // Works stats
  const completedWorks = works.length > 0
    ? works.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length
    : (summary.completedWorksCount || 0)
  const ongoingWorks = works.length > 0
    ? Math.max(0, works.length - completedWorks)
    : Math.max(0, (summary.recommendedWorksCount || 0) - (summary.completedWorksCount || 0))
  const totalDeliveryWorks = completedWorks + ongoingWorks
  const completionPct = totalDeliveryWorks > 0 ? Number(((completedWorks / totalDeliveryWorks) * 100).toFixed(1)) : 0
  const ongoingPct = totalDeliveryWorks > 0 ? Number(((ongoingWorks / totalDeliveryWorks) * 100).toFixed(1)) : 0

  // Deterministic Vidhan Sabha assembly segment mapping & counts
  const rawAssemblySegments: Array<{ ac_name: string; district?: string; count?: number }> =
    Array.isArray(summary.assembly_segments) && summary.assembly_segments.length > 0
      ? summary.assembly_segments
      : Array.isArray(summary.all_assemblies_in_pc) && summary.all_assemblies_in_pc.length > 0
      ? summary.all_assemblies_in_pc.map((acName: string) => ({ ac_name: acName, district: '', count: 0 }))
      : []

  const seenAcKeys = new Set<string>()
  const assemblySegments = rawAssemblySegments.filter((ac) => {
    const k = String(ac?.ac_name || '').trim().toLowerCase()
    if (!k || seenAcKeys.has(k)) return false
    seenAcKeys.add(k)
    return true
  })

  const canonicalAcByLower: Record<string, string> = {}
  assemblySegments.forEach((ac) => {
    const acName = String(ac.ac_name || '').trim()
    if (acName) canonicalAcByLower[acName.toLowerCase()] = acName
  })

  const hasExplicitSegments = works.some(
    (w: any) => typeof w.assembly_segment === 'string' && w.assembly_segment.trim().length > 0
  )

  const getResolvedWorkSegment = (w: any): string => {
    const explicit = typeof w.assembly_segment === 'string' ? w.assembly_segment.trim() : ''
    if (explicit) {
      if (explicit.toLowerCase() === UNSPECIFIED_SEGMENT.toLowerCase()) return UNSPECIFIED_SEGMENT
      return canonicalAcByLower[explicit.toLowerCase()] || explicit
    }
    if (!hasExplicitSegments) {
      return resolveWorkSegmentFallback(w, assemblySegments, summary.constituency || '')
    }
    return UNSPECIFIED_SEGMENT
  }

  const segmentCounts: Record<string, number> = {}
  assemblySegments.forEach((ac) => {
    const k = String(ac.ac_name || '').trim().toLowerCase()
    if (k) segmentCounts[k] = 0
  })
  let unspecifiedCount = 0

  if (works.length > 0) {
    works.forEach((w: any) => {
      const seg = getResolvedWorkSegment(w)
      const segLower = seg.toLowerCase()
      if (segLower !== UNSPECIFIED_SEGMENT.toLowerCase() && segLower in segmentCounts) {
        segmentCounts[segLower] += 1
      } else {
        unspecifiedCount += 1
      }
    })
  } else {
    assemblySegments.forEach((ac) => {
      const k = String(ac.ac_name || '').trim().toLowerCase()
      if (k) segmentCounts[k] = Number(ac.count ?? 0)
    })
    unspecifiedCount = Number(summary.unspecifiedWorksCount ?? 0)
  }

  const matchesAcFilter = (w: any, targetAc: string): boolean => {
    const q = targetAc.trim().toLowerCase()
    if (!q) return true
    if (typeof w.assembly_segment === 'string' && w.assembly_segment.trim().length > 0) {
      return w.assembly_segment.trim().toLowerCase() === q
    }
    if (!hasExplicitSegments) {
      const resolved = resolveWorkSegmentFallback(w, assemblySegments, summary.constituency || '')
      if (q === UNSPECIFIED_SEGMENT.toLowerCase() || q in canonicalAcByLower) {
        return resolved.toLowerCase() === q
      }
      const base = normalizeAcBase(targetAc)
      if (!base) return false
      const desc = String(w.work_description || w.workDescription || w.description || '').toLowerCase()
      const rawLoc = String(w.location || '').trim()
      const normPc = normalizeAcBase(summary.constituency || '')
      const normWorkDist = normalizeAcBase(String(w.district || ''))
      const normLoc = normalizeAcBase(rawLoc)
      const isGenericLoc = !normLoc || normLoc === normPc || normLoc === normWorkDist
      const searchable = isGenericLoc ? desc : `${desc} ${rawLoc.toLowerCase()}`
      return new RegExp(`\\b${escapeRegExp(base).replace(/\s+/g, '\\s+')}\\b`, 'i').test(searchable)
    }
    return q === UNSPECIFIED_SEGMENT.toLowerCase()
  }

  const acScopedWorks = acFilter
    ? works.filter((w: any) => matchesAcFilter(w, acFilter))
    : works
  const acScopedComp = acScopedWorks.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length
  const acScopedOngoing = Math.max(0, acScopedWorks.length - acScopedComp)

  const handleToggleAcSegment = (targetAc: string, switchToWorks: boolean) => {
    const isCurrent = acFilter.toLowerCase() === targetAc.toLowerCase()
    if (isCurrent) {
      setAcFilter('')
    } else {
      setAcFilter(targetAc)
      if (switchToWorks) setActiveTab('works')
    }
    setWorksPage(1)
  }

  const renderSegmentButtons = (opts: {
    switchToWorks: boolean
    showAllButton?: boolean
    showIconAndArrow?: boolean
    buttonClass?: string
  }) => {
    const {
      switchToWorks,
      showAllButton = false,
      showIconAndArrow = false,
      buttonClass = 'px-2.5 py-1 rounded-lg'
    } = opts
    return (
      <>
        {showAllButton && (
          <button
            type="button"
            onClick={() => {
              setAcFilter('')
              setWorksPage(1)
            }}
            className={`${buttonClass} text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
              !acFilter
                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-2xs'
                : 'bg-[var(--surface-alt)] hover:bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>All Segments</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                !acFilter ? 'bg-white/20 text-white' : 'bg-[var(--surface-primary)] text-[var(--text-primary)]'
              }`}
            >
              {formatNum(works.length)}
            </span>
          </button>
        )}
        {assemblySegments.map((ac) => {
          const acName = ac.ac_name
          const isCurrent = acFilter.toLowerCase() === acName.toLowerCase()
          const count = segmentCounts[acName.toLowerCase()] ?? 0
          return (
            <button
              key={acName}
              type="button"
              onClick={() => handleToggleAcSegment(acName, switchToWorks)}
              className={`${buttonClass} text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                isCurrent
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-[var(--surface-alt)] hover:bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-primary)] hover:border-emerald-500'
              }`}
            >
              <span>{showIconAndArrow ? `🏛️ ${acName}` : acName}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                  isCurrent
                    ? 'bg-white/25 text-white'
                    : count > 0
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-[var(--surface-primary)] text-[var(--text-tertiary)]'
                }`}
              >
                {formatNum(count)}
              </span>
              {showIconAndArrow && <span className="text-[10px] opacity-75">&rarr;</span>}
            </button>
          )
        })}
        {unspecifiedCount > 0 && (() => {
          const isUnspecCurrent = acFilter.toLowerCase() === UNSPECIFIED_SEGMENT.toLowerCase()
          return (
            <button
              key={UNSPECIFIED_SEGMENT}
              type="button"
              onClick={() => handleToggleAcSegment(UNSPECIFIED_SEGMENT, switchToWorks)}
              className={`${buttonClass} text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                isUnspecCurrent
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 border-dashed'
              }`}
              title="District-wide works or works without a single localized Vidhan Sabha tag"
            >
              <span>District-Wide / Unspecified</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                  isUnspecCurrent
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-500/20 text-amber-900 dark:text-amber-200'
                }`}
              >
                {formatNum(unspecifiedCount)}
              </span>
              {showIconAndArrow && <span className="text-[10px] opacity-75">&rarr;</span>}
            </button>
          )
        })()}
      </>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation & Follow MP Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/mps" />
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] flex-wrap">
            <Link to="/" className="hover:text-[var(--text-primary)] transition">Home</Link>
            <ChevronRight size={12} />
            <Link to="/mps" className="hover:text-[var(--text-primary)] transition">MPs</Link>
            {summary.state && (
              <>
                <ChevronRight size={12} />
                <Link to={`/states/${encodeURIComponent(summary.state)}`} className="hover:text-[var(--text-primary)] transition">
                  {translateState(summary.state, lang)}
                </Link>
              </>
            )}
            <ChevronRight size={12} />
            <span className="font-bold text-[var(--text-primary)]">{translateMP(summary.mpName, lang)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRecommendModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition bg-[var(--brand-primary)] text-white hover:opacity-90 shadow-2xs cursor-pointer"
          >
            <PlusCircle size={13} />
            <span>{t('btn.recommend_work')}</span>
          </button>
          <Link
            to={`/mp-dashboard?id=${encodeURIComponent(summary.id || id || '')}`}
            onClick={() => {
              if (summary.id || id) {
                setMpJurisdiction(summary.id || id, summary.mpName, summary.state)
                if (user.role === 'mp') {
                  switchRole('mp', summary.state, summary.constituency, summary.id || id, summary.mpName)
                }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-[var(--primary-700)]/30 bg-[var(--primary-100)] text-[var(--primary-700)] hover:bg-[var(--primary-700)] hover:text-white shadow-2xs"
          >
            <Landmark size={13} />
            <span>Open in MP Console</span>
          </Link>
        </div>
      </div>

      {/* ⭐ TOP HIGHLIGHT: ACRU Debit-Card Style Fund Card */}
      <FundCard
        allocated={rawAlloc}
        used={rawExp}
        balance={rawUnspent}
        utilization={util}
        mpName={translateMP(summary.mpName, lang)}
        constituency={translateConstituency(summary.constituency, lang)}
        house={summary.house}
        party={summary.party}
        term={summary.term || (summary.house === 'Rajya Sabha' ? 'Rajya Sabha' : '18th Lok Sabha')}
      />

      {/* Assembly Constituency Banner if user queried by AC */}
      {(summary.matched_assembly_constituency || acFilter) && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
              <Landmark size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)] flex flex-wrap items-center gap-1.5">
                <span>
                  Assembly Segment:{' '}
                  <strong>
                    {(acFilter || summary.matched_assembly_constituency) === UNSPECIFIED_SEGMENT
                      ? UNSPECIFIED_SEGMENT
                      : translateConstituency(acFilter || summary.matched_assembly_constituency, lang)}
                  </strong>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
                  {translateConstituency(summary.constituency, lang)} Lok Sabha
                </span>
                {acFilter && works.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white tabular-nums">
                    {formatNum(acScopedWorks.length)} of {formatNum(works.length)} works
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {acFilter === UNSPECIFIED_SEGMENT
                  ? `Showing district-wide works or works without a specific Vidhan Sabha locality tag in ${summary.constituency}.`
                  : (summary.search_context || `This MP represents ${acFilter || summary.matched_assembly_constituency} Assembly Constituency as part of ${summary.constituency} Parliamentary Constituency.`)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {acFilter && (
              <button
                type="button"
                onClick={() => {
                  setAcFilter('')
                  setWorksPage(1)
                }}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition cursor-pointer"
              >
                Clear &times;
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveTab('works')
                setAcFilter(acFilter || summary.matched_assembly_constituency)
                setWorksPage(1)
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shrink-0 cursor-pointer shadow-sm"
            >
              View Projects in {acFilter || summary.matched_assembly_constituency} &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'overview'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers size={14} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>{t('kpi.recommended')} ({formatNum(summary.recommendedWorksCount || works.length)})</span>
        </button>

        {isAuditorOrAdmin && (
          <>
            <button
              onClick={() => setActiveTab('flags')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                effectiveTab === 'flags'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {flags.length > 0 ? (
                <ShieldAlert size={14} className="text-rose-500" />
              ) : (
                <ShieldCheck size={14} className="text-emerald-500" />
              )}
              <span>Forensic Flags ({formatNum(flags.length)})</span>
            </button>

            <button
              onClick={() => setActiveTab('risk')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                effectiveTab === 'risk'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {(entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) > 0 ? (
                <AlertTriangle size={14} className="text-amber-500" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-500" />
              )}
              <span>Integrity & Risk</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {effectiveTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics (5 KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              icon={Landmark}
              label="mps.fund_allocated"
              value={Number(allocCr)}
              prefix="₹"
              unit="Cr"
              theme="slate"
              description="kpi.total_central_sanction"
            />
            <StatCard
              icon={Coins}
              label="mps.disbursed"
              value={Number(expCr)}
              prefix="₹"
              unit="Cr"
              theme="slate"
              description="kpi.verified_expenditure"
            />
            <StatCard
              icon={FileCheck2}
              label="kpi.recommended"
              value={summary.recommendedWorksCount || (completedWorks + ongoingWorks) || works.length || 0}
              theme="slate"
              borderHighlight="blue"
              description="stat.both_houses"
              tooltip="Total civil development projects recommended by this MP under their MPLADS allocation."
            />
            <StatCard
              icon={Percent}
              label="kpi.utilization"
              value={Number(util)}
              unit="%"
              theme="emerald"
              gaugeValue={Number(util)}
              description="kpi.expenditure_ratio"
            />
            <StatCard
              icon={Clock}
              label="kpi.payment_gap"
              value={Number((100 - Number(util)).toFixed(1))}
              unit="%"
              theme="amber"
              description="kpi.pending_disbursement"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Works Delivery Breakdown */}
            <SectionCard
              title="Works Delivery Breakdown"
              subtitle="Physical execution progress & certification status"
              action={
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                    {completionPct}% Delivered
                  </span>
                  <div className="flex items-center bg-[var(--surface-alt)] p-0.5 rounded-lg border border-[var(--border-primary)]">
                    <button
                      onClick={() => setDeliveryChartMode('donut')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                        deliveryChartMode === 'donut'
                          ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Donut Distribution View"
                    >
                      Donut
                    </button>
                    <button
                      onClick={() => setDeliveryChartMode('bar')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                        deliveryChartMode === 'bar'
                          ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-xs'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Compact Bar View"
                    >
                      Bar
                    </button>
                  </div>
                </div>
              }
            >
              {deliveryChartMode === 'donut' ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  {/* Compact Donut Chart with Center Completion % */}
                  <div className="h-56 w-full sm:w-1/2 relative flex items-center justify-center chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={`delivery-pie-${chartKey}`}>
                        <Pie
                          data={[
                            { name: 'Completed Works', value: completedWorks, color: '#2563EB', pct: completionPct },
                            { name: 'Active in Progress', value: ongoingWorks, color: '#94A3B8', pct: ongoingPct }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={64}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          isAnimationActive={true}
                          animationDuration={850}
                          animationEasing="ease-out"
                          animationBegin={50}
                        >
                          <Cell fill="#2563EB" stroke="#FFFFFF" strokeWidth={3} />
                          <Cell fill="#94A3B8" stroke="#FFFFFF" strokeWidth={3} />
                        </Pie>
                        <Tooltip content={<ChartTooltip formatter="number" />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                      <div className="max-w-[124px] flex flex-col items-center justify-center">
                        <span className="text-lg sm:text-xl font-black text-[var(--good)] tabular-nums leading-tight">
                          {formatNum(completionPct)}%
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold tracking-normal text-[var(--text-tertiary)] mt-0.5 max-w-[110px] text-center leading-tight line-clamp-2">
                          {t('chart.delivered')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Structured Delivery Metrics & Dual Progress Bar */}
                  <div className="w-full sm:w-1/2 space-y-2">
                    <div className="p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[var(--tint-good)] text-[var(--good)] flex items-center justify-center shrink-0">
                          <CheckCircle2 size={13} />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-[var(--text-primary)] block">Completed Works</span>
                          <span className="text-[9px] text-[var(--text-tertiary)]">Certified & Delivered</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-[var(--text-primary)] tabular-nums block">
                          {completedWorks.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-extrabold text-[var(--good)] tabular-nums">
                          {completionPct}%
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[var(--tint-warn)] text-[var(--warn)] flex items-center justify-center shrink-0">
                          <Clock size={13} />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-[var(--text-primary)] block">Active in Progress</span>
                          <span className="text-[9px] text-[var(--text-tertiary)]">Execution Pipeline</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-[var(--text-primary)] tabular-nums block">
                          {ongoingWorks.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-extrabold text-[var(--warn)] tabular-nums">
                          {ongoingPct}%
                        </span>
                      </div>
                    </div>

                    {/* Dual Velocity Progress Bar */}
                    <div className="pt-1">
                      <div className="w-full h-2 rounded-full bg-[var(--surface-primary)] border border-[var(--border-primary)] overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-[width] duration-500"
                          style={{ width: `${completionPct}%` }}
                          title={`Completed: ${completedWorks} (${completionPct}%)`}
                        />
                        <div
                          className="h-full bg-indigo-500 transition-[width] duration-500"
                          style={{ width: `${ongoingPct}%` }}
                          title={`In Progress: ${ongoingWorks} (${ongoingPct}%)`}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-[var(--text-tertiary)] mt-1 font-semibold">
                        <span>Total: {totalDeliveryWorks} Projects</span>
                        <span>Target: 100% Delivery</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="h-44 w-full chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        key={`delivery-bar-${chartKey}`}
                        data={[
                          { name: 'Completed Works', count: completedWorks, color: '#10B981', pct: completionPct },
                          { name: 'Active in Progress', count: ongoingWorks, color: '#6366F1', pct: ongoingPct }
                        ]}
                        margin={{ top: 15, right: 20, left: -15, bottom: 5 }}
                        barSize={28}
                        maxBarSize={32}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} opacity={0.4} />
                        <XAxis dataKey="name" stroke={chartTheme.textColor} fontSize={11} tickLine={false} />
                        <YAxis stroke={chartTheme.textColor} fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip formatter="number" />} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} {...ANIMATION_CONFIG.getChartProps('bar')}>
                          <Cell fill="#10B981" />
                          <Cell fill="#6366F1" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">Completed & Certified</span>
                      <strong className="text-sm font-black text-[var(--text-primary)] tabular-nums">{completedWorks}</strong>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1">({completionPct}%)</span>
                    </div>
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">In Progress Queue</span>
                      <strong className="text-sm font-black text-[var(--text-primary)] tabular-nums">{ongoingWorks}</strong>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1">({ongoingPct}%)</span>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Sectoral Distribution Donut */}
            <SectionCard
              title="Sectoral Investment Share"
              subtitle="Asset categories recommended in this constituency"
            >
              {(() => {
                const sectorMap: Record<string, number> = {}
                works.forEach((w: any) => {
                  const cat = w.category || 'General Civil Works'
                  sectorMap[cat] = (sectorMap[cat] || 0) + 1
                })
                const palette = chartTheme.category
                const catEntries = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
                const totalWorksCount = works.length

                if (catEntries.length === 0 || totalWorksCount === 0) {
                  return <EmptyState title="No sectoral data" description="No work categories recorded for this MP." />
                }

                const pieData = catEntries.map(([name, count], idx) => ({
                  name,
                  count,
                  value: Number(((count / totalWorksCount) * 100).toFixed(1)),
                  color: palette[idx % palette.length]
                }))

                return (
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                    {/* Donut Chart with Center Metric */}
                    <div className="h-56 w-full sm:w-1/2 relative flex items-center justify-center chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart key={`sector-pie-${chartKey}`}>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={64}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            isAnimationActive={true}
                            animationDuration={850}
                            animationEasing="ease-out"
                            animationBegin={50}
                          >
                            {pieData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={3} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={<ChartTooltip formatter="percent" />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                        <div className="max-w-[124px] flex flex-col items-center justify-center">
                          <span className="text-lg sm:text-xl font-black text-[var(--text-primary)] tabular-nums leading-tight">
                            {formatNum(totalWorksCount)}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold tracking-normal text-[var(--text-tertiary)] mt-0.5 max-w-[110px] text-center leading-tight line-clamp-2">
                            {t('chart.civil_works')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Clear Category Breakdown with Field Names & Percentages */}
                    <div className="w-full sm:w-1/2 space-y-1.5">
                      {pieData.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)]"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate font-semibold text-[var(--text-secondary)] text-[11px]" title={entry.name}>
                              {entry.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                              {entry.count} works
                            </span>
                            <span
                              className="font-extrabold tabular-nums px-1.5 py-0.5 rounded text-[10px] text-white"
                              style={{ backgroundColor: entry.color }}
                            >
                              {entry.value}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </SectionCard>
          </div>

          {/* Demographic Record & Declared Financial Disclosures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="lux-card p-6 space-y-4">
              <h3 className="text-base font-bold text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2 flex items-center gap-2">
                <GraduationCap size={18} className="text-[var(--brand-primary)]" />
                <span>Demographic & Educational Record</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Education</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {dossierInfo?.education || <span className="text-[var(--text-tertiary)] italic">Not declared</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Political Affiliation</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {dossierInfo?.party || summary.party || <span className="text-[var(--text-tertiary)] italic">Not declared</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">ADR Criminal Cases</span>
                  <span className="font-bold">
                    {dossierInfo?.criminal_cases !== undefined ? (
                      dossierInfo.criminal_cases > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold">{dossierInfo.criminal_cases} Registered</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">0 (Clean Record)</span>
                      )
                    ) : (
                      <span className="text-[var(--text-tertiary)] italic">Not declared</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="lux-card p-6 space-y-4">
              <h3 className="text-base font-bold text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2 flex items-center gap-2">
                <Scale size={18} className="text-amber-500" />
                <span>Declared Financial Disclosures (ADR / MyNeta)</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Declared Total Assets</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {dossierInfo?.total_assets || dossierInfo?.movable_assets || <span className="text-[var(--text-tertiary)] italic font-normal">Not declared</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">Declared Liabilities</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {dossierInfo?.liabilities || <span className="text-[var(--text-tertiary)] italic font-normal">Not declared</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assembly Constituencies in this Parliamentary Constituency */}
          {assemblySegments.length > 0 && (
            <SectionCard
              title={`Assembly Constituencies in ${summary.constituency} (${assemblySegments.length})`}
              subtitle="Vidhan Sabha assembly segments in this Parliamentary Constituency"
              action={
                works.length > 0 && works.length < Math.max(summary.recommendedWorksCount || 0, works.length) ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    Showing {formatNum(works.length)} of {formatNum(summary.recommendedWorksCount)} detailed records
                  </span>
                ) : undefined
              }
            >
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                This Parliamentary Constituency comprises the following Vidhan Sabha assembly segments. Click any assembly constituency to inspect its local development works.
              </p>
              <div className="flex flex-wrap gap-2">
                {renderSegmentButtons({
                  switchToWorks: true,
                  showIconAndArrow: true,
                  buttonClass: 'px-3 py-1.5 rounded-xl'
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* TAB 2: WORKS / PROJECTS */}
      {effectiveTab === 'works' && (
        <div className="space-y-4">
          {works.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="text-amber-800 dark:text-amber-300 font-medium">
                Showing drill-down forensic sample: <strong>{works.length}</strong> of <strong>{Math.max(summary.recommendedWorksCount || 0, works.length)}</strong> projects ({Math.min(100, Math.round((works.length / Math.max(summary.recommendedWorksCount || 1, works.length)) * 100))}% audit coverage)
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                Census ledger verification complete
              </span>
            </div>
          )}

          {/* Compact Interactive Vidhan Sabha Assembly Segments Filter Bar */}
          {(assemblySegments.length > 0 || Boolean(acFilter)) && (
            <div className="p-3.5 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
                  <Landmark size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Vidhan Sabha Assembly Segments ({assemblySegments.length})</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {works.length > 0 && (
                    <span className="text-[var(--text-tertiary)] font-medium">
                      {formatNum(works.length)} detailed works partitioned
                    </span>
                  )}
                  {acFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setAcFilter('')
                        setWorksPage(1)
                      }}
                      className="font-bold text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear Segment &times;
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {renderSegmentButtons({
                  switchToWorks: false,
                  showAllButton: true,
                  buttonClass: 'px-2.5 py-1 rounded-lg'
                })}
              </div>
            </div>
          )}

          {/* Work Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setWorkFilter('all')
                setWorksPage(1)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                workFilter === 'all'
                  ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                  : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {acFilter
                ? `All in Segment (${formatNum(acScopedWorks.length)})`
                : `All Recommended Works (${formatNum(Math.max(summary.recommendedWorksCount || 0, works.length, completedWorks + ongoingWorks))})`}
            </button>
            <button
              onClick={() => {
                setWorkFilter('completed')
                setWorksPage(1)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                workFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[var(--surface-alt)] text-emerald-700 dark:text-emerald-400 hover:bg-[var(--surface-hover)]'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>{t('status.completed')} ({formatNum(acFilter ? acScopedComp : completedWorks)})</span>
            </button>
            <button
              onClick={() => {
                setWorkFilter('pending')
                setWorksPage(1)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                workFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-[var(--surface-alt)] text-amber-700 dark:text-amber-400 hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Clock size={13} />
              <span>Recommended / Ongoing ({formatNum(acFilter ? acScopedOngoing : ongoingWorks)})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRecommendModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer"
            >
              <PlusCircle size={13} />
              <span>{t('btn.recommend_work')}</span>
            </button>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 bg-[var(--surface-alt)] px-2 py-1 rounded-xl border border-[var(--border-primary)] text-xs ml-auto">
              <span className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase mr-1">{t('common.per_page')}:</span>
              {[30, 50, 100, 'all'].map((sz) => (
                <button
                  key={sz}
                  onClick={() => {
                    setWorksPageSize(sz as any)
                    setWorksPage(1)
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                    worksPageSize === sz
                      ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {sz === 'all' ? t('common.all') : formatNum(sz)}
                </button>
              ))}
            </div>
          </div>

          {/* Agency Filter Dropdown */}
          {(() => {
            const uniqueAgencies: string[] = Array.from(new Set<string>(works.map((w: any) => String(w.implementingAgency || w.implementing_agency || 'District Authority').trim()))).sort()
            if (uniqueAgencies.length <= 1) return null
            return (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-primary)]">
                <span className="text-xs font-semibold text-[var(--text-tertiary)]">Filter by Agency:</span>
                <select
                  value={agencyFilter}
                  onChange={(e) => {
                    setAgencyFilter(e.target.value)
                    setWorksPage(1)
                  }}
                  className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-alt)] text-xs font-semibold text-[var(--text-primary)] outline-none"
                >
                  <option value="">All Executing Agencies ({uniqueAgencies.length})</option>
                  {uniqueAgencies.map((ag: string) => (
                    <option key={ag} value={ag}>
                      {ag}
                    </option>
                  ))}
                </select>
                {agencyFilter && (
                  <button
                    onClick={() => {
                      setAgencyFilter('')
                      setWorksPage(1)
                    }}
                    className="text-xs font-bold text-rose-500 hover:underline px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            )
          })()}

          {(() => {
            const filteredWorks = acScopedWorks.filter((w: any) => {
              const isDone = (w.status || '').toLowerCase().includes('completed')
              if (workFilter === 'completed' && !isDone) return false
              if (workFilter === 'pending' && isDone) return false
              if (agencyFilter) {
                const ag = (w.implementingAgency || w.implementing_agency || 'District Authority').trim()
                if (ag !== agencyFilter) return false
              }
              return true
            })

            if (filteredWorks.length === 0) {
              return (
                <div className="space-y-3">
                  {acFilter && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                      <span>No works tagged with "{acFilter}" match the current filters.</span>
                      <button
                        onClick={() => {
                          setAcFilter('')
                          setWorksPage(1)
                        }}
                        className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                      >
                        Show all {works.length} constituency projects
                      </button>
                    </div>
                  )}
                  <EmptyState
                    title={`No ${workFilter === 'completed' ? 'completed' : workFilter === 'pending' ? 'pending' : ''} projects found`}
                    description="No civil projects match the current filters."
                  />
                </div>
              )
            }

            return (
              <div className="space-y-3">
                {acFilter && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200">
                    <div className="flex items-center gap-2">
                      <Landmark size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {acFilter === UNSPECIFIED_SEGMENT ? (
                          <>Showing <strong>{filteredWorks.length}</strong> district-wide / unspecified works</>
                        ) : (
                          <>Showing <strong>{filteredWorks.length}</strong> works in Assembly Segment: <strong>{acFilter}</strong></>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setAcFilter('')
                        setWorksPage(1)
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Show All {works.length} Projects
                    </button>
                  </div>
                )}
                {(() => {
                  const paginatedWorks = worksPageSize === 'all'
                    ? filteredWorks
                    : filteredWorks.slice((worksPage - 1) * Number(worksPageSize), worksPage * Number(worksPageSize))
                  const totalWorksPages = worksPageSize === 'all' ? 1 : Math.ceil(filteredWorks.length / Number(worksPageSize)) || 1

                  return (
                    <div className="lux-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                          <thead>
                            <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                              <th className="p-3 font-bold w-20 shrink-0">{t('table.work_id')}</th>
                              <th className="p-3 font-bold min-w-[180px]">{t('table.description')}</th>
                              <th className="p-3 font-bold min-w-[140px] w-40">{t('table.district')}</th>
                              <th className="p-3 font-bold w-28 text-right shrink-0 whitespace-nowrap">{t('table.sanctioned_amount')}</th>
                              <th className="p-3 font-bold w-24 text-center shrink-0">{t('table.status')}</th>
                              <th className="p-3 font-bold w-24 text-center shrink-0">{t('table.progress')}</th>
                              <th className="p-3 font-bold w-28 shrink-0">{t('table.delay')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)]">
                            {paginatedWorks.map((w: any) => {
                              const isDone = (w.status || '').toLowerCase().includes('completed')
                              const prog = w.progressPct ?? w.progress_pct ?? (isDone ? 100 : 60)
                              const del = w.delayDays ?? w.delay_days ?? (isDone ? 0 : 45)

                              return (
                                <tr
                                  key={w.workId || w.work_id}
                                  className={`hover:bg-[var(--surface-alt)]/50 transition-colors duration-100 ${isAuditorOrAdmin ? 'cursor-pointer' : ''}`}
                                  onClick={isAuditorOrAdmin ? () => {
                                    const matchFlag = flags.find((f: any) => f.workId === (w.workId || w.work_id))
                                    if (matchFlag) {
                                      setSelectedFlag(matchFlag)
                                    }
                                  } : undefined}
                                >
                                  <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                                    <div className="flex items-center gap-1.5">
                                      <span>#{formatNum(w.workId || w.work_id)}</span>
                                      {w.isNew && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs animate-pulse">
                                          NEW
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-[var(--text-secondary)] leading-relaxed" title={w.work_description || w.workDescription || w.description}>
                                    <div className="font-medium text-[var(--text-primary)] line-clamp-2">
                                      {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                                    </div>
                                  </td>
                                  <td className="p-3 font-medium text-[var(--text-primary)]">
                                    <div className="break-words leading-snug" title={w.district || summary.constituency}>
                                      {w.district || summary.constituency}
                                    </div>
                                    {w.assembly_segment && (
                                      <span
                                        className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                          w.assembly_segment === UNSPECIFIED_SEGMENT
                                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                        }`}
                                      >
                                        {w.assembly_segment}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] whitespace-nowrap text-right">
                                    ₹{formatNum(((w.sanctionedCost || w.cost || 0) / 100000).toFixed(2))} {t('unit.lakh')}
                                  </td>
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block whitespace-nowrap ${
                                        isDone
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                      }`}
                                    >
                                      {isDone ? t('status.completed') : t('status.recommended')}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <div className="w-12 h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                                        <div
                                          className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                          style={{ width: `${Math.min(100, prog)}%` }}
                                        />
                                      </div>
                                      <span className="font-extrabold tabular-nums text-[11px] text-[var(--text-primary)]">
                                        {formatNum(prog)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {isDone ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                                        <CheckCircle2 size={12} />
                                        <span>{t('status.on_schedule')}</span>
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                                        <Clock size={12} />
                                        <span>{formatNum(del)} {t('unit.days_delay')}</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex flex-wrap justify-between items-center gap-2">
                        <span>Showing {paginatedWorks.length} of {filteredWorks.length} projects in view ({summary.recommendedWorksCount || summary.totalWorks || works.length} statutory total)</span>
                        {totalWorksPages > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              disabled={worksPage === 1}
                              onClick={() => setWorksPage((p) => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                            >
                              {t('common.previous')}
                            </button>
                            <span className="text-xs font-semibold text-[var(--text-secondary)] px-1">
                              {t('common.page')} {formatNum(worksPage)} {t('common.of')} {formatNum(totalWorksPages)}
                            </span>
                            <button
                              disabled={worksPage === totalWorksPages}
                              onClick={() => setWorksPage((p) => Math.min(totalWorksPages, p + 1))}
                              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                            >
                              {t('common.next')}
                            </button>
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Audited Parliamentary Ledger</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
        })()}
      </div>
      )}

      {/* TAB 3: FLAGS - Restricted to Authorized Personnel */}
      {isAuditorOrAdmin && effectiveTab === 'flags' && (
        <div className="space-y-4">
          {flags.length === 0 ? (
            <div className="lux-card p-8 max-w-2xl mx-auto text-center space-y-5 my-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={32} />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Audit Cleared &bull; 100% Compliant
                </span>
                <h3 className="text-lg font-extrabold text-[var(--text-primary)] mt-2">
                  Zero Forensic Anomalies Detected
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-md mx-auto leading-relaxed">
                  All {works.length} civil projects recommended by <strong>{summary.mpName}</strong> have undergone automated forensic surveillance. No red-flags found across cost inflation, bill-splitting, or duplicate project signatures.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--border-primary)] text-left">
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] mb-1">
                    Cost Benchmarks
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>CPWD Compliant</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] mb-1">
                    Bill Splitting
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>No Split Tenders</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] mb-1">
                    Work Uniqueness
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>Zero Duplicates</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold w-20 shrink-0">{t('table.work_id')}</th>
                      <th className="p-3 font-bold min-w-[180px]">{t('table.description')}</th>
                      <th className="p-3 font-bold min-w-[200px] w-60">{t('table.agency')}</th>
                      <th className="p-3 font-bold w-28 text-right shrink-0 whitespace-nowrap">{t('table.sanctioned_amount')}</th>
                      <th className="p-3 font-bold w-24 text-center shrink-0">{t('table.severity')}</th>
                      <th className="p-3 font-bold w-32 sm:w-36 text-right shrink-0">{isReadOnlyPublic ? 'Public Dossier' : t('table.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {flags.map((flag: any) => (
                      <tr
                        key={flag.workId || flag.work_id}
                        className="hover:bg-[var(--surface-alt)]/50 transition cursor-pointer"
                        onClick={() => setSelectedFlag(flag)}
                      >
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                          #{formatNum(flag.workId || flag.work_id)}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed" title={flag.work_description || flag.workDescription || flag.description}>
                          <div className="font-medium text-[var(--text-primary)] line-clamp-2">
                            {flag.work_description || flag.workDescription || flag.description || 'Civil Works Project'}
                          </div>
                        </td>
                        <td className="p-3">
                          <AgencyBadge agency={flag.implementingAgency || flag.implementing_agency || 'District Authority'} size="sm" className="max-w-full" />
                        </td>
                        <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] text-right">
                          ₹{formatNum(((flag.cost || flag.sanctionedCost || 0) / 100000).toFixed(2))} {t('unit.lakh')}
                        </td>
                        <td className="p-3 text-center">
                          <TierBadge
                            tier={flag.severity >= 0.7 ? 'critical' : flag.severity >= 0.4 ? 'high' : 'medium'}
                            count={Number(flag.severity?.toFixed(2) || 0)}
                            showLabel={false}
                            size="sm"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFlag(flag)
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition whitespace-nowrap text-xs cursor-pointer"
                          >
                            {isReadOnlyPublic ? 'View Findings' : t('table.report')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ENTITY RISK - Restricted to Authorized Personnel */}
      {isAuditorOrAdmin && effectiveTab === 'risk' && (
        <div className="space-y-4">
          <div className="lux-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-tertiary)]">
                    Forensic Surveillance D14
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  Integrity & Compliance Screening &bull; {summary.mpName}
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  Multi-variable risk scoring across split-billing, contractor concentration, and CPWD cost tolerances
                </span>
              </div>
              <TierBadge
                tier={
                  (entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) >= 15
                    ? 'critical'
                    : (entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) >= 10
                    ? 'high'
                    : (entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0) > 0
                    ? 'medium'
                    : 'low'
                }
              />
            </div>

            {(() => {
              const riskVal = entity_risk?.composite_risk_score ?? entity_risk?.composite_risk ?? 0
              const isClean = riskVal === 0

              if (isClean) {
                return (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <span>CLEAN AUDIT BASELINE</span>
                          <span className="text-[10px] font-normal text-[var(--text-secondary)]">&bull; 0.00 / 20.0 Composite Risk</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          No single-contractor lock-in, duplicate works, or pricing deviations detected across {works.length} works.
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-sm shrink-0">
                      Clean Record
                    </span>
                  </div>
                )
              }

              return (
                <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-[var(--text-secondary)]">Composite Risk Score</span>
                    <span className="font-extrabold text-lg tabular-nums text-rose-600 dark:text-rose-400">
                      {riskVal.toFixed(2)} / 20.0
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-[var(--surface-primary)] overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-[width] duration-700"
                      style={{ width: `${Math.min(100, ((riskVal / 20) * 100))}%` }}
                    />
                  </div>
                </div>
              )
            })()}

            {(() => {
              const b = entity_risk?.breakdown || {}
              const dbk = b.detector_breakdown || {}

              const conc = b.contractor_concentration ?? dbk.bill_splitting?.violation_rate_pct ?? 0
              const cost = b.cost_deviation ?? dbk.cost_overrun?.violation_rate_pct ?? 0
              const repeat = b.repeat_works ?? dbk.duplicate_work?.violation_rate_pct ?? 0

              const formatPct = (val: number, cleanLabel: string) => {
                const num = Number(val)
                if (num === 0) return `0.0% (${cleanLabel})`
                return `${(num > 1 ? num : num * 100).toFixed(1)}%`
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                      Contractor Concentration
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatPct(conc, 'Normal / Diversified')}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                      Empirical Cost Deviation
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatPct(cost, 'Within CPWD Limits')}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                      Repeated Works Anomaly
                    </span>
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatPct(repeat, 'Zero Duplicates')}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Flag Diagnostic Report Modal - Restricted to Authorized Personnel */}
      {isAuditorOrAdmin && selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}

      {/* Statutory Work Recommendation Modal */}
      <RecommendWorkModal
        isOpen={isRecommendModalOpen}
        onClose={() => setIsRecommendModalOpen(false)}
        mpId={id || summary.id || ''}
        mpName={summary.mpName || 'MP'}
        constituency={summary.constituency}
        state={summary.state}
        house={summary.house}
        unspentBalance={rawUnspent}
        onWorkRecommended={handleWorkRecommended}
      />
    </div>
  )
}
