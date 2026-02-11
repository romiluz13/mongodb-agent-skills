---
title: Vector Index Must Fit in RAM
impact: HIGH
impactDescription: Disk spillover causes 10-100x performance degradation
tags: RAM, memory, index-size, performance, mongot
---

## Vector Index Must Fit in RAM

Vector indexes use HNSW graphs that must fit in RAM for acceptable performance. Disk spillover causes severe latency degradation.

**Incorrect (index exceeds available RAM):**

```javascript
// WRONG: Large index on small instance
// 2M vectors × 1536 dims = ~12GB index
// Running on M30 with 8GB RAM = spillover to disk

db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No quantization on 2M vectors = 12GB needed
  }]
})
// Result: Query latency goes from 50ms to 5000ms
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
    quantization: "binary"  // Reduces to ~0.5GB
  }]
})

// Option 2: Upgrade cluster tier
// M30 (8GB) → M40 (16GB) → M50 (32GB)

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

**RAM Requirements by Cluster Tier:**

| Tier | RAM | Max Vectors (no quant) | Max Vectors (binary) |
|------|-----|------------------------|----------------------|
| M10 | 2 GB | ~300K | ~7M |
| M20 | 4 GB | ~600K | ~14M |
| M30 | 8 GB | ~1.2M | ~28M |
| M40 | 16 GB | ~2.4M | ~56M |
| M50 | 32 GB | ~5M | ~112M |

*Based on 1536-dimensional vectors*

**Calculate Your Index Size:**

```javascript
// Estimate index RAM requirement
function estimateVectorIndexRAM(vectorCount, dimensions, quantization = "none") {
  const bytesPerVector = {
    "none": dimensions * 4,      // float32
    "scalar": dimensions * 1,    // int8
    "binary": dimensions / 8     // int1
  }

  const vectorBytes = vectorCount * bytesPerVector[quantization]
  const hnswOverhead = 1.3  // Graph overhead ~30%

  return (vectorBytes * hnswOverhead) / (1024 * 1024 * 1024)  // GB
}

// Example
const count = await db.products.countDocuments({ embedding: { $exists: true } })
console.log(`Vectors: ${count}`)
console.log(`RAM (no quant): ${estimateVectorIndexRAM(count, 1536, "none").toFixed(2)} GB`)
console.log(`RAM (scalar): ${estimateVectorIndexRAM(count, 1536, "scalar").toFixed(2)} GB`)
console.log(`RAM (binary): ${estimateVectorIndexRAM(count, 1536, "binary").toFixed(2)} GB`)
```

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

- Query latency spikes (50ms → 500ms+)
- Inconsistent query times
- "Memory limit exceeded" in logs
- Atlas alerts for search process memory

**When NOT to use this pattern:**

- Using dedicated Search Nodes (separate memory pool)
- Serverless instances (auto-scaling)
- Development/testing with small datasets

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Atlas Cluster Tier Selection](https://mongodb.com/docs/atlas/sizing-tier-selection/)
