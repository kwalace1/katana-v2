import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { WheelEvent as ReactWheelEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Loader2, Search, Star, MapPin, UserPlus } from 'lucide-react'
import {
  getSuggestedInvestors,
  type SuggestedInvestorsResponseRef,
  type SuggestedInvestorRef,
  type ExistingInvestorRef,
} from '@/lib/kyi-api'

/** REFERENCE_Suggested_Investors.md — layout constants (exact) */
const RING_SPACING = 35
const COMPANY_R = 28
const COMPANY_FILL = '#1a1f2e'
const COMPANY_STROKE = '#3a4a66'
const INVESTOR_R = 18
const INVESTOR_R_SELECTED = 22
const INVESTOR_STROKE = '#0c1322'
const INVESTOR_COLORS = ['#7c5cff', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#8b5cf6']
const SUGGESTION_R_MIN = 6
const SUGGESTION_R_SCORE_FACTOR = 8
const ZOOM_EXTENT: [number, number] = [0.3, 3]

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

function truncateLabel(label: string, maxLen = 10): string {
  const s = (label ?? '').trim()
  if (s.length <= maxLen) return s
  return s.substring(0, maxLen) + '..'
}

function getDimensions(container: HTMLDivElement | null): { width: number; height: number; centerX: number; centerY: number } {
  const w = container?.clientWidth ?? 400
  const h = container?.clientHeight ?? 400
  const size = Math.min(w, h)
  return { width: size, height: size, centerX: size / 2, centerY: size / 2 }
}

function suggestionRadius(score: number | undefined): number {
  return SUGGESTION_R_MIN + Math.min(1, (score ?? 0) / 30) * SUGGESTION_R_SCORE_FACTOR
}

interface AccessMapSuggestedViewProps {
  companyId: number
  companyName: string
  fullscreen?: boolean
}

export function AccessMapSuggestedView({ companyId, companyName, fullscreen = false }: AccessMapSuggestedViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState(() => ({ width: 400, height: 400, centerX: 200, centerY: 200 }))
  const [data, setData] = useState<SuggestedInvestorsResponseRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterByInvestor, setFilterByInvestor] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedInvestorRef | null>(null)
  const [hoverSuggestion, setHoverSuggestion] = useState<SuggestedInvestorRef | null>(null)
  const [hoverInvestorName, setHoverInvestorName] = useState<string | null>(null)
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 })
  const panRef = useRef({ panning: false, lastX: 0, lastY: 0 })
  const [legendOffset, setLegendOffset] = useState({ x: 0, y: 0 })
  const legendDragRef = useRef({ dragging: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    let cancelled = false
    getSuggestedInvestors(companyId)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [companyId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setDim(getDimensions(el))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fullscreen])

  const handleWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.001)
    setZoomTransform((prev) => {
      const nextK = clamp(prev.k * factor, ZOOM_EXTENT[0], ZOOM_EXTENT[1])
      return { ...prev, k: nextK }
    })
  }, [])

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    panRef.current.panning = true
    panRef.current.lastX = e.clientX
    panRef.current.lastY = e.clientY
  }, [])

  const handlePointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!panRef.current.panning) return
    const { clientX, clientY } = e
    const dx = clientX - panRef.current.lastX
    const dy = clientY - panRef.current.lastY
    panRef.current.lastX = clientX
    panRef.current.lastY = clientY
    setZoomTransform((prev) => ({
      ...prev,
      x: prev.x + dx / prev.k,
      y: prev.y + dy / prev.k,
    }))
  }, [])

  const endPan = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current.panning) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    panRef.current.panning = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    const start = performance.now()
    const from = { ...zoomTransform }
    const duration = 500
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setZoomTransform({
        k: from.k + (1 - from.k) * t,
        x: from.x * (1 - t),
        y: from.y * (1 - t),
      })
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [zoomTransform])

  // Legend drag within the viewport – independent of pan/zoom
  const handleLegendPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    legendDragRef.current.dragging = true
    legendDragRef.current.lastX = e.clientX
    legendDragRef.current.lastY = e.clientY
  }, [])

  const investors = data?.existing_investors ?? []
  const invCount = Math.max(investors.length, 1)

  const handleLegendPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!legendDragRef.current.dragging) return
    const { clientX, clientY } = e
    const dx = clientX - legendDragRef.current.lastX
    const dy = clientY - legendDragRef.current.lastY
    legendDragRef.current.lastX = clientX
    legendDragRef.current.lastY = clientY
    // Adjust by current zoom so movement feels natural, and clamp legend within viewport bounds
    setLegendOffset((prev) => {
      const rawX = prev.x + dx / zoomTransform.k
      const rawY = prev.y + dy / zoomTransform.k
      const legendWidth = 140
      const legendHeight = 24 + invCount * 22
      const maxX = Math.max(0, dim.width - 10 - legendWidth)
      const maxY = Math.max(0, dim.height - 10 - legendHeight)
      return {
        x: clamp(rawX, 0, maxX),
        y: clamp(rawY, 0, maxY),
      }
    })
  }, [zoomTransform.k, invCount, dim.width, dim.height])

  const handleLegendPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (legendDragRef.current.dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    legendDragRef.current.dragging = false
  }, [])

  const minDim = Math.min(dim.width, dim.height)
  const invRadius = minDim * 0.15
  const baseRadius = minDim * 0.28
  const maxRadius = minDim * 0.45
  const arcSpread = (2 * Math.PI / invCount) * 0.85

  const investorPositions = useMemo(() => {
    return investors.map((inv, i) => {
      const angle = (2 * Math.PI * i) / invCount - Math.PI / 2
      return {
        ...inv,
        angle,
        x: invRadius * Math.cos(angle),
        y: invRadius * Math.sin(angle),
        color: INVESTOR_COLORS[i % INVESTOR_COLORS.length],
      }
    })
  }, [investors, invCount, invRadius])

  const displaySuggestions = useMemo(() => {
    let list = data?.suggestions ?? []
    if (filterByInvestor) {
      list = list.filter((s) => s.related_investors?.some((r) => r.name === filterByInvestor))
    }
    return list
  }, [data?.suggestions, filterByInvestor])

  const suggByInvestor = useMemo(() => {
    const map = new Map<string, SuggestedInvestorRef[]>()
    investorPositions.forEach((inv) => map.set(inv.full_name, []))
    displaySuggestions.forEach((s) => {
      const primary = s.related_investors?.[0]?.name
      if (primary && map.has(primary)) map.get(primary)!.push(s)
    })
    return map
  }, [investorPositions, displaySuggestions])

  const perRing = (invSuggs: SuggestedInvestorRef[]) =>
    Math.min(12, Math.ceil(Math.max(invSuggs.length, 1) / 3))

  const suggestionNodes = useMemo(() => {
    const nodes: Array<{
      suggestion: SuggestedInvestorRef
      x: number
      y: number
      invPositions: Array<{ x: number; y: number; color: string; name: string }>
      globalIdx: number
    }> = []
    let globalIdx = 0
    investorPositions.forEach((inv) => {
      const invSuggs = suggByInvestor.get(inv.full_name) ?? []
      const perR = perRing(invSuggs)
      const startAngle = inv.angle - arcSpread / 2
      invSuggs.forEach((s, i) => {
        const ringNum = Math.floor(i / perR)
        const posInRing = i % perR
        const ringTotal = Math.min(perR, invSuggs.length - ringNum * perR)
        const radius = Math.min(baseRadius + ringNum * RING_SPACING, maxRadius)
        const angle = startAngle + (arcSpread * (posInRing + 0.5)) / Math.max(ringTotal, 1)
        const x = radius * Math.cos(angle)
        const y = radius * Math.sin(angle)
        const relatedInvs = (s.related_investors ?? [])
          .map((r) => investorPositions.find((ip) => ip.full_name === r.name))
          .filter((p): p is NonNullable<typeof p> => p != null)
        nodes.push({
          suggestion: s,
          x,
          y,
          invPositions: relatedInvs.map((p) => ({ x: p.x, y: p.y, color: p.color, name: p.full_name })),
          globalIdx: globalIdx++,
        })
      })
    })
    return nodes
  }, [investorPositions, suggByInvestor, arcSpread, baseRadius, maxRadius])

  const filteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return displaySuggestions
    const searchStr = (s: SuggestedInvestorRef) =>
      [s.name, s.position, s.firm, s.location, ...(s.reasons ?? []), ...(s.related_investors ?? []).map((r) => r.name)].join(' ').toLowerCase()
    return displaySuggestions.filter((s) => searchStr(s).includes(q))
  }, [displaySuggestions, searchQuery])

  const sortedList = useMemo(() => {
    return [...filteredBySearch].sort((a, b) => {
      const aLen = a.related_investors?.length ?? 0
      const bLen = b.related_investors?.length ?? 0
      if (bLen !== aLen) return bLen - aLen
      return (b.score ?? 0) - (a.score ?? 0)
    })
  }, [filteredBySearch])

  const investorCounts = useMemo(() => {
    const m = new Map<string, number>()
    investors.forEach((inv) => m.set(inv.full_name, 0))
    displaySuggestions.forEach((s) => {
      s.related_investors?.forEach((r) => {
        if (m.has(r.name)) m.set(r.name, (m.get(r.name) ?? 0) + 1)
      })
    })
    return m
  }, [investors, displaySuggestions])

  const handleInvestorClick = useCallback((fullName: string) => {
    setFilterByInvestor((prev) => (prev === fullName ? null : fullName))
  }, [])

  const selectedInv = filterByInvestor ? investorPositions.find((p) => p.full_name === filterByInvestor) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 rounded-xl border border-border bg-[#0f1729]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>
  }

  const multiInvestorCount = data?.multi_investor_count ?? 0
  const allSuggestions = data?.suggestions ?? []

  return (
    <div className={`flex flex-1 min-h-0 min-w-0 ${fullscreen ? '' : 'flex-col md:flex-row gap-4'}`}>
      <div
        ref={containerRef}
        className={
          fullscreen
            ? 'relative flex-1 min-h-0 min-w-0 rounded-xl border border-border bg-[#0f1729]'
            : 'relative flex-1 min-h-0 min-w-0 rounded-xl border border-border bg-[#0f1729] min-h-[420px]'
        }
        style={{ minHeight: fullscreen ? undefined : 420 }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${dim.width} ${dim.height}`}
          className="overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          style={{ maxHeight: '100%' }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerLeave={endPan}
          onDoubleClick={handleDoubleClick}
        >
          <g transform={`translate(${dim.centerX},${dim.centerY}) scale(${zoomTransform.k}) translate(${zoomTransform.x},${zoomTransform.y})`}>

            {/* Relation edges (suggestion ↔ investor); default opacity 0, hover 0.6/0.8 */}
            <g className="edges">
              {suggestionNodes.map((node) =>
                node.invPositions.map((invPos) => {
                  const isHoverInv = hoverInvestorName === invPos.name
                  const isHoverSugg = hoverSuggestion?.name === node.suggestion.name
                  const opacity = isHoverInv ? 0.6 : isHoverSugg ? 0.8 : 0
                  return (
                    <line
                      key={`${node.globalIdx}-${invPos.name}`}
                      x1={node.x}
                      y1={node.y}
                      x2={invPos.x}
                      y2={invPos.y}
                      stroke={invPos.color}
                      strokeOpacity={opacity}
                      strokeWidth={1}
                    />
                  )
                }),
              )}
            </g>

            {/* Investor → center lines (stroke investor color, opacity 0.25) */}
            {investorPositions.map((ip) => (
              <line
                key={ip.id}
                x1={0}
                y1={0}
                x2={ip.x}
                y2={ip.y}
                stroke={ip.color}
                strokeOpacity={0.25}
                strokeWidth={1}
              />
            ))}

            {/* Center company node */}
            <circle cx={0} cy={0} r={COMPANY_R} fill={COMPANY_FILL} stroke={COMPANY_STROKE} strokeWidth={2} />
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} fontWeight="700">
              {truncateLabel(companyName, 12)}
            </text>

            {/* Suggestion nodes */}
            {suggestionNodes.map((node) => (
              <g
                key={node.globalIdx}
                onMouseEnter={() => setHoverSuggestion(node.suggestion)}
                onMouseLeave={() => setHoverSuggestion(null)}
                onClick={() => setSelectedSuggestion(node.suggestion)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={suggestionRadius(node.suggestion.score)}
                  fill={node.invPositions[0]?.color ?? '#6b7280'}
                  stroke={hoverSuggestion?.name === node.suggestion.name ? '#fff' : 'none'}
                  strokeWidth={1}
                />
              </g>
            ))}

            {/* Investor nodes */}
            {investorPositions.map((ip) => {
              const isSelected = selectedInv?.full_name === ip.full_name
              const r = isSelected ? INVESTOR_R_SELECTED : INVESTOR_R
              const stroke = isSelected || hoverInvestorName === ip.full_name ? '#fff' : INVESTOR_STROKE
              return (
                <g
                  key={ip.id}
                  onMouseEnter={() => setHoverInvestorName(ip.full_name)}
                  onMouseLeave={() => setHoverInvestorName(null)}
                  onClick={() => handleInvestorClick(ip.full_name)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={ip.x} cy={ip.y} r={r} fill={ip.color} stroke={stroke} strokeWidth={2} />
                  <text x={ip.x} y={ip.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={9} fontWeight="600">
                    {ip.full_name.split(' ')[0]}
                  </text>
                  {investorCounts.get(ip.full_name) != null && investorCounts.get(ip.full_name)! > 0 && (
                    <text x={ip.x + r + 6} y={ip.y} textAnchor="start" dominantBaseline="middle" fill="white" fontSize={9}>
                      {investorCounts.get(ip.full_name)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Draggable investors legend overlay – independent of zoom/pan */}
        <div
          className="absolute z-20 rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-[10px] text-white/90 cursor-grab"
          style={{ top: 15 + legendOffset.y, left: 15 + legendOffset.x }}
          onPointerDown={handleLegendPointerDown}
          onPointerMove={handleLegendPointerMove}
          onPointerUp={handleLegendPointerUp}
          onPointerLeave={handleLegendPointerUp}
        >
          <p className="text-[11px] font-bold mb-1">INVESTORS</p>
          <div className="space-y-1">
            {investorPositions.map((ip) => (
              <div key={ip.id} className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: ip.color }} />
                <span className="truncate">
                  {truncateLabel(ip.full_name)} ({investorCounts.get(ip.full_name) ?? 0})
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[9px] text-white/60">Scroll to zoom • Drag to pan</p>
        </div>

        {/* Hover info: investor */}
        {hoverInvestorName && !hoverSuggestion && (
          <div
            className="absolute top-2 right-2 max-w-[200px] rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs shadow-lg z-10"
            style={{ pointerEvents: 'none' }}
          >
            <p className="font-semibold text-white">{hoverInvestorName}</p>
            <p className="text-white/70">{investorCounts.get(hoverInvestorName) ?? 0} suggestions</p>
          </div>
        )}

        {/* Hover info: suggestion */}
        {hoverSuggestion && !selectedSuggestion && (
          <div
            className="absolute top-2 right-2 max-w-[220px] rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs shadow-lg z-10"
            style={{ pointerEvents: 'none' }}
          >
            <p className="font-semibold text-white">{hoverSuggestion.name}</p>
            {hoverSuggestion.firm && <p className="text-white/80">{hoverSuggestion.firm}</p>}
            {hoverSuggestion.position && <p className="text-white/70">{hoverSuggestion.position}</p>}
            {hoverSuggestion.score != null && <p className="text-white/70">Score: {hoverSuggestion.score}</p>}
            {hoverSuggestion.related_investors?.length ? (
              <p className="text-white/70 mt-1">Via: {hoverSuggestion.related_investors.map((r) => r.name.split(' ')[0]).join(', ')}</p>
            ) : null}
          </div>
        )}

        {/* Status bar at reference position: y = dim.height/2 - 12 */}
        <div
          className="absolute left-0 right-0 z-10 text-center space-y-0.5"
          style={{ bottom: 12 }}
        >
          <p className="text-[10px] text-white/80">
            {allSuggestions.length} suggestions • Hover to see connections
          </p>
          <p className="text-[10px] text-white/60">
            Click an investor to filter. Click a suggestion for details.
          </p>
        </div>
      </div>

      {/* List panel (reference §4) */}
      {!fullscreen && data && (
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-[#0f1729] p-4 overflow-auto">
          <p className="text-sm text-white/90 mb-2">
            {allSuggestions.length} suggestions • {multiInvestorCount} connected to 2+ investors
          </p>
          <p className="text-xs text-white/70 mb-2">Filter by:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setFilterByInvestor(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${!filterByInvestor ? 'bg-[#7c5cff] text-white' : 'bg-[#1f2937] text-white/90 border border-white/20'}`}
            >
              All
            </button>
            {investors.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => handleInvestorClick(inv.full_name)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${filterByInvestor === inv.full_name ? 'bg-[#7c5cff] text-white' : 'bg-[#1f2937] text-white/90 border border-white/20'}`}
              >
                {inv.full_name.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search by name, firm, position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {sortedList.map((s, idx) => {
              const connCount = s.related_investors?.length ?? 0
              const isMulti = connCount >= 2
              const signals = s.signals ?? []
              return (
                <button
                  key={`${s.name}-${idx}`}
                  type="button"
                  onClick={() => setSelectedSuggestion(s)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:border-[#3b82f6] hover:bg-[#1a2332] ${
                    isMulti ? 'border-[#f59e0b]/40 bg-[#0f1729]' : 'border-[#1f2937] bg-[#0f1729]'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isMulti ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#ef4444] text-white mb-1">
                          <Star className="w-3 h-3" />
                          {connCount} INVESTOR CONNECTIONS
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-white/80 mb-1">1 connection</span>
                      )}
                      <p className="font-semibold text-[13px] text-[#e8eef7]">{s.name}</p>
                      {s.position && <p className="text-[11px] text-[#9ca3af]">{s.position}</p>}
                      {s.firm && <p className="text-[11px] text-[#6b7280]">{s.firm}</p>}
                      {s.location && (
                        <p className="flex items-center gap-1 text-[10px] text-white/70 mt-0.5">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                          {s.location}
                        </p>
                      )}
                      {signals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-white/80">
                            {signals.length} signals
                          </span>
                          {signals.map((sig, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[#020617] text-white/70 border border-white/10"
                            >
                              {sig}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.related_investors?.length ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.related_investors.map((r) => (
                            <span key={r.name} className="px-1.5 py-0.5 rounded text-[10px] bg-[#7c5cff]/20 text-[#7c5cff]">
                              via {r.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {s.score != null && (
                      <div className="text-right shrink-0">
                        <span className="text-[14px] font-bold text-[#22c55e]">{s.score}</span>
                        <p className="text-[9px] text-white/50">score</p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Detail panel (reference §5) */}
      {selectedSuggestion && (
        <div className={`rounded-xl border border-white/20 bg-[#0f1729] p-4 ${fullscreen ? 'absolute bottom-4 left-4 right-4 max-w-md z-20' : 'mt-4'}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <p className="font-semibold text-white">{selectedSuggestion.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSuggestion(null)}
              className="text-white/60 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="grid gap-2 text-sm text-white/80 mb-3">
            {selectedSuggestion.position && <p>Position: {selectedSuggestion.position}</p>}
            {selectedSuggestion.firm && <p>Firm: {selectedSuggestion.firm}</p>}
            {selectedSuggestion.location && <p>Location: {selectedSuggestion.location}</p>}
            {selectedSuggestion.source && <p>Source: {selectedSuggestion.source}</p>}
            {selectedSuggestion.score != null && <p>Match Score: {selectedSuggestion.score}</p>}
            {selectedSuggestion.signals?.length ? (
              <p>Signals: {selectedSuggestion.signals.length}</p>
            ) : null}
            {selectedSuggestion.profile_url && (
              <a href={selectedSuggestion.profile_url} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">
                View Profile
              </a>
            )}
          </div>
          {selectedSuggestion.reasons?.length ? (
            <div className="mb-3">
              <p className="text-xs font-medium text-white/70 mb-1">Why Suggested:</p>
              <div className="flex flex-wrap gap-1">
                {selectedSuggestion.reasons.map((r, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-[#1a1f2e] text-xs text-white/90 border border-white/10">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {selectedSuggestion.related_investors?.length ? (
            <div className="mb-3">
              <p className="text-xs font-medium text-white/70 mb-1">Related to Your Investors:</p>
              <div className="space-y-2">
                {selectedSuggestion.related_investors.map((r) => (
                  <div key={r.name} className="p-2 rounded bg-[#1a1f2e] border-l-2 border-[#7c5cff] text-xs text-white/90">
                    <p className="font-medium">{r.name}</p>
                    {r.reasons?.length ? <p className="text-white/60">{(r.reasons as string[]).join(' • ')}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <a
            href={`/kyi/investors/new?name=${encodeURIComponent(selectedSuggestion.name)}&company=${encodeURIComponent(companyName)}${selectedSuggestion.location ? `&location=${encodeURIComponent(selectedSuggestion.location)}` : ''}${selectedSuggestion.firm ? `&firm=${encodeURIComponent(selectedSuggestion.firm)}` : ''}`}
            className="inline-flex items-center gap-2 text-sm text-[#7c5cff] hover:underline"
          >
            <UserPlus className="w-4 h-4" />
            + Add as Investor
          </a>
        </div>
      )}
    </div>
  )
}
