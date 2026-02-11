# Capability Matrix (MongoDB 8.2.5 Baseline)

## Purpose

Track whether the three core MongoDB skills cover the latest high-risk capabilities and version boundaries up to MongoDB **8.2.5**.

## Coverage Summary

1. Total tracked capabilities: **19**
2. Covered: **19**
3. Partial: **0**
4. Gap: **0**

Detailed row-level data: `data/skill_capability_matrix_8_2_5.csv`

## MongoDB.AI Coverage

1. Lexical prefilters (`$search.vectorSearch`) with preview guardrails.
2. Hybrid search boundaries (`$rankFusion`, `$scoreFusion`, view support, preview caveats).
3. Vector index technical constraints (8192 dimensions, HNSW defaults/ranges, view behavior).
4. Automated embedding deployment split:
   - Community Edition 8.2+ preview (`autoEmbed`)
   - Atlas private-preview track constraints

## Query and Index Optimization Coverage

1. `$queryStats` version deltas (8.1 shape coverage, 8.2 metrics additions, output stability caveat).
2. `setQuerySettings` boundaries (8.1 and 8.0.4+ notes).
3. Deprecated index filters migration guidance.
4. `bulkWrite` semantics corrected to non-atomic cross-collection batching with transaction fallback for all-or-nothing.

## Schema Advisor Coverage

1. `validationAction: "errorAndLog"` boundary and downgrade caveats.
2. Rollout strategy includes rollback pathway for downgrade-safe operation.

## Sources (Primary)

1. `https://www.mongodb.com/docs/manual/release-notes/8.2/`
2. `https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/`
3. `https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/`
4. `https://www.mongodb.com/docs/manual/reference/operator/aggregation/queryStats/`
5. `https://www.mongodb.com/docs/manual/reference/command/setQuerySettings/`
6. `https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/`
7. `https://www.mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic/`
8. `https://www.mongodb.com/docs/atlas/atlas-vector-search/automated-embedding/`

## Forward Signal

Current baseline for these three skills is complete for tracked 8.2.5-critical capabilities. The next frontier is new skills for adjacent domains (operational reliability, sharding/cluster architecture, security/compliance playbooks, and migration/runbooks).
