# MongoDB Agent Skills v1.3.0

Release date: 2026-03-02

## Highlights

- **Three-round audit applied across all 5 skills** — fixes grounded in GitHub docs (Round 1), Glean internal docs (Round 2), and Bright Data live scrapes (Round 3, authoritative judge)
- **3 new rules** added to `mongodb-schema-design`
- **29 fixes** applied across all 5 skills — correcting defaults, behavior claims, version attributions, missing restrictions, and absent content blocks
- **Validated post-fix** by 5 independent agents cross-checking against Glean + live MongoDB docs simultaneously — overall score 98.2/100

## New Rules

| Rule | Skill | Impact |
|------|-------|--------|
| `antipattern-unnecessary-indexes` | mongodb-schema-design | CRITICAL |
| `pattern-approximation` | mongodb-schema-design | MEDIUM |
| `pattern-document-versioning` | mongodb-schema-design | MEDIUM |

## Key Fixes by Skill

### mongodb-schema-design (2.2.0 → 2.3.0)
- Time series `granularity` default corrected: **seconds** (not minutes) — bucket spans corrected for all three levels
- WiredTiger covered-query exception added to bloated-documents antipattern
- Time-partitioned collections added as second antipattern scenario in unnecessary-collections
- Attribute Pattern: Atlas Search `{k,v}` incompatibility caveat added
- Tree Structures: `parent` field + `$graphLookup` guidance added for Array of Ancestors pattern
- SKILL.md: 10 new trigger keywords; rule count corrected to 33; category counts corrected (Anti-Patterns: 7, Design Patterns: 12)

### mongodb-query-and-index-optimize (2.4.0 → 2.5.0)
- `$graphLookup` disk spill: corrected to auto-spill above 100MB (MongoDB 6.0+), removed misleading allowDiskUse rescue suggestion
- ESR: ERS Exception documented (highly selective range <5% → ERS can outperform ESR); `$in` 201-value threshold clarified
- `workingMillis` correctly separated from `durationMillis` — filter-only parameter, does not replace slowms
- Text index sort limitation documented; compound wildcard multikey restriction added
- `$queryStats` version corrected from "8.0 feature" to "introduced in 6.0.7"

### mongodb-ai (1.5.0 → 1.6.0)
- Atlas automated embedding Private Preview `type:"text"` syntax removed — replaced with "not yet available on Atlas" guidance
- `$sample` added to $rankFusion allowed stages (confirmed by live docs scrape)
- Sub-pipeline serial execution claim corrected to independent execution
- `$score` stage requirement added for non-scoring $scoreFusion pipelines
- View Support for Atlas Search/Vector Search: GA status (August 2025) documented

### mongodb-transactions-consistency (1.0.0 → 1.1.0)
- Per-operation writeConcern inside transactions: explicit error section with ❌/✅ examples
- Duplicate-key upsert retry: version range corrected to 7.0.22+/8.0.11+/8.1+ in title, test-cases, SKILL.md
- Transaction runtime limit: "in many deployments" qualifier removed; 1000-doc best practice with batching example added
- Lock timeout: 5ms default documented with tuning guidance
- Restricted operations: `createIndexes` replaced with `$out` in test-cases.json and AGENTS.md

### mongodb-search (1.0.1 → 1.1.0)
- MongoDB 8.2+ minimum version requirement added as first bullet in Community prereqs
- $rankFusion/$scoreFusion stage gates table: `$sample` added (Battle 1 verdict), Pagination Stages row explicit with `$skip`/`$limit` (Battle 3 verdict)
- `minimumShouldMatch` documented with default-0 behavior and only-should edge case
- Synonyms: 5-constraint Restrictions section (operator scope, matchCriteria, fuzzy exclusivity, analyzer restrictions, M0 limit)
- `scoreDetails` debugging added to score-tuning and ops-debugging rules
- 14-row operator intent matrix replacing 4-operator coverage
- Facet: numBuckets default (10) and max (1000), deprecated type mappings
- `returnScope` constraint: requires `returnStoredSource: true`

## Preserved (Battle Verdicts — Not Changed)

| Item | Battle | Verdict |
|------|--------|---------|
| `index-static-vs-dynamic-mappings.md` | Battle 2 | CORRECT — typeSets array + dynamic typeSet syntax confirmed |
| `$limit`/`$skip` in fusion sub-pipelines | Battle 3 | ALLOWED — Pagination Stages confirmed |
| `input.normalization` in $scoreFusion | Battle 5b | CORRECT — confirmed syntax |
| `$sample` in $rankFusion | Battle 1 | ALLOWED — confirmed in Search Stages table |

## Validation Results

Post-fix validation by 5 independent agents using Glean + live Bright Data scrapes:

| Skill | Score |
|-------|-------|
| mongodb-ai | 100/100 |
| mongodb-schema-design | 100/100 |
| mongodb-search | 97/100 |
| mongodb-query-and-index-optimize | 97/100 |
| mongodb-transactions-consistency | 97/100 |
| **Overall** | **98.2/100** |

## Skill Versions

- `mongodb-schema-design`: `2.3.0`
- `mongodb-query-and-index-optimize`: `2.5.0`
- `mongodb-search`: `1.1.0`
- `mongodb-ai`: `1.6.0`
- `mongodb-transactions-consistency`: `1.1.0`
