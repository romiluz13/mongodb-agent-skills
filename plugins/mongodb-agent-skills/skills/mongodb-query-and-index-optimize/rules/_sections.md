# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Index Essentials (index)

**Impact:** CRITICAL
**Description:** Indexes are the primary tool for query performance. Compound field order, the prefix principle, index coverage, and explain-driven verification determine whether the planner can avoid collection scans and unnecessary document fetches. Use ESR as a starting heuristic, then verify with explain on the actual workload.

## 2. Specialized Indexes (specialized)

**Impact:** HIGH
**Description:** MongoDB offers purpose-built indexes for specific use cases. Unique, partial, sparse, TTL, wildcard, multikey, geospatial, hashed, clustered, and hidden indexes all have different planner and operational tradeoffs. This section also covers built-in `$text` search with text indexes. Atlas Search routing belongs to `mongodb-search`.

## 3. Query Patterns (query)

**Impact:** HIGH
**Description:** Even with good indexes, bad query patterns can lead to wasted scans, poor selectivity, or unnecessary round trips. This section covers projections, negation/selectivity caveats, `$or` behavior, anchored regex, batching, pagination, sparse-index caveats, collation-aware sorting, and the newer `bulkWrite` and `updateOne` sort capabilities. Treat these as explain-driven workload rules rather than absolutes.

## 4. Aggregation Optimization (agg)

**Impact:** HIGH
**Description:** Aggregation pipelines are powerful but expensive if designed poorly. This section covers stage ordering, optimizer behavior, top-N sorting, `$lookup` indexing, `$graphLookup`, `$unwind` fan-out, spill behavior, and `$group` memory constraints. Use these as mechanics-aware optimization rules, then confirm with explain and observed resource usage.

## 5. Performance Diagnostics (perf)

**Impact:** MEDIUM
**Description:** Use explain, profiler data, `$indexStats`, Atlas Performance Advisor, `$queryStats`, Query Settings, and `hint()` to turn vague performance complaints into specific planner or workload findings. Release-line differences matter for `$queryStats` and Query Settings, so validate behavior against the target version.
