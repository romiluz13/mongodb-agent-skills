---
title: Managing LLM Context Window Limits
impact: HIGH
impactDescription: Exceeding context limits causes truncation or errors
tags: RAG, context-window, tokens, truncation, LLM
---

## Managing LLM Context Window Limits

LLMs have token limits. RAG must fit retrieved context + query + response within these limits.

**Incorrect (ignoring limits):**

```javascript
// WRONG: Retrieving too much context
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 50  // 50 chunks × ~500 tokens = 25,000 tokens!
    }
  }
]).toArray()

const fullContext = context.map(c => c.content).join('\n\n')
// Result: Exceeds GPT-4's context, gets truncated or errors
```

**Correct (context-aware retrieval):**

```javascript
// Token estimation (rough: 1 token ≈ 4 characters for English)
function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

// Context-aware retrieval
async function retrieveWithinTokenLimit(query, options = {}) {
  const {
    maxContextTokens = 4000,  // Reserve tokens for context
    maxResponseTokens = 1000, // Reserve for response
    modelLimit = 8192         // GPT-4 limit
  } = options

  // Calculate available context budget
  const queryTokens = estimateTokens(query)
  const systemPromptTokens = 500  // Estimate for system prompt
  const availableTokens = modelLimit - queryTokens - systemPromptTokens - maxResponseTokens

  const contextBudget = Math.min(availableTokens, maxContextTokens)

  // Retrieve chunks
  const queryEmbedding = await embeddingClient.embed(query)
  const chunks = await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 200,
        limit: 20  // Get more than needed, then filter
      }
    },
    {
      $addFields: { score: { $meta: "vectorSearchScore" } }
    },
    {
      $project: { content: 1, score: 1, source: 1 }
    }
  ]).toArray()

  // Select chunks within budget
  const selectedChunks = []
  let usedTokens = 0

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.content)
    if (usedTokens + chunkTokens <= contextBudget) {
      selectedChunks.push(chunk)
      usedTokens += chunkTokens
    } else {
      break  // Stop when budget exhausted
    }
  }

  return {
    chunks: selectedChunks,
    tokensUsed: usedTokens,
    tokenBudget: contextBudget
  }
}
```

**Model Token Limits:**

| Model | Context Limit | Safe Context Budget |
|-------|---------------|---------------------|
| GPT-3.5-turbo | 16,384 | 12,000 |
| GPT-4 | 8,192 | 6,000 |
| GPT-4-turbo | 128,000 | 100,000 |
| Claude 3 Sonnet | 200,000 | 150,000 |
| Claude 3 Opus | 200,000 | 150,000 |

**Dynamic Context Sizing:**

```javascript
async function smartContextRetrieval(query, modelConfig) {
  const {
    contextLimit,
    reserveForResponse = 2000,
    reserveForSystemPrompt = 500
  } = modelConfig

  // Calculate dynamic limits based on query
  const queryTokens = estimateTokens(query)
  const availableForContext = contextLimit - queryTokens - reserveForResponse - reserveForSystemPrompt

  // Adjust chunk count based on available space
  const avgChunkTokens = 400  // Your average chunk size
  const maxChunks = Math.floor(availableForContext / avgChunkTokens)

  const chunks = await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embeddingClient.embed(query),
        numCandidates: maxChunks * 20,
        limit: maxChunks
      }
    },
    { $addFields: { score: { $meta: "vectorSearchScore" } } }
  ]).toArray()

  return chunks
}
```

**Chunking for Context Efficiency:**

```javascript
// Optimal chunk sizes for RAG
const chunkingConfig = {
  // Smaller chunks = more precise retrieval
  precisionFocused: {
    chunkSize: 500,     // ~125 tokens
    overlap: 100,
    retrieveCount: 8    // Fit ~1000 tokens of context
  },

  // Larger chunks = more context per chunk
  contextFocused: {
    chunkSize: 1500,    // ~375 tokens
    overlap: 200,
    retrieveCount: 4    // Same ~1500 tokens, fewer chunks
  },

  // Large context models
  largeContext: {
    chunkSize: 2000,    // ~500 tokens
    overlap: 300,
    retrieveCount: 20   // ~10,000 tokens of context
  }
}
```

**When NOT to use this pattern:**

- Using models with very large context (200K+) - less critical
- Simple Q&A with single short documents
- When full document is required regardless of length

Reference: [MongoDB RAG Best Practices](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)
