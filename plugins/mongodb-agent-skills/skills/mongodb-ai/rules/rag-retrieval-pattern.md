---
title: RAG Retrieval Pattern
impact: HIGH
impactDescription: Effective retrieval provides relevant context for LLM generation
tags: RAG, retrieval, vectorSearch, context, LLM
---

## RAG Retrieval Pattern

Retrieval uses $vectorSearch to find semantically relevant chunks, then formats them for LLM context.

**Incorrect (poor retrieval):**

```javascript
// WRONG: No score filtering - includes low-relevance results
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 10
    }
  }
]).toArray()
// Result: Context includes irrelevant chunks, confuses LLM

// WRONG: No source tracking - can't cite sources
const response = await llm.chat([
  { role: "system", content: context.map(c => c.content).join('\n') },
  { role: "user", content: userQuery }
])
// Result: No way to verify or cite sources
```

**Correct (quality retrieval):**

```javascript
// Complete RAG retrieval function
async function retrieveContext(userQuery, options = {}) {
  const {
    limit = 5,
    minScore = 0.7,
    category = null
  } = options

  // Step 1: Embed the query
  const queryEmbedding = await embeddingClient.embed(userQuery)

  // Step 2: Vector search with optional filter
  const pipeline = [
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: limit * 20,  // 20x rule
        limit: limit * 2,            // Get extra for score filtering
        ...(category && { filter: { "metadata.category": category } })
      }
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" }
      }
    },
    {
      $match: {
        score: { $gte: minScore }  // Filter low-relevance
      }
    },
    {
      $limit: limit
    },
    {
      $project: {
        content: 1,
        score: 1,
        source: 1,
        "metadata.category": 1
      }
    }
  ]

  const results = await db.ragChunks.aggregate(pipeline).toArray()

  // Step 3: Format for LLM with source tracking
  const contextWithSources = results.map((doc, i) => ({
    index: i + 1,
    content: doc.content,
    score: doc.score,
    source: doc.source?.fileName || "Unknown",
    citation: `[${i + 1}]`
  }))

  return contextWithSources
}

// Usage in RAG pipeline
async function ragQuery(userQuery) {
  const context = await retrieveContext(userQuery, {
    limit: 5,
    minScore: 0.75
  })

  // Build prompt with sources
  const systemPrompt = `You are a helpful assistant. Answer based ONLY on the provided context.
If the context doesn't contain relevant information, say "I don't have information about that."
Cite sources using [1], [2], etc.

Context:
${context.map(c => `${c.citation} ${c.content}`).join('\n\n')}

Sources:
${context.map(c => `${c.citation} ${c.source}`).join('\n')}`

  const response = await llm.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery }
  ])

  return {
    answer: response,
    sources: context.map(c => ({ citation: c.citation, source: c.source, score: c.score }))
  }
}
```

**Retrieval Quality Checks:**

```javascript
// Check retrieval quality before sending to LLM
function validateContext(context) {
  if (context.length === 0) {
    return { valid: false, reason: "No relevant context found" }
  }

  const avgScore = context.reduce((sum, c) => sum + c.score, 0) / context.length
  if (avgScore < 0.6) {
    return { valid: false, reason: "Low average relevance score" }
  }

  if (context[0].score < 0.7) {
    return { valid: false, reason: "Best match has low relevance" }
  }

  return { valid: true }
}

// Usage
const context = await retrieveContext(userQuery)
const validation = validateContext(context)

if (!validation.valid) {
  return `I don't have enough relevant information to answer that. ${validation.reason}`
}
```

**Multi-Query Retrieval (Better Recall):**

```javascript
// Generate multiple query variations for better retrieval
async function multiQueryRetrieval(userQuery) {
  // Generate query variations
  const variations = await llm.chat([
    {
      role: "system",
      content: "Generate 3 different phrasings of this question for search. Return as JSON array."
    },
    { role: "user", content: userQuery }
  ])

  const queries = [userQuery, ...JSON.parse(variations)]

  // Retrieve for each query
  const allResults = []
  for (const query of queries) {
    const results = await retrieveContext(query, { limit: 3 })
    allResults.push(...results)
  }

  // Deduplicate and re-rank by score
  const seen = new Set()
  return allResults
    .filter(r => {
      const key = r.content.substring(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
```

**When NOT to use this pattern:**

- Direct factual questions (use regular queries)
- Real-time chat without knowledge base
- When entire document needed (not chunk-based)

Reference: [MongoDB RAG Implementation](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)
