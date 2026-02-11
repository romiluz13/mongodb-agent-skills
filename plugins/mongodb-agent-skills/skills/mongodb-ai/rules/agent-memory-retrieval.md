---
title: Semantic Memory Retrieval
impact: MEDIUM
impactDescription: Enables "recall" of relevant past context for agent responses
tags: agent, memory, retrieval, semantic-search, recall
---

## Semantic Memory Retrieval

Use vector search to retrieve relevant memories based on current context, not just keyword matching.

**Incorrect (keyword-based retrieval):**

```javascript
// WRONG: Exact keyword match - misses semantically related memories
const memories = await db.longTermMemory.find({
  userId: currentUserId,
  content: { $regex: "Python", $options: "i" }
}).toArray()
// Result: Misses "prefers code examples in snake_case" (related but no keyword)

// WRONG: Retrieving all memories - no relevance filtering
const memories = await db.longTermMemory.find({
  userId: currentUserId
}).toArray()
// Result: Too much irrelevant context
```

**Correct (semantic retrieval):**

```javascript
// Semantic memory retrieval function
async function retrieveRelevantMemories(currentContext, userId, options = {}) {
  const {
    limit = 5,
    minRelevance = 0.7,
    memoryTypes = ["fact", "preference", "instruction"]
  } = options

  // Embed the current context
  const contextEmbedding = await embed(currentContext)

  // Search long-term memory
  const memories = await db.longTermMemory.aggregate([
    {
      $vectorSearch: {
        index: "ltm_vector_index",
        path: "embedding",
        queryVector: contextEmbedding,
        numCandidates: limit * 20,
        limit: limit * 2,
        filter: {
          $and: [
            { userId: userId },
            { status: "active" },
            { type: { $in: memoryTypes } }
          ]
        }
      }
    },
    {
      $addFields: {
        relevance: { $meta: "vectorSearchScore" }
      }
    },
    {
      $match: {
        relevance: { $gte: minRelevance }
      }
    },
    {
      $sort: { relevance: -1, importance: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        type: 1,
        content: 1,
        summary: 1,
        relevance: 1,
        importance: 1
      }
    }
  ]).toArray()

  // Update access metrics
  const memoryIds = memories.map(m => m._id)
  await db.longTermMemory.updateMany(
    { _id: { $in: memoryIds } },
    {
      $inc: { accessCount: 1 },
      $set: { lastAccessed: new Date() }
    }
  )

  return memories
}

// Usage in agent
async function generateResponse(userMessage, userId, sessionId) {
  // Retrieve relevant memories
  const memories = await retrieveRelevantMemories(userMessage, userId)

  // Format memories for context
  const memoryContext = memories.map(m =>
    `[${m.type}] ${m.content}`
  ).join('\n')

  // Include in system prompt
  const systemPrompt = `You are a helpful assistant.

User Information (from memory):
${memoryContext || "No relevant memories found."}

Use this information to personalize your response.`

  return await llm.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ])
}
```

**Retrieve Conversation History:**

```javascript
// Get recent conversation for context
async function getConversationHistory(sessionId, limit = 10) {
  return await db.shortTermMemory.find({
    sessionId: sessionId
  })
  .sort({ turnNumber: -1 })
  .limit(limit)
  .toArray()
  .then(msgs => msgs.reverse())  // Chronological order
}

// Semantic search over past conversations
async function searchConversationHistory(query, userId, options = {}) {
  const { limit = 5, daysBack = 30 } = options
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)

  const queryEmbedding = await embed(query)

  return await db.shortTermMemory.aggregate([
    {
      $vectorSearch: {
        index: "stm_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: limit,
        filter: {
          userId: userId,
          createdAt: { $gte: cutoffDate }
        }
      }
    },
    {
      $project: {
        role: 1,
        content: 1,
        sessionId: 1,
        createdAt: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]).toArray()
}
```

**Combined Memory Retrieval:**

```javascript
// Retrieve from both memory types
async function getFullContext(userMessage, userId, sessionId) {
  // Parallel retrieval
  const [
    longTermMemories,
    conversationHistory,
    relatedPastConversations
  ] = await Promise.all([
    retrieveRelevantMemories(userMessage, userId, { limit: 3 }),
    getConversationHistory(sessionId, 5),
    searchConversationHistory(userMessage, userId, { limit: 2 })
  ])

  return {
    userProfile: longTermMemories,
    currentConversation: conversationHistory,
    relatedHistory: relatedPastConversations
  }
}
```

**When NOT to use this pattern:**

- Privacy requirements prohibit memory storage
- Stateless interactions required
- User requests memory deletion

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB AI Agents](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)
