---
title: Dedicated Search Nodes for Production
impact: HIGH
impactDescription: Workload isolation prevents resource contention, enables independent scaling
tags: search-nodes, production, deployment, scaling, isolation
---

## Dedicated Search Nodes for Production

Deploy dedicated Search Nodes for production workloads. Isolates search from database operations and enables independent scaling.

**Incorrect (shared resources):**

```javascript
// WRONG: Production workload on shared node
// MongoDB (mongod) and Search (mongot) compete for resources
// Cluster: M30 with Vector Search enabled
// Result: Resource contention, unpredictable latency
```

**Correct (dedicated Search Nodes):**

```
Production Architecture:
┌─────────────────┐     ┌─────────────────┐
│  Database Node  │     │   Search Node   │
│     (mongod)    │────▶│    (mongot)     │
│    M40 tier     │     │    S30 tier     │
└─────────────────┘     └─────────────────┘
        │                       │
   Database ops           Vector Search
   (reads/writes)          (queries)
```

**Deployment Recommendations:**

| Environment | Configuration |
|-------------|---------------|
| Development | M10/M20 (shared) |
| Staging | M30 with Search Nodes |
| Production | M40+ with dedicated Search Nodes (S30+) |

**Search Node Tiers:**

| Tier | RAM | CPUs | Best For |
|------|-----|------|----------|
| S20 (High-CPU) | 4 GB | 4 | Low latency, smaller indexes |
| S30 (Low-CPU) | 8 GB | 2 | Larger indexes, moderate queries |
| S40 | 16 GB | 4 | Large production workloads |
| S50 | 32 GB | 8 | Very large indexes |
| S80 | 64 GB | 16 | Enterprise scale |

**RAM Allocation on Search Nodes:**

```
Search Nodes: ~90% RAM for vector index + JVM
Database Nodes: ~50% for MongoDB, ~50% for search (shared)

Example:
- S30 (8 GB): ~7.2 GB available for vector index
- M40 shared: ~4 GB available for vector index
```

**Sizing Your Search Nodes:**

```javascript
// Calculate required RAM
function calculateSearchNodeSize(vectorCount, dimensions, quantization = "none") {
  const bytesPerVector = {
    "none": dimensions * 4,
    "scalar": dimensions * 1,
    "binary": dimensions / 8
  }

  const indexBytes = vectorCount * bytesPerVector[quantization]
  const graphOverhead = 1.3  // ~30% for HNSW graph
  const jvmOverhead = 1.1    // ~10% for JVM

  const totalBytes = indexBytes * graphOverhead * jvmOverhead
  const requiredGB = totalBytes / (1024 ** 3)

  // Recommend 10% headroom
  return requiredGB * 1.1
}

// Example: 1M vectors, 1536 dims, no quantization
const requiredGB = calculateSearchNodeSize(1000000, 1536, "none")
console.log(`Required: ${requiredGB.toFixed(2)} GB`)  // ~8.8 GB → S40 tier
```

**Migration to Search Nodes:**

```
Step 1: Ensure cluster is M10 or higher
Step 2: Select region with Search Node support
Step 3: Enable "Search Nodes for workload isolation"
Step 4: Choose search tier based on index size
Step 5: Monitor metrics during migration
```

**Benefits of Search Nodes:**

| Aspect | Shared | Dedicated Search Nodes |
|--------|--------|------------------------|
| Resource contention | Yes | No |
| Independent scaling | No | Yes |
| Cost optimization | Lower initial | Pay for what you need |
| Query latency | Variable | Predictable |
| Concurrent queries | Limited | Optimized |

**Cloud Provider Availability:**

```
AWS:     Available in select regions
Azure:   Available in select regions
GCP:     Available in ALL regions
```

**Monitoring Search Nodes:**

```javascript
// Key metrics to monitor:
// 1. Search Normalized Process CPU - Should stay < 80%
// 2. System Memory - Available should exceed used
// 3. Page Faults - Should be near zero
// 4. Index Size - Must fit in Search Node RAM
```

**When NOT to use this pattern:**

- Development/testing (M10/M20 shared is sufficient)
- Small datasets (< 100K vectors)
- Cost-sensitive prototypes
- Regions without Search Node support

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Deployment Options](https://mongodb.com/docs/atlas/atlas-vector-search/deployment-options/)
