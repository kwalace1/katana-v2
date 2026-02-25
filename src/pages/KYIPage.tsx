import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LineChart, Building2, Users, Loader2, MapPin, GitCompare, Plus } from 'lucide-react'
import { getCompanies, createCompany, type KYICompany } from '@/lib/kyi-api'

export default function KYIPage() {
  const [companies, setCompanies] = useState<KYICompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addCompanyOpen, setAddCompanyOpen] = useState(false)
  const [addCompanySaving, setAddCompanySaving] = useState(false)
  const [addCompanyForm, setAddCompanyForm] = useState({
    name: '',
    location: '',
    industry: '',
    website: '',
    description: '',
  })

  const fetchCompanies = () => {
    getCompanies()
      .then(setCompanies)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load companies'))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load companies')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleAddCompany = async () => {
    const name = addCompanyForm.name.trim()
    if (!name) return
    setAddCompanySaving(true)
    try {
      await createCompany({
        name,
        location: addCompanyForm.location.trim() || undefined,
        industry: addCompanyForm.industry.trim() || undefined,
        website: addCompanyForm.website.trim() || undefined,
        description: addCompanyForm.description.trim() || undefined,
      })
      fetchCompanies()
      setAddCompanyOpen(false)
      setAddCompanyForm({ name: '', location: '', industry: '', website: '', description: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create company')
    } finally {
      setAddCompanySaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Cannot load Know Your Investor</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ensure Supabase is configured correctly (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) and that the KYI
              Supabase schema has been applied.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LineChart className="w-7 h-7" />
            Know Your Investor
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage companies and investors, and discover suggested investors from public records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/kyi/cross-reference" className="flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Cross-Reference
            </Link>
          </Button>
          <Dialog open={addCompanyOpen} onOpenChange={setAddCompanyOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Company</DialogTitle>
                <DialogDescription>
                  Create a company to associate investors with. Suggested investors are scoped per company.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="company-name">Company name *</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. Acme Ventures"
                    value={addCompanyForm.name}
                    onChange={(e) => setAddCompanyForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company-location">Location</Label>
                  <Input
                    id="company-location"
                    placeholder="e.g. New York, NY"
                    value={addCompanyForm.location}
                    onChange={(e) => setAddCompanyForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company-industry">Industry</Label>
                  <Input
                    id="company-industry"
                    placeholder="e.g. Technology, Healthcare"
                    value={addCompanyForm.industry}
                    onChange={(e) => setAddCompanyForm((p) => ({ ...p, industry: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input
                    id="company-website"
                    placeholder="https://example.com"
                    value={addCompanyForm.website}
                    onChange={(e) => setAddCompanyForm((p) => ({ ...p, website: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company-description">Description</Label>
                  <Textarea
                    id="company-description"
                    placeholder="Brief description..."
                    rows={3}
                    value={addCompanyForm.description}
                    onChange={(e) => setAddCompanyForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddCompanyOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCompany} disabled={!addCompanyForm.name.trim() || addCompanySaving}>
                  {addCompanySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Company
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Companies</CardTitle>
          <CardDescription>Click a company to manage investors and view suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No companies yet. Create one here to start tracking investors for a company.
            </p>
          ) : (
            <div className="space-y-2">
              {companies.map((c) => (
                <Link
                  key={c.id}
                  to={`/kyi/companies/${c.id}`}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover bg-muted"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {c.location}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {c.investor_count}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
