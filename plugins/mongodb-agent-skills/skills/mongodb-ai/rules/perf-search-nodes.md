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
│ dedicated tier  │     │ sized per usage │
└─────────────────┘     └─────────────────┘
        │                       │
   Database ops           Vector Search
   (reads/writes)          (queries)
```

**Deployment Recommendations:**

- Atlas Search Nodes are available on dedicated clusters, not on free, Flex, serverless, or global clusters.
- Atlas creates an S20 Search Node by default for workload isolation; Atlas docs recommend low-CPU Search Nodes for Vector Search workloads.
- Size Search Nodes from Atlas `Required Memory`, query throughput, and observed metrics, not from fixed tier pairings or homemade formulas.
- Atlas docs recommend node RAM at least 10% larger than total vector size.

**Migration to Search Nodes:**

```
Step 1: Ensure the deployment uses a dedicated Atlas cluster
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

**Monitoring Search Nodes:**

- Use the Vector Search dashboard and Search Node metrics to watch `Required Memory`, query latency, and process pressure.
- Validate isolation benefits with live workload metrics instead of assuming a fixed tier mapping.

**When NOT to use this pattern:**

- Development or prototype workloads where shared resources are acceptable
- Deployments where Search Nodes are unavailable for the chosen cluster type or region

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Deployment Options](https://mongodb.com/docs/atlas/atlas-vector-search/deployment-options/)
