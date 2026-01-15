/**
 * Configuration for the build tooling
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Get skill name from command line args or default
const skillName = process.argv[2] || 'mongodb-schema-design'

// Path to the skill directory (relative to this package)
export const SKILLS_ROOT = join(__dirname, '../../..', 'skills')
export const SKILL_DIR = join(SKILLS_ROOT, skillName)
export const BUILD_DIR = join(__dirname, '..')
export const RULES_DIR = join(SKILL_DIR, 'rules')
export const METADATA_FILE = join(SKILL_DIR, 'metadata.json')
export const OUTPUT_FILE = join(SKILL_DIR, 'AGENTS.md')

// Section mappings for each skill
export const SECTION_MAPS: Record<string, Record<string, number>> = {
  'mongodb-schema-design': {
    antipattern: 1,
    fundamental: 2,
    pattern: 3,
  },
  'mongodb-query-and-index-optimize': {
    index: 1,
    query: 2,
    agg: 3,
  },
}

export function getSectionMap(): Record<string, number> {
  return SECTION_MAPS[skillName] || {}
}

export function getSkillName(): string {
  return skillName
}
