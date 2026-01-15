---
name: mongodb-query-and-index-optimize
description: MongoDB query optimization and indexing strategies. Use when writing queries, creating indexes, building aggregation pipelines, or debugging slow operations. Triggers on "slow query", "create index", "optimize query", "aggregation pipeline", "explain output", "COLLSCAN".
license: Apache-2.0
metadata:
  author: mongodb
  version: "1.0.0"
---

# MongoDB Query and Index Optimization

Query patterns and indexing strategies for MongoDB, maintained by MongoDB. Contains 15 rules across 3 categories, prioritized by impact. Indexes are the primary tool for query performance—most slow queries are missing an appropriate index.

## When to Apply

Reference these guidelines when:
- Writing new MongoDB queries or aggregations
- Creating indexes for collections
- Debugging slow queries (COLLSCAN, high execution time)
- Reviewing explain() output
- Seeing Performance Advisor suggestions
- Optimizing aggregation pipelines

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Index Strategies | CRITICAL | `index-` |
| 2 | Query Patterns | HIGH | `query-` |
| 3 | Aggregation Optimization | HIGH | `agg-` |

## Quick Reference

### 1. Index Strategies (CRITICAL)

- `index-compound-field-order` - Equality first, sort second, range last
- `index-ensure-usage` - Avoid COLLSCAN, verify with explain()
- `index-remove-unused` - Audit indexes with $indexStats
- `index-high-cardinality-first` - Put selective fields at index start
- `index-covered-queries` - Include projected fields to avoid document fetch

### 2. Query Patterns (HIGH)

- `query-use-projection` - Fetch only needed fields
- `query-avoid-ne-nin` - Use $in instead of negation operators
- `query-anchored-regex` - Start regex with ^ for index usage
- `query-batch-operations` - Avoid N+1 patterns, use $in or $lookup
- `query-pagination` - Use range-based pagination, not skip

### 3. Aggregation Optimization (HIGH)

- `agg-match-early` - Filter with $match at pipeline start
- `agg-project-early` - Reduce document size with $project
- `agg-sort-limit` - Combine $sort with $limit for top-N
- `agg-lookup-index` - Ensure $lookup foreign field is indexed
- `agg-avoid-large-unwind` - Don't $unwind massive arrays

## Key Principle

> **"If there's no index, it's a collection scan."**

Every query without a supporting index scans the entire collection. A 10ms query on 10,000 documents becomes a 10-second query on 10 million documents.

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/index-compound-field-order.md
rules/query-use-projection.md
rules/_sections.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- How to verify with explain()

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
