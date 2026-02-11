---
title: Pre-filter to Narrow Candidate Set
impact: HIGH
impactDescription: Reduces vector comparisons by 10-1000x
tags: pre-filter, filter, performance, candidates
---

## Pre-filter to Narrow Candidate Set

Pre-filtering narrows the candidate set before vector comparison. Filtering 1M to 10K candidates = 100x fewer vector operations.

**Incorrect (no filtering on large dataset):**

```javascript
// WRONG: Searching 1M vectors without filtering
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
      // No filter - searches ALL 1M products
    }
  }
])
// Result: Slower queries, potentially irrelevant results
```

**Correct (strategic pre-filtering):**

```javascript
// Filter by category first
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: { category: "electronics" }  // 1M → 100K candidates
    }
  }
])

// Multi-filter for targeted search
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        $and: [
          { category: "electronics" },
          { brand: "Apple" },
          { inStock: true }
        ]
      }
    }
  }
])
// 1M → 5K candidates = 200x fewer comparisons
```

**Filter Strategy by Use Case:**

```javascript
// E-commerce: Filter by department/availability
{
  filter: {
    department: userSelectedDepartment,
    inStock: true,
    status: "active"
  }
}

// Multi-tenant: Filter by tenant ID (critical!)
{
  filter: {
    tenantId: currentTenantId  // Security + performance
  }
}

// Time-sensitive: Filter by date range
{
  filter: {
    createdAt: {
      $gte: ISODate("2024-01-01"),
      $lte: ISODate("2024-12-31")
    }
  }
}

// User-specific: Filter by access permissions
{
  filter: {
    $or: [
      { visibility: "public" },
      { authorId: currentUserId },
      { sharedWith: { $in: [currentUserId] } }
    ]
  }
}
```

**Performance Impact Example:**

```
Without filter (1M docs):
  - Vector comparisons: 1,000,000
  - Latency: ~150ms

With category filter (100K docs in category):
  - Vector comparisons: 100,000
  - Latency: ~40ms
  - Improvement: 3.75x faster

With multi-filter (10K docs matching all):
  - Vector comparisons: 10,000
  - Latency: ~15ms
  - Improvement: 10x faster
```

**Index Definition for Filters:**

```javascript
// Include all filterable fields in index
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    // Add filter fields
    { type: "filter", path: "category" },
    { type: "filter", path: "brand" },
    { type: "filter", path: "inStock" },
    { type: "filter", path: "status" },
    { type: "filter", path: "tenantId" },
    { type: "filter", path: "createdAt" }
  ]
})
```

**Analyze Filter Effectiveness:**

```javascript
// Check cardinality of filter fields
db.products.aggregate([
  {
    $group: {
      _id: "$category",
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } }
])
// High-cardinality filters are most effective

// Check filter selectivity
const total = await db.products.countDocuments()
const filtered = await db.products.countDocuments({ category: "electronics" })
console.log(`Filter selectivity: ${((total - filtered) / total * 100).toFixed(1)}%`)
// Higher % = more effective filter
```

**When NOT to use this pattern:**

- Filter removes too many candidates (< 100 remaining)
- Filter field not indexed (will error or post-filter)
- Need results across all categories

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB $vectorSearch Filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter)
