---
title: AI Agent Memory Schema Design
impact: MEDIUM
impactDescription: Proper schema enables effective memory retrieval and context management
tags: agent, memory, schema, short-term, long-term
---

## AI Agent Memory Schema Design

AI agents need both short-term (conversation) and long-term (persistent) memory. Design schemas for each type.

**Incorrect (unstructured memory):**

```javascript
// WRONG: No structure - can't filter or manage
await db.memory.insertOne({
  content: "User likes dark mode"
  // No userId, sessionId, type, embedding, or timestamps
})
// Result: Can't retrieve user-specific memories, no semantic search
```

**Correct (structured memory schemas):**

```javascript
// SHORT-TERM MEMORY: Conversation context
const shortTermMemorySchema = {
  // Identifiers
  sessionId: String,       // Conversation session
  userId: String,          // User identifier
  messageId: String,       // Unique message ID

  // Content
  role: String,            // "user" | "assistant" | "system"
  content: String,         // The message text
  embedding: [Number],     // For semantic search over history

  // Context
  turnNumber: Number,      // Position in conversation
  parentMessageId: String, // For threading

  // Metadata
  createdAt: Date,
  tokenCount: Number,
  model: String
}

// LONG-TERM MEMORY: Persistent knowledge
const longTermMemorySchema = {
  // Identifiers
  memoryId: String,
  userId: String,

  // Content
  type: String,            // "fact" | "preference" | "instruction" | "episode"
  content: String,         // The memory content
  summary: String,         // Condensed version
  embedding: [Number],     // For semantic retrieval

  // Importance
  importance: Number,      // 0-1 score for prioritization
  accessCount: Number,     // How often retrieved
  lastAccessed: Date,

  // Source
  source: {
    sessionId: String,     // Where it was learned
    extractedFrom: String  // Original context
  },

  // Lifecycle
  createdAt: Date,
  expiresAt: Date,         // null for permanent
  status: String           // "active" | "archived" | "forgotten"
}

// Create both types
await db.shortTermMemory.insertOne({
  sessionId: "session_123",
  userId: "user_456",
  messageId: "msg_789",
  role: "user",
  content: "I prefer dark mode and Python code examples",
  embedding: await embed("I prefer dark mode and Python code examples"),
  turnNumber: 1,
  createdAt: new Date(),
  tokenCount: 12
})

await db.longTermMemory.insertOne({
  memoryId: "mem_001",
  userId: "user_456",
  type: "preference",
  content: "User prefers dark mode UI",
  summary: "dark mode preference",
  embedding: await embed("User prefers dark mode UI"),
  importance: 0.8,
  accessCount: 0,
  lastAccessed: null,
  source: {
    sessionId: "session_123",
    extractedFrom: "user message about preferences"
  },
  createdAt: new Date(),
  expiresAt: null,
  status: "active"
})
```

**Indexes for Memory Collections:**

```javascript
// Short-term memory index
db.shortTermMemory.createSearchIndex("stm_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    { type: "filter", path: "sessionId" },
    { type: "filter", path: "userId" },
    { type: "filter", path: "role" }
  ]
})

// TTL index for automatic cleanup
db.shortTermMemory.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 * 7 }  // 7 days
)

// Long-term memory index
db.longTermMemory.createSearchIndex("ltm_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    { type: "filter", path: "userId" },
    { type: "filter", path: "type" },
    { type: "filter", path: "status" },
    { type: "filter", path: "importance" }
  ]
})

// Index for importance-based retrieval
db.longTermMemory.createIndex({ userId: 1, importance: -1 })
```

**Memory Type Guidelines:**

| Type | Use Case | Example | Expiry |
|------|----------|---------|--------|
| `fact` | User information | "Works at Acme Corp" | Never |
| `preference` | User preferences | "Prefers Python" | Never |
| `instruction` | Custom rules | "Always use metric units" | Never |
| `episode` | Past interactions | "Helped debug auth issue" | 90 days |

**When NOT to use this pattern:**

- Simple chatbots without personalization
- Privacy-sensitive applications (implement appropriate data handling)
- Single-session interactions only

Reference: [MongoDB AI Agents](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)
