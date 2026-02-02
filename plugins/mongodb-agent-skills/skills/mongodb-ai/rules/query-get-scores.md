---
title: Retrieving Vector Search Scores
impact: HIGH
impactDescription: Scores enable relevance thresholds, ranking display, and quality filtering
tags: score, vectorSearchScore, $meta, relevance
---

## Retrieving Vector Search Scores

Use `$meta: "vectorSearchScore"` to retrieve similarity scores. Scores enable relevance thresholds and quality assessment.

**Incorrect (not retrieving scores):**

```javascript
// WRONG: No way to assess result quality
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
// Result: No visibility into match quality

// WRONG: Trying to access score without projection
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  { $match: { score: { $gte: 0.8 } } }  // score field doesn't exist!
])
```

**Correct (retrieving and using scores):**

```javascript
// CORRECT: Add score via $project
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  {
    $project: {
      title: 1,
      description: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
])

// CORRECT: Add score via $addFields (keeps all fields)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" }
    }
  }
])
```

**Score Interpretation:**

| Similarity | Score Range | Meaning |
|------------|-------------|---------|
| cosine | 0 to 1 | 1 = identical, 0 = orthogonal |
| euclidean | 0 to ∞ | Lower = more similar |
| dotProduct | -∞ to ∞ | Higher = more similar |

**Using Scores for Thresholds:**

```javascript
// Filter by relevance threshold
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 50  // Get more, then filter by score
    }
  },
  {
    $addFields: { score: { $meta: "vectorSearchScore" } }
  },
  {
    $match: { score: { $gte: 0.75 } }  // Only high-relevance results
  },
  {
    $limit: 10
  }
])

// Score-based categories
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 20
    }
  },
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" },
      relevance: {
        $switch: {
          branches: [
            { case: { $gte: [{ $meta: "vectorSearchScore" }, 0.9] }, then: "excellent" },
            { case: { $gte: [{ $meta: "vectorSearchScore" }, 0.7] }, then: "good" },
            { case: { $gte: [{ $meta: "vectorSearchScore" }, 0.5] }, then: "fair" }
          ],
          default: "low"
        }
      }
    }
  }
])
```

**Complete RAG Pattern with Scores:**

```javascript
// Retrieve context for LLM with relevance info
const context = await db.docs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5
    }
  },
  {
    $project: {
      content: 1,
      source: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]).toArray()

// Use scores to build context string
const relevantContext = context
  .filter(doc => doc.score > 0.7)  // Only high-relevance
  .map(doc => `[Score: ${doc.score.toFixed(2)}] ${doc.content}`)
  .join('\n\n')
```

**When NOT to use this pattern:**

- When you don't need relevance information
- When using scores for absolute thresholds (scores are relative)
- Comparing scores across different queries (only compare within same query)

Reference: [MongoDB vectorSearchScore](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-score)
