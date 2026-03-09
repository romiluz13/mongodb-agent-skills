# MongoDB Agent Skills v1.4.0

Release date: 2026-03-09

## Highlights

- Full independent re-audit of the skill suite against current official MongoDB docs
- Canonical guidance tightened across all 5 skills to remove stale claims, unsupported absolutes, and cross-skill overlap
- Public packaging surfaces fixed so both publish paths now expose the same 5 skills:
  - root `skills/` for CLI-style installs
  - `plugins/mongodb-agent-skills/skills/` for native plugin installs
- Plugin metadata, skill metadata, compiled mirrors, and changelog synchronized for release `v1.4.0`

## What Changed

### Docs-backed hardening across all 5 skills

- **mongodb-ai**
  - Removed stale Atlas-only assumptions where current MongoDB docs support broader deployment routing
  - Removed unsupported sizing formulas, tier pairings, and synthetic benchmark claims
  - Reframed quantization, HNSW, Search Nodes, ANN/ENN, and `numCandidates` guidance around current docs plus benchmark/measurement workflows
  - Tightened ownership boundaries with `mongodb-search`

- **mongodb-search**
  - Corrected Community Search production guidance so it now depends on current release status and versioned docs
  - Fixed `$rankFusion` / `$scoreFusion` stage legality and `$search` / `$searchMeta` return-shape guidance
  - Removed unsupported absolute operational wording

- **mongodb-query-and-index-optimize**
  - Scoped text-search guidance to built-in `$text` / text indexes
  - Routed Atlas Search semantics to `mongodb-search`
  - Softened over-strong ESR, regex, `$or`, and index-memory claims

- **mongodb-schema-design**
  - Made time series collections the default recommendation for most time-bucketed workloads
  - Replaced remaining blog references with official MongoDB docs
  - Reduced overlap with query/index operational cleanup guidance

- **mongodb-transactions-consistency**
  - Removed the non-canonical `1,000 documents per transaction` rule from docs-backed guidance
  - Corrected duplicate-key upsert retry behavior to `7.0.22+ / 8.0.11+ / 8.1+`
  - Restored production-safe observability guidance in the compiled mirror

### Packaging and publish-surface fixes

- Root `skills/` now exposes all 5 public skills in tracked Git state
- Plugin `plugins/mongodb-agent-skills/skills/` now exposes all 5 public skills in tracked Git state
- Removed stale ignore rules that were hiding `mongodb-transactions-consistency` from the public repo
- Synced visible release metadata:
  - `README.md`
  - `.claude-plugin/marketplace.json`
  - `plugins/mongodb-agent-skills/.claude-plugin/plugin.json`
  - per-skill `SKILL.md`, `metadata.json`, and `AGENTS.md`

## Skill Versions

- `mongodb-ai`: `1.7.0`
- `mongodb-query-and-index-optimize`: `2.6.0`
- `mongodb-schema-design`: `2.4.0`
- `mongodb-search`: `1.2.0`
- `mongodb-transactions-consistency`: `1.2.0`

## Plugin Version

- `mongodb-agent-skills`: `1.4.0`

## Publish Surface Verification

- Tracked root `skills/`: 5 entries
- Tracked plugin `plugins/mongodb-agent-skills/skills/`: 5 skill directories
- No tracked `.claude/`, `audit/`, or `.DS_Store` files in the public publish surface

## Validation

- `jq empty` passed for touched JSON files
- Git pre-commit checks passed on the release branch
- Docs-sensitive wording revalidated against current MongoDB docs during this release cycle
