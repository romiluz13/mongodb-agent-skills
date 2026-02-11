#!/usr/bin/env node
/**
 * Validate high-risk semantic invariants using rule-aware checks.
 */

import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { SKILLS_ROOT } from './config.js'
import { parseRuleFile } from './parser.js'

interface ValidationError {
  file: string
  message: string
}

type ExampleKind = 'good' | 'bad' | 'any'

interface ExampleAssertion {
  kind: ExampleKind
  containsAll: string[]
  message: string
}

interface SemanticInvariant {
  file: string
  requiredHeadings?: string[]
  requiredPhrases?: string[]
  exampleAssertions?: ExampleAssertion[]
}

interface SemanticRegistry {
  invariants: SemanticInvariant[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_FILE = join(__dirname, '../config/semantic-invariant-registry.json')

function extractHeadings(content: string): Set<string> {
  const headings = new Set<string>()
  const headingRegex = /^##\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(content)) !== null) {
    headings.add(match[1].trim())
  }
  return headings
}

function isBadLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return (
    lower.includes('incorrect') ||
    lower.includes('wrong') ||
    lower.includes('bad') ||
    lower.includes('problem') ||
    lower.includes('avoid')
  )
}

function isGoodLabel(label: string): boolean {
  const lower = label.toLowerCase()
  return (
    lower.includes('correct') ||
    lower.includes('good') ||
    lower.includes('usage') ||
    lower.includes('implementation') ||
    lower.includes('example') ||
    lower.includes('solution') ||
    lower.includes('better') ||
    lower.includes('optimized')
  )
}

function pickExamples(
  examples: Array<{ label: string; code: string }>,
  kind: ExampleKind
): Array<{ label: string; code: string }> {
  const codeExamples = examples.filter((e) => e.code && e.code.trim().length > 0)

  if (kind === 'any') return codeExamples
  if (kind === 'good') return codeExamples.filter((e) => isGoodLabel(e.label))
  return codeExamples.filter((e) => isBadLabel(e.label))
}

function validateInvariant(
  invariant: SemanticInvariant,
  rawContent: string,
  parsedExamples: Array<{ label: string; code: string }>
): ValidationError[] {
  const errors: ValidationError[] = []
  const headings = extractHeadings(rawContent)

  for (const heading of invariant.requiredHeadings || []) {
    if (!headings.has(heading)) {
      errors.push({
        file: invariant.file,
        message: `Missing required heading: "${heading}"`,
      })
    }
  }

  for (const phrase of invariant.requiredPhrases || []) {
    if (!rawContent.includes(phrase)) {
      errors.push({
        file: invariant.file,
        message: `Missing required phrase: "${phrase}"`,
      })
    }
  }

  for (const assertion of invariant.exampleAssertions || []) {
    const candidates = pickExamples(parsedExamples, assertion.kind)
    const matched = candidates.some((example) =>
      assertion.containsAll.every((token) => example.code.includes(token))
    )

    if (!matched) {
      errors.push({
        file: invariant.file,
        message: `${assertion.message} (expected tokens: ${assertion.containsAll.join(', ')})`,
      })
    }
  }

  return errors
}

async function loadRegistry(): Promise<SemanticRegistry> {
  const raw = await readFile(REGISTRY_FILE, 'utf-8')
  return JSON.parse(raw) as SemanticRegistry
}

async function main() {
  try {
    console.log('Checking high-risk semantic invariants...')
    console.log(`Skills root: ${SKILLS_ROOT}`)
    console.log(`Registry: ${REGISTRY_FILE}`)

    const registry = await loadRegistry()
    const errors: ValidationError[] = []

    for (const invariant of registry.invariants) {
      const absPath = join(SKILLS_ROOT, invariant.file)

      let rawContent = ''
      try {
        rawContent = await readFile(absPath, 'utf-8')
      } catch {
        errors.push({
          file: invariant.file,
          message: 'Invariant target file not found',
        })
        continue
      }

      try {
        const { rule } = await parseRuleFile(absPath)
        errors.push(...validateInvariant(invariant, rawContent, rule.examples))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        errors.push({
          file: invariant.file,
          message: `Failed to parse rule for semantic checks: ${reason}`,
        })
      }
    }

    if (errors.length > 0) {
      console.error('\n✗ Semantic invariant checks failed:\n')
      for (const error of errors) {
        console.error(`  ${error.file}: ${error.message}`)
      }
      process.exit(1)
    }

    console.log(
      `✓ Semantic invariant checks passed for ${registry.invariants.length} high-risk rules`
    )
  } catch (error) {
    console.error('Semantic invariant checks failed:', error)
    process.exit(1)
  }
}

main()
