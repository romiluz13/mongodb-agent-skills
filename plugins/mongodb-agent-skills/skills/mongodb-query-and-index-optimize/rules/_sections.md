# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Index Essentials (index)

**Impact:** CRITICAL
**Description:** Without an index, every query is a collection scan—MongoDB reads every document to find matches. On a 10M document collection, that's 10M document reads for every single query, turning 5ms indexed lookups into 30-second full scans. Compound index field order matters: {status, date} supports queries on status alone OR status+date, but NOT date alone. The ESR rule (Equality-Sort-Range) determines optimal field ordering. Covered queries return results directly from the index without touching documents, making them 10-100× faster. Getting indexes wrong is the #1 cause of "MongoDB is slow" complaints—it's almost never MongoDB, it's missing or misconfigured indexes.

## 2. Specialized Indexes (specialized)

**Impact:** HIGH
**Description:** MongoDB offers purpose-built indexes for specific use cases. Unique indexes enforce data integrity at write time. Partial indexes only index documents matching a filter—index only active users instead of all 50M users, saving 80% storage and improving write performance. Sparse indexes skip documents missing the indexed field—perfect for optional fields. TTL indexes automatically delete documents after a time period—essential for session data, logs, and caches. Text indexes enable full-text search with stemming and relevance scoring. Wildcard indexes handle dynamic schemas where field names aren't known in advance. Geospatial indexes enable location queries with $near and $geoWithin. Hashed indexes provide uniform distribution for equality lookups and shard keys. Clustered collections store data in index order for fast range scans. Hidden indexes let you test removals safely. Each specialized index solves problems that regular indexes cannot.

## 3. Query Patterns (query)

**Impact:** HIGH
**Description:** Even with perfect indexes, bad query patterns force collection scans. $ne and $nin cannot use indexes efficiently—they must scan everything to find "not equal" matches. Unanchored regex /pattern/ scans every document; anchored regex /^pattern/ uses the index. $exists:false forces scans because indexes don't contain missing values. The $in operator is optimized but has limits—1000+ values may be slower than multiple queries. Projections reduce network transfer and memory usage by 50-90% when you only need specific fields. MongoDB 8.0 introduced the `bulkWrite` command for single-request cross-collection batch operations (use transactions when you need all-or-nothing atomicity), and added the `sort` option to updateOne/replaceOne for deterministic updates when multiple documents match. These patterns determine whether your indexes actually get used or sit idle while MongoDB scans.

## 4. Aggregation Optimization (agg)

**Impact:** HIGH
**Description:** Aggregation pipelines are powerful but expensive if designed poorly. Stage order is everything: $match at the start filters documents BEFORE processing—a $match that removes 90% of documents makes every subsequent stage 10× faster. $project early to drop unneeded fields, reducing memory usage throughout the pipeline. $sort + $limit coalesce into a single operation that only tracks top N results, using O(N) memory instead of O(all). $lookup without an index on the foreign collection causes nested collection scans—O(N×M) complexity that brings servers to their knees. $unwind on large arrays explodes document count, turning 1000 documents into 1M. The optimizer helps, but understanding pipeline mechanics lets you write 100× faster aggregations.

## 5. Performance Diagnostics (perf)

**Impact:** MEDIUM
**Description:** You can't optimize what you can't measure. explain("executionStats") reveals exactly what MongoDB did: COLLSCAN means no index was used, IXSCAN means indexed lookup, totalDocsExamined vs. nReturned shows scan efficiency (10000 examined for 10 returned = 99.9% wasted work). $indexStats shows which indexes are actually being used—unused indexes waste disk space and slow down writes. The slow query log captures queries exceeding a threshold. MongoDB Profiler records all operations with timing. Atlas Performance Advisor suggests missing indexes from real workloads. `$queryStats` is available in Atlas M10+ and has important release-line differences (8.1 adds count/distinct coverage; 8.2 adds delinquency and CPU metrics), while Query Settings (`setQuerySettings`/`removeQuerySettings`) provide persistent index guidance without app code changes. When needed, hint() lets you force a known-good plan. These tools turn "it's slow" into "this specific query scans 10M documents because it's missing an index on {userId, createdAt}".
