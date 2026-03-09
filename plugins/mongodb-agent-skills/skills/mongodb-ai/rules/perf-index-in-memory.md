---
title: Keep the Vector Index Working Set in Memory When Sizing
impact: HIGH
impactDescription: Disk spillover can cause severe latency and throughput degradation
tags: RAM, memory, index-size, performance, mongot
---

## Keep the Vector Index Working Set in Memory When Sizing

For best performance, size vector search so the active index working set can stay in memory on the Search process or Search Nodes. If the working set is too large, latency and throughput can degrade sharply.

**Incorrect (index exceeds available RAM):**

```javascript
// WRONG: Large vector index on a cluster with too little Search memory
// The index working set no longer fits comfortably in memory.

db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No quantization and no memory-sizing validation
  }]
})
// Result: Query latency becomes unstable and degrades under load
```

**Correct (size index to fit RAM):**

```javascript
// Option 1: Enable quantization to reduce RAM
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "binary"
  }]
})

// Option 2: Increase available Search memory or Search Node capacity

// Option 3: Use partial indexing approach
// Only index active/recent documents
db.products.createSearchIndex("active_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    {
      type: "filter",
      path: "status"
    }
  ]
})
// Then always filter: filter: { status: "active" }
```

**Sizing Guidance:**

Use Atlas `Required Memory`, Search metrics, and explain output as the authoritative sizing signals. Atlas docs recommend RAM at least 10% larger than total vector size. Treat any local estimate as a rough planning aid, not a rule.

**Monitor Index Memory in Atlas:**

```
Atlas UI Path:
1. Database Deployments
2. Click cluster name
3. Metrics tab
4. Select "Search" process
5. Check "Memory Usage" metric

Or via Atlas Admin API:
GET /api/atlas/v1.0/groups/{groupId}/processes/{processId}/measurements
```

**Signs of Memory Pressure:**

- Query latency spikes
- Inconsistent query times
- Atlas alerts for Search process memory
- Search metrics showing sustained memory pressure

**When NOT to use this pattern:**

- Development/testing with small datasets

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Atlas Cluster Tier Selection](https://mongodb.com/docs/atlas/sizing-tier-selection/)
Reference: [MongoDB Vector Quantization](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
