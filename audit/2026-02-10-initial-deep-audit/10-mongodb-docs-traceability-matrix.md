# MongoDB Docs Traceability Matrix

This matrix focuses on high-risk, version-sensitive claims.

| Topic | MongoDB docs source | Skill/rule using it | Status |
|---|---|---|---|
| `$vectorSearch` supported versions | `atlas-vector-search/vector-search-stage.txt` lines 87-92 | AI common error guidance | **Partial/Incorrect** |
| `$vectorSearch` first-stage requirement | `atlas-vector-search/vector-search-stage.txt` lines 329-330 | `query-vectorsearch-first` | Correct |
| View index/query behavior (8.0 vs 8.1+) | `includes/search-shared/fact-partial-indexing-reqs.rst` lines 6-23 | `index-views-partial` | **Incorrect** |
| HNSW option ranges/defaults | `includes/avs/index/list-table-fields.rst` lines 115-141 | `index-hnsw-options` | **Incorrect** |
| `$queryStats` introduced version | `manual/v7.0/.../queryStats.txt` line 13 | `perf-query-stats` | **Incorrect** |
| `bulkWrite` semantics | `reference/command/bulkWrite.txt` lines 221-233 + intro include | `query-bulkwrite-command` | **Overstated** |
| CRUD atomicity baseline | `manual/source/crud.txt` lines 42-44 | `query-bulkwrite-command` context | Needs clarification |

## Traceability Data

See `data/docs_evidence_index.csv` for exact source pointers used in this audit.
