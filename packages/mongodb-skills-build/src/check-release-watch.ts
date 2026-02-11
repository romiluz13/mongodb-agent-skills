#!/usr/bin/env node
/**
 * Detect release-line drift by checking official MongoDB release pages.
 */

import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

interface ReleaseWatchCheck {
  id: string
  url: string
  versionPattern: string
  expectedLatest: string
  description?: string
}

interface ReleaseWatchRegistry {
  checks: ReleaseWatchCheck[]
}

interface Version {
  major: number
  minor: number
  patch: number
}

const REQUEST_TIMEOUT_MS = 15000
const RETRIES = 2

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_FILE = join(__dirname, '../config/release-watch-registry.json')

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseVersion(version: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

async function fetchHtml(url: string): Promise<string> {
  let lastError = 'unknown error'

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      })
      if (!response.ok) {
        lastError = `HTTP ${response.status}`
      } else {
        return await response.text()
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    } finally {
      clearTimeout(timer)
    }

    if (attempt < RETRIES) {
      await delay(300 * (attempt + 1))
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError}`)
}

function extractVersions(content: string, pattern: string): string[] {
  const regex = new RegExp(pattern, 'g')
  const matches = Array.from(content.matchAll(regex), (m) => m[0])
  const unique = Array.from(new Set(matches))
  return unique.filter((v) => parseVersion(v) !== null)
}

function formatVersion(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

async function loadRegistry(): Promise<ReleaseWatchRegistry> {
  const raw = await readFile(REGISTRY_FILE, 'utf-8')
  return JSON.parse(raw) as ReleaseWatchRegistry
}

async function runCheck(check: ReleaseWatchCheck): Promise<void> {
  const expected = parseVersion(check.expectedLatest)
  if (!expected) {
    throw new Error(`[${check.id}] Invalid expectedLatest semver: ${check.expectedLatest}`)
  }

  const html = await fetchHtml(check.url)
  const candidates = extractVersions(html, check.versionPattern)
  if (candidates.length === 0) {
    throw new Error(
      `[${check.id}] No versions matched pattern /${check.versionPattern}/ on ${check.url}`
    )
  }

  const parsed = candidates
    .map((v) => ({ raw: v, parsed: parseVersion(v) }))
    .filter((item): item is { raw: string; parsed: Version } => item.parsed !== null)

  parsed.sort((a, b) => compareVersions(a.parsed, b.parsed))
  const observedLatest = parsed[parsed.length - 1]
  const cmp = compareVersions(observedLatest.parsed, expected)

  const observedText = formatVersion(observedLatest.parsed)
  const expectedText = formatVersion(expected)

  console.log(
    `CHECK ${check.id}: observed latest=${observedText}, expected latest=${expectedText} (${check.url})`
  )

  if (cmp > 0) {
    throw new Error(
      `[${check.id}] Newer release detected (${observedText} > ${expectedText}). Update skills/audit baselines.`
    )
  }

  if (cmp < 0) {
    throw new Error(
      `[${check.id}] Expected release (${expectedText}) not found as latest; observed ${observedText}. Reconcile registry assumptions.`
    )
  }
}

async function main() {
  try {
    console.log('Checking release-line drift...')
    console.log(`Registry: ${REGISTRY_FILE}`)

    const registry = await loadRegistry()
    if (!registry.checks || registry.checks.length === 0) {
      console.log('No release-watch checks configured.')
      return
    }

    for (const check of registry.checks) {
      await runCheck(check)
    }

    console.log(`✓ Release-watch checks passed for ${registry.checks.length} release lines`)
  } catch (error) {
    console.error('Release-watch checks failed:', error)
    process.exit(1)
  }
}

main()
