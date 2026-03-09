# Changelog

All notable changes to this project are documented in this file.

## [1.4.0] - 2026-03-09

### Changed
- Ran a new independent audit against current official MongoDB docs pages and treated docs-site guidance as the canonical source for skill wording, version gates, and examples.
- **mongodb-ai**:
  - broadened scope beyond Atlas-only assumptions where current docs support multiple deployment tracks
  - removed stale Atlas automated-embedding preview paths and third-party model-dimension tables
  - tightened hybrid-search boundaries with `mongodb-search`
  - replaced unsupported RAM formulas, tier pairings, benchmark numbers, and hard quantization heuristics with docs-backed memory/Required Memory guidance
  - normalized ANN/ENN, `numCandidates`, HNSW, Search Nodes, and quantization guidance to focus on current defaults plus benchmark/measurement workflows
- **mongodb-search**:
  - corrected Community Search guidance to require checking current release status and versioned docs before production recommendations
  - corrected `$rankFusion`/`$scoreFusion` stage gating and `$search` vs `$searchMeta` return-shape guidance
  - removed unsupported absolute runbook wording in operations guidance
- **mongodb-query-and-index-optimize**:
  - narrowed text-search guidance to built-in `$text` and routed Atlas Search semantics to `mongodb-search`
  - softened ESR, regex, `$or`, and index-memory claims where prior wording was stronger than current docs
- **mongodb-schema-design**:
  - made time series collections the default recommendation for most time-bucketed workloads
  - replaced remaining blog references with current docs pages
  - reduced overlap with query/index cleanup guidance and softened unsupported absolutes in compiled mirrors
- **mongodb-transactions-consistency**:
  - removed the blog-sourced `1,000 documents per transaction` rule from canonical guidance
  - corrected duplicate-key upsert retry behavior to `7.0.22+ / 8.0.11+ / 8.1+`
  - fixed compiled observability guidance so it no longer discouraged production instrumentation

### Version Bumps
- `mongodb-ai`: `1.6.0` → `1.7.0`
- `mongodb-query-and-index-optimize`: `2.5.0` → `2.6.0`
- `mongodb-schema-design`: `2.3.0` → `2.4.0`
- `mongodb-search`: `1.1.0` → `1.2.0`
- `mongodb-transactions-consistency`: `1.1.0` → `1.2.0`
- Plugin release version: `1.3.0` → `1.4.0`

## [1.3.0] - 2026-03-02

### Added
- New rule: `mongodb-schema-design/rules/antipattern-unnecessary-indexes` — write cost, $indexStats, hide→drop workflow, Atlas Advisor flags (CRITICAL)
- New rule: `mongodb-schema-design/rules/pattern-approximation` — threshold-based write reduction for counters/page views (MEDIUM)
- New rule: `mongodb-schema-design/rules/pattern-document-versioning` — full snapshot history in revisions collection for compliance use cases (MEDIUM)

### Changed
- **mongodb-schema-design**: granularity default corrected (seconds, not minutes); covered-query WiredTiger exception added; time-partitioned collections antipattern scenario added; Atlas Search incompatibility caveat for Attribute Pattern; `$graphLookup` parent field guidance for tree structures; 10 new trigger keywords; per-category rule counts corrected (7 anti-patterns, 12 design patterns)
- **mongodb-query-and-index-optimize**: `$graphLookup` auto-spill behavior corrected for MongoDB 6.0+ (no allowDiskUse rescue needed); ERS exception documented with <5% selectivity heuristic; `$in` threshold clarified (201 boundary); `workingMillis` vs `durationMillis` semantics correctly separated; text index sort limitation documented; compound wildcard multikey restriction added; `$queryStats` version corrected to 6.0.7
- **mongodb-ai**: Atlas automated embedding Private Preview syntax removed (not yet available on Atlas); CE 8.2+ autoEmbed syntax preserved; `$sample` added to $rankFusion allowed stages; sub-pipeline serial claim corrected to independent execution; `$score` stage requirement documented for non-scoring $scoreFusion pipelines; View Support GA status (August 2025) noted
- **mongodb-transactions-consistency**: per-operation writeConcern error section added; duplicate-key upsert retry version range corrected to 7.0.22+/8.0.11+/8.1+; 60s transaction limit qualifier removed; 1000-document best practice with batching pattern added; 5ms lock timeout default documented; test-cases.json and AGENTS.md updated to use `$out` as restricted-operations example
- **mongodb-search**: MongoDB 8.2+ requirement added as first bullet to Community prereqs; $rankFusion/$scoreFusion stage gates table updated with $sample and explicit Pagination Stages row; `minimumShouldMatch` documented; synonyms Restrictions section with 5 constraints; `scoreDetails` debugging added to score-tuning and ops-debugging; 14-row operator intent matrix added; numBuckets defaults and deprecated facet types documented; `returnScope` requires `returnStoredSource: true` constraint added

### Version Bumps
- `mongodb-schema-design`: `2.2.0` → `2.3.0`
- `mongodb-query-and-index-optimize`: `2.4.0` → `2.5.0`
- `mongodb-search`: `1.0.1` → `1.1.0`
- `mongodb-ai`: `1.5.0` → `1.6.0`
- `mongodb-transactions-consistency`: `1.0.0` → `1.1.0`
- Plugin release version: `1.2.0` → `1.3.0`

## [1.2.0] - 2026-02-18

### Added
- New skill: `mongodb-search` with 24 rules across:
  - Deployment Modes and Release Gates
  - Index Architecture and Mappings
  - Query Composition and Relevance
  - Hybrid and Vector Interop
  - Operations and Troubleshooting
  - Skill Boundary Rules
- New references map for search docs routing:
  - `plugins/mongodb-agent-skills/skills/mongodb-search/references/docs-navigation.md`
- New rule test suite:
  - `plugins/mongodb-agent-skills/skills/mongodb-search/test-cases.json`

### Changed
- Skill suite expanded from 4 skills / 129 rules to **5 skills / 153 rules**.
- Installer/catalog/docs updated to include `mongodb-search`.
- Plugin metadata updated for release `1.2.0`.
- Post-audit hardening pass on `mongodb-search`:
  - deployment routing now includes Kubernetes Operator self-managed path
  - community prerequisites now distinguish manual keyfile flow vs operator flow
  - fusion-stage guidance aligned with current `$rankFusion`/`$scoreFusion` constraints

### Version Bumps
- `mongodb-ai`: `1.4.0` -> `1.5.0`
- `mongodb-search`: `1.0.0` -> `1.0.1`
- Plugin release version: `1.1.0` -> `1.2.0`

## [1.1.0] - 2026-02-11

### Added
- New skill: `mongodb-transactions-consistency` with 20 rules across:
  - Transaction Fundamentals
  - Consistency Semantics
  - Retry and Error Handling
  - Operational Constraints
  - Implementation Patterns
- Strict installer support for transactions skill in `scripts/mongodb-skills-cli.sh`.
- Extended validation guardrails for transaction-specific version and semantic invariants.
- Sprint 12 and final validation audit artifacts.

### Changed
- Skill suite expanded from 3 skills / 109 rules to **4 skills / 129 rules**.
- Installation/catalog/docs updated to include transactions consistency.
- Plugin metadata updated for release `1.1.0`.
- Build tooling version bumped to `2.1.0`.

### Version Bumps
- `mongodb-ai`: `1.3.0` -> `1.4.0`
- `mongodb-query-and-index-optimize`: `2.3.0` -> `2.4.0`
- `mongodb-schema-design`: `2.1.0` -> `2.2.0`
- `mongodb-transactions-consistency`: `1.0.0` (initial)
- Plugin release version: `1.0.0` -> `1.1.0`

### Validation
- Build/validate/version-claim/semantic-invariant/link/release-watch gates passing.
- Release-watch confirms MongoDB 8.2.5 baseline.

## [1.0.0] - 2026-02-11

### Added
- Initial published baseline with 3 skills:
  - `mongodb-schema-design` (30 rules)
  - `mongodb-query-and-index-optimize` (46 rules)
  - `mongodb-ai` (33 rules)
