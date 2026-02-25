#!/usr/bin/env node
/**
 * KYI Fetch – download CSV (and other) data from URLs into the data folder.
 * Configure URLs in data/kyi-fetch-urls.json or via env (see below).
 * Run before import for automated data collection: npm run kyi:fetch-data && npm run kyi:import-data
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const dataDir = process.env.KYI_DATA_PATH || path.resolve(process.cwd(), 'data')

function loadUrlConfig() {
  const configPath = path.join(dataDir, 'kyi-fetch-urls.json')
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    } catch (e) {
      console.warn('Could not parse', configPath, e.message)
    }
  }
  const out = {}
  // Env: KYI_FETCH_<filename_without_csv>=https://...
  const prefix = 'KYI_FETCH_'
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value && value.startsWith('http')) {
      const name = key.slice(prefix.length).toLowerCase().replace(/_/g, '-')
      const filename = name.endsWith('.csv') ? name : `${name}.csv`
      out[filename] = value
    }
  }
  return out
}

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib
      .get(url, { headers: { 'User-Agent': 'Zenith-KYI-Fetch/1' } }, (res) => {
        const redirect = res.statusCode >= 300 && res.statusCode < 400 && res.headers.location
        if (redirect) {
          download(redirect).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

async function run() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const config = loadUrlConfig()
  const entries = Object.entries(config)
  if (entries.length === 0) {
    console.log('KYI Fetch: no URLs configured. Add data/kyi-fetch-urls.json or KYI_FETCH_* env vars.')
    console.log('  Example kyi-fetch-urls.json: { "fec_donors.csv": "https://example.com/fec.csv" }')
    return
  }

  console.log('KYI Fetch – data dir:', dataDir)
  for (const [filename, url] of entries) {
    try {
      const buf = await download(url)
      const filepath = path.join(dataDir, filename)
      fs.writeFileSync(filepath, buf)
      console.log('  ', filename, '←', url.slice(0, 60) + (url.length > 60 ? '...' : ''))
    } catch (e) {
      console.error('  ', filename, 'failed:', e.message)
    }
  }
  console.log('Done.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
