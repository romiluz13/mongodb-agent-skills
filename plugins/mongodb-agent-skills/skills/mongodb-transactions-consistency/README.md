# MongoDB Transactions and Consistency

A structured repository for creating and maintaining MongoDB transaction correctness and consistency best practices optimized for agents and LLMs.

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
npx skills add romiluz13/mongodb-agent-skills --skill mongodb-transactions-consistency -a claude-code -a codex -a cursor
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build AGENTS.md from rules:
   ```bash
   pnpm build-transactions
   ```

3. Validate rule files:
   ```bash
   pnpm validate
   ```

4. Extract test cases:
   ```bash
   pnpm extract-tests-transactions
   ```

## Contributing

When adding or modifying rules:

1. Use the correct filename prefix for your section
2. Follow the rule file structure used in existing rules
3. Include clear incorrect/correct examples using MongoDB Shell syntax
4. Include a `## Verify with` section and an official MongoDB docs reference
5. Run `pnpm build-transactions` and commit generated outputs

## Acknowledgments

Created by MongoDB Engineering, inspired by [Vercel's agent-skills](https://github.com/vercel-labs/agent-skills).
