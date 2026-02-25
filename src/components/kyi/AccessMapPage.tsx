import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Maximize2, Minimize2, Compass, Users, UserPlus, X } from 'lucide-react'
import { getAccessMap, type AccessMapOverlap } from '@/lib/kyi-api'
import { AccessMapOrbit } from '@/components/kyi/AccessMapOrbit'
import { MetricModal } from '@/components/kyi/access-map-metric-modals'
import { AccessMapOverlapView } from '@/components/kyi/AccessMapOverlapView'
import { AccessMapSuggestedView } from '@/components/kyi/AccessMapSuggestedView'

const FULLSCREEN_MAX_NODES = 85
const DEFAULT_MAX_NODES = 24

type ViewMode = 'explore' | 'overlap' | 'suggested'

interface AccessMapPageProps {
  companyId: number
  companyName: string
  title?: string
}

export function AccessMapPage({ companyId, companyName, title: titleProp }: AccessMapPageProps) {
  const pageTitle = titleProp ? `${titleProp} — ${companyName}` : `Solar Network — ${companyName}`
  const [viewMode, setViewMode] = useState<ViewMode>('explore')
  const [fullscreen, setFullscreen] = useState(false)
  const [mapData, setMapData] = useState<{
    metrics: Record<string, number>
    overlap: AccessMapOverlap
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metricModal, setMetricModal] = useState<keyof typeof import('./access-map-metric-modals').METRIC_COPY | null>(null)
  const [metricModalOpen, setMetricModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAccessMap(companyId)
      .then((res) => {
        if (cancelled) return
        setMapData({
          metrics: res.metrics || {},
          overlap: res.overlap || {
            unique_people_count: 0,
            unique_org_count: 0,
            overlap_people_count: 0,
            overlap_org_count: 0,
            overlap_percentage: 0,
            top_overlapping_people: [],
            top_overlapping_orgs: [],
          },
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load access map')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const openMetricModal = (key: string) => {
    setMetricModal(key)
    setMetricModalOpen(true)
  }

  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

  const metrics = mapData?.metrics ?? {}
  const overlap = mapData?.overlap

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click any node to zoom into their network. Use the back button or breadcrumbs to navigate.
      </p>

      {loading && !mapData && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {mapData && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => openMetricModal('nodes')}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Nodes</p>
              <p className="font-semibold text-lg">{metrics.node_count ?? 0}</p>
            </button>
            <button
              type="button"
              onClick={() => openMetricModal('edges')}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Edges</p>
              <p className="font-semibold text-lg">{metrics.edge_count ?? 0}</p>
            </button>
            <button
              type="button"
              onClick={() => openMetricModal('unique_people')}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Unique People</p>
              <p className="font-semibold text-lg">{overlap?.unique_people_count ?? 0}</p>
            </button>
            <button
              type="button"
              onClick={() => openMetricModal('unique_orgs')}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Unique Orgs</p>
              <p className="font-semibold text-lg">{overlap?.unique_org_count ?? 0}</p>
            </button>
            <button
              type="button"
              onClick={() => openMetricModal('overlap_people')}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Overlap People</p>
              <p className="font-semibold text-lg">{overlap?.overlap_people_count ?? 0}</p>
            </button>
            <button
              type="button"
              onClick={() => openMetricModal('overlap_percentage')}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Overlap %</p>
              <p className="font-semibold text-lg">{overlap?.overlap_percentage != null ? `${Math.round(overlap.overlap_percentage)}%` : '—'}</p>
            </button>
          </div>

          {/* Network Explorer card: dark gradient, fixed height unless fullscreen */}
          <Card
            className={
              fullscreen
                ? 'fixed inset-0 flex flex-col bg-[#070a0f]'
                : 'overflow-hidden border-border bg-gradient-to-b from-[#0f1729] to-[#070a0f]'
            }
            style={
              fullscreen
                ? { margin: 0, zIndex: 9999 }
                : { minHeight: 560, maxHeight: 560 }
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 flex-wrap shrink-0 pb-3">
              <CardTitle className="text-lg text-white">Network Explorer</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                  <Button
                    variant={viewMode === 'explore' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`rounded-md ${viewMode === 'explore' ? 'bg-primary text-primary-foreground' : 'text-white/90 hover:text-white'}`}
                    onClick={() => setViewMode('explore')}
                  >
                    <Compass className="w-4 h-4 mr-1.5" />
                    Explore
                  </Button>
                  <Button
                    variant={viewMode === 'overlap' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`rounded-md ${viewMode === 'overlap' ? 'bg-primary text-primary-foreground' : 'text-white/90 hover:text-white'}`}
                    onClick={() => setViewMode('overlap')}
                  >
                    <Users className="w-4 h-4 mr-1.5" />
                    Overlap View
                  </Button>
                  <Button
                    variant={viewMode === 'suggested' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`rounded-md ${viewMode === 'suggested' ? 'bg-primary text-primary-foreground' : 'text-white/90 hover:text-white'}`}
                    onClick={() => setViewMode('suggested')}
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Suggested Investors
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white/90 border-white/20 hover:bg-white/10"
                  onClick={() => setFullscreen((f) => !f)}
                  title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                  {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </Button>
                {fullscreen && (
                  <Button variant="ghost" size="sm" className="text-white/90" onClick={() => setFullscreen(false)}>
                    <X className="w-4 h-4 mr-1" />
                    Exit Fullscreen
                  </Button>
                )}
              </div>
            </CardHeader>
            <div className="px-6 border-b border-white/10" />
            <CardContent className={`flex-1 min-h-0 flex flex-col ${fullscreen ? 'overflow-hidden' : 'overflow-auto'}`}>
              {viewMode === 'explore' && (
                <AccessMapOrbit
                  companyId={companyId}
                  companyName={companyName}
                  maxVisibleNodes={fullscreen ? FULLSCREEN_MAX_NODES : DEFAULT_MAX_NODES}
                  fullscreen={fullscreen}
                />
              )}
              {viewMode === 'overlap' && (
                <AccessMapOverlapView companyId={companyId} companyName={companyName} fullscreen={fullscreen} />
              )}
              {viewMode === 'suggested' && (
                <AccessMapSuggestedView companyId={companyId} companyName={companyName} fullscreen={fullscreen} />
              )}
            </CardContent>
          </Card>

          {/* Top Overlapping People & Orgs */}
          {overlap &&
            (overlap.top_overlapping_people.length > 0 || overlap.top_overlapping_orgs.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Overlapping People & Orgs</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    People and organizations that appear in multiple investor networks
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {overlap.top_overlapping_people.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">People in multiple investor networks</p>
                        <ul className="space-y-1 text-sm">
                          {overlap.top_overlapping_people.slice(0, 10).map((p) => (
                            <li key={p.label} className="flex justify-between rounded border border-border/80 px-2 py-1.5">
                              <span className="truncate">{p.label}</span>
                              <span className="text-muted-foreground ml-2">({p.count})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {overlap.top_overlapping_orgs.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Orgs across multiple networks</p>
                        <ul className="space-y-1 text-sm">
                          {overlap.top_overlapping_orgs.slice(0, 10).map((o) => (
                            <li key={o.label} className="flex justify-between rounded border border-border/80 px-2 py-1.5">
                              <span className="truncate">{o.label}</span>
                              <span className="text-muted-foreground ml-2">({o.count})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
        </>
      )}

      <MetricModal
        metricKey={metricModal}
        open={metricModalOpen}
        onOpenChange={setMetricModalOpen}
      />
    </div>
  )
}
