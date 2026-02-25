import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Building2,
  Users,
  LineChart,
  ChevronLeft,
  Loader2,
  MapPin,
  Briefcase,
  Globe,
  User,
  Target,
  Plus,
  Trash2,
} from 'lucide-react'
import { AccessMapPage } from '@/components/kyi/AccessMapPage'
import { AccessMapSuggestedView } from '@/components/kyi/AccessMapSuggestedView'
import {
  getCompany,
  getCompanyInvestors,
  getSuggestedInvestors,
  getGeoSettings,
  updateGeoSettings,
  getLeads,
  triggerRefreshNow,
  triggerGeocodeNow,
  kyiGeocodeProgress,
  createInvestor,
  deleteCompany,
  type KYICompanyDetail,
  type KYIInvestor,
  type GeoSettingsResponse,
  type KYILead,
} from '@/lib/kyi-api'

const emptyInvestorForm = {
  full_name: '',
  email: '',
  phone: '',
  location: '',
  industry: '',
  firm: '',
  title: '',
  profile_url: '',
  notes: '',
}

export default function KYICompanyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const companyId = id ? parseInt(id, 10) : NaN
  const [company, setCompany] = useState<KYICompanyDetail | null>(null)
  const [investors, setInvestors] = useState<KYIInvestor[]>([])
  const [addInvestorOpen, setAddInvestorOpen] = useState(false)
  const [addInvestorSaving, setAddInvestorSaving] = useState(false)
  const [addInvestorForm, setAddInvestorForm] = useState(emptyInvestorForm)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteDeleting, setDeleteDeleting] = useState(false)
  const [suggested, setSuggested] = useState<{
    suggestions: Array<{ name: string; firm?: string; position?: string; location?: string; score?: number; reasons?: string[] }>
    suggested_count?: number
  } | null>(null)
  const [geo, setGeo] = useState<GeoSettingsResponse | null>(null)
  const [geoSaving, setGeoSaving] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoForm, setGeoForm] = useState<{ location_label: string; radius_miles: number }>({
    location_label: '',
    radius_miles: 50,
  })
  const [leads, setLeads] = useState<KYILead[] | null>(null)
  const [leadStats, setLeadStats] = useState<{
    total_count: number
    filtered_count: number
    displayed_count: number
    needs_geocoding_count: number
  } | null>(null)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [leadsFilters, setLeadsFilters] = useState<{ thinning: string; minScore: number | null }>({
    thinning: 'top_10_percent',
    minScore: null,
  })
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState<{
    initial: number
    current: number
    status: 'running' | 'done'
  } | null>(null)
  // Progress bar: processed = attempted, geocoded = Open-Meteo returned coords, done = saved to DB
  const [geocodeBatchProcessed, setGeocodeBatchProcessed] = useState(0)
  const [geocodeBatchGeocoded, setGeocodeBatchGeocoded] = useState(0)
  const [geocodeBatchDone, setGeocodeBatchDone] = useState(0)
  const [geocodeBatchSize, setGeocodeBatchSize] = useState(0)
  const [geocodeNeedsCount, setGeocodeNeedsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || Number.isNaN(companyId)) {
      setError('Invalid company')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getCompany(companyId),
      getCompanyInvestors(companyId),
      getSuggestedInvestors(companyId).catch(() => null),
      getGeoSettings(companyId).catch(() => null),
    ])
      .then(([companyData, investorsData, suggestedData, geoData]) => {
        if (cancelled) return
        setCompany(companyData)
        setInvestors(investorsData)
        setSuggested(
          suggestedData && Array.isArray(suggestedData.suggestions)
            ? { suggestions: suggestedData.suggestions, suggested_count: suggestedData.suggested_count }
            : null
        )
        if (geoData) {
          setGeo(geoData)
          if (geoData.settings) {
            setGeoForm({
              location_label: geoData.settings.location_label,
              radius_miles: geoData.settings.radius_miles,
            })
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, companyId])

  const loadLeads = async () => {
    if (!companyId) return
    setLeadsLoading(true)
    setLeadsError(null)
    try {
      const data = await getLeads(companyId, {
        thinning: leadsFilters.thinning,
        min_score: leadsFilters.minScore,
      } as any)
      setLeads(data.leads)
      setLeadStats({
        total_count: data.total_count,
        filtered_count: data.filtered_count,
        displayed_count: data.displayed_count,
        needs_geocoding_count: data.needs_geocoding_count,
      })
      setGeocodeProgress((prev) => {
        if (!prev || prev.status === 'done') return prev
        const current = data.needs_geocoding_count
        const status = current === 0 ? 'done' : prev.status
        return {
          ...prev,
          current,
          status,
        }
      })
    } catch (e) {
      setLeadsError(e instanceof Error ? e.message : 'Failed to load leads')
    } finally {
      setLeadsLoading(false)
    }
  }

  useEffect(() => {
    // Load leads the first time Leads tab is used; to keep it simple, we load once on mount
    if (!Number.isNaN(companyId)) {
      loadLeads()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Poll leads every 3s while geocoding so "X / Y geocoded" updates. Depend only on status
  // so we don't tear down the interval every time current changes.
  const geocodeRunning = geocodeProgress?.status === 'running'
  useEffect(() => {
    if (!geocodeRunning || !companyId) return

    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const data = await getLeads(companyId, {
          thinning: leadsFilters.thinning,
          min_score: leadsFilters.minScore,
        })
        setLeads(data.leads)
        setLeadStats({
          total_count: data.total_count,
          filtered_count: data.filtered_count,
          displayed_count: data.displayed_count,
          needs_geocoding_count: data.needs_geocoding_count,
        })
        const needs = data.needs_geocoding_count
        setGeocodeNeedsCount(needs)
        setGeocodeProgress((prev) => {
          if (!prev || prev.status === 'done') return prev
          const status = needs === 0 ? 'done' : 'running'
          return { ...prev, current: needs, status }
        })
        if (needs === 0) {
          setPipelineMessage('Geocoding complete. All leads have coordinates.')
        }
      } catch (e) {
        if (!cancelled) {
          setPipelineError(e instanceof Error ? e.message : 'Failed to refresh leads during geocoding')
        }
      }
    }

    poll()
    const interval = window.setInterval(poll, 8000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [companyId, geocodeRunning, leadsFilters.thinning, leadsFilters.minScore])

  const handleSaveGeo = async () => {
    if (!companyId) return
    setGeoSaving(true)
    setGeoError(null)
    try {
      const res = await updateGeoSettings(companyId, {
        location_label: geoForm.location_label,
        radius_miles: geoForm.radius_miles,
      })
      setGeo((prev) =>
        prev
          ? {
              ...prev,
              configured: true,
              settings: res.settings,
            }
          : {
              configured: true,
              client_id: companyId,
              client_name: company?.name ?? '',
              settings: res.settings,
            },
      )
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Could not save geo settings')
    } finally {
      setGeoSaving(false)
    }
  }

  const fetchInvestors = () => {
    if (Number.isNaN(companyId)) return
    getCompanyInvestors(companyId).then(setInvestors).catch(() => {})
  }

  const handleAddInvestor = async () => {
    const full_name = addInvestorForm.full_name.trim()
    if (!full_name || Number.isNaN(companyId)) return
    setAddInvestorSaving(true)
    try {
      await createInvestor({
        company_id: companyId,
        full_name,
        email: addInvestorForm.email.trim() || undefined,
        phone: addInvestorForm.phone.trim() || undefined,
        location: addInvestorForm.location.trim() || undefined,
        industry: addInvestorForm.industry.trim() || undefined,
        firm: addInvestorForm.firm.trim() || undefined,
        title: addInvestorForm.title.trim() || undefined,
        profile_url: addInvestorForm.profile_url.trim() || undefined,
        notes: addInvestorForm.notes.trim() || undefined,
      })
      fetchInvestors()
      setAddInvestorOpen(false)
      setAddInvestorForm(emptyInvestorForm)
    } finally {
      setAddInvestorSaving(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (Number.isNaN(companyId) || company?.id === 1) return
    setDeleteDeleting(true)
    try {
      await deleteCompany(companyId)
      navigate('/kyi')
    } finally {
      setDeleteDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const handleRefreshNow = async () => {
    setRefreshing(true)
    setPipelineMessage(null)
    setPipelineError(null)
    try {
      const res = await triggerRefreshNow()
      setPipelineMessage(res.message || 'Refresh started. Reload leads in a few minutes.')
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : 'Failed to start refresh')
    } finally {
      setRefreshing(false)
    }
  }

  // Listen for per-lead updates (processed = attempted, geocoded = got coords, updated = saved)
  useEffect(() => {
    const onTick = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && typeof d.processed === 'number') {
        setGeocodeBatchProcessed(d.processed)
        setGeocodeBatchGeocoded(d.geocoded ?? 0)
        setGeocodeBatchDone(d.updated ?? 0)
        if (typeof d.batchSize === 'number') setGeocodeBatchSize(d.batchSize)
        if (d.done) setGeocodeProgress((prev) => (prev ? { ...prev, status: 'done' } : prev))
      }
    }
    window.addEventListener('kyi-geocode-tick', onTick)
    return () => window.removeEventListener('kyi-geocode-tick', onTick)
  }, [])

  // Also poll every 200ms while running (backup in case events don't fire)
  useEffect(() => {
    if (!geocodeRunning) return
    const tick = () => {
      setGeocodeBatchProcessed(kyiGeocodeProgress.processed)
      setGeocodeBatchGeocoded(kyiGeocodeProgress.geocoded)
      setGeocodeBatchDone(kyiGeocodeProgress.updated)
      setGeocodeBatchSize(kyiGeocodeProgress.batchSize)
      if (kyiGeocodeProgress.done) {
        setGeocodeProgress((prev) => (prev ? { ...prev, status: 'done' } : prev))
      }
    }
    tick()
    const interval = window.setInterval(tick, 200)
    return () => window.clearInterval(interval)
  }, [geocodeRunning])

  const handleGeocodeNow = async () => {
    setGeocoding(true)
    setPipelineMessage(null)
    setPipelineError(null)
    setGeocodeBatchProcessed(0)
    setGeocodeBatchDone(0)
    setGeocodeBatchSize(100)
    if (leadStats && leadStats.needs_geocoding_count > 0) {
      const initial = leadStats.needs_geocoding_count
      setGeocodeProgress({
        initial,
        current: initial,
        status: 'running',
      })
      setGeocodeNeedsCount(initial)
    } else {
      setGeocodeProgress(null)
      setGeocodeNeedsCount(null)
    }
    try {
      const res = await triggerGeocodeNow(companyId)
      setPipelineMessage(res.message || 'Geocoding started. Watch the “Need geocoding” count; it updates every few seconds.')
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : 'Failed to start geocoding')
      setGeocodeProgress(null)
    } finally {
      setGeocoding(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error ?? 'Company not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/kyi">Back to Companies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb: Companies › Company Name */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/kyi" className="hover:text-foreground transition-colors">
          Companies
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground font-medium truncate">{company.name}</span>
      </nav>
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/kyi">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt=""
                className="w-9 h-9 rounded-lg object-cover bg-muted"
              />
            ) : (
              <Building2 className="w-8 h-8 text-muted-foreground" />
            )}
            {company.name}
          </h1>
          {(company.location || company.industry) && (
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-3">
              {company.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {company.location}
                </span>
              )}
              {company.industry && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {company.industry}
                </span>
              )}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {company.investor_count} investors
        </Badge>
        {company.id !== 1 && (
          <>
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete company
            </Button>
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete company?</AlertDialogTitle>
                <AlertDialogDescription>
                  All investors for this company will be moved to the Default Company. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteCompany}
                  disabled={deleteDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="investors">Investors</TabsTrigger>
          <TabsTrigger value="suggested">Suggested Investors</TabsTrigger>
          <TabsTrigger value="leads">Localized Leads</TabsTrigger>
          <TabsTrigger value="geo">Geo targeting</TabsTrigger>
          <TabsTrigger value="accessmap">Access Map</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.website && (
                <p className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.website}
                  </a>
                </p>
              )}
              {company.description && (
                <p className="text-sm text-muted-foreground">{company.description}</p>
              )}
              {!company.website && !company.description && (
                <p className="text-sm text-muted-foreground">No additional details.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="investors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
              <div>
                <CardTitle className="text-lg">Investors</CardTitle>
                <CardDescription>People associated with this company</CardDescription>
              </div>
              <Dialog open={addInvestorOpen} onOpenChange={setAddInvestorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Investor
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Investor</DialogTitle>
                    <DialogDescription>
                      Add an investor to this company. Full name is required; other fields are optional.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="inv-full_name">Full name *</Label>
                      <Input
                        id="inv-full_name"
                        value={addInvestorForm.full_name}
                        onChange={(e) => setAddInvestorForm((p) => ({ ...p, full_name: e.target.value }))}
                        placeholder="e.g. Jane Smith"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="inv-email">Email</Label>
                        <Input
                          id="inv-email"
                          type="email"
                          value={addInvestorForm.email}
                          onChange={(e) => setAddInvestorForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="jane@example.com"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="inv-phone">Phone</Label>
                        <Input
                          id="inv-phone"
                          value={addInvestorForm.phone}
                          onChange={(e) => setAddInvestorForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inv-location">Location</Label>
                      <Input
                        id="inv-location"
                        value={addInvestorForm.location}
                        onChange={(e) => setAddInvestorForm((p) => ({ ...p, location: e.target.value }))}
                        placeholder="e.g. San Francisco, CA"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="inv-firm">Firm</Label>
                        <Input
                          id="inv-firm"
                          value={addInvestorForm.firm}
                          onChange={(e) => setAddInvestorForm((p) => ({ ...p, firm: e.target.value }))}
                          placeholder="e.g. Acme Capital"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="inv-title">Title</Label>
                        <Input
                          id="inv-title"
                          value={addInvestorForm.title}
                          onChange={(e) => setAddInvestorForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="e.g. Partner"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inv-industry">Industry</Label>
                      <Input
                        id="inv-industry"
                        value={addInvestorForm.industry}
                        onChange={(e) => setAddInvestorForm((p) => ({ ...p, industry: e.target.value }))}
                        placeholder="e.g. Technology"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inv-profile_url">Profile URL</Label>
                      <Input
                        id="inv-profile_url"
                        value={addInvestorForm.profile_url}
                        onChange={(e) => setAddInvestorForm((p) => ({ ...p, profile_url: e.target.value }))}
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inv-notes">Notes</Label>
                      <Textarea
                        id="inv-notes"
                        rows={2}
                        value={addInvestorForm.notes}
                        onChange={(e) => setAddInvestorForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddInvestorOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddInvestor}
                      disabled={!addInvestorForm.full_name.trim() || addInvestorSaving}
                    >
                      {addInvestorSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Investor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {investors.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">No investors yet.</p>
              ) : (
                <div className="space-y-2">
                  {investors.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/kyi/investors/${inv.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{inv.full_name}</p>
                        {(inv.firm || inv.title) && (
                          <p className="text-sm text-muted-foreground">
                            {[inv.title, inv.firm].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {inv.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {inv.location}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="suggested" className="space-y-4">
          {/* Network graph: light gray center, purple/blue investor nodes, white badges, arc of dots */}
          {company?.id != null && company?.name != null && (
            <Card className="overflow-hidden border-border bg-gradient-to-b from-[#0f1729] to-[#070a0f]">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">Suggested Investors</CardTitle>
                <CardDescription className="text-white/70">
                  Network view: your investors and suggested matches from public records.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-[420px]">
                <AccessMapSuggestedView
                  companyId={company.id}
                  companyName={company.name}
                  fullscreen={false}
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Suggested investors list
              </CardTitle>
              <CardDescription>
                Potential matches from public records (SEC, FEC, Wikidata, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!suggested ? (
                <p className="text-muted-foreground py-6 text-center">
                  Could not load suggestions. Ensure Supabase KYI data is available for this company.
                </p>
              ) : suggested.suggestions.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  No suggestions yet. Add investors to this company first, then run the recommendation pipeline.
                </p>
              ) : (
                <div className="space-y-2">
                  {suggested.suggestions.slice(0, 50).map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{s.name}</p>
                        {(s.firm || s.position) && (
                          <p className="text-sm text-muted-foreground">
                            {[s.position, s.firm].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {s.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {s.location}
                          </p>
                        )}
                        {s.reasons && s.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.reasons.slice(0, 3).map((r, j) => (
                              <Badge key={j} variant="secondary" className="text-xs">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {typeof s.score === 'number' && (
                        <Badge variant="outline">Score {s.score}</Badge>
                      )}
                    </div>
                  ))}
                  {suggested.suggestions.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Showing 50 of {suggested.suggestions.length} suggestions
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Localized leads</CardTitle>
              <CardDescription>
                Leads sourced from public records and filtered by your geo targeting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {geo?.settings ? (
                <p className="text-sm text-muted-foreground">
                  Showing leads within{' '}
                  <span className="font-medium">
                    {Math.round(geo.settings.radius_miles)} miles
                  </span>{' '}
                  of <span className="font-medium">{geo.settings.location_label}</span>.
                </p>
              ) : (
                <p className="text-sm text-amber-500">
                  Geo targeting not configured. Set a location and radius in the Geo tab to
                  enable localized lead filtering.
                </p>
              )}
              {leadStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total leads</p>
                    <p className="text-lg font-semibold">{leadStats.total_count}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">In radius</p>
                    <p className="text-lg font-semibold">{leadStats.filtered_count}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Showing</p>
                    <p className="text-lg font-semibold">{leadStats.displayed_count}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Need geocoding</p>
                    <p className="text-lg font-semibold">{leadStats.needs_geocoding_count}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Show</label>
                  <select
                    className="border border-border rounded-md bg-background px-2 py-1 text-sm"
                    value={leadsFilters.thinning}
                    onChange={(e) =>
                      setLeadsFilters((prev) => ({ ...prev, thinning: e.target.value }))
                    }
                  >
                    <option value="top_10_percent">Top 10%</option>
                    <option value="top_25_percent">Top 25%</option>
                    <option value="top_50_percent">Top 50%</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Min score</label>
                  <input
                    type="number"
                    className="border border-border rounded-md bg-background px-2 py-1 text-sm w-24"
                    value={leadsFilters.minScore ?? ''}
                    onChange={(e) =>
                      setLeadsFilters((prev) => ({
                        ...prev,
                        minScore: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadLeads}
                  disabled={leadsLoading}
                >
                  {leadsLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Apply filters
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeocodeNow}
                  disabled={geocoding}
                >
                  {geocoding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Geocode now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshNow}
                  disabled={refreshing}
                >
                  {refreshing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Refresh now
                </Button>
              </div>
              {(geocodeProgress?.initial ?? 0) > 0 || geocodeBatchSize > 0 ? (
                <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Geocoding leads
                      {(geocodeProgress?.status ?? '') === 'done' ? ' complete' : ' in progress'}
                    </span>
                    <span className="font-medium text-foreground">
                      {geocodeBatchSize > 0
                        ? `${geocodeBatchProcessed} / ${geocodeBatchSize} processed, ${geocodeBatchDone} saved`
                        : geocodeProgress
                          ? `${Math.max(0, geocodeProgress.initial - (geocodeNeedsCount ?? geocodeProgress.current))} / ${geocodeProgress.initial} geocoded`
                          : '—'}
                    </span>
                  </div>
                  <Progress
                    value={
                      geocodeBatchSize > 0
                        ? Math.min(100, (geocodeBatchProcessed / geocodeBatchSize) * 100)
                        : geocodeProgress && geocodeProgress.initial > 0
                          ? ((geocodeProgress.initial - (geocodeNeedsCount ?? geocodeProgress.current)) / geocodeProgress.initial) * 100
                          : 0
                    }
                  />
                  {(geocodeProgress?.status ?? '') !== 'done' && geocodeBatchSize > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {geocodeBatchSize - geocodeBatchProcessed} left. If 0 geocoded: Open-Meteo returned nothing. If geocoded is positive but 0 saved: Supabase update (RLS/anon) failing.
                    </p>
                  )}
                </div>
              ) : null}
              {pipelineMessage && (
                <p className="text-xs text-emerald-500">{pipelineMessage}</p>
              )}
              {pipelineError && <p className="text-xs text-red-500">{pipelineError}</p>}
              {leadsError && <p className="text-sm text-red-500">{leadsError}</p>}
              {!leadsLoading && leads && leads.length === 0 && (
                <p className="text-muted-foreground py-6 text-center">
                  No leads found for the current filters. Try widening the radius or lowering
                  the minimum score.
                </p>
              )}
              {leadsLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : leads && leads.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {leads.map((lead) => (
                    <Card key={lead.id} className="border-border">
                      <CardContent className="pt-4 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{lead.display_name}</p>
                            <p className="text-xs text-muted-foreground">{lead.entity_type}</p>
                          </div>
                          <p className="font-semibold text-primary text-sm">
                            {lead.raw_score}
                          </p>
                        </div>
                        {(lead.city || lead.state) && (
                          <p className="text-xs text-muted-foreground">
                            {lead.city}
                            {lead.city && lead.state ? ', ' : ''}
                            {lead.state}
                          </p>
                        )}
                        {lead.tags && lead.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">
                                {t.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="geo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Geo targeting</CardTitle>
              <CardDescription>
                Configure a target location and radius to drive localized investor leads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {geoError && <p className="text-sm text-red-500">{geoError}</p>}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Target location</label>
                <input
                  type="text"
                  className="border border-border rounded-md bg-background px-3 py-2 text-sm w-full"
                  placeholder="e.g., Austin, TX or 123 Main St, Denver, CO"
                  value={geoForm.location_label}
                  onChange={(e) =>
                    setGeoForm((prev) => ({ ...prev, location_label: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Enter a city/state or full address. KYI will geocode it and filter leads by
                  distance.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Radius (miles)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={250}
                    step={5}
                    value={geoForm.radius_miles}
                    onChange={(e) =>
                      setGeoForm((prev) => ({
                        ...prev,
                        radius_miles: Number(e.target.value),
                      }))
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold w-16 text-right">
                    {Math.round(geoForm.radius_miles)} mi
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommended: 25–100 miles. Leads outside this radius are filtered out.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveGeo} disabled={geoSaving}>
                  {geoSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save settings
                </Button>
              </div>
              {geo?.settings && (
                <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Current configuration</p>
                  <p>
                    <span className="font-medium">Location:</span>{' '}
                    {geo.settings.location_label}
                  </p>
                  <p>
                    <span className="font-medium">Radius:</span>{' '}
                    {Math.round(geo.settings.radius_miles)} miles
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="accessmap" className="space-y-4">
          <AccessMapPage
            companyId={companyId}
            companyName={company.name}
            title="Solar Network"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
