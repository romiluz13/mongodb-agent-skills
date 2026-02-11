#!/usr/bin/env node
/**
 * Check external reference link health across all MongoDB skill rules.
 */

import { readdir } from 'fs/promises'
import { join } from 'path'
import { parseRuleFile } from './parser.js'
import { SKILLS_ROOT } from './config.js'

interface UrlCheckResult {
  url: string
  ok: boolean
  status?: number
  note?: string
}

const REQUEST_TIMEOUT_MS = 15000
const RETRIES = 2
const CONCURRENCY = 8

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestUrl(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function checkOneUrl(url: string): Promise<UrlCheckResult> {
  let lastError = 'unknown error'

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      let res = await requestUrl(url, 'HEAD')

      if (res.status === 405 || res.status === 501) {
        res = await requestUrl(url, 'GET')
      }

      if (res.status === 429) {
        return { url, ok: true, status: res.status, note: 'rate-limited (treated as reachable)' }
      }

      if (res.status >= 200 && res.status < 400) {
        return { url, ok: true, status: res.status }
      }

      lastError = `HTTP ${res.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    if (attempt < RETRIES) {
      await delay(300 * (attempt + 1))
    }
  }

  return { url, ok: false, note: lastError }
}

async function collectRuleReferences(): Promise<Map<string, Set<string>>> {
  const refs = new Map<string, Set<string>>()
  const skillDirs = await readdir(SKILLS_ROOT)
  const skills = skillDirs.filter((d) => d.startsWith('mongodb-'))

  for (const skill of skills) {
    const rulesDir = join(SKILLS_ROOT, skill, 'rules')
    let files: string[] = []
    try {
      files = await readdir(rulesDir)
    } catch {
      continue
    }

    const ruleFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    for (const file of ruleFiles) {
      const rulePath = join(rulesDir, file)
      try {
        const { rule } = await parseRuleFile(rulePath)
        const fileRef = `${skill}/${file}`
        for (const ref of rule.references || []) {
          if (!/^https?:\/\//i.test(ref)) continue
          if (!refs.has(ref)) refs.set(ref, new Set<string>())
          refs.get(ref)!.add(fileRef)
        }
      } catch (error) {
        console.warn(`Warning: failed to parse ${rulePath}: ${String(error)}`)
      }
    }
  }

  return refs
}

async function checkAllUrls(urls: string[]): Promise<UrlCheckResult[]> {
  const results: UrlCheckResult[] = []
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < urls.length) {
      const i = cursor
      cursor++
      const url = urls[i]
      const result = await checkOneUrl(url)
      results.push(result)
      const marker = result.ok ? 'OK' : 'FAIL'
      const detail = result.status ? `(${result.status})` : `(${result.note || 'n/a'})`
      console.log(`${marker} ${url} ${detail}`)
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function main() {
  console.log('Checking reference link health...')
  console.log(`Skills root: ${SKILLS_ROOT}`)

  const refMap = await collectRuleReferences()
  const urls = Array.from(refMap.keys()).sort()
  console.log(`Found ${urls.length} unique reference URLs`)

  if (urls.length === 0) {
    console.log('No URLs found to check.')
    return
  }

  const results = await checkAllUrls(urls)
  const failures = results.filter((r) => !r.ok)

  if (failures.length > 0) {
    console.error('\nBroken or unreachable references detected:')
    for (const failure of failures) {
      const files = Array.from(refMap.get(failure.url) || []).sort()
      console.error(`- ${failure.url} (${failure.note || `HTTP ${failure.status}`})`)
      for (const file of files) {
        console.error(`  - ${file}`)
      }
    }
    process.exit(1)
  }

  console.log('\n✓ All reference links are reachable')
}

main().catch((error) => {
  console.error('Link check failed:', error)
  process.exit(1)
})
