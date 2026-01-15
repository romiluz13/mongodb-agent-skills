#!/usr/bin/env node
/**
 * Validate rule files follow the correct structure
 */

import { readdir } from 'fs/promises'
import { join } from 'path'
import { Rule } from './types.js'
import { parseRuleFile } from './parser.js'
import { SKILLS_ROOT } from './config.js'

interface ValidationError {
  file: string
  ruleId?: string
  message: string
}

/**
 * Validate a rule
 */
function validateRule(rule: Rule, file: string): ValidationError[] {
  const errors: ValidationError[] = []

  // Note: rule.id is auto-generated during build, not required in source files

  if (!rule.title || rule.title.trim().length === 0) {
    errors.push({ file, ruleId: rule.id, message: 'Missing or empty title' })
  }

  if (!rule.explanation || rule.explanation.trim().length === 0) {
    errors.push({ file, ruleId: rule.id, message: 'Missing or empty explanation' })
  }

  if (!rule.examples || rule.examples.length === 0) {
    errors.push({ file, ruleId: rule.id, message: 'Missing examples (need at least one bad and one good example)' })
  } else {
    // Filter out informational examples (notes, trade-offs, etc.) that don't have code
    const codeExamples = rule.examples.filter(e => e.code && e.code.trim().length > 0)

    const hasBad = codeExamples.some(e =>
      e.label.toLowerCase().includes('incorrect') ||
      e.label.toLowerCase().includes('wrong') ||
      e.label.toLowerCase().includes('bad') ||
      e.label.toLowerCase().includes('problem') ||
      e.label.toLowerCase().includes('avoid')
    )
    const hasGood = codeExamples.some(e =>
      e.label.toLowerCase().includes('correct') ||
      e.label.toLowerCase().includes('good') ||
      e.label.toLowerCase().includes('usage') ||
      e.label.toLowerCase().includes('implementation') ||
      e.label.toLowerCase().includes('example') ||
      e.label.toLowerCase().includes('solution') ||
      e.label.toLowerCase().includes('better') ||
      e.label.toLowerCase().includes('optimized')
    )

    if (codeExamples.length === 0) {
      errors.push({ file, ruleId: rule.id, message: 'Missing code examples' })
    } else if (!hasBad && !hasGood) {
      errors.push({ file, ruleId: rule.id, message: 'Missing bad/incorrect or good/correct examples' })
    }
  }

  const validImpacts: Rule['impact'][] = ['CRITICAL', 'HIGH', 'MEDIUM-HIGH', 'MEDIUM', 'LOW-MEDIUM', 'LOW']
  if (!validImpacts.includes(rule.impact)) {
    errors.push({ file, ruleId: rule.id, message: `Invalid impact level: ${rule.impact}. Must be one of: ${validImpacts.join(', ')}` })
  }

  return errors
}

/**
 * Main validation function
 */
async function validate() {
  try {
    console.log('Validating all MongoDB skills...')
    console.log(`Skills root: ${SKILLS_ROOT}`)

    // Get all skill directories
    const skillDirs = await readdir(SKILLS_ROOT)
    const skills = skillDirs.filter(d => d.startsWith('mongodb-'))

    const allErrors: ValidationError[] = []
    let totalRules = 0

    for (const skill of skills) {
      const rulesDir = join(SKILLS_ROOT, skill, 'rules')
      console.log(`\nValidating ${skill}...`)

      try {
        const files = await readdir(rulesDir)
        const ruleFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('_'))

        for (const file of ruleFiles) {
          const filePath = join(rulesDir, file)
          try {
            const { rule } = await parseRuleFile(filePath)
            const errors = validateRule(rule, `${skill}/${file}`)
            allErrors.push(...errors)
            totalRules++
          } catch (error) {
            allErrors.push({
              file: `${skill}/${file}`,
              message: `Failed to parse: ${error instanceof Error ? error.message : String(error)}`
            })
          }
        }

        console.log(`  Found ${ruleFiles.length} rules`)
      } catch (error) {
        console.warn(`  Warning: Could not read rules for ${skill}`)
      }
    }

    if (allErrors.length > 0) {
      console.error('\n✗ Validation failed:\n')
      allErrors.forEach(error => {
        console.error(`  ${error.file}${error.ruleId ? ` (${error.ruleId})` : ''}: ${error.message}`)
      })
      process.exit(1)
    } else {
      console.log(`\n✓ All ${totalRules} rules across ${skills.length} skills are valid`)
    }
  } catch (error) {
    console.error('Validation failed:', error)
    process.exit(1)
  }
}

validate()
