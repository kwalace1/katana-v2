#!/usr/bin/env node
/**
 * KYI Import from data folder – sync leads into Supabase kyi_investor_leads.
 * All leads go into the platform pool (KYI_PLATFORM_CLIENT_ID, default 1). Any company
 * then sees these leads filtered by their own geo (investors in their target area).
 *
 * Usage (from zenith root):
 *   npm run kyi:import-data
 *
 * Data path: KYI_DATA_PATH or <zenith>/data (put fec_donors.csv, sec_13f.csv, kyi_nodes.csv, etc. there).
 * Re-run anytime to pull new data; existing names are skipped (append-only).
 *
 * Requires: csv-parse (npm install csv-parse --save-dev)
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env from project root
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const dataDir = process.env.KYI_DATA_PATH || path.resolve(process.cwd(), 'data/kyi')
// All leads go into the platform pool so any company can see them filtered by their geo
const clientId = parseInt(process.env.KYI_PLATFORM_CLIENT_ID || process.argv[2] || process.env.KYI_CLIENT_ID || '1', 10)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (or SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}

if (!fs.existsSync(dataDir)) {
  console.error('❌ KYI data directory not found:', dataDir)
  console.error('   Put CSVs in zenith data/kyi/ or set KYI_DATA_PATH to the folder containing fec_donors.csv, sec_13f.csv, etc.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })

// Score weights (match Python scoring)
const SCORE = {
  sec_form_d: 25,
  sec_13f: 25,
  fec_donor: 15,
  business_registry: 25,
  multi_2: 1.15,
  multi_3: 1.25,
  multi_4: 1.35,
}

function scoreLead(signals) {
  let base = 0
  const fired = []
  if (signals.sec_form_d) { base += SCORE.sec_form_d; fired.push('sec_form_d') }
  if (signals.sec_13f) { base += SCORE.sec_13f; fired.push('sec_13f') }
  if (signals.fec_donor) { base += SCORE.fec_donor; fired.push('fec_donor') }
  if (signals.business_registry) { base += SCORE.business_registry; fired.push('business_registry') }
  const mult = fired.length >= 4 ? SCORE.multi_4 : fired.length >= 3 ? SCORE.multi_3 : fired.length >= 2 ? SCORE.multi_2 : 1
  return Math.round(base * mult)
}

function normalizeName(name) {
  if (!name || !name.trim()) return ''
  let n = name.trim()
  if (n.includes(',')) {
    const [last, first] = n.split(',', 2).map((s) => s.trim())
    n = first && last ? `${first} ${last}` : n
  }
  return n.replace(/\b\w/g, (c) => c.toUpperCase())
}

// City cache for quick coords (subset of Python CITY_COORDINATES)
const CITY_COORDS = {
  'NEW YORK,NY': [40.7128, -74.006],
  'SAN FRANCISCO,CA': [37.7749, -122.4194],
  'BOSTON,MA': [42.3601, -71.0589],
  'AUSTIN,TX': [30.2672, -97.7431],
  'CHICAGO,IL': [41.8781, -87.6298],
  'SEATTLE,WA': [47.6062, -122.3321],
  'DENVER,CO': [39.7392, -104.9903],
  'MIAMI,FL': [25.7617, -80.1918],
  'CARMEL,CA': [36.5552, -121.9233],
  'KENILWORTH,IL': [42.0878, -87.7173],
  'WAIMANALO,HI': [21.3481, -157.71],
  'LOS ANGELES,CA': [34.0522, -118.2437],
  'PHILADELPHIA,PA': [39.9526, -75.1652],
  'WASHINGTON,DC': [38.9072, -77.0369],
  'NORTH BEND,OR': [43.4065, -124.2243],
}

function lookupCoords(city, state) {
  if (!city || !state) return null
  const key = `${city.toUpperCase().trim()},${state.toUpperCase().trim()}`
  return CITY_COORDS[key] || null
}

async function loadCsv(fileName) {
  const filepath = path.join(dataDir, fileName)
  if (!fs.existsSync(filepath)) return []
  const { parse } = await import('csv-parse/sync')
  const raw = fs.readFileSync(filepath, 'utf-8')
  return parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true })
}

async function getExistingNames() {
  const { data, error } = await supabase
    .from('kyi_investor_leads')
    .select('display_name')
    .eq('client_id', clientId)
  if (error) throw error
  return new Set((data || []).map((r) => (r.display_name || '').toLowerCase()))
}

function buildLead(row) {
  const now = new Date().toISOString()
  return {
    client_id: clientId,
    entity_type: row.entity_type || 'person',
    display_name: row.display_name,
    street_address: row.street_address || null,
    city: row.city || null,
    state: row.state || null,
    zip_code: row.zip_code || null,
    country: row.country || 'US',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    sources: row.sources || [],
    signals: row.signals || {},
    raw_score: row.raw_score ?? 0,
    score_breakdown: row.score_breakdown || null,
    tags: row.tags || [],
    created_at: now,
    updated_at: now,
  }
}

async function ingestFecDonors(existingNames, stats) {
  const rows = await loadCsv('fec_donors.csv')
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const name = normalizeName(row.person_name || '')
    if (!name || existingNames.has(name.toLowerCase())) continue
    const city = (row.city || '').trim()
    const state = (row.state || '').trim()
    const coords = city && state ? lookupCoords(city, state) : null
    const signals = {
      fec_donor: true,
      business_registry: false,
      sec_13f: false,
      sec_form_d: false,
      signal_dates: { fec_donor: row.date || '' },
    }
    const occ = (row.occupation || '').toUpperCase()
    const emp = (row.employer || '').toUpperCase()
    if (/VENTURE|CAPITAL|INVESTOR|PARTNER|MANAGING|CEO|FOUNDER/.test(occ)) signals.business_registry = true
    if (/VENTURE|CAPITAL|INVESTMENT|FUND|PARTNERS/.test(emp)) signals.business_registry = true
    const raw_score = scoreLead(signals)
    toInsert.push(buildLead({
      entity_type: 'person',
      display_name: name,
      city: city ? city.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
      state: state || null,
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null,
      sources: [{ source_name: 'FEC', date_observed: row.date, confidence: 0.9 }],
      signals,
      raw_score,
    }))
    existingNames.add(name.toLowerCase())
  }
  if (toInsert.length === 0) return
  const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
  if (error) throw error
  stats.imported += toInsert.length
  console.log('  FEC donors:', toInsert.length)
}

async function ingestSec13f(existingNames, stats) {
  const rows = await loadCsv('sec_13f.csv')
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    let name = (row.investor_name || '').replace(/^HR - |^HR\/A - |^NT - /i, '').trim()
    if (!name) continue
    if (existingNames.has(name.toLowerCase())) continue
    const signals = { sec_13f: true, fec_donor: false, business_registry: false, sec_form_d: false, signal_dates: { sec_13f: row.date || '' } }
    const raw_score = scoreLead(signals)
    toInsert.push(buildLead({
      entity_type: 'firm',
      display_name: name,
      sources: [{ source_name: 'SEC_13F', url: row.link, date_observed: row.date, confidence: 1 }],
      signals,
      raw_score,
    }))
    existingNames.add(name.toLowerCase())
  }
  if (toInsert.length === 0) return
  const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
  if (error) throw error
  stats.imported += toInsert.length
  console.log('  SEC 13F:', toInsert.length)
}

async function ingestWikidata(existingNames, stats) {
  const rows = await loadCsv('wikidata_investors.csv')
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const country = (row.country || '').trim()
    if (country && !country.includes('United States')) continue
    const name = (row.person_name || '').trim()
    if (!name || existingNames.has(name.toLowerCase())) continue
    const signals = { business_registry: true, sec_13f: false, fec_donor: false, sec_form_d: false }
    const occ = (row.occupation || '').toLowerCase()
    if (/ceo|chief executive/.test(occ)) signals.business_registry = true
    const raw_score = scoreLead(signals)
    toInsert.push(buildLead({
      entity_type: 'person',
      display_name: name,
      country: 'US',
      sources: [{ source_name: 'Wikidata', source_id: row.wikidata_id, confidence: 0.8 }],
      signals,
      raw_score,
    }))
    existingNames.add(name.toLowerCase())
  }
  if (toInsert.length === 0) return
  const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
  if (error) throw error
  stats.imported += toInsert.length
  console.log('  Wikidata:', toInsert.length)
}

async function ingestOptional(name, file, opts, existingNames, stats) {
  const rows = await loadCsv(file)
  if (rows.length === 0) return
  stats.total_rows += rows.length
  const toInsert = []
  for (const row of rows) {
    const displayName = opts.getDisplayName(row)
    if (!displayName || existingNames.has(displayName.toLowerCase())) continue
    toInsert.push(buildLead({
      entity_type: opts.entity_type || 'person',
      display_name: displayName,
      city: opts.getCity?.(row) || null,
      state: opts.getState?.(row) || null,
      sources: opts.sources(row),
      signals: opts.signals || {},
      raw_score: scoreLead(opts.signals || {}),
    }))
    existingNames.add(displayName.toLowerCase())
  }
  if (toInsert.length === 0) return
  const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
  if (error) throw error
  stats.imported += toInsert.length
  console.log(`  ${name}:`, toInsert.length)
}

async function run() {
  console.log('KYI Import from data folder')
  console.log('  Data dir:', dataDir)
  console.log('  Client ID:', clientId)
  const stats = { total_rows: 0, imported: 0 }
  const existingNames = await getExistingNames()
  console.log('  Existing leads for client:', existingNames.size)

  await ingestFecDonors(existingNames, stats)
  await ingestSec13f(existingNames, stats)
  await ingestWikidata(existingNames, stats)

  if (fs.existsSync(path.join(dataDir, 'github_users.csv'))) {
    await ingestOptional('GitHub', 'github_users.csv', {
      getDisplayName: (r) => (r.name || r.username || '').trim(),
      getCity: (r) => { const loc = (r.location || '').trim(); return loc.includes(',') ? loc.split(',', 1)[0].trim() || null : loc || null },
      getState: (r) => { const loc = (r.location || '').trim(); return loc.includes(',') ? loc.split(',')[1]?.trim() || null : null },
      entity_type: 'person',
      sources: (r) => [{ source_name: 'GitHub', url: r.profile_url, confidence: 0.7 }],
      signals: { business_registry: true },
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'mastodon_users.csv'))) {
    await ingestOptional('Mastodon', 'mastodon_users.csv', {
      getDisplayName: (r) => (r.display_name || r.username || '').trim(),
      entity_type: 'person',
      sources: (r) => [{ source_name: 'Mastodon', url: r.profile_url, confidence: 0.6 }],
      signals: {},
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'news_funding.csv'))) {
    await ingestOptional('NewsFunding', 'news_funding.csv', {
      getDisplayName: (r) => (r.title || '').trim().slice(0, 200),
      entity_type: 'firm',
      sources: (r) => [{ source_name: 'NewsFunding', url: r.link, confidence: 0.5 }],
      signals: {},
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'reddit_posts.csv'))) {
    await ingestOptional('Reddit', 'reddit_posts.csv', {
      getDisplayName: (r) => (r.author || '').trim(),
      entity_type: 'person',
      sources: (r) => [{ source_name: 'Reddit', url: r.url, confidence: 0.5 }],
      signals: {},
    }, existingNames, stats)
  }
  if (fs.existsSync(path.join(dataDir, 'sec_form_d.csv'))) {
    const rows = await loadCsv('sec_form_d.csv')
    stats.total_rows += rows.length
    const toInsert = []
    for (const row of rows) {
      const name = (row.company_name || '').trim()
      if (!name || existingNames.has(name.toLowerCase())) continue
      const signals = { sec_form_d: true, signal_dates: { sec_form_d: row.date || '' } }
      toInsert.push(buildLead({
        entity_type: 'firm',
        display_name: name,
        sources: [{ source_name: 'SEC_FORM_D', url: row.link, date_observed: row.date, confidence: 0.9 }],
        signals,
        raw_score: scoreLead(signals),
      }))
      existingNames.add(name.toLowerCase())
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
      if (error) throw error
      stats.imported += toInsert.length
      console.log('  SEC Form D:', toInsert.length)
    }
  }

  if (fs.existsSync(path.join(dataDir, 'kyi_nodes.csv'))) {
    const rows = await loadCsv('kyi_nodes.csv')
    stats.total_rows += rows.length
    const toInsert = []
    for (const row of rows) {
      const label = (row.label || row.id || '').trim().slice(0, 500)
      if (!label || existingNames.has(label.toLowerCase())) continue
      const nodeType = (row.node_type || '').toLowerCase()
      const entityType = nodeType === 'organization' || nodeType === 'firm' ? 'firm' : 'person'
      const sourceName = (row.source || 'KYI_NODES').replace(/\s+/g, '_')
      toInsert.push(buildLead({
        entity_type: entityType,
        display_name: label,
        sources: [{ source_name: sourceName, confidence: 0.6 }],
        signals: { business_registry: true },
        raw_score: scoreLead({ business_registry: true }),
      }))
      existingNames.add(label.toLowerCase())
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
      if (error) throw error
      stats.imported += toInsert.length
      console.log('  KYI nodes:', toInsert.length)
    }
  }

  if (fs.existsSync(path.join(dataDir, 'kyi_edges.csv'))) {
    const rows = await loadCsv('kyi_edges.csv')
    stats.total_rows += rows.length
    const toInsert = []
    for (const row of rows) {
      const fromNode = (row.from_node || '').trim().slice(0, 300)
      if (!fromNode || fromNode.length < 2) continue
      if (existingNames.has(fromNode.toLowerCase())) continue
      const rel = (row.relationship || '').toLowerCase()
      const sourceName = (row.source || 'KYI_EDGES').replace(/\s+/g, '_')
      toInsert.push(buildLead({
        entity_type: 'person',
        display_name: fromNode,
        sources: [{ source_name: sourceName, confidence: 0.5 }],
        signals: {},
        raw_score: 5,
      }))
      existingNames.add(fromNode.toLowerCase())
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('kyi_investor_leads').insert(toInsert)
      if (error) throw error
      stats.imported += toInsert.length
      console.log('  KYI edges (persons):', toInsert.length)
    }
  }

  console.log('Done. Total imported this run:', stats.imported)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
