---
title: Tuning Hybrid Search Weights
impact: MEDIUM
impactDescription: Per-query weight tuning improves relevance by 20-40%
tags: hybrid, weights, tuning, rankFusion, scoreFusion
---

## Tuning Hybrid Search Weights

Weights control the contribution of each search method. Tune per-query based on query type.

**Incorrect (static weights for all queries):**

```javascript
// WRONG: Same weights for all query types
const hybridSearch = (query) => db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }]
        },
        weights: {
          vector: 0.5,  // Always 50/50 - suboptimal
          text: 0.5
        }
      }
    }
  }
])
// Result: Concept queries get too much keyword weight, and vice versa
```

**Correct (dynamic weights based on query type):**

```javascript
// Query type detection
function detectQueryType(query) {
  // Technical queries often have specific terms
  const technicalPatterns = /\b(error|bug|api|function|method|class|config)\b/i

  // Conceptual queries are more abstract
  const conceptualPatterns = /\b(how to|best way|explain|understand|similar to)\b/i

  // Exact match queries have quotes or very specific terms
  const exactPatterns = /"[^"]+"|\b[A-Z]{2,}\b|\d{4,}/

  if (exactPatterns.test(query)) return "exact"
  if (technicalPatterns.test(query)) return "technical"
  if (conceptualPatterns.test(query)) return "conceptual"
  return "balanced"
}

// Weight configuration by query type
const weightConfigs = {
  exact: { vector: 0.2, text: 0.8 },      // Lexical-heavy
  technical: { vector: 0.4, text: 0.6 },   // Slight lexical bias
  balanced: { vector: 0.5, text: 0.5 },    // Equal weight
  conceptual: { vector: 0.7, text: 0.3 }   // Semantic-heavy
}

// Dynamic hybrid search
async function hybridSearch(query) {
  const queryType = detectQueryType(query)
  const weights = weightConfigs[queryType]
  const queryEmbedding = await embed(query)

  return db.products.aggregate([
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [{
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 20
              }
            }],
            text: [{
              $search: {
                index: "text_index",
                text: { query: query, path: "description" }
              }
            }, { $limit: 20 }]
          },
          weights: weights
        }
      }
    },
    { $limit: 10 }
  ]).toArray()
}
```

**Query Type Weight Guidelines:**

| Query Type | Example | Vector | Text |
|------------|---------|--------|------|
| Exact match | "error code 404" | 0.2 | 0.8 |
| Technical | "fix authentication bug" | 0.4 | 0.6 |
| Balanced | "laptop reviews" | 0.5 | 0.5 |
| Conceptual | "how to improve performance" | 0.7 | 0.3 |
| Abstract | "similar products" | 0.8 | 0.2 |

**Using $scoreFusion for Fine Control (MongoDB 8.2+):**

```javascript
// $scoreFusion uses actual scores instead of ranks
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          vector: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          text: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "description" }
            }
          }, { $limit: 20 }]
        },
        weights: { vector: 0.6, text: 0.4 },
        combination: "sum"  // or "max", "multiply"
      }
    }
  },
  { $limit: 10 }
])
```

**A/B Testing Weights:**

```javascript
// Test different weight configurations
async function testWeights(queries, weightConfigs) {
  const results = {}

  for (const [name, weights] of Object.entries(weightConfigs)) {
    let totalRelevance = 0

    for (const query of queries) {
      const searchResults = await hybridSearchWithWeights(query, weights)
      // Score based on your relevance criteria
      totalRelevance += scoreResults(searchResults, query)
    }

    results[name] = totalRelevance / queries.length
  }

  return results
}

// Example test
const testResults = await testWeights(sampleQueries, {
  "vector-heavy": { vector: 0.8, text: 0.2 },
  "balanced": { vector: 0.5, text: 0.5 },
  "text-heavy": { vector: 0.2, text: 0.8 }
})
```

**When NOT to use this pattern:**

- Single search method is sufficient
- Query classification is unreliable
- Consistent UX is more important than optimization

Reference: [MongoDB $rankFusion Weights](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/)
