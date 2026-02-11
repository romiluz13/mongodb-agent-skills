# Query and Index Optimization Feature Gap Matrix (8.0 -> 8.1 Focus)

## Scope

- Skill path: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize`
- Rules analyzed: 46
- Goal: ensure 8.0/8.1 query-engine and admin-surface features are accurately represented.

## Coverage Snapshot

- **Strong:** index fundamentals, aggregation ordering, update sort option rule, explain/tooling basics.
- **Critical drift:** `$queryStats` version framing, `bulkWrite` atomicity claim, validator-breaking structure in plan-cache rule.
- **8.1 freshness gaps:** query settings comment field and query-stats shape expansion not yet reflected.

## Feature Matrix

| Capability | MongoDB Source of Truth | Current Skill Coverage | Status | Impacted Rule Files | Required Fix |
|---|---|---|---|---|---|
| Query Settings introduced in 8.0 | MongoDB 8.0 release notes | Covered | Covered | `perf-query-settings.md` | Keep |
| Query Settings comment field in 8.1 / 8.0.4 | `setQuerySettings` + `$querySettings` docs | Not called out in rule | Missing | `perf-query-settings.md` | Add explicit version-gated `comment` guidance and examples |
| `$queryStats` availability baseline | Official docs show pre-8.0 availability (7.x lineage) | Rule claims “MongoDB 8.0 introduced `$queryStats`” | Incorrect | `perf-query-stats.md` | Correct introduction wording to pre-8.0 origin |
| `$queryStats` includes `count` and `distinct` (8.1 compatibility change) | 8.1 compatibility page | Not represented | Missing | `perf-query-stats.md` | Add 8.1 section for `count`/`distinct` shape coverage |
| Query settings supersede index filters in 8.0 | `setQuerySettings` docs | Not emphasized in rule | Partial | `perf-query-settings.md` | Add migration note from index filters -> query settings |
| `bulkWrite` command adds cross-collection batch in one request | `bulkWrite` docs + 8.0 release notes | Present | Covered | `query-bulkwrite-command.md` | Keep core capability statement |
| `bulkWrite` cross-collection atomicity | `bulkWrite` docs do not claim atomicity | Rule says “atomic across collections” | Incorrect | `query-bulkwrite-command.md` | Remove atomicity claim; add transaction guidance when atomicity is required |
| `updateOne` / `replaceOne` `sort` option | 8.0 release notes + method docs | Present and accurate | Covered | `query-updateone-sort.md` | Keep |
| Plan cache rule validator compliance | Build validator requires labeled good/bad code examples | Rule lacks explicit labeled examples | Structural Error | `perf-query-plan-cache.md` | Add labeled incorrect/correct code examples to pass validation |
| Query operators reference URL | URL currently 404 | Broken link | Incorrect | `query-avoid-ne-nin.md` | Replace with valid canonical operator docs URL |

## New/Updated Findings (Query+Index)

1. **P0**: `perf-query-stats.md` incorrectly attributes `$queryStats` to MongoDB 8.0 and contains stale reset snippet.
2. **P0**: `query-bulkwrite-command.md` overstates atomicity.
3. **P1**: `perf-query-settings.md` lacks 8.1/8.0.4 `comment` support and index-filter deprecation migration framing.
4. **P1**: `perf-query-plan-cache.md` currently fails validator gate.
5. **P1**: `query-avoid-ne-nin.md` contains broken reference URL.
