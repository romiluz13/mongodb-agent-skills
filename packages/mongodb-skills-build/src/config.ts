/**
 * Configuration for the build tooling
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Get skill name from command line args or default
const skillName = process.argv[2] || 'mongodb-schema-design'

// Path to the skill directory (relative to this package)
// Note: Structure is mongodb-agent-skills/plugins/mongodb-agent-skills/skills/
export const SKILLS_ROOT = join(__dirname, '../../../plugins/mongodb-agent-skills', 'skills')
export const SKILL_DIR = join(SKILLS_ROOT, skillName)
export const BUILD_DIR = join(__dirname, '..')
export const RULES_DIR = join(SKILL_DIR, 'rules')
export const METADATA_FILE = join(SKILL_DIR, 'metadata.json')
export const OUTPUT_FILE = join(SKILL_DIR, 'AGENTS.md')
export const TEST_CASES_FILE = join(SKILL_DIR, 'test-cases.json')

// Section mappings for each skill (updated for v2.0.0)
export const SECTION_MAPS: Record<string, Record<string, number>> = {
  'mongodb-schema-design': {
    antipattern: 1,   // Schema Anti-Patterns (CRITICAL)
    fundamental: 2,   // Schema Fundamentals (HIGH)
    relationship: 3,  // Relationship Patterns (HIGH)
    pattern: 4,       // Design Patterns (MEDIUM)
    validation: 5,    // Schema Validation (MEDIUM)
  },
  'mongodb-query-and-index-optimize': {
    index: 1,         // Index Essentials (CRITICAL) + Specialized Indexes (HIGH)
    specialized: 2,   // Specialized Indexes are under 'index' prefix but section 2
    query: 3,         // Query Patterns (HIGH)
    agg: 4,           // Aggregation Optimization (HIGH)
    perf: 5,          // Performance Diagnostics (MEDIUM)
  },
  'mongodb-ai': {
    index: 1,         // Vector Index Creation
    query: 2,         // $vectorSearch Queries
    perf: 3,          // Performance Tuning
    rag: 4,           // RAG Patterns
    hybrid: 5,        // Hybrid Search
    agent: 6,         // AI Agent Integration
  },
  'mongodb-transactions-consistency': {
    fundamental: 1,   // Transaction Fundamentals
    consistency: 2,   // Consistency Semantics
    retry: 3,         // Retry and Error Handling
    ops: 4,           // Operational Constraints
    pattern: 5,       // Implementation Patterns
  },
}

// Index prefix subsection mapping (for separating essentials from specialized)
export const INDEX_SUBSECTION_MAP: Record<string, number> = {
  'index-compound-field-order': 1,
  'index-ensure-usage': 1,
  'index-remove-unused': 1,
  'index-high-cardinality-first': 1,
  'index-covered-queries': 1,
  'index-prefix-principle': 1,
  'index-creation-background': 1,
  'index-size-considerations': 1,
  // Specialized indexes (section 2)
  'index-partial': 2,
  'index-sparse': 2,
  'index-ttl': 2,
  'index-text-search': 2,
  'index-wildcard': 2,
  'index-multikey': 2,
  'index-geospatial': 2,
}

export function getSectionMap(): Record<string, number> {
  return SECTION_MAPS[skillName] || {}
}

export function getSkillName(): string {
  return skillName
}

export function getIndexSubsection(filename: string): number | undefined {
  // Remove .md extension
  const baseName = filename.replace('.md', '')
  return INDEX_SUBSECTION_MAP[baseName]
}
