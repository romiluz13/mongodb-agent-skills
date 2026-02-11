---
title: ANN vs ENN Search
impact: CRITICAL
impactDescription: Choose approximate (fast) or exact (accurate) based on use case
tags: ANN, ENN, exact, approximate, numCandidates
---

## ANN vs ENN Search

ANN (Approximate Nearest Neighbors) is fast but may miss some matches. ENN (Exact Nearest Neighbors) guarantees perfect results but is slower.

**Incorrect (always using one approach):**

```javascript
// WRONG: Using ENN for real-time user queries (too slow)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      exact: true,  // Too slow for real-time!
      limit: 10
    }
  }
])
// Result: 500ms+ latency on large datasets

// WRONG: Using low numCandidates ANN for critical searches
db.legalDocs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 50,  // Too low for legal discovery
      limit: 10
    }
  }
])
// Result: Missed relevant documents in critical search
```

**Correct (choosing based on use case):**

```javascript
// ANN: Real-time user-facing search (fast, good enough)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: userQueryEmbedding,
      numCandidates: 200,  // ANN with 20x rule
      limit: 10
    }
  }
])
// Result: ~10ms latency, ~90%+ recall

// ENN: Batch processing / critical searches (accurate)
db.legalDocs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: searchEmbedding,
      exact: true,  // ENN for perfect recall
      limit: 100
    }
  }
])
// Result: ~500ms latency, 100% recall

// ENN: Measuring recall accuracy of ANN
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: testQueryEmbedding,
      exact: true,  // Ground truth for testing
      limit: 10
    }
  }
])
```

**ANN vs ENN Comparison:**

| Aspect | ANN | ENN |
|--------|-----|-----|
| Parameter | `numCandidates: N` | `exact: true` |
| Speed | Fast (10-50ms) | Slower (100ms-1s+) |
| Recall | ~90-99% | 100% |
| Scaling | Scales well | Linear with data size |
| Use Case | Real-time search | Batch, critical, testing |

**Mutually Exclusive Parameters:**

```javascript
// WRONG: Cannot use both
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,  // ANN parameter
      exact: true,          // ENN parameter - CONFLICT!
      limit: 10
    }
  }
])
// Error: numCandidates and exact are mutually exclusive
```

**When to Use Each:**

```javascript
// USE ANN (numCandidates) when:
// - Real-time user queries
// - High query volume
// - Good-enough results acceptable
// - Latency matters more than perfect recall

// USE ENN (exact: true) when:
// - Legal/compliance searches
// - Scientific research
// - Measuring ANN accuracy
// - Batch processing
// - Small datasets (< 10K vectors)
// - Perfect recall required
```

**Combining with Pre-filtering:**

```javascript
// ENN with filter (manageable subset)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      exact: true,
      limit: 10,
      filter: { category: "specific" }  // Reduces candidates for ENN
    }
  }
])
// Filter reduces candidate set, making ENN faster
```

**When NOT to use this pattern:**

- ENN on > 100K vectors without filtering (too slow)
- ANN with very low numCandidates (poor recall)
- Both parameters together (mutually exclusive)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB ENN Search](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-exact)
