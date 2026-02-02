# MongoDB AI Skill - Research Document

**Last Updated:** February 2026
**Research Source:** BrightData MCP scraping of MongoDB official changelogs

---

## Research Summary

This document tracks MongoDB features discovered through BrightData research against official MongoDB changelogs. Features are categorized by skill and coverage status.

---

## 1. MongoDB Vector Search Changelog (2023-2026)

### Already Covered in mongodb-ai Skill

| Date | Feature | Covered In |
|------|---------|------------|
| Nov 2025 | Lexical prefilters (`$search.vectorSearch` operator) | `query-lexical-prefilter.md` |
| Nov 2025 | `$exists` operator in pre-filter | `query-prefiltering.md` |
| Sep 2025 | `$ne` to null in pre-filter | `query-prefiltering.md` |
| June 2025 | Views support for $vectorSearch (MongoDB 8.1) | `index-views-partial.md` |
| June 2025 | HNSW graph parameters (maxEdges, numEdgeCandidates) | `index-hnsw-options.md` |
| March 2025 | Vector dimension limit increased to 8192 | `index-dimensions-match.md` |
| Dec 2024 | Scalar quantization (int8) | `index-quantization.md`, `perf-quantization-scale.md` |
| Dec 2024 | Binary quantization (int1) | `index-quantization.md`, `perf-quantization-scale.md` |
| Dec 2024 | BinData int1 vectors | `index-quantization.md` |
| Sep 2024 | BSON vector type (float32, int8) | `index-quantization.md` |
| Aug 2024 | `$not` operator in filters | `query-prefiltering.md` |
| Aug 2024 | Arrays with all operators in filters | `query-prefiltering.md` |
| Aug 2024 | ObjectId/UUID support in filters | `query-prefiltering.md` |
| June 2024 | ENN exact search flag | `query-ann-vs-enn.md` |
| June 2024 | M0/M2/M5 tier index creation | Mentioned in various rules |

### Gap Analysis - Vector Search Features Needing Attention

| Date | Feature | Status | Recommendation |
|------|---------|--------|----------------|
| July 2025 | Explain segments statistics for vector search | **COVERED** | Already in `perf-explain-vectorsearch.md` |
| Jan 2025 | Explain support for int8/uint1 quantized queries | **COVERED** | Already in `perf-explain-vectorsearch.md` |

**Verdict: Vector Search features are 100% covered.**

---

## 2. MongoDB Atlas Search Changelog (2024-2026)

These are Atlas Search features (not Vector Search). Some overlap with AI skill for hybrid search.

### Features Relevant to mongodb-ai Skill (Hybrid Search)

| Date | Feature | Coverage Status |
|------|---------|-----------------|
| Jan 2026 | Search alerts/metrics for index field limits | NOT COVERED - Operational, not pattern |
| Oct 2025 | `returnScope` for arrays | NOT COVERED - Atlas Search specific |
| Oct 2025 | `hasRoot`/`hasAncestor` operators | NOT COVERED - Atlas Search specific |
| Sep 2025 | `typeSets` for dynamic indexing | NOT COVERED - Atlas Search specific |
| Sep 2025 | `stableTfl`/`boolean` similarity functions | NOT COVERED - Atlas Search specific |
| July 2025 | `keywordRepeat`/`removeDuplicates` token filters | NOT COVERED - Atlas Search specific |
| June 2025 | Views support for Atlas Search | **Covered** in hybrid context |
| Jan 2025 | Facet on number/date types | NOT COVERED - Atlas Search specific |
| Dec 2024 | Explain for facet queries | NOT COVERED - Atlas Search specific |
| Sep 2024 | Synonyms in phrase queries | NOT COVERED - Atlas Search specific |

**Recommendation:** Atlas Search features are NOT in scope for mongodb-ai skill. The skill focuses on Vector Search and hybrid search ($rankFusion/$scoreFusion). Pure Atlas Search patterns belong in a potential future `mongodb-atlas-search` skill.

---

## 3. MongoDB 8.0/8.1/8.2 Features

### Features for mongodb-query-and-index-optimize Skill

| Feature | Status | Notes |
|---------|--------|-------|
| `bulkWrite` command (cross-collection) | **NOT COVERED** | NEW - Should add to query skill |
| `$queryStats` aggregation stage | **NOT COVERED** | NEW - Should add to query skill diagnostics |
| Query Settings (`setQuerySettings`, `removeQuerySettings`) | **NOT COVERED** | NEW - Should add to query skill |
| Express query stages | **NOT COVERED** | Internal optimization, no user action needed |
| `updateOne`/`replaceOne` sort option | **NOT COVERED** | NEW - Should add to query skill |
| `defaultMaxTimeMS` cluster parameter | **NOT COVERED** | Operational, not query pattern |

### Features for mongodb-schema-design Skill

| Feature | Status | Notes |
|---------|--------|-------|
| Time Series block processing (200%+ throughput) | **PARTIAL** | `pattern-time-series-collections.md` exists but doesn't mention 8.0 improvements |
| Queryable Encryption range queries | **NOT COVERED** | Security feature, could add |
| Config shards (`transitionFromDedicatedConfigServer`) | **NOT COVERED** | Operational/sharding |
| `moveCollection`/`unshardCollection` commands | **NOT COVERED** | Operational/sharding |

### Features Already Covered in mongodb-ai Skill

| Feature | Status | Covered In |
|---------|--------|------------|
| `$rankFusion` (MongoDB 8.0+) | **COVERED** | `hybrid-rankfusion.md` |
| `$scoreFusion` (MongoDB 8.2+) | **COVERED** | `hybrid-scorefusion.md` |

---

## 4. Action Items Summary

### mongodb-ai Skill: NO NEW RULES NEEDED

All Vector Search and AI features from 2024-2026 are covered in the current 33 rules.

### mongodb-query-and-index-optimize Skill: COMPLETED

| Status | Rule Added | Feature |
|--------|------------|---------|
| DONE | `query-bulkwrite-command.md` | MongoDB 8.0 bulkWrite command |
| DONE | `perf-query-stats.md` | $queryStats aggregation stage |
| DONE | `perf-query-settings.md` | setQuerySettings/removeQuerySettings |
| DONE | `query-updateone-sort.md` | updateOne/replaceOne sort option |

**Total rules: 46 (was 42)**

### mongodb-schema-design Skill: COMPLETED

| Status | Action | Feature |
|--------|--------|---------|
| DONE | Updated `pattern-time-series-collections.md` | MongoDB 8.0 block processing (200%+ throughput) |

---

## 5. Borderline Features - Need User Decision

### Time Series Block Processing

**Question:** Time Series improvements in MongoDB 8.0 provide 200%+ throughput improvement. This could belong to:
- `mongodb-schema-design` (it's about Time Series collection design)
- `mongodb-query-and-index-optimize` (it affects query performance)

**Current state:** `pattern-time-series-collections.md` exists in schema skill but doesn't mention 8.0 improvements.

**Recommendation:** Update existing schema rule since Time Series is fundamentally a schema/collection-type decision.

### Atlas Search Features

**Question:** Should we create a separate `mongodb-atlas-search` skill for pure full-text search patterns?

**Features that would go there:**
- Faceting (number/date facets)
- Token filters (keywordRepeat, removeDuplicates)
- Array operators (returnScope, hasRoot, hasAncestor)
- Dynamic indexing (typeSets)
- Synonym management
- Explain for facet queries

**Recommendation:** Not in scope for current mongodb-ai skill. Consider as future 4th skill.

---

## 6. Research Methodology

1. Used BrightData MCP `scrape_as_markdown` tool
2. Scraped official MongoDB changelogs:
   - https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog/
   - https://www.mongodb.com/docs/atlas/atlas-search/changelog/
   - https://www.mongodb.com/docs/manual/release-notes/8.0/
3. Cross-referenced with existing rules in all three skills
4. Categorized by skill based on feature purpose

---

## 7. Verification Complete

**mongodb-ai skill validation:**
- 33 rules across 6 categories
- All Vector Search features from 2024-2026 covered
- All hybrid search features ($rankFusion, $scoreFusion) covered
- All AI agent memory patterns covered
- No redundancy between rules
- Structure compliant with Agent Skills standard

**Date verified:** February 2026
