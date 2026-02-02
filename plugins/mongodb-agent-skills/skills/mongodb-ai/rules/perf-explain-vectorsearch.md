---
title: Explain Vector Search Queries
impact: HIGH
impactDescription: Debug performance issues and understand query execution
tags: explain, debug, performance, execution-stats, query-plan
---

## Explain Vector Search Queries

Use `explain()` to analyze vector search query execution, identify bottlenecks, and verify index usage.

**Incorrect (guessing performance issues):**

```javascript
// WRONG: Running queries without understanding execution
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  }
])
// Result: No visibility into what's happening, can't optimize
```

**Correct (using explain for analysis):**

```javascript
// CORRECT: Analyze query execution with explain
// Basic execution stats
db.products.explain("executionStats").aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10
    }
  }
])

// Full query plan analysis
db.products.explain("allPlansExecution").aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10
    }
  }
])

// Query planner only (fastest, no execution)
db.products.explain("queryPlanner").aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10
    }
  }
])
```

**Explain Verbosity Levels:**

| Level | Executes Query | Returns |
|-------|----------------|---------|
| `queryPlanner` | No | Query plan only |
| `executionStats` | Yes | Plan + execution metrics |
| `allPlansExecution` | Yes | All plans considered |

**Key Metrics to Monitor:**

```javascript
// Sample explain output fields
{
  "collectors": {
    // Collection statistics
  },
  "query": {
    "args": {
      "numCandidates": 200,    // Candidates considered
      "limit": 10              // Results returned
    },
    "stats": {
      "vectorSearchTime": 45,  // Time in ms
      "totalTime": 52
    }
  },
  "resourceUsage": {
    "memUsedBytes": 1048576,   // Memory consumed
    "cpuTimeMs": 45            // CPU time
  }
}
```

**Vector Tracing (Debug Specific Documents):**

```javascript
// Trace why specific documents did/didn't appear in results
db.products.explain("executionStats").aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10,
      explainOptions: {
        traceDocumentIds: [
          ObjectId("573a13d8f29313caabda6557"),
          ObjectId("573a1398f29313caabce98d9")
        ]
      }
    }
  }
])

// Output includes vectorTracing:
// - Whether document was visited
// - Whether it appeared in results
// - Why it was dropped (if applicable)
// - Reachability information
```

**Performance Analysis Workflow:**

```javascript
async function analyzeVectorSearchPerformance(query) {
  const queryEmbedding = await embed(query)

  // Step 1: Get execution stats
  const stats = await db.products.explain("executionStats").aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 200,
        limit: 10
      }
    }
  ]).toArray()

  // Step 2: Analyze key metrics
  const analysis = {
    vectorSearchTime: stats[0].query?.stats?.vectorSearchTime,
    numCandidates: stats[0].query?.args?.numCandidates,
    memoryUsed: stats[0].resourceUsage?.memUsedBytes,
    cpuTime: stats[0].resourceUsage?.cpuTimeMs
  }

  // Step 3: Identify issues
  if (analysis.vectorSearchTime > 100) {
    console.log("Slow query - consider increasing cluster tier or adding quantization")
  }

  return analysis
}
```

**Common Issues Identified via Explain:**

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| High vectorSearchTime | Low numCandidates or no index | Increase numCandidates, verify index |
| High memUsedBytes | Large result set | Add pre-filtering |
| Missing documents | HNSW probabilistic nature | Increase numCandidates or use ENN |

**When NOT to use this pattern:**

- Production queries (explain adds overhead)
- Simple queries with known performance
- When using ENN (exact search behavior is deterministic)

Reference: [MongoDB Explain Vector Search](https://mongodb.com/docs/atlas/atlas-vector-search/explain/)
