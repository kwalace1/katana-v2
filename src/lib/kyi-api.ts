/**
 * Know Your Investor (KYI) API client.
 *
 * Primary implementation: Supabase tables/functions (no separate KYI Flask app required).
 * Fallback: legacy KYI Flask API proxied at /api/kyi (for environments without Supabase).
 *
 * Leads are stored in a single platform pool (PLATFORM_CLIENT_ID). Any company's view
 * shows leads from that pool filtered by that company's geo (investors in their target area).
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Legacy KYI Flask app base URL.
// - When VITE_KYI_APP_URL is set (e.g. http://localhost:5000), we call its `/api/...` endpoints directly.
// - Otherwise we fall back to `/api/kyi`, which can be proxied by the host environment if needed.
const KYI_APP_URL =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: { VITE_KYI_APP_URL?: string } }).env?.VITE_KYI_APP_URL

const LEGACY_BASE = KYI_APP_URL ? `${KYI_APP_URL.replace(/\/$/, '')}/api` : '/api/kyi'

/** All imported leads live under this client; every company sees this pool filtered by their geo. */
export const PLATFORM_CLIENT_ID = 1

async function fetchJsonLegacy<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${LEGACY_BASE}${path}`, {
    headers: { Accept: 'application/json', ...(options?.headers as Record<string, string>) },
    ...options,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || res.statusText || 'KYI API error')
  }
  return res.json() as Promise<T>
}

// Minimal legacy company shape used for name-based mapping.
interface LegacyCompanyRef {
  id: number
  name: string
}

/** Resolve a legacy KYI company id by (case-insensitive) company name. */
async function resolveLegacyCompanyIdByName(companyName: string): Promise<number | null> {
  const trimmed = (companyName ?? '').trim()
  if (!trimmed) return null
  try {
    const companies = await fetchJsonLegacy<LegacyCompanyRef[]>('/companies')
    if (!Array.isArray(companies) || companies.length === 0) return null
    const target = trimmed.toLowerCase()
    const exact = companies.find((c) => (c.name ?? '').trim().toLowerCase() === target)
    if (exact) return exact.id
    const partial = companies.find((c) => (c.name ?? '').trim().toLowerCase().includes(target))
    return partial?.id ?? null
  } catch {
    return null
  }
}

// Simple haversine implementation for geo filtering (miles)
const EARTH_RADIUS_MILES = 3958.8

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_MILES * c
}

/** Paginated fetch – Supabase caps .select() at 1 000 rows by default. */
async function fetchAllLeads(): Promise<Record<string, unknown>[]> {
  const PAGE = 1000
  const all: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('kyi_investor_leads')
      .select('*')
      .eq('client_id', PLATFORM_CLIENT_ID)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message || 'Failed to load leads')
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

// Geocoding: Open-Meteo only (CORS-supported in browser). Do not use Nominatim from the
// client — it blocks cross-origin requests, which causes "Geocode now" to fail in the console.
const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com'

/** Open-Meteo: empty or 1 char returns nothing; 2 chars = exact only; 3+ = fuzzy. Use countryCode to narrow. */
async function geocodeLocationLabel(
  label: string,
  countryCode?: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = (label ?? '').trim().replace(/^,\s*|\s*,$/g, '').trim()
  if (trimmed.length < 3) return null
  try {
    const params = new URLSearchParams({
      name: trimmed,
      count: '1',
      language: 'en',
      format: 'json',
    })
    if (countryCode) params.set('countryCode', countryCode)
    const url = `${OPEN_METEO_GEOCODE}/v1/search?${params.toString()}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ latitude?: number; longitude?: number }> }
    const first = Array.isArray(data.results) && data.results.length > 0 ? data.results[0] : undefined
    if (first?.latitude == null || first?.longitude == null) return null
    return { lat: first.latitude, lng: first.longitude }
  } catch {
    return null
  }
}

async function geocodeCityState(city: string | null, state: string | null): Promise<{ lat: number; lng: number } | null> {
  const c = (city ?? '').trim()
  const s = (state ?? '').trim()
  if (!c && !s) return null
  // Prefer "City, ST" with US filter (KYI data is US-focused: FEC, SEC)
  const query = c && s ? `${c}, ${s}` : c || s
  let result = await geocodeLocationLabel(query, 'US')
  if (!result && c && s) result = await geocodeLocationLabel(c, 'US')
  return result
}

/** Parse US-style address to city, state, ZIP for fallback geocoding (Open-Meteo prefers city/postal over full street). */
function parseAddressForGeocode(address: string): { city?: string; state?: string; zip?: string } {
  const parts = (address ?? '')
    .trim()
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return {}
  const last = parts[parts.length - 1]
  const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/) ?? last.match(/^([A-Za-z]{2})\s*$/)
  const state = stateZip?.[1]
  const zip = stateZip?.[2]
  const city = parts.length >= 2 ? parts[parts.length - 2] : undefined
  return { city, state, zip }
}

/** Geocode a free-form location (full address or "City, ST"). Tries full string, then "City, ST", then ZIP. */
async function geocodeAddressOrLabel(label: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = (label ?? '').trim()
  if (trimmed.length < 3) return null
  let result = await geocodeLocationLabel(trimmed, 'US')
  if (result) return result
  const { city, state, zip } = parseAddressForGeocode(trimmed)
  if (city && state) result = await geocodeLocationLabel(`${city}, ${state}`, 'US')
  if (!result && zip) result = await geocodeLocationLabel(zip, 'US')
  if (!result && city) result = await geocodeLocationLabel(city, 'US')
  return result
}

export interface KYICompany {
  id: number
  name: string
  location: string | null
  industry: string | null
  website: string | null
  logo_url: string | null
  investor_count: number
}

export interface KYIInvestor {
  id: number
  full_name: string
  firm: string | null
  title: string | null
  location: string | null
  industry: string | null
  profile_url: string | null
  notes: string | null
  created_at: string | null
  investor_type: string | null
}

export interface KYICompanyDetail extends KYICompany {
  description: string | null
  created_at: string | null
}

// ---------------------------------------------------------------------------
// Companies & investors
// ---------------------------------------------------------------------------

export async function getCompanies(): Promise<KYICompany[]> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<KYICompany[]>('/companies')
  }

  const { data, error } = await supabase
    .from('kyi_companies_with_counts')
    .select('id, name, location, industry, website, logo_url, investor_count')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load KYI companies')
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    investor_count: (row.investor_count as number) ?? 0,
  }))
}

export async function createCompany(data: {
  name: string
  location?: string
  industry?: string
  website?: string
  description?: string
}): Promise<KYICompany> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<KYICompany>('/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  const payload = {
    name: data.name.trim(),
    location: data.location?.trim() || null,
    industry: data.industry?.trim() || null,
    website: data.website?.trim() || null,
    description: data.description?.trim() || null,
  }

  const { data: row, error } = await supabase
    .from('kyi_companies')
    .insert(payload)
    .select('id, name, location, industry, website, logo_url, description, created_at')
    .single()

  if (error || !row) {
    throw new Error(error?.message || 'Failed to create KYI company')
  }

  return {
    id: row.id as number,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    investor_count: 0,
  }
}

export async function deleteCompany(companyId: number): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<{ success: boolean }>(`/companies/${companyId}`, { method: 'DELETE' })
  }

  if (companyId === 1) {
    throw new Error('Cannot delete the Default Company')
  }

  const { error: moveError } = await supabase
    .from('kyi_investors')
    .update({ company_id: 1 })
    .eq('company_id', companyId)

  if (moveError) {
    throw new Error(moveError.message || 'Failed to move investors before deleting company')
  }

  const { error: deleteError } = await supabase.from('kyi_companies').delete().eq('id', companyId)
  if (deleteError) {
    throw new Error(deleteError.message || 'Failed to delete company')
  }

  return { success: true }
}

export async function getCompany(companyId: number): Promise<KYICompanyDetail> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<KYICompanyDetail>(`/companies/${companyId}`)
  }

  const { data: row, error } = await supabase
    .from('kyi_companies_with_counts')
    .select('id, name, location, industry, website, description, logo_url, created_at, investor_count')
    .eq('id', companyId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load KYI company')
  }
  if (!row) {
    throw new Error('Company not found')
  }

  return {
    id: row.id as number,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    investor_count: (row.investor_count as number) ?? 0,
  }
}

export async function getCompanyInvestors(companyId: number): Promise<KYIInvestor[]> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<KYIInvestor[]>(`/companies/${companyId}/investors`)
  }

  const { data, error } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm, title, location, industry, profile_url, notes, created_at, investor_type')
    .eq('company_id', companyId)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load investors')
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row): KYIInvestor => ({
    id: row.id as number,
    full_name: row.full_name as string,
    firm: (row.firm as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    profile_url: (row.profile_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    investor_type: (row.investor_type as string | null) ?? null,
  }))
}

export async function createInvestor(data: {
  company_id: number
  full_name: string
  email?: string
  phone?: string
  location?: string
  industry?: string
  firm?: string
  title?: string
  profile_url?: string
  notes?: string
}): Promise<KYIInvestor> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<KYIInvestor>('/investors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  const now = new Date().toISOString()
  const payload = {
    company_id: data.company_id,
    full_name: data.full_name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    location: data.location?.trim() || null,
    industry: data.industry?.trim() || null,
    firm: data.firm?.trim() || null,
    title: data.title?.trim() || null,
    profile_url: data.profile_url?.trim() || null,
    notes: data.notes?.trim() || null,
    created_at: now,
    updated_at: now,
  }

  const { data: row, error } = await supabase
    .from('kyi_investors')
    .insert(payload)
    .select('id, full_name, firm, title, location, industry, profile_url, notes, created_at, investor_type')
    .single()

  if (error || !row) {
    throw new Error(error?.message || 'Failed to create investor')
  }

  const r = row as Record<string, unknown>
  const investor: KYIInvestor = {
    id: r.id as number,
    full_name: r.full_name as string,
    firm: (r.firm as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    industry: (r.industry as string | null) ?? null,
    profile_url: (r.profile_url as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    investor_type: (r.investor_type as string | null) ?? null,
  }
  return investor
}

/** Reference API: suggestion shape (REFERENCE_Suggested_Investors.md) */
export interface SuggestedInvestorRef {
  name: string
  position?: string
  location?: string
  score?: number
  source?: string
  sources?: string[]
  signals?: string[]
  reasons?: string[]
  profile_url?: string
  firm?: string
  related_investors: Array<{ id: number; name: string; firm?: string; reasons?: string[] }>
}

/** Reference API: existing_investors shape */
export interface ExistingInvestorRef {
  id: number
  full_name: string
  firm?: string
  title?: string
  location?: string
  industry?: string
}

/** Reference API: response shape (REFERENCE_Suggested_Investors.md) */
export interface SuggestedInvestorsResponseRef {
  company_name: string
  existing_investors: ExistingInvestorRef[]
  suggested_count: number
  multi_investor_count: number
  firms: Record<string, SuggestedInvestorRef[]>
  suggestions: SuggestedInvestorRef[]
  investor_suggestions?: Record<string, { investor: ExistingInvestorRef; count: number; suggestions: SuggestedInvestorRef[] }>
}

/** Legacy shape (for backward compatibility); normalized to Ref in getSuggestedInvestors */
export interface SuggestedInvestor {
  name: string
  firm?: string
  position?: string
  location?: string
  score?: number
  reasons?: string[]
  sources?: string[]
  signals?: string[]
  related_investors?: Array<{ name: string; id?: number; reasons?: string[]; firm?: string }>
}

export interface SuggestedInvestorsResponse {
  company_name?: string
  investors?: Array<{ id: number; name: string; full_name?: string; firm?: string; label?: string }>
  existing_investors?: ExistingInvestorRef[]
  suggestions: SuggestedInvestor[] | SuggestedInvestorRef[]
  suggested_count?: number
  multi_investor_count?: number
  firms?: Record<string, SuggestedInvestor[] | SuggestedInvestorRef[]>
  investor_suggestions?: Record<string, { count: number; suggestions: SuggestedInvestor[] }>
}

function normalizeToRef(raw: SuggestedInvestorsResponse): SuggestedInvestorsResponseRef {
  const existing = raw.existing_investors ?? (raw.investors ?? []).map((inv) => ({
    id: inv.id,
    full_name: inv.full_name ?? inv.name,
    firm: inv.firm,
    title: undefined,
    location: undefined,
    industry: undefined,
  }))
  const suggestions = (raw.suggestions ?? []).map((s) => {
    const r = s as SuggestedInvestor & SuggestedInvestorRef
    return {
      name: r.name,
      position: r.position ?? '',
      location: r.location ?? '',
      score: r.score ?? 0,
      source: r.source ?? 'public_records',
      sources: r.sources ?? [],
      signals: Array.isArray(r.signals) ? r.signals : [],
      reasons: r.reasons ?? [],
      profile_url: r.profile_url ?? '',
      firm: r.firm ?? '(Unknown Firm)',
      related_investors: (r.related_investors ?? []).map((rel) => ({
        id: rel.id ?? 0,
        name: rel.name,
        firm: rel.firm,
        reasons: rel.reasons ?? [],
      })),
    } as SuggestedInvestorRef
  })
  return {
    company_name: raw.company_name ?? '',
    existing_investors: existing,
    suggested_count: raw.suggested_count ?? suggestions.length,
    multi_investor_count:
      raw.multi_investor_count ?? suggestions.filter((s) => (s.related_investors?.length ?? 0) >= 2).length,
    firms: (raw.firms as Record<string, SuggestedInvestorRef[]>) ?? {},
    suggestions,
  }
}

export async function getSuggestedInvestors(companyId: number): Promise<SuggestedInvestorsResponseRef> {
  // Pure legacy (no Supabase): use numeric id directly.
  if (!isSupabaseConfigured) {
    const raw = await fetchJsonLegacy<SuggestedInvestorsResponse>(`/companies/${companyId}/suggested-investors`)
    return normalizeToRef(raw)
  }

  // Supabase-backed: load company + investors first so we can keep
  // `existing_investors` in sync with the Supabase KYI module.
  const company = await getCompany(companyId)
  const investors = await getCompanyInvestors(companyId)

  const existing_investors: ExistingInvestorRef[] = (investors ?? []).map((inv) => ({
    id: inv.id,
    full_name: inv.full_name,
    firm: inv.firm ?? undefined,
    title: inv.title ?? undefined,
    location: inv.location ?? undefined,
    industry: inv.industry ?? undefined,
  }))

  // When a legacy KYI app is running with a richer public-records graph,
  // map by company name so Supabase company "DW Griffin Capital" lines up
  // with the same company in the legacy database even if ids differ.
  try {
    const legacyCompanyId = await resolveLegacyCompanyIdByName(company.name)
    if (legacyCompanyId != null) {
      const raw = await fetchJsonLegacy<SuggestedInvestorsResponse>(
        `/companies/${legacyCompanyId}/suggested-investors`,
      )
      const ref = normalizeToRef(raw)
      return {
        ...ref,
        company_name: company.name,
        existing_investors,
      }
    }
  } catch {
    // Ignore and fall back to Supabase-only stub below.
  }

  // Supabase-only fallback: no cross-app suggestions yet.
  return {
    company_name: company.name,
    existing_investors,
    suggested_count: 0,
    multi_investor_count: 0,
    firms: {},
    suggestions: [],
  }
}

// Investor overlap (Overlap View)
export interface InvestorOverlapConnection {
  name: string
  id?: number
  reasons?: string[]
}

export interface MultiInvestorSuggestion {
  label: string
  name?: string
  firm?: string
  position?: string
  location?: string
  score?: number
  connection_count: number
  connected_to: InvestorOverlapConnection[]
}

export interface InvestorOverlapResponse {
  investors: Array<{ id: number; label: string; name?: string; node_type?: string }>
  multi_investor_suggestions: MultiInvestorSuggestion[]
  matrix?: Record<string, number[]>
}

export async function getInvestorOverlap(companyId: number): Promise<InvestorOverlapResponse> {
  // Pure legacy (no Supabase): use numeric id directly.
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<InvestorOverlapResponse>(`/companies/${companyId}/investor-overlap`)
  }

  // Supabase-backed: map by company name into the legacy KYI app when present.
  try {
    const company = await getCompany(companyId)
    const legacyCompanyId = await resolveLegacyCompanyIdByName(company.name)
    if (legacyCompanyId != null) {
      return await fetchJsonLegacy<InvestorOverlapResponse>(`/companies/${legacyCompanyId}/investor-overlap`)
    }
  } catch {
    // Ignore and fall back to simple Supabase-only result below.
  }

  const { data: investors, error } = await supabase
    .from('kyi_investors')
    .select('id, full_name')
    .eq('company_id', companyId)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for overlap')
  }

  return {
    investors: (investors ?? []).map((inv) => ({
      id: inv.id as number,
      label: inv.full_name as string,
      name: inv.full_name as string,
    })),
    multi_investor_suggestions: [],
  }
}

// Geo targeting
export interface GeoSettings {
  location_label: string
  center_lat: number
  center_lng: number
  radius_miles: number
  bbox_min_lat: number
  bbox_max_lat: number
  bbox_min_lng: number
  bbox_max_lng: number
  updated_at: string
}

export interface GeoSettingsResponse {
  configured: boolean
  client_id: number
  client_name: string
  message?: string
  settings?: GeoSettings
}

export async function getGeoSettings(clientId: number): Promise<GeoSettingsResponse> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<GeoSettingsResponse>(`/clients/${clientId}/geo-settings`)
  }

  const [{ data: company, error: companyError }, { data: settingsRow, error: settingsError }] = await Promise.all([
    supabase.from('kyi_companies').select('id, name').eq('id', clientId).maybeSingle(),
    supabase.from('kyi_client_geo_settings').select('*').eq('client_id', clientId).maybeSingle(),
  ])

  if (companyError) {
    throw new Error(companyError.message || 'Failed to load KYI company')
  }

  const client_name = (company?.name as string) ?? ''

  if (settingsError && settingsError.code !== 'PGRST116') {
    throw new Error(settingsError.message || 'Failed to load geo settings')
  }

  if (!settingsRow) {
    return {
      configured: false,
      client_id: clientId,
      client_name,
      message: 'Geo targeting not configured.',
    }
  }

  const settings: GeoSettings = {
    location_label: settingsRow.location_label as string,
    center_lat: settingsRow.center_lat as number,
    center_lng: settingsRow.center_lng as number,
    radius_miles: settingsRow.radius_miles as number,
    bbox_min_lat: settingsRow.bbox_min_lat as number,
    bbox_max_lat: settingsRow.bbox_max_lat as number,
    bbox_min_lng: settingsRow.bbox_min_lng as number,
    bbox_max_lng: settingsRow.bbox_max_lng as number,
    updated_at: (settingsRow.updated_at as string) ?? new Date().toISOString(),
  }

  return {
    configured: true,
    client_id: clientId,
    client_name,
    settings,
  }
}

export async function updateGeoSettings(
  clientId: number,
  data: { location_label: string; radius_miles: number },
): Promise<{
  success: boolean
  settings: GeoSettings
}> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy(`/clients/${clientId}/geo-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  const locationLabel = data.location_label.trim()
  if (!locationLabel) {
    throw new Error('Location is required')
  }

  const radius = data.radius_miles || 50

  const coords = await geocodeAddressOrLabel(locationLabel)
  if (!coords) {
    throw new Error('Could not geocode location. Try a different city/state or address.')
  }

  const center_lat = coords.lat
  const center_lng = coords.lng

  const latDelta = radius / 69 // ~69 miles per degree latitude
  const lngDelta = radius / (Math.cos(toRadians(center_lat)) * 69 || 69)

  const bbox_min_lat = center_lat - latDelta
  const bbox_max_lat = center_lat + latDelta
  const bbox_min_lng = center_lng - lngDelta
  const bbox_max_lng = center_lng + lngDelta

  const now = new Date().toISOString()

  const { data: row, error } = await supabase
    .from('kyi_client_geo_settings')
    .upsert(
      {
        client_id: clientId,
        location_label: locationLabel,
        center_lat,
        center_lng,
        radius_miles: radius,
        bbox_min_lat,
        bbox_max_lat,
        bbox_min_lng,
        bbox_max_lng,
        updated_at: now,
      },
      { onConflict: 'client_id' },
    )
    .select('*')
    .single()

  if (error || !row) {
    throw new Error(error?.message || 'Failed to save geo settings')
  }

  const settings: GeoSettings = {
    location_label: locationLabel,
    center_lat,
    center_lng,
    radius_miles: radius,
    bbox_min_lat,
    bbox_max_lat,
    bbox_min_lng,
    bbox_max_lng,
    updated_at: now,
  }

  return { success: true, settings }
}

// Per-investor geo settings
export async function getInvestorGeoSettings(investorId: number): Promise<GeoSettingsResponse> {
  if (!isSupabaseConfigured) {
    return { configured: false, client_id: investorId, client_name: '', message: 'Not configured' }
  }

  const { data: settingsRow, error } = await supabase
    .from('kyi_investor_geo_settings')
    .select('*')
    .eq('investor_id', investorId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message || 'Failed to load investor geo settings')
  }

  if (!settingsRow) {
    return {
      configured: false,
      client_id: investorId,
      client_name: '',
      message: 'Geo targeting not configured for this investor.',
    }
  }

  return {
    configured: true,
    client_id: investorId,
    client_name: '',
    settings: {
      location_label: settingsRow.location_label as string,
      center_lat: settingsRow.center_lat as number,
      center_lng: settingsRow.center_lng as number,
      radius_miles: settingsRow.radius_miles as number,
      bbox_min_lat: settingsRow.bbox_min_lat as number,
      bbox_max_lat: settingsRow.bbox_max_lat as number,
      bbox_min_lng: settingsRow.bbox_min_lng as number,
      bbox_max_lng: settingsRow.bbox_max_lng as number,
      updated_at: (settingsRow.updated_at as string) ?? new Date().toISOString(),
    },
  }
}

export async function updateInvestorGeoSettings(
  investorId: number,
  data: { location_label: string; radius_miles: number },
): Promise<{ success: boolean; settings: GeoSettings }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const locationLabel = data.location_label.trim()
  if (!locationLabel) throw new Error('Location is required')

  const radius = data.radius_miles || 50
  const coords = await geocodeAddressOrLabel(locationLabel)
  if (!coords) throw new Error('Could not geocode location. Try a different city/state or address.')

  const center_lat = coords.lat
  const center_lng = coords.lng
  const latDelta = radius / 69
  const lngDelta = radius / (Math.cos(toRadians(center_lat)) * 69 || 69)
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('kyi_investor_geo_settings')
    .upsert(
      {
        investor_id: investorId,
        location_label: locationLabel,
        center_lat,
        center_lng,
        radius_miles: radius,
        bbox_min_lat: center_lat - latDelta,
        bbox_max_lat: center_lat + latDelta,
        bbox_min_lng: center_lng - lngDelta,
        bbox_max_lng: center_lng + lngDelta,
        updated_at: now,
      },
      { onConflict: 'investor_id' },
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message || 'Failed to save investor geo settings')

  return {
    success: true,
    settings: {
      location_label: locationLabel,
      center_lat,
      center_lng,
      radius_miles: radius,
      bbox_min_lat: center_lat - latDelta,
      bbox_max_lat: center_lat + latDelta,
      bbox_min_lng: center_lng - lngDelta,
      bbox_max_lng: center_lng + lngDelta,
      updated_at: now,
    },
  }
}

// Leads (localized leads)
export interface KYILead {
  id: number
  client_id: number
  entity_type: 'person' | 'firm'
  display_name: string
  city: string | null
  state: string | null
  zip_code: string | null
  lat: number | null
  lng: number | null
  raw_score: number
  tags?: string[]
  signals?: {
    sec_form_d?: boolean
    sec_13f?: boolean
    fec_donor?: boolean
    [key: string]: unknown
  }
}

export interface LeadsListResponse {
  client_id: number
  total_count: number
  filtered_count: number
  displayed_count: number
  needs_geocoding_count: number
  thinning_mode: string
  leads: KYILead[]
}

export async function getLeads(
  clientId: number,
  opts?: { thinning?: string; min_score?: number | null },
): Promise<LeadsListResponse> {
  if (!isSupabaseConfigured) {
    const params = new URLSearchParams()
    if (opts?.thinning) params.set('thinning', opts.thinning)
    if (typeof opts?.min_score === 'number') params.set('min_score', String(opts.min_score))
    const qs = params.toString()
    const path = `/clients/${clientId}/leads${qs ? `?${qs}` : ''}`
    return fetchJsonLegacy<LeadsListResponse>(path)
  }

  const thinningMode = opts?.thinning || 'top_10_percent'
  const minScore = typeof opts?.min_score === 'number' ? opts.min_score : null

  // Fetch from platform pool so any company sees the same lead set, filtered by their geo
  let leadsRaw = await fetchAllLeads()

  // When Supabase has no leads, try legacy KYI API so data still shows during transition
  if (leadsRaw.length === 0) {
    try {
      const params = new URLSearchParams()
      if (opts?.thinning) params.set('thinning', opts.thinning)
      if (typeof opts?.min_score === 'number') params.set('min_score', String(opts.min_score))
      const qs = params.toString()
      const path = `/clients/${clientId}/leads${qs ? `?${qs}` : ''}`
      const legacy = await fetchJsonLegacy<LeadsListResponse>(path)
      if (legacy.leads?.length !== undefined && legacy.leads.length > 0) {
        return legacy
      }
    } catch {
      // Legacy API not available; continue with empty result
    }
  }

  const leads: KYILead[] = leadsRaw.map((row: Record<string, unknown>) => ({
    id: row.id as number,
    client_id: row.client_id as number,
    entity_type: (row.entity_type as 'person' | 'firm') ?? 'person',
    display_name: row.display_name as string,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    zip_code: (row.zip_code as string | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    raw_score: (row.raw_score as number | null) ?? 0,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    signals: (row.signals as KYILead['signals']) ?? undefined,
  }))

  const total_count = leads.length
  const needs_geocoding_count = leads.filter(
    (l) => (!l.lat || !l.lng) && !!(l.city && l.city.trim() !== ''),
  ).length

  // Apply geo filtering if geo settings exist
  let geoFiltered = leads
  const { data: geoRow, error: geoError } = await supabase
    .from('kyi_client_geo_settings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (geoError && geoError.code !== 'PGRST116') {
    // eslint-disable-next-line no-console
    console.warn('Failed to load KYI geo settings for leads:', geoError)
  }

  if (geoRow) {
    const centerLat = geoRow.center_lat as number
    const centerLng = geoRow.center_lng as number
    const radius = (geoRow.radius_miles as number) ?? 50
    geoFiltered = leads.filter(
      (l) =>
        l.lat != null &&
        l.lng != null &&
        distanceMiles(l.lat, l.lng, centerLat, centerLng) <= radius,
    )
  }

  // Apply min_score
  let scored = geoFiltered
  if (minScore != null) {
    scored = scored.filter((l) => l.raw_score >= minScore)
  }

  // Sort by score desc
  scored = [...scored].sort((a, b) => b.raw_score - a.raw_score)

  // Thinning
  let displayed = scored
  if (thinningMode !== 'all') {
    const total = scored.length
    let percentCount = total
    if (thinningMode === 'top_10_percent') {
      percentCount = Math.max(1, Math.floor(total * 0.1))
    } else if (thinningMode === 'top_25_percent') {
      percentCount = Math.max(1, Math.floor(total * 0.25))
    } else if (thinningMode === 'top_50_percent') {
      percentCount = Math.max(1, Math.floor(total * 0.5))
    }
    const minimumCount = 50
    const cutoff = Math.max(percentCount, minimumCount)
    displayed = scored.slice(0, cutoff)
  }

  return {
    client_id: clientId,
    total_count,
    filtered_count: scored.length,
    displayed_count: displayed.length,
    needs_geocoding_count,
    thinning_mode: thinningMode,
    leads: displayed,
  }
}

export async function getLeadsForInvestor(
  investorId: number,
  opts?: { thinning?: string; min_score?: number | null },
): Promise<LeadsListResponse> {
  if (!isSupabaseConfigured) {
    return { client_id: investorId, total_count: 0, filtered_count: 0, displayed_count: 0, needs_geocoding_count: 0, thinning_mode: opts?.thinning || 'top_10_percent', leads: [] }
  }

  const thinningMode = opts?.thinning || 'top_10_percent'
  const minScore = typeof opts?.min_score === 'number' ? opts.min_score : null

  let leadsRaw = await fetchAllLeads()

  if (leadsRaw.length === 0) {
    try {
      const params = new URLSearchParams()
      if (opts?.thinning) params.set('thinning', opts.thinning)
      if (typeof opts?.min_score === 'number') params.set('min_score', String(opts.min_score))
      const qs = params.toString()
      const legacy = await fetchJsonLegacy<LeadsListResponse>(`/clients/1/leads${qs ? `?${qs}` : ''}`)
      if (legacy.leads?.length > 0) return legacy
    } catch { /* ignore */ }
  }

  const leads: KYILead[] = leadsRaw.map((row: Record<string, unknown>) => ({
    id: row.id as number,
    client_id: row.client_id as number,
    entity_type: (row.entity_type as 'person' | 'firm') ?? 'person',
    display_name: row.display_name as string,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    zip_code: (row.zip_code as string | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    raw_score: (row.raw_score as number | null) ?? 0,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    signals: (row.signals as KYILead['signals']) ?? undefined,
  }))

  const total_count = leads.length
  const needs_geocoding_count = leads.filter(
    (l) => (!l.lat || !l.lng) && !!(l.city && l.city.trim() !== ''),
  ).length

  let geoFiltered = leads
  const { data: geoRow, error: geoError } = await supabase
    .from('kyi_investor_geo_settings')
    .select('*')
    .eq('investor_id', investorId)
    .maybeSingle()

  if (geoError && geoError.code !== 'PGRST116') {
    // eslint-disable-next-line no-console
    console.warn('Failed to load investor geo settings for leads:', geoError)
  }

  if (geoRow) {
    const centerLat = geoRow.center_lat as number
    const centerLng = geoRow.center_lng as number
    const radius = (geoRow.radius_miles as number) ?? 50
    geoFiltered = leads.filter(
      (l) => l.lat != null && l.lng != null && distanceMiles(l.lat, l.lng, centerLat, centerLng) <= radius,
    )
  }

  let scored = geoFiltered
  if (minScore != null) scored = scored.filter((l) => l.raw_score >= minScore)
  scored = [...scored].sort((a, b) => b.raw_score - a.raw_score)

  let displayed = scored
  if (thinningMode !== 'all') {
    const total = scored.length
    let percentCount = total
    if (thinningMode === 'top_10_percent') percentCount = Math.max(1, Math.floor(total * 0.1))
    else if (thinningMode === 'top_25_percent') percentCount = Math.max(1, Math.floor(total * 0.25))
    else if (thinningMode === 'top_50_percent') percentCount = Math.max(1, Math.floor(total * 0.5))
    displayed = scored.slice(0, Math.max(percentCount, 50))
  }

  return {
    client_id: investorId,
    total_count,
    filtered_count: scored.length,
    displayed_count: displayed.length,
    needs_geocoding_count,
    thinning_mode: thinningMode,
    leads: displayed,
  }
}

export async function triggerRefreshNow(): Promise<{ success: boolean; message?: string }> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy('/admin/refresh-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return {
    success: true,
    message: 'Refresh is handled automatically in the Supabase-backed version.',
  }
}

// Prevent multiple geocode runs at once (e.g. double-click or Strict Mode)
let geocodeRunInProgress = false

/** UI reads this: processed = attempted, updated = saved; geocoded = Open-Meteo returned coords */
export const kyiGeocodeProgress = { processed: 0, updated: 0, geocoded: 0, batchSize: 0, done: false }

const GEOCODE_BATCH_SIZE = 100
const GEOCODE_DELAY_MS = 80

export async function triggerGeocodeNow(clientId: number): Promise<{ success: boolean; message?: string }> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy('/admin/geocode-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (geocodeRunInProgress) {
    return {
      success: false,
      message: 'A geocode run is already in progress. Wait for it to finish, then click again for the next batch.',
    }
  }

  geocodeRunInProgress = true

  // Process only a batch per run so the UI can show progress and the network tab doesn’t flood.
  kyiGeocodeProgress.processed = 0
  kyiGeocodeProgress.updated = 0
  kyiGeocodeProgress.geocoded = 0
  kyiGeocodeProgress.batchSize = GEOCODE_BATCH_SIZE
  kyiGeocodeProgress.done = false

  const emit = (processed: number, updated: number, geocoded: number, batchSize: number, done: boolean) => {
    kyiGeocodeProgress.processed = processed
    kyiGeocodeProgress.updated = updated
    kyiGeocodeProgress.geocoded = geocoded
    try {
      window.dispatchEvent(new CustomEvent('kyi-geocode-tick', { detail: { processed, updated, geocoded, batchSize, done } }))
    } catch {
      /* noop */
    }
  }

  ;(async () => {
    try {
      const { data: batch, error } = await supabase
        .from('kyi_investor_leads')
        .select('id, client_id, city, state, lat, lng')
        .eq('client_id', PLATFORM_CLIENT_ID)
        .is('lat', null)
        .not('city', 'is', null)
        .order('id', { ascending: true })
        .range(0, GEOCODE_BATCH_SIZE - 1)

      if (error || !batch) {
        console.error('Failed to load leads needing geocoding:', error)
        kyiGeocodeProgress.done = true
        return
      }

      let processed = 0
      let updated = 0
      let geocoded = 0
      let failed = 0

      for (const row of batch) {
        const city = (row.city as string | null) ?? null
        const state = (row.state as string | null) ?? null
        if (!city && !state) continue

        const result = await geocodeCityState(city, state)
        if (!result) {
          processed += 1
          emit(processed, updated, geocoded, batch.length, false)
          await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS))
          continue
        }

        geocoded += 1
        const { error: updateError } = await supabase
          .from('kyi_investor_leads')
          .update({ lat: result.lat, lng: result.lng, updated_at: new Date().toISOString() })
          .eq('id', row.id)

        processed += 1
        if (updateError) {
          failed += 1
          console.warn('Geocode update failed for lead', row.id, updateError.message)
        } else {
          updated += 1
        }
        emit(processed, updated, geocoded, batch.length, false)

        await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS))
      }

      kyiGeocodeProgress.done = true
      emit(processed, updated, geocoded, batch.length, true)
      if (geocoded === 0 && batch.length > 0) {
        const first = batch[0] as { city?: string | null; state?: string | null }
        const c = (first?.city ?? '').trim()
        const s = (first?.state ?? '').trim()
        const sampleQuery = c && s ? `${c}, ${s}` : c || s
        const sampleUrl =
          sampleQuery.length >= 3
            ? `${OPEN_METEO_GEOCODE}/v1/search?${new URLSearchParams({ name: sampleQuery, count: '1', language: 'en', format: 'json', countryCode: 'US' }).toString()}`
            : null
        console.warn(
          'KYI geocode: Open-Meteo returned no results for all leads. First lead city/state:',
          JSON.stringify({ city: first?.city ?? null, state: first?.state ?? null }),
          sampleUrl ? `— try in browser: ${sampleUrl}` : '(query too short: need 3+ chars)'
        )
      } else if (updated === 0 && geocoded > 0) {
        console.warn('KYI geocode: Open-Meteo returned coords but all Supabase updates failed. Check RLS on kyi_investor_leads and anon key UPDATE permission.')
      }
      if (updated > 0 || failed > 0) {
        console.log(`Geocode batch done: ${geocoded} geocoded, ${updated} saved, ${failed} update failed (of ${batch.length}).`)
      }
    } catch (e) {
      console.error('Error during KYI client-side geocoding:', e)
      kyiGeocodeProgress.done = true
    } finally {
      geocodeRunInProgress = false
    }
  })()

  return {
    success: true,
    message: `Geocoding up to ${GEOCODE_BATCH_SIZE} leads. Progress updates every few seconds; click “Geocode now” again for the next batch if needed.`,
  }
}

// Access Map (orbit / solar network)
export interface AccessMapNode {
  id: number
  company_id: number
  node_type: 'investor' | 'person' | 'org'
  label: string
  meta_json?: string
  meta?: Record<string, unknown>
}

export interface AccessMapEdge {
  id?: number
  from_node_id: number
  to_node_id: number
  edge_type: string
  weight: number
}

export interface AccessMapOverlap {
  unique_people_count: number
  unique_org_count: number
  overlap_people_count: number
  overlap_org_count: number
  overlap_percentage: number
  top_overlapping_people: Array<{ label: string; count: number }>
  top_overlapping_orgs: Array<{ label: string; count: number }>
}

export interface AccessMapResponse {
  nodes: AccessMapNode[]
  edges: AccessMapEdge[]
  metrics: { node_count?: number; edge_count?: number; investor_count?: number; person_count?: number; org_count?: number }
  overlap: AccessMapOverlap
}

export async function getAccessMap(companyId: number): Promise<AccessMapResponse> {
  // Pure legacy (no Supabase): use numeric id directly.
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<AccessMapResponse>(`/companies/${companyId}/access-map`)
  }

  // Supabase-backed: map by company name into the legacy KYI app when present.
  try {
    const company = await getCompany(companyId)
    const legacyCompanyId = await resolveLegacyCompanyIdByName(company.name)
    if (legacyCompanyId != null) {
      return await fetchJsonLegacy<AccessMapResponse>(`/companies/${legacyCompanyId}/access-map`)
    }
  } catch {
    // Ignore and fall back to simple Supabase-only result below.
  }

  // Supabase fallback: basic empty access map; can be expanded later to use kyi_entities/location_claims.
  return {
    nodes: [],
    edges: [],
    metrics: {},
    overlap: {
      unique_people_count: 0,
      unique_org_count: 0,
      overlap_people_count: 0,
      overlap_org_count: 0,
      overlap_percentage: 0,
      top_overlapping_people: [],
      top_overlapping_orgs: [],
    },
  }
}

export interface SolarNodeConnection {
  center: AccessMapNode | null
  connections: AccessMapNode[]
  edges: AccessMapEdge[]
}

export async function getSolarNetworkNode(companyId: number, nodeId: number): Promise<SolarNodeConnection> {
  // Prefer full solar-network view from legacy KYI when available.
  try {
    return await fetchJsonLegacy<SolarNodeConnection>(`/companies/${companyId}/solar-network/${nodeId}`)
  } catch (legacyError) {
    if (!isSupabaseConfigured) {
      throw legacyError instanceof Error ? legacyError : new Error('Failed to load solar network node')
    }
  }

  // Supabase fallback: no solar network edges yet.
  return {
    center: null,
    connections: [],
    edges: [],
  }
}

export async function getSolarNetworkInvestors(companyId: number): Promise<{ investors: AccessMapNode[] }> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<{ investors: AccessMapNode[] }>(`/companies/${companyId}/solar-network/investors`)
  }

  const { data, error } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm')
    .eq('company_id', companyId)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for solar network')
  }

  const investors: AccessMapNode[] = (data ?? []).map((row) => ({
    id: row.id as number,
    company_id: companyId,
    node_type: 'investor',
    label: row.full_name as string,
    meta_json: JSON.stringify({
      firm: (row.firm as string | null) ?? undefined,
    }),
  }))

  return { investors }
}

// Investor profile (full detail + suggestions)
export interface KYIInvestorDetail extends KYIInvestor {
  company_id: number | null
  email: string | null
  phone: string | null
  company?: { id: number; name: string } | null
  connection_count?: number
}

export async function getInvestor(investorId: number): Promise<KYIInvestorDetail> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<KYIInvestorDetail>(`/investors/${investorId}`)
  }

  const { data: investor, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('id', investorId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load investor')
  }
  if (!investor) {
    throw new Error('Investor not found')
  }

  const inv = investor as Record<string, unknown>
  const companyId = inv.company_id as number | null
  let company: { id: number; name: string } | null = null

  if (companyId != null) {
    const { data: companyRow } = await supabase
      .from('kyi_companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle()
    if (companyRow) {
      company = { id: companyRow.id as number, name: companyRow.name as string }
    }
  }

  const detail: KYIInvestorDetail = {
    id: inv.id as number,
    full_name: inv.full_name as string,
    firm: (inv.firm as string | null) ?? null,
    title: (inv.title as string | null) ?? null,
    location: (inv.location as string | null) ?? null,
    industry: (inv.industry as string | null) ?? null,
    profile_url: (inv.profile_url as string | null) ?? null,
    notes: (inv.notes as string | null) ?? null,
    created_at: (inv.created_at as string | null) ?? null,
    investor_type: (inv.investor_type as string | null) ?? null,
    company_id: companyId,
    email: (inv.email as string | null) ?? null,
    phone: (inv.phone as string | null) ?? null,
    company,
    connection_count: 0,
  }
  return detail
}

export async function updateInvestor(
  investorId: number,
  data: Partial<{
    full_name: string
    email: string | null
    phone: string | null
    location: string | null
    industry: string | null
    firm: string | null
    title: string | null
    profile_url: string | null
    notes: string | null
  }>,
): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('kyi_investors')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', investorId)
  if (error) throw new Error(error.message || 'Failed to update investor')
}

export async function updateInvestorType(investorId: number, investorType: string | null): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('kyi_investors')
    .update({ investor_type: investorType, updated_at: new Date().toISOString() })
    .eq('id', investorId)
  if (error) throw new Error(error.message || 'Failed to update investor type')
}

export interface InvestorSuggestionsResponse {
  investor: { id: number; name: string; firm?: string; title?: string; location?: string; industry?: string }
  suggested_count: number
  firms: Record<string, SuggestedInvestor[]>
  suggestions: SuggestedInvestor[]
}

export async function getInvestorSuggestions(investorId: number): Promise<InvestorSuggestionsResponse> {
  // Prefer full per-investor suggestions from legacy KYI when available.
  try {
    return await fetchJsonLegacy<InvestorSuggestionsResponse>(`/investors/${investorId}/suggestions`)
  } catch (legacyError) {
    if (!isSupabaseConfigured) {
      throw legacyError instanceof Error ? legacyError : new Error('Failed to load investor suggestions')
    }
  }

  const detail = await getInvestor(investorId)
  return {
    investor: {
      id: detail.id,
      name: detail.full_name,
      firm: detail.firm ?? undefined,
      title: detail.title ?? undefined,
      location: detail.location ?? undefined,
      industry: detail.industry ?? undefined,
    },
    suggested_count: 0,
    firms: {},
    suggestions: [],
  }
}

// Cross-reference
export interface CrossReferenceInvestor {
  id: number
  full_name: string
  firm: string | null
  company_id: number | null
  company_name: string | null
  conn_count: number
}

export async function getCrossReferenceInvestors(): Promise<CrossReferenceInvestor[]> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<CrossReferenceInvestor[]>('/cross-reference/investors')
  }

  const { data, error } = await supabase.from('kyi_investors').select('id, full_name, firm, company_id')

  if (error) {
    throw new Error(error.message || 'Failed to load investors for cross-reference')
  }

  const companyNames = new Map<number, string>()
  if (data && data.length > 0) {
    const companyIds = Array.from(
      new Set(
        data
          .map((row) => row.company_id as number | null)
          .filter((id): id is number => typeof id === 'number'),
      ),
    )
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('kyi_companies')
        .select('id, name')
        .in('id', companyIds)
      for (const c of companies ?? []) {
        companyNames.set(c.id as number, c.name as string)
      }
    }
  }

  return (data ?? []).map((row) => {
    const cid = row.company_id as number | null
    return {
      id: row.id as number,
      full_name: row.full_name as string,
      firm: (row.firm as string | null) ?? null,
      company_id: cid,
      company_name: cid != null ? companyNames.get(cid) ?? null : null,
      conn_count: 0,
    }
  })
}

export interface CrossReferenceCompareResponse {
  investor_data: Record<
    number,
    { investor: KYIInvestorDetail; connections: unknown[]; people: string[]; companies: string[] }
  >
  overlapping_people: Record<string, number[]>
  shared_companies: Record<string, number[]>
  stats: {
    total_investors: number
    total_unique_people: number
    overlapping_people_count: number
    total_unique_companies: number
    shared_companies_count: number
  }
}

export async function postCrossReferenceCompare(investorIds: number[]): Promise<CrossReferenceCompareResponse> {
  if (!isSupabaseConfigured) {
    return fetchJsonLegacy<CrossReferenceCompareResponse>('/cross-reference/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investor_ids: investorIds }),
    })
  }

  const uniqueInvestorIds = Array.from(new Set(investorIds))
  const { data, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .in('id', uniqueInvestorIds)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for comparison')
  }

  const investor_data: CrossReferenceCompareResponse['investor_data'] = {}

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = row.id as number
    const detail: KYIInvestorDetail = {
      id,
      full_name: row.full_name as string,
      firm: (row.firm as string | null) ?? null,
      title: (row.title as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      industry: (row.industry as string | null) ?? null,
      profile_url: (row.profile_url as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      investor_type: (row.investor_type as string | null) ?? null,
      company_id: (row.company_id as number | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      company: undefined,
      connection_count: 0,
    }

    investor_data[id] = {
      investor: detail,
      connections: [],
      people: [],
      companies: [],
    }
  }

  return {
    investor_data,
    overlapping_people: {},
    shared_companies: {},
    stats: {
      total_investors: Object.keys(investor_data).length,
      total_unique_people: 0,
      overlapping_people_count: 0,
      total_unique_companies: 0,
      shared_companies_count: 0,
    },
  }
}

