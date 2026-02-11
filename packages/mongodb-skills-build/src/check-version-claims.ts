#!/usr/bin/env node
/**
 * Guard version-sensitive claims against accidental drift using registry-driven checks.
 */

import { readdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { SKILLS_ROOT } from './config.js'

interface ValidationError {
  file: string
  message: string
}

interface PatternRule {
  pattern: string
  flags?: string
  message: string
}

interface PathRule {
  pathRegex: string
  requirements?: PatternRule[]
  prohibitions?: PatternRule[]
}

interface FileRule {
  file: string
  requirements?: PatternRule[]
  prohibitions?: PatternRule[]
}

interface Registry {
  global: {
    enforceOfficialReferenceForVersionClaims: boolean
    versionClaimPattern: string
    officialReferencePattern: string
  }
  pathRules: PathRule[]
  fileRules: FileRule[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_FILE = join(__dirname, '../config/version-claim-registry.json')
const CONTENT_RULE_PATH_PATTERN = /^mongodb-.+\/rules\/(?!_).+\.md$/

function compilePattern(
  rule: PatternRule,
  scope: string
): { regex: RegExp; message: string } {
  try {
    return {
      regex: new RegExp(rule.pattern, rule.flags),
      message: rule.message,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid regex in ${scope}: /${rule.pattern}/${rule.flags || ''} (${reason})`)
  }
}

function compileRegex(pattern: string, flags: string | undefined, scope: string): RegExp {
  try {
    return new RegExp(pattern, flags)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid regex in ${scope}: /${pattern}/${flags || ''} (${reason})`)
  }
}

async function loadRegistry(): Promise<Registry> {
  const raw = await readFile(REGISTRY_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as Registry
  return parsed
}

async function loadRuleFiles(): Promise<Map<string, string>> {
  const ruleContents = new Map<string, string>()
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

    const ruleFiles = files.filter((f) => f.endsWith('.md') && f !== 'README.md')

    for (const file of ruleFiles) {
      const absPath = join(rulesDir, file)
      const key = `${skill}/rules/${file}`
      const content = await readFile(absPath, 'utf-8')
      ruleContents.set(key, content)
    }
  }

  return ruleContents
}

function runPatternChecks(
  file: string,
  content: string,
  requirements: PatternRule[] | undefined,
  prohibitions: PatternRule[] | undefined,
  scope: string
): ValidationError[] {
  const errors: ValidationError[] = []

  for (const requirement of requirements || []) {
    const compiled = compilePattern(requirement, scope)
    if (!compiled.regex.test(content)) {
      errors.push({ file, message: compiled.message })
    }
  }

  for (const prohibition of prohibitions || []) {
    const compiled = compilePattern(prohibition, scope)
    if (compiled.regex.test(content)) {
      errors.push({ file, message: prohibition.message })
    }
  }

  return errors
}

function validateVersionClaims(ruleContents: Map<string, string>, registry: Registry): ValidationError[] {
  const errors: ValidationError[] = []

  const versionClaimRegex = compileRegex(
    registry.global.versionClaimPattern,
    undefined,
    'registry.global.versionClaimPattern'
  )
  const officialReferenceRegex = compileRegex(
    registry.global.officialReferencePattern,
    'm',
    'registry.global.officialReferencePattern'
  )

  const compiledPathRules = registry.pathRules.map((rule, idx) => ({
    pathRegex: compileRegex(rule.pathRegex, undefined, `registry.pathRules[${idx}].pathRegex`),
    requirements: rule.requirements,
    prohibitions: rule.prohibitions,
  }))

  // Global + path-pattern checks
  for (const [file, content] of ruleContents.entries()) {
    if (
      registry.global.enforceOfficialReferenceForVersionClaims &&
      CONTENT_RULE_PATH_PATTERN.test(file) &&
      versionClaimRegex.test(content) &&
      !officialReferenceRegex.test(content)
    ) {
      errors.push({
        file,
        message:
          'Contains version claims but is missing an official mongodb.com/docs Reference line',
      })
    }

    for (let i = 0; i < compiledPathRules.length; i++) {
      const rule = compiledPathRules[i]
      if (!rule.pathRegex.test(file)) continue
      errors.push(
        ...runPatternChecks(
          file,
          content,
          rule.requirements,
          rule.prohibitions,
          `registry.pathRules[${i}]`
        )
      )
    }
  }

  // File-specific assertions
  for (let i = 0; i < registry.fileRules.length; i++) {
    const fileRule = registry.fileRules[i]
    const content = ruleContents.get(fileRule.file)
    if (!content) {
      errors.push({
        file: fileRule.file,
        message: 'File rule target not found',
      })
      continue
    }
    errors.push(
      ...runPatternChecks(
        fileRule.file,
        content,
        fileRule.requirements,
        fileRule.prohibitions,
        `registry.fileRules[${i}]`
      )
    )
  }

  return errors
}

async function main() {
  try {
    console.log('Checking version-sensitive claim integrity...')
    console.log(`Skills root: ${SKILLS_ROOT}`)
    console.log(`Registry: ${REGISTRY_FILE}`)

    const registry = await loadRegistry()
    const ruleContents = await loadRuleFiles()
    const errors = validateVersionClaims(ruleContents, registry)

    if (errors.length > 0) {
      console.error('\n✗ Version-claim checks failed:\n')
      for (const error of errors) {
        console.error(`  ${error.file}: ${error.message}`)
      }
      process.exit(1)
    }

    console.log(
      `✓ Version-claim checks passed for ${ruleContents.size} markdown sources across 3 skills`
    )
  } catch (error) {
    console.error('Version-claim checks failed:', error)
    process.exit(1)
  }
}

main()
