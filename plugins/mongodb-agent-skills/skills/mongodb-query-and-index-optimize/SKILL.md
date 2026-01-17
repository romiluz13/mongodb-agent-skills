---
name: mongodb-query-and-index-optimize
description: MongoDB query optimization and indexing strategies. Use when writing queries, creating indexes, building aggregation pipelines, or debugging slow operations. Triggers on "slow query", "create index", "optimize query", "aggregation pipeline", "explain output", "COLLSCAN", "ESR rule", "compound index", "partial index", "TTL index", "text search", "geospatial", "$indexStats", "profiler".
license: Apache-2.0
metadata:
  author: mongodb
  version: "2.1.0"
---

# MongoDB Query and Index Optimization

Query patterns and indexing strategies for MongoDB, maintained by MongoDB. Contains **39 rules across 5 categories**, prioritized by impact. Indexes are the primary tool for query performance—most slow queries are missing an appropriate index.

## When to Apply

Reference these guidelines when:
- Writing new MongoDB queries or aggregations
- Creating or reviewing indexes for collections
- Debugging slow queries (COLLSCAN, high execution time)
- Reviewing explain() output
- Seeing Performance Advisor suggestions
- Optimizing aggregation pipelines
- Implementing full-text search
- Adding geospatial queries
- Setting up TTL (time-to-live) for data expiration
- Analyzing index usage with $indexStats
- Profiling slow operations

## Rule Categories by Priority

| Priority | Category | Impact | Prefix | Rules |
|----------|----------|--------|--------|-------|
| 1 | Index Essentials | CRITICAL | `index-` | 9 |
| 2 | Specialized Indexes | HIGH | `index-` | 11 |
| 3 | Query Patterns | HIGH | `query-` | 7 |
| 4 | Aggregation Optimization | HIGH | `agg-` | 7 |
| 5 | Performance Diagnostics | MEDIUM | `perf-` | 5 |

## Quick Reference

### 1. Index Essentials (CRITICAL) - 9 rules

- `index-compound-field-order` - Equality first, sort second, range last (ESR rule)
- `index-compound-multi-field` - Use compound indexes for multi-field queries
- `index-ensure-usage` - Avoid COLLSCAN, verify with explain()
- `index-remove-unused` - Audit indexes with $indexStats
- `index-high-cardinality-first` - Put selective fields at index start
- `index-covered-queries` - Include projected fields to avoid document fetch
- `index-prefix-principle` - Compound indexes serve prefix queries
- `index-creation-background` - Build indexes without blocking operations
- `index-size-considerations` - Keep indexes in RAM for optimal performance

### 2. Specialized Indexes (HIGH) - 11 rules

- `index-unique` - Enforce uniqueness for identifiers and constraints
- `index-partial` - Index subset of documents to reduce size
- `index-sparse` - Skip documents missing the indexed field
- `index-ttl` - Automatic document expiration for sessions/logs
- `index-text-search` - Full-text search with stemming and relevance
- `index-wildcard` - Dynamic field indexing for polymorphic schemas
- `index-multikey` - Array field indexing (one entry per element)
- `index-geospatial` - 2dsphere indexes for location queries
- `index-hashed` - Uniform distribution for equality lookups or shard keys
- `index-clustered` - Ordered storage with clustered collections
- `index-hidden` - Safely test index removals in production

### 3. Query Patterns (HIGH) - 7 rules

- `query-use-projection` - Fetch only needed fields
- `query-avoid-ne-nin` - Use $in instead of negation operators
- `query-anchored-regex` - Start regex with ^ for index usage
- `query-batch-operations` - Avoid N+1 patterns, use $in or $lookup
- `query-pagination` - Use range-based pagination, not skip
- `query-exists-with-sparse` - Understand $exists behavior with sparse indexes
- `query-sort-collation` - Match sort order and collation to indexes

### 4. Aggregation Optimization (HIGH) - 7 rules

- `agg-match-early` - Filter with $match at pipeline start
- `agg-project-early` - Reduce document size with $project
- `agg-sort-limit` - Combine $sort with $limit for top-N
- `agg-lookup-index` - Ensure $lookup foreign field is indexed
- `agg-avoid-large-unwind` - Don't $unwind massive arrays
- `agg-allowdiskuse` - Handle large aggregations exceeding 100MB
- `agg-group-memory-limit` - Control $group memory and spills

### 5. Performance Diagnostics (MEDIUM) - 5 rules

- `perf-explain-interpretation` - Read explain() output like a pro
- `perf-slow-query-log` - Use profiler to find slow operations
- `perf-index-stats` - Find unused indexes with $indexStats
- `perf-use-hint` - Force a known-good index when the optimizer errs
- `perf-atlas-performance-advisor` - Use Atlas suggestions for missing indexes

## Key Principle

> **"If there's no index, it's a collection scan."**

Every query without a supporting index scans the entire collection. A 10ms query on 10,000 documents becomes a 10-second query on 10 million documents.

## ESR Rule (Equality-Sort-Range)

The most important rule for compound index field order:

```javascript
// Query: status = "active" AND createdAt > lastWeek ORDER BY priority
// ESR: Equality (status) → Sort (priority) → Range (createdAt)
db.tasks.createIndex({ status: 1, priority: 1, createdAt: 1 })
```

| Position | Type | Example | Why |
|----------|------|---------|-----|
| First | Equality | `status: "active"` | Narrows to exact matches |
| Second | Sort | `ORDER BY priority` | Avoids in-memory sort |
| Third | Range | `createdAt > date` | Scans within sorted data |

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/index-compound-field-order.md
rules/perf-explain-interpretation.md
rules/_sections.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- "When NOT to use" exceptions
- How to verify with explain()
- Performance impact and metrics

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
