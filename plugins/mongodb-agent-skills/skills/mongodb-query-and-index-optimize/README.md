# MongoDB Query and Index Optimization

A structured repository for creating and maintaining MongoDB Query and Index Optimization best practices optimized for agents and LLMs.

## Structure

- `rules/` - Individual rule files (one per rule)
  - `_sections.md` - Section metadata (titles, impacts, descriptions)
  - `area-description.md` - Individual rule files
- `metadata.json` - Document metadata (version, organization, abstract)
- __`AGENTS.md`__ - Compiled output (generated)
- __`test-cases.json`__ - Test cases for LLM evaluation (generated)

## Installation (End Users)

### Claude Code plugin
Use the root install flow in `/README.md` to install from Claude Code plugin marketplace.

### Agent Skills CLI (recommended)
```bash
npx skills add romiluz13/mongodb-agent-skills --skill mongodb-query-and-index-optimize -a claude-code -a codex -a cursor
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build AGENTS.md from rules:
   ```bash
   pnpm build mongodb-query-and-index-optimize
   ```

3. Validate rule files:
   ```bash
   pnpm validate mongodb-query-and-index-optimize
   ```

4. Extract test cases:
   ```bash
   pnpm extract-tests mongodb-query-and-index-optimize
   ```

## Creating a New Rule

1. Copy an existing rule file to `rules/area-description.md`
2. Choose the appropriate area prefix:
   - `index-` for Index Essentials and Specialized Indexes (Sections 1-2)
   - `query-` for Query Patterns (Section 3)
   - `agg-` for Aggregation Optimization (Section 4)
   - `perf-` for Performance Diagnostics (Section 5)
3. Fill in the frontmatter and content
4. Ensure you have clear bad/good examples with explanations
5. Run `pnpm build mongodb-query-and-index-optimize` to regenerate AGENTS.md

## Rule File Structure

Each rule file should follow this structure:

```markdown
---
title: Rule Title Here
impact: CRITICAL|HIGH|MEDIUM
impactDescription: Optional description
tags: tag1, tag2, tag3
---

## Rule Title Here

Brief explanation of the rule and why it matters.

**Incorrect (description of what's wrong):**

```javascript
// Bad code example using MongoDB Shell syntax
```

**Correct (description of what's right):**

```javascript
// Good code example using MongoDB Shell syntax
```

Optional explanatory text after examples.

Reference: [MongoDB Documentation](https://mongodb.com/docs/manual/)
```

## File Naming Convention

- Files starting with `_` are special (excluded from build)
- Rule files: `area-description.md` (e.g., `index-compound-field-order.md`)
- Section is automatically inferred from filename prefix
- Rules are sorted alphabetically by title within each section
- IDs (e.g., 1.1, 1.2) are auto-generated during build

## Impact Levels

- `CRITICAL` - 10-100x improvement (collection scans to index usage)
- `HIGH` - 2-10x improvement (query optimization)
- `MEDIUM` - 20-100% improvement (pipeline optimizations)

## Scripts

- `pnpm build mongodb-query-and-index-optimize` - Compile rules into AGENTS.md
- `pnpm validate mongodb-query-and-index-optimize` - Validate all rule files
- `pnpm extract-tests mongodb-query-and-index-optimize` - Extract test cases for LLM evaluation

## Contributing

When adding or modifying rules:

1. Use the correct filename prefix for your section
2. Follow the rule file structure above
3. Include clear bad/good examples using MongoDB Shell syntax
4. Add appropriate tags
5. Run `pnpm build mongodb-query-and-index-optimize` to regenerate AGENTS.md
6. Rules are automatically sorted by title - no need to manage numbers

## Acknowledgments

Created by MongoDB Engineering, inspired by [Vercel's agent-skills](https://github.com/vercel-labs/agent-skills).
