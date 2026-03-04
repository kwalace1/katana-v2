#!/usr/bin/env node
/**
 * KYI Fetch – pull fresh investor lead data from public APIs.
 *
 * Sources:
 *   1. FEC  – Federal Election Commission individual contributions
 *   2. SEC 13F – EDGAR full-text search for 13F-HR filings
 *   3. SEC Form D – EDGAR full-text search for Form D filings
 *   4. Wikidata – SPARQL query for US investor/VC entities
 *   5. GitHub – Search API for VC-related user profiles
 *   6. Reddit – r/venturecapital subreddit posts
 *   7. Mastodon – Active investor directory profiles
 *   8. RSS – TechCrunch funding news
 *
 * Usage:  npm run kyi:fetch-data
 * Chain:  npm run kyi:refresh        (fetch + import)
 * Auto:   npm run kyi:schedule       (every 24 h)
 *
 * Env vars (optional overrides):
 *   FEC_API_KEY          – FEC API key (falls back to DEMO_KEY)
 *   GITHUB_TOKEN         – GitHub personal access token (higher rate limit)
 *   KYI_DATA_PATH        – output directory (default: <project>/data)
 *   KYI_FETCH_LOOKBACK   – days of history to fetch (default: 30)
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const dataDir = process.env.KYI_DATA_PATH || path.resolve(process.cwd(), 'data')
const LOOKBACK_DAYS = parseInt(process.env.KYI_FETCH_LOOKBACK || '30', 10)
const FEC_KEY = process.env.FEC_API_KEY || 'DEMO_KEY'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// ── helpers ──────────────────────────────────────────────────────────────────

function dateStr(d) { return d.toISOString().slice(0, 10) }

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const opts = {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Zenith-KYI/1.0 (kyi-fetch)', ...headers },
    }
    lib.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location, headers).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString().slice(0, 200)}`)))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)) }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const opts = { headers: { 'User-Agent': 'Zenith-KYI/1.0 (kyi-fetch)', ...headers } }
    lib.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location, headers).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString()))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function escapeCsv(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function writeCsv(filename, headers, rows) {
  const filepath = path.join(dataDir, filename)
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => escapeCsv(row[h])).join(','))
  fs.writeFileSync(filepath, lines.join('\n') + '\n')
  console.log(`  ${filename}: ${rows.length} rows`)
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ── 1. FEC donors ────────────────────────────────────────────────────────────

async function fetchFec() {
  console.log('  [FEC] Fetching individual contributions...')
  const headers = ['source', 'person_name', 'employer', 'occupation', 'city', 'state', 'date', 'node_type', 'relationship_type']
  const rows = []
  // FEC data has quarterly reporting lag, so look back further
  const fecLookback = Math.max(LOOKBACK_DAYS, 365)
  const minDate = dateStr(daysAgo(fecLookback))

  const employerTerms = ['VENTURE+CAPITAL', 'PRIVATE+EQUITY', 'ANGEL+INVEST', 'CAPITAL+PARTNERS', 'INVESTMENT+FUND', 'CAPITAL+MANAGEMENT']
  const occupationTerms = ['INVESTOR', 'VENTURE+CAPITALIST', 'FUND+MANAGER', 'MANAGING+PARTNER', 'CAPITAL+INVESTOR']

  async function fetchPage(paramName, term) {
    try {
      const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${FEC_KEY}&sort=-contribution_receipt_date&per_page=100&min_date=${minDate}&${paramName}=${term}`
      const data = await fetchJson(url)
      for (const r of (data.results || [])) {
        const name = (r.contributor_name || '').trim()
        if (!name) continue
        rows.push({
          source: 'FEC',
          person_name: name,
          employer: (r.contributor_employer || '').trim(),
          occupation: (r.contributor_occupation || '').trim(),
          city: (r.contributor_city || '').trim(),
          state: (r.contributor_state || '').trim(),
          date: (r.contribution_receipt_date || '').slice(0, 10),
          node_type: 'person',
          relationship_type: 'employment',
        })
      }
    } catch (e) {
      console.warn(`  [FEC] ${paramName}=${term} failed:`, e.message)
    }
    await sleep(500)
  }

  for (const term of employerTerms) await fetchPage('contributor_employer', term)
  for (const term of occupationTerms) await fetchPage('contributor_occupation', term)

  const seen = new Set()
  const unique = rows.filter((r) => {
    const k = r.person_name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  writeCsv('fec_donors.csv', headers, unique)
}

// ── 2. SEC 13F filings ──────────────────────────────────────────────────────

async function fetchSec13f() {
  console.log('  [SEC] Fetching 13F-HR filings...')
  const headers = ['source', 'investor_name', 'manager_name', 'cik', 'filing_type', 'filing_date', 'date', 'link', 'source_url', 'issuer_name', 'cusip', 'value', 'shares', 'put_call', 'investment_discretion', 'other_manager', 'voting_auth_sole', 'voting_auth_shared', 'voting_auth_none', 'node_type', 'relationship_type']
  const rows = []
  const startDate = dateStr(daysAgo(LOOKBACK_DAYS))
  const endDate = dateStr(new Date())

  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%2213F%22&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&start=0&count=100`
    const data = await fetchJson(url, { 'User-Agent': 'Zenith-KYI/1.0 admin@katana.dev' })
    const hits = data.hits?.hits || []
    for (const hit of hits) {
      const s = hit._source || {}
      const displayNames = Array.isArray(s.display_names) ? s.display_names : []
      const name = (displayNames[0] || '').trim()
      if (!name) continue
      const cik = Array.isArray(s.ciks) ? s.ciks[0] || '' : ''
      const adsh = s.adsh || ''
      const adshPath = adsh.replace(/-/g, '')
      const filingUrl = cik && adsh
        ? `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${adshPath}/${adsh}-index.htm`
        : ''
      rows.push({
        source: 'SEC_13F',
        investor_name: name,
        manager_name: '', cik, filing_type: s.form || '13F-HR',
        filing_date: s.file_date || '', date: s.file_date || '',
        link: filingUrl, source_url: '', issuer_name: '', cusip: '',
        value: '', shares: '', put_call: '', investment_discretion: '',
        other_manager: '', voting_auth_sole: '', voting_auth_shared: '', voting_auth_none: '',
        node_type: 'investor', relationship_type: 'institutional_holdings',
      })
    }
  } catch (e) {
    console.warn('  [SEC 13F] EFTS failed:', e.message)
  }

  writeCsv('sec_13f.csv', headers, rows)
}

// ── 3. SEC Form D filings ───────────────────────────────────────────────────

async function fetchSecFormD() {
  console.log('  [SEC] Fetching Form D filings...')
  const headers = ['source', 'company_name', 'filing_type', 'date', 'link', 'summary', 'relationship_type']
  const rows = []
  const startDate = dateStr(daysAgo(LOOKBACK_DAYS))
  const endDate = dateStr(new Date())

  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22Form+D%22&forms=D,D/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&start=0&count=200`
    const data = await fetchJson(url, { 'User-Agent': 'Zenith-KYI/1.0 admin@katana.dev' })
    const hits = data.hits?.hits || []
    for (const hit of hits) {
      const s = hit._source || {}
      const displayNames = Array.isArray(s.display_names) ? s.display_names : []
      const name = (displayNames[0] || '').trim()
      if (!name) continue
      const cik = Array.isArray(s.ciks) ? s.ciks[0] || '' : ''
      const adsh = s.adsh || ''
      const adshPath = adsh.replace(/-/g, '')
      const filingUrl = cik && adsh
        ? `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${adshPath}/${adsh}-index.htm`
        : ''
      rows.push({
        source: 'SEC_FORM_D',
        company_name: `${s.form || 'D'} - ${name}`,
        filing_type: 'Form D',
        date: s.file_date || '',
        link: filingUrl,
        summary: `Filed: ${s.file_date || 'N/A'}`,
        relationship_type: 'investment',
      })
    }
  } catch (e) {
    console.warn('  [SEC Form D] EFTS failed:', e.message)
  }

  writeCsv('sec_form_d.csv', headers, rows)
}

// ── 4. Wikidata investors ───────────────────────────────────────────────────

async function fetchWikidata() {
  console.log('  [Wikidata] Querying investor entities...')
  const headers = ['source', 'person_name', 'occupation', 'employer', 'country', 'city', 'roles', 'industries', 'website', 'socials', 'wikidata_id', 'aliases', 'node_type', 'relationship_type']
  const rows = []

  const sparql = `
SELECT DISTINCT ?person ?personLabel ?occupationLabel ?countryLabel ?wikidataId WHERE {
  VALUES ?occType { wd:Q484876 wd:Q2526255 wd:Q18924081 wd:Q3621823 wd:Q131524 }
  ?person wdt:P106 ?occType .
  ?person wdt:P27 ?country .
  OPTIONAL { ?person wdt:P106 ?occupation . }
  BIND(REPLACE(STR(?person), "http://www.wikidata.org/entity/", "") AS ?wikidataId)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 200
`
  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql.trim())}`
    const data = await fetchJson(url, { 'Accept': 'application/sparql-results+json' })
    const bindings = data.results?.bindings || []
    for (const b of bindings) {
      const name = (b.personLabel?.value || '').trim()
      if (!name || name.startsWith('Q')) continue
      rows.push({
        source: 'Wikidata', person_name: name,
        occupation: b.occupationLabel?.value || '', employer: '',
        country: b.countryLabel?.value || '', city: '',
        roles: '', industries: '', website: '', socials: '',
        wikidata_id: b.wikidataId?.value || '', aliases: '',
        node_type: 'person', relationship_type: 'professional',
      })
    }
  } catch (e) {
    console.warn('  [Wikidata] Failed:', e.message)
  }

  // Deduplicate
  const seen = new Set()
  const unique = rows.filter((r) => {
    const key = r.person_name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  writeCsv('wikidata_investors.csv', headers, unique)
}

// ── 5. GitHub users ─────────────────────────────────────────────────────────

async function fetchGithub() {
  console.log('  [GitHub] Searching VC-related profiles...')
  const headers = ['source', 'username', 'name', 'bio', 'company', 'location', 'followers', 'following', 'public_repos', 'profile_url', 'node_type', 'relationship_type']
  const rows = []
  const queries = ['venture capital', 'angel investor', 'private equity']
  const authHeaders = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}

  for (const q of queries) {
    try {
      const url = `https://api.github.com/search/users?q=${encodeURIComponent(q)}+in:bio&per_page=50&sort=followers&order=desc`
      const data = await fetchJson(url, authHeaders)
      const items = data.items || []
      for (const user of items) {
        try {
          const profile = await fetchJson(`https://api.github.com/users/${user.login}`, authHeaders)
          rows.push({
            source: 'GitHub', username: user.login,
            name: profile.name || '', bio: (profile.bio || '').replace(/\n/g, ' '),
            company: profile.company || '', location: profile.location || '',
            followers: profile.followers || 0, following: profile.following || 0,
            public_repos: profile.public_repos || 0,
            profile_url: `https://github.com/${user.login}`,
            node_type: 'person', relationship_type: 'developer',
          })
          await sleep(800)
        } catch { /* skip individual user errors */ }
      }
      await sleep(10000)
    } catch (e) {
      console.warn(`  [GitHub] Query "${q}" failed:`, e.message)
    }
  }

  const seen = new Set()
  const unique = rows.filter((r) => {
    if (seen.has(r.username)) return false
    seen.add(r.username)
    return true
  })

  writeCsv('github_users.csv', headers, unique)
}

// ── 6. Reddit posts ─────────────────────────────────────────────────────────

async function fetchReddit() {
  console.log('  [Reddit] Fetching r/venturecapital posts...')
  const headers = ['source', 'title', 'author', 'score', 'comments', 'url', 'created', 'subreddit', 'node_type', 'relationship_type']
  const rows = []
  const subs = ['venturecapital', 'investing', 'startups']

  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=100`
      const data = await fetchJson(url, { 'User-Agent': 'Zenith-KYI/1.0 (by /u/kyi-bot)' })
      const posts = data?.data?.children || []
      for (const p of posts) {
        const d = p.data
        if (!d || d.stickied) continue
        rows.push({
          source: `Reddit_${sub}`, title: (d.title || '').slice(0, 300),
          author: d.author || '', score: d.score || 0,
          comments: d.num_comments || 0,
          url: `https://reddit.com${d.permalink || ''}`,
          created: d.created_utc || '', subreddit: sub,
          node_type: 'discussion', relationship_type: 'community_post',
        })
      }
      await sleep(2000)
    } catch (e) {
      console.warn(`  [Reddit] r/${sub} failed:`, e.message)
    }
  }

  writeCsv('reddit_posts.csv', headers, rows)
}

// ── 7. Mastodon directory ───────────────────────────────────────────────────

async function fetchMastodon() {
  console.log('  [Mastodon] Fetching investor profiles...')
  const headers = ['source', 'username', 'display_name', 'bio', 'followers', 'following', 'profile_url', 'instance', 'node_type', 'relationship_type']
  const rows = []
  const instances = ['mastodon.social', 'me.dm', 'techhub.social']

  for (const inst of instances) {
    try {
      const url = `https://${inst}/api/v1/directory?order=active&limit=80&local=true`
      const data = await fetchJson(url)
      if (!Array.isArray(data)) continue
      for (const acct of data) {
        const bio = (acct.note || '').replace(/<[^>]*>/g, '').toLowerCase()
        const isInvestor = /invest|venture|capital|fund|angel|equity|portfolio|fintech|startup/i.test(bio + ' ' + (acct.display_name || ''))
        if (!isInvestor) continue
        rows.push({
          source: `Mastodon_${inst}`,
          username: acct.username || '', display_name: acct.display_name || '',
          bio: (acct.note || '').replace(/<[^>]*>/g, '').replace(/\n/g, ' ').slice(0, 500),
          followers: acct.followers_count || 0, following: acct.following_count || 0,
          profile_url: acct.url || '', instance: inst,
          node_type: 'person', relationship_type: 'social_profile',
        })
      }
      await sleep(1000)
    } catch (e) {
      console.warn(`  [Mastodon] ${inst} failed:`, e.message)
    }
  }

  writeCsv('mastodon_users.csv', headers, rows)
}

// ── 8. RSS / News feeds ─────────────────────────────────────────────────────

async function fetchRssNews() {
  console.log('  [RSS] Fetching funding news...')
  const headers = ['source', 'title', 'link', 'published', 'summary', 'node_type', 'relationship_type']
  const rows = []
  const feeds = [
    { name: 'RSS_TechCrunch', url: 'https://techcrunch.com/feed/' },
  ]

  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed.url)
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
      for (const item of items) {
        const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
        const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
        const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
        const desc = (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || ''
        const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const cleanDesc = desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim().slice(0, 300)
        const isFunding = /invest|fund|capital|venture|startup|raise|ipo|valuation|acquisition|billion|million/i.test(cleanTitle + ' ' + cleanDesc)
        if (!isFunding) continue
        rows.push({
          source: feed.name, title: cleanTitle, link: link.trim(),
          published: pubDate.trim(), summary: cleanDesc,
          node_type: 'news', relationship_type: 'funding_announcement',
        })
      }
    } catch (e) {
      console.warn(`  [RSS] ${feed.name} failed:`, e.message)
    }
  }

  writeCsv('news_funding.csv', headers, rows)
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const start = Date.now()
  console.log('KYI Fetch – pulling fresh data from public sources')
  console.log('  Data dir:', dataDir)
  console.log('  Lookback:', LOOKBACK_DAYS, 'days')
  console.log('')

  const sources = [
    { name: 'FEC',        fn: fetchFec },
    { name: 'SEC 13F',    fn: fetchSec13f },
    { name: 'SEC Form D', fn: fetchSecFormD },
    { name: 'Wikidata',   fn: fetchWikidata },
    { name: 'GitHub',     fn: fetchGithub },
    { name: 'Reddit',     fn: fetchReddit },
    { name: 'Mastodon',   fn: fetchMastodon },
    { name: 'RSS News',   fn: fetchRssNews },
  ]

  const results = []
  for (const src of sources) {
    try {
      await src.fn()
      results.push({ name: src.name, status: 'ok' })
    } catch (e) {
      console.error(`  [${src.name}] FAILED:`, e.message)
      results.push({ name: src.name, status: 'failed', error: e.message })
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('')
  console.log(`Done in ${elapsed}s.`)
  console.log('  Results:', results.map((r) => `${r.name}: ${r.status}`).join(', '))

  const failCount = results.filter((r) => r.status === 'failed').length
  if (failCount > 0) console.warn(`  ${failCount} source(s) failed – data from other sources was still saved.`)

  // Write a fetch timestamp so the import knows when data was last refreshed
  const meta = { last_fetch: new Date().toISOString(), lookback_days: LOOKBACK_DAYS, results }
  fs.writeFileSync(path.join(dataDir, '.kyi-fetch-meta.json'), JSON.stringify(meta, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
