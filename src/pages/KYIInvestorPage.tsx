import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  Loader2,
  MapPin,
  Briefcase,
  User,
  Mail,
  Phone,
  Globe,
  Target,
  Link2,
} from 'lucide-react'
import { getInvestor, getInvestorSuggestions, type KYIInvestorDetail, type SuggestedInvestor } from '@/lib/kyi-api'

export default function KYIInvestorPage() {
  const { id } = useParams<{ id: string }>()
  const investorId = id ? parseInt(id, 10) : NaN
  const [investor, setInvestor] = useState<KYIInvestorDetail | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedInvestor[] | null>(null)
  const [suggestedCount, setSuggestedCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || Number.isNaN(investorId)) {
      setError('Invalid investor')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getInvestor(investorId), getInvestorSuggestions(investorId).catch(() => null)])
      .then(([invData, suggData]) => {
        if (cancelled) return
        setInvestor(invData)
        if (suggData) {
          setSuggestions(suggData.suggestions || [])
          setSuggestedCount(suggData.suggested_count ?? 0)
        } else {
          setSuggestions(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, investorId])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !investor) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error ?? 'Investor not found'}</CardDescription>
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
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to={investor.company_id ? `/kyi/companies/${investor.company_id}` : '/kyi'}>
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <User className="w-8 h-8 text-muted-foreground" />
            {investor.full_name}
          </h1>
          {(investor.firm || investor.title) && (
            <p className="text-muted-foreground text-sm mt-1">
              {[investor.title, investor.firm].filter(Boolean).join(' · ')}
            </p>
          )}
          {investor.company && (
            <Link
              to={`/kyi/companies/${investor.company.id}`}
              className="text-sm text-primary hover:underline mt-1 inline-block"
            >
              {investor.company.name}
            </Link>
          )}
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="orbit">Orbit (Suggested)</TabsTrigger>
          <TabsTrigger value="relationship">Relationship</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investor information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Full name</p>
                  <p className="font-medium">{investor.full_name}</p>
                </div>
                {investor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${investor.email}`} className="text-primary hover:underline">
                      {investor.email}
                    </a>
                  </div>
                )}
                {investor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{investor.phone}</span>
                  </div>
                )}
                {investor.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{investor.location}</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {investor.firm && (
                  <div>
                    <p className="text-xs text-muted-foreground">Firm / organization</p>
                    <p className="font-medium">{investor.firm}</p>
                  </div>
                )}
                {investor.title && (
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-medium">{investor.title}</p>
                  </div>
                )}
                {investor.industry && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{investor.industry}</span>
                  </div>
                )}
                {investor.profile_url && (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={investor.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View profile
                    </a>
                  </div>
                )}
              </div>
              {investor.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap mt-1">{investor.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="orbit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                Suggested connections
              </CardTitle>
              <CardDescription>
                Based on {investor.full_name}&apos;s profile (public records: FEC, SEC, Wikidata, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions === null ? (
                <p className="text-muted-foreground py-6 text-center">
                  Could not load suggestions. Ensure the KYI backend is running.
                </p>
              ) : suggestions.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  No suggested connections yet. Add more detail (firm, location, industry) to improve matching.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    {suggestedCount} suggestion{suggestedCount !== 1 ? 's' : ''}
                  </p>
                  <div className="grid gap-2">
                    {suggestions.slice(0, 80).map((s, i) => (
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
                        </div>
                        {typeof s.score === 'number' && (
                          <span className="text-sm font-medium text-muted-foreground">Score {s.score}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {suggestions.length > 80 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Showing 80 of {suggestions.length}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="relationship" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Relationship</CardTitle>
              <CardDescription>
                Tags, interactions, and relationship strength (from KYI)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground py-6 text-center">
                Relationship data is managed in the KYI app. Connection count: {investor.connection_count ?? 0}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Behavior</CardTitle>
              <CardDescription>
                Behavioral profile and fit metrics (from KYI)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground py-6 text-center">
                Behavior profile is computed in the KYI backend. View full details in the KYI app if needed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
