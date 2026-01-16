#!/usr/bin/env node
/**
 * Extract test cases from MongoDB rules for LLM evaluation
 *
 * Usage:
 *   npx tsx src/extract-tests.ts mongodb-schema-design
 *   npx tsx src/extract-tests.ts mongodb-query-and-index-optimize
 *
 * Or via npm scripts:
 *   pnpm extract-tests mongodb-schema-design
 */

import { readdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { Rule, TestCase } from './types.js'
import { parseRuleFile } from './parser.js'
import { RULES_DIR, TEST_CASES_FILE, getSkillName } from './config.js'

/**
 * Extract test cases from a rule
 * Looks for "Incorrect" and "Correct" code examples
 */
function extractTestCases(rule: Rule, filename: string): TestCase[] {
  const testCases: TestCase[] = []

  // Create a rule ID from filename (e.g., antipattern-unbounded-arrays.md -> antipattern-unbounded-arrays)
  const ruleId = filename.replace('.md', '')

  rule.examples.forEach((example) => {
    const labelLower = example.label.toLowerCase()

    // Identify bad examples
    const isBad = labelLower.includes('incorrect') ||
                  labelLower.includes('wrong') ||
                  labelLower.includes('bad') ||
                  labelLower.includes('avoid') ||
                  labelLower.includes('problematic')

    // Identify good examples
    const isGood = labelLower.includes('correct') ||
                   labelLower.includes('good') ||
                   labelLower.includes('solution') ||
                   labelLower.includes('recommended') ||
                   labelLower.includes('better') ||
                   labelLower.includes('optimal')

    // Only include examples that are clearly good or bad
    if ((isBad || isGood) && example.code.trim()) {
      testCases.push({
        ruleId,
        ruleTitle: rule.title,
        type: isBad ? 'bad' : 'good',
        code: example.code,
        language: example.language || 'javascript',
        description: example.description ||
                    `${example.label} example for ${rule.title}`
      })
    }
  })

  return testCases
}

/**
 * Main extraction function
 */
async function extractTests() {
  try {
    const skillName = getSkillName()
    console.log(`Extracting test cases for: ${skillName}`)
    console.log(`Rules directory: ${RULES_DIR}`)
    console.log(`Output file: ${TEST_CASES_FILE}`)

    const files = await readdir(RULES_DIR)
    const ruleFiles = files.filter(f =>
      f.endsWith('.md') &&
      !f.startsWith('_') &&
      f !== 'README.md'
    )

    console.log(`Found ${ruleFiles.length} rule files`)

    const allTestCases: TestCase[] = []
    const errors: string[] = []

    for (const file of ruleFiles) {
      const filePath = join(RULES_DIR, file)
      try {
        const { rule } = await parseRuleFile(filePath)
        const testCases = extractTestCases(rule, file)

        if (testCases.length > 0) {
          allTestCases.push(...testCases)
          console.log(`  ${file}: ${testCases.length} test cases`)
        } else {
          console.log(`  ${file}: No test cases found`)
        }
      } catch (error) {
        const errorMsg = `Error processing ${file}: ${error}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    // Write test cases as JSON
    const output = {
      skill: skillName,
      generatedAt: new Date().toISOString(),
      totalTestCases: allTestCases.length,
      summary: {
        badExamples: allTestCases.filter(tc => tc.type === 'bad').length,
        goodExamples: allTestCases.filter(tc => tc.type === 'good').length,
      },
      testCases: allTestCases
    }

    await writeFile(TEST_CASES_FILE, JSON.stringify(output, null, 2), 'utf-8')

    console.log(`\n✓ Extracted ${allTestCases.length} test cases to ${TEST_CASES_FILE}`)
    console.log(`  - Bad examples: ${output.summary.badExamples}`)
    console.log(`  - Good examples: ${output.summary.goodExamples}`)

    if (errors.length > 0) {
      console.log(`\n⚠ ${errors.length} files had errors:`)
      errors.forEach(e => console.log(`  - ${e}`))
    }

    // Return stats for programmatic use
    return output.summary

  } catch (error) {
    console.error('Extraction failed:', error)
    process.exit(1)
  }
}

// Run if called directly
extractTests()
