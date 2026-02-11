# MongoDB.AI Feature Gap Matrix (8.0 -> 8.1 Focus)

## Scope

- Skill path: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai`
- Rules analyzed: 33
- Goal: verify coverage of latest MongoDB.AI features and identify rule-level fixes.

## Coverage Snapshot

- **Covered and current:** lexical prefilter concept, ANN/ENN basics, metadata prefilters, basic rank/score fusion differentiation.
- **Partially covered:** hybrid constraints, view support nuances, vector-search stage behavior exceptions.
- **Incorrect or stale:** HNSW bounds/defaults, view version gate, some hybrid syntax examples, broken reference URL.

## Feature Matrix

| Capability | MongoDB Source of Truth | Current Skill Coverage | Status | Impacted Rule Files | Required Fix |
|---|---|---|---|---|---|
| Lexical prefilters via `$search.vectorSearch` | Atlas Vector Search changelog (Nov 24, 2025), vectorSearch operator docs | `query-lexical-prefilter.md` explicitly covers preview and advanced filters | Covered | `query-lexical-prefilter.md` | Keep; add short note on preview lifecycle watchlist |
| `$rankFusion` stage baseline | Manual `$rankFusion` docs (8.0+) | `hybrid-rankfusion.md` says 8.0+ | Covered | `hybrid-rankfusion.md` | Keep baseline statement |
| `$scoreFusion` availability | Manual `$scoreFusion` docs (8.2+) | `hybrid-scorefusion.md` tags/description set to 8.2+ | Covered | `hybrid-scorefusion.md` | Keep, plus explicit “not in 8.0/8.1” one-liner |
| `$rankFusion` + `$vectorSearch` in input pipelines | Atlas hybrid tutorial states starting v8.1 | Rule implies generic 8.0+ for vector+text examples | Partial | `hybrid-rankfusion.md` | Add version gate note: vectorSearch-in-input requires 8.1+ |
| `$vectorSearch` in `$unionWith` | Manual `$vectorSearch` stage behavior starting in 8.0 | Rule says “must be first stage” without 8.0 `$unionWith` nuance | Partial | `query-vectorsearch-first.md` | Clarify: first stage of its pipeline context; allowed in `$unionWith` from 8.0 |
| View support for vector indexes + querying views | Atlas changelog June 25, 2025 (MongoDB 8.1) | Rule currently claims vectorSearch-on-views requires 8.0+ | Incorrect | `index-views-partial.md` | Correct to 8.1+ for index commands + vector query on views |
| Allowed view pipeline stages for search/vector index commands | MongoDB docs: `$addFields`, `$set`, `$match`+`$expr` | Rule already lists these | Covered | `index-views-partial.md` | Keep; align wording to official phrasing |
| Vector dimension limit increase | Atlas changelog: 8192 | Some rule examples hardcode 1536 and no explicit max mention | Partial | `index-vector-definition.md`, `index-dimensions-match.md` | Add explicit max dimension statement (<= 8192) |
| HNSW defaults/ranges | Atlas docs: `maxEdges` 16..64 default 16; `numEdgeCandidates` 100..3200 default 100 | Rule uses 32 default, ranges 4..100 and 4..1000 | Incorrect | `index-hnsw-options.md` | Replace table/ranges/defaults; rework tuning guidance to supported envelope |
| Hybrid sub-pipeline constraints | Atlas hybrid docs + manual stage docs | Rule has most constraints; some examples/syntax drift | Partial | `hybrid-limitations.md`, `hybrid-weights.md` | Normalize stage list and syntax to latest docs |
| Score-fusion weights/combination syntax | Manual `$scoreFusion` syntax (`combination.weights`, `combination.method`) | “Fine control” snippet uses unsupported shape (`input.weights`, `combination: "sum"`) | Incorrect | `hybrid-weights.md` | Rewrite snippet to valid syntax and options |
| Serial execution + no pagination in fusion | Atlas hybrid docs | Mentioned in `hybrid-limitations.md` | Covered | `hybrid-limitations.md` | Keep and add practical mitigation note |
| Filter operator evolution in vector prefilter | Atlas vector changelog (`$exists`, `$ne:null`) | Present in `query-prefiltering.md` | Covered | `query-prefiltering.md` | Keep; add source date footnotes |
| Reference link validity | HTTP check shows 404 for tier page URL | Broken URL remains in rule | Incorrect | `perf-index-in-memory.md` | Replace with working Atlas URL + optional search node memory docs |
| Compiled guidance parity (`AGENTS.md`) | Vercel skill pattern: rule-source -> compiled artifact | `mongodb-ai/AGENTS.md` is manually curated and drift-prone | Structural Gap | `mongodb-ai/AGENTS.md`, build tooling | Bring `mongodb-ai` into build pipeline and regenerate compiled AGENTS |

## New/Updated Findings (MongoDB.AI)

1. **P0**: `index-hnsw-options.md` has incorrect bounds/defaults against official docs.
2. **P0**: `index-views-partial.md` has wrong version gate for vector search on views.
3. **P1**: `hybrid-weights.md` includes invalid `$scoreFusion` structure in a “correct guidance” section.
4. **P1**: `query-vectorsearch-first.md` needs `$unionWith` exception/version nuance to avoid over-restrictive guidance.
5. **P1**: `perf-index-in-memory.md` reference URL is currently 404.
6. **P1**: Build/compile parity still excludes full `mongodb-ai` generation flow.
