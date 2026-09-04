import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { MapContainer, GeoJSON, Tooltip, useMap } from 'react-leaflet'
import { Globe2, Layers, MapPin, ExternalLink, Info, ArrowRight, RotateCcw } from 'lucide-react'
import { palette } from '../lib/palette'
import { t } from '../lib/i18n'

const INDIA_CENTER: [number, number] = [22.5937, 79.5]
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68.0],
  [37.5, 97.5]
]

function ResetViewControl() {
  const map = useMap()
  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: '70px', marginLeft: '10px' }}>
      <div className="leaflet-control leaflet-bar shadow-md border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <button
          onClick={() => map.setView(INDIA_CENTER, 5)}
          title="Reset to Full Sovereign India View"
          className="w-8 h-8 flex items-center justify-center bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-alt)] font-bold text-xs transition cursor-pointer"
        >
          🇮🇳
        </button>
      </div>
    </div>
  )
}

export const GISMap: React.FC = () => {
  const [geoData, setGeoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [layerType, setLayerType] = useState<'pcs' | 'districts'>('pcs')
  const [metric, setMetric] = useState<'utilization' | 'works'>('utilization')
  const [selectedFeature, setSelectedFeature] = useState<any>(null)

  useEffect(() => {
    async function loadGeoJson() {
      setLoading(true)
      try {
        const primaryUrl = layerType === 'pcs' ? '/api/map/pcs' : '/api/map/districts'
        const fallbackUrl = layerType === 'pcs' ? '/data/pcs_enriched.geojson' : '/data/districts_enriched.geojson'
        
        let parsed: any = null
        try {
          const res = await fetch(primaryUrl)
          if (res.ok) {
            const text = await res.text()
            if (text.trim().startsWith('{')) {
              parsed = JSON.parse(text)
            }
          }
        } catch {
          // Fallback to static asset
        }

        if (!parsed) {
          const resFallback = await fetch(fallbackUrl)
          if (resFallback.ok) {
            const textFallback = await resFallback.text()
            if (textFallback.trim().startsWith('{')) {
              parsed = JSON.parse(textFallback)
            }
          }
        }

        if (parsed) {
          if (parsed.data && parsed.data.type === 'FeatureCollection') {
            setGeoData(parsed.data)
          } else {
            setGeoData(parsed)
          }
        }
      } catch (err) {
        console.error('Failed to load GeoJSON:', err)
      } finally {
        setLoading(false)
      }
    }
    loadGeoJson()
  }, [layerType])

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  const ramp = isDark ? palette.sequential.dark : palette.sequential.light

  const getColor = (val: number, isPct: boolean) => {
    if (isPct) {
      if (val >= 80) return ramp[4]
      if (val >= 60) return ramp[3]
      if (val >= 40) return ramp[2]
      if (val >= 20) return ramp[1]
      return ramp[0]
    } else {
      if (val >= 150) return ramp[4]
      if (val >= 100) return ramp[3]
      if (val >= 50) return ramp[2]
      if (val >= 20) return ramp[1]
      return ramp[0]
    }
  }

  const styleFeature = (feature: any) => {
    const props = feature.properties || {}
    let val = 0
    let isPct = true

    if (layerType === 'pcs') {
      if (metric === 'utilization') {
        val = parseFloat(props.utilization_pct || props.utilizationPercentage || 0)
        isPct = true
      } else {
        val = parseInt(props.completed_works || props.completedWorksCount || 0, 10)
        isPct = false
      }
    } else {
      if (metric === 'utilization') {
        val = parseFloat(props.completion_rate_pct || 0)
        isPct = true
      } else {
        val = parseInt(props.completed_works_count || 0, 10)
        isPct = false
      }
    }

    return {
      fillColor: getColor(val, isPct),
      weight: 1,
      opacity: 0.8,
      color: isDark ? palette.neutral.dark : palette.neutral.light,
      fillOpacity: 0.75,
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    layer.on({
      click: () => {
        setSelectedFeature(feature.properties)
      },
      mouseover: (e: any) => {
        const l = e.target
        l.setStyle({
          weight: 2.5,
          color: isDark ? palette.fund.utilized.dark : palette.fund.utilized.light,
          fillOpacity: 0.9,
        })
      },
      mouseout: (e: any) => {
        const l = e.target
        l.setStyle(styleFeature(feature))
      },
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--brand-primary)]">
              Sovereign Territorial Surveillance
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              ● India Only
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
            <Globe2 className="text-[var(--brand-primary)]" size={26} />
            <span>National GIS Geospatial Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Sovereign map of the Republic of India rendering 543 Parliamentary Constituencies and 594 administrative districts.
          </p>
        </div>

        {/* Toggle Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Layer Selector */}
          <div className="flex items-center rounded-xl bg-[var(--surface-primary)] p-0.5 border border-[var(--border-primary)] text-xs font-bold shadow-sm">
            <button
              onClick={() => setLayerType('pcs')}
              className={`px-3 py-1.5 rounded-lg transition ${
                layerType === 'pcs'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              PCs (543)
            </button>
            <button
              onClick={() => setLayerType('districts')}
              className={`px-3 py-1.5 rounded-lg transition ${
                layerType === 'districts'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Districts (594)
            </button>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center rounded-xl bg-[var(--surface-primary)] p-0.5 border border-[var(--border-primary)] text-xs font-bold shadow-sm">
            <button
              onClick={() => setMetric('utilization')}
              className={`px-3 py-1.5 rounded-lg transition ${
                metric === 'utilization'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Utilization %
            </button>
            <button
              onClick={() => setMetric('works')}
              className={`px-3 py-1.5 rounded-lg transition ${
                metric === 'works'
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Completed Works
            </button>
          </div>
        </div>
      </div>

      {/* Map + Detail Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Map Container */}
        <div className="lg:col-span-3 lux-card p-2 overflow-hidden h-[640px] relative">
          {loading ? (
            <LoadingSkeleton rows={10} height="h-full" />
          ) : (
            <MapContainer
              center={INDIA_CENTER}
              zoom={5}
              minZoom={4.5}
              maxZoom={8.5}
              maxBounds={INDIA_BOUNDS}
              maxBoundsViscosity={1.0}
              style={{ height: '100%', width: '100%', borderRadius: '12px' }}
              className="z-0"
            >
              <ResetViewControl />
              {geoData && (
                <GeoJSON
                  key={`${layerType}-${metric}`}
                  data={geoData}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
              )}
            </MapContainer>
          )}

          {/* Legend (Bottom-Right) */}
          <div className="absolute bottom-4 right-4 z-20 lux-card p-3 shadow-xl backdrop-blur-md text-xs pointer-events-none">
            <div className="font-bold text-[var(--text-primary)] text-[11px] mb-1.5 uppercase tracking-wider">
              {metric === 'utilization' ? 'Utilization / Realization' : 'Completed Projects'}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">Low</span>
              <div
                className="w-28 h-2 rounded-full shadow-inner"
                style={{
                  background: `linear-gradient(to right, ${ramp[0]}, ${ramp[1]}, ${ramp[2]}, ${ramp[3]}, ${ramp[4]})`
                }}
              />
              <span className="text-[10px] font-bold text-[var(--text-primary)]">High</span>
            </div>
          </div>
        </div>

        {/* Side Panel: Selected Feature Inspector */}
        <div className="lg:col-span-1 lux-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--brand-primary)] mb-3 pb-2 border-b border-[var(--border-primary)]">
              <MapPin size={14} />
              <span>GEOSPATIAL INSPECTOR</span>
            </div>

            {selectedFeature ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-[var(--text-primary)] tracking-tight">
                    {selectedFeature.pc_name ||
                      selectedFeature.NAME_2 ||
                      selectedFeature.district ||
                      'Geospatial Zone'}
                  </h3>
                  <div className="text-xs text-[var(--text-secondary)] font-medium">
                    State: <strong className="text-[var(--text-primary)]">{selectedFeature.state || selectedFeature.NAME_1 || 'India'}</strong>
                  </div>
                  {selectedFeature.mp_name && (
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      MP: <strong className="text-[var(--text-primary)]">{selectedFeature.mp_name}</strong>
                    </div>
                  )}
                </div>

                {(() => {
                  const totalWorks = Number(selectedFeature.total_works ?? selectedFeature.recommended_works ?? 0)
                  const completedWorks = Number(selectedFeature.completed_works_count ?? selectedFeature.completed_works ?? 0)
                  const remainedWorks = Math.max(0, totalWorks - completedWorks)
                  const completionRate = totalWorks > 0 ? ((completedWorks / totalWorks) * 100).toFixed(1) : '0.0'
                  const allocated = selectedFeature.total_allocated ?? selectedFeature.allocated_amount
                  const spent = selectedFeature.total_expenditure
                  const utilRate = selectedFeature.utilization_pct ?? (allocated && spent ? ((spent / allocated) * 100).toFixed(1) : null)

                  return (
                    <div className="space-y-3">
                      {/* Works Execution Breakdown */}
                      <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] space-y-2.5 text-xs">
                        <div className="font-bold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider flex items-center justify-between">
                          <span>Works Execution Progress</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{completionRate}% Done</span>
                        </div>

                        {/* Dual-tone Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[var(--surface-primary)] overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Number(completionRate))}%` }}
                            title={`Completed: ${completedWorks} works`}
                          />
                          <div
                            className="h-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${Math.max(0, 100 - Number(completionRate))}%` }}
                            title={`Remained: ${remainedWorks} works`}
                          />
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Total Works:
                            </span>
                            <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                              {totalWorks.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Completed Works:
                            </span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {completedWorks.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-tertiary)] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Remained / In Progress:
                            </span>
                            <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                              {remainedWorks.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Outlay & Spend */}
                      {(allocated || utilRate) && (
                        <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] space-y-2 text-xs">
                          <div className="font-bold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                            Financial Outlay & Spend
                          </div>
                          {allocated && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Allocated:</span>
                              <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                                ₹{(Number(allocated) / 10000000).toFixed(2)} Cr
                              </span>
                            </div>
                          )}
                          {spent && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Expenditure:</span>
                              <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                                ₹{(Number(spent) / 10000000).toFixed(2)} Cr
                              </span>
                            </div>
                          )}
                          {utilRate && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Utilization Rate:</span>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {Number(utilRate).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Representatives */}
                      {selectedFeature.mp_count != null || selectedFeature.mps_active ? (
                        <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs flex items-center justify-between">
                          <span className="font-bold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                            Members of Parliament
                          </span>
                          <span className="font-extrabold text-[var(--brand-primary)] tabular-nums">
                            {selectedFeature.mp_count ?? (selectedFeature.mps_active ? selectedFeature.mps_active.split(',').filter(Boolean).length : 0)} {((selectedFeature.mp_count ?? (selectedFeature.mps_active ? selectedFeature.mps_active.split(',').filter(Boolean).length : 0)) === 1) ? 'MP' : 'MPs'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}

                {selectedFeature.state && (
                  <Link
                    to={`/states/${encodeURIComponent(selectedFeature.state)}`}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition hover:opacity-90"
                  >
                    <span>View State Report</span>
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-2">
                <Info size={24} className="mx-auto text-[var(--text-tertiary)]" />
                <p>Click on any Parliamentary Constituency or District polygon on the map to inspect its real-time telemetry.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--border-primary)] text-[11px] text-[var(--text-tertiary)]">
            Polygon boundaries aligned with Survey of India & GADM 4.1 master GIS shapes.
          </div>
        </div>
      </div>
    </div>
  )
}
