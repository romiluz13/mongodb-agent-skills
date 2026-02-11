---
title: Session Context Storage
impact: MEDIUM
impactDescription: Maintains conversation continuity across interactions
tags: agent, session, context, conversation, history
---

## Session Context Storage

Store and manage conversation sessions for continuity across interactions and context persistence.

**Incorrect (no session management):**

```javascript
// WRONG: No session tracking
await db.messages.insertOne({
  role: "user",
  content: userMessage
  // No session, no user, no ordering
})
// Result: Can't maintain conversation continuity

// WRONG: Storing entire conversation in single document
await db.sessions.updateOne(
  { sessionId: sessionId },
  { $push: { messages: { role: "user", content: userMessage } } }
)
// Result: Document grows unbounded, hits 16MB limit
```

**Correct (session-based storage):**

```javascript
// Session document (metadata only)
const sessionSchema = {
  sessionId: String,
  userId: String,

  // Session metadata
  title: String,           // Auto-generated or user-set
  createdAt: Date,
  lastActivity: Date,
  status: String,          // "active" | "archived" | "deleted"

  // Context summary
  summary: String,         // Condensed conversation context
  summaryEmbedding: [Number],

  // Statistics
  messageCount: Number,
  totalTokens: Number,

  // Settings
  model: String,
  temperature: Number
}

// Create new session
async function createSession(userId, model = "gpt-4") {
  const sessionId = generateId()

  await db.sessions.insertOne({
    sessionId,
    userId,
    title: "New Conversation",
    createdAt: new Date(),
    lastActivity: new Date(),
    status: "active",
    summary: null,
    summaryEmbedding: null,
    messageCount: 0,
    totalTokens: 0,
    model
  })

  return sessionId
}

// Add message to session
async function addMessage(sessionId, role, content) {
  const messageId = generateId()
  const embedding = await embed(content)
  const tokenCount = estimateTokens(content)

  // Get current turn number
  const lastMessage = await db.shortTermMemory
    .find({ sessionId })
    .sort({ turnNumber: -1 })
    .limit(1)
    .toArray()

  const turnNumber = (lastMessage[0]?.turnNumber || 0) + 1

  // Insert message
  await db.shortTermMemory.insertOne({
    sessionId,
    messageId,
    role,
    content,
    embedding,
    turnNumber,
    createdAt: new Date(),
    tokenCount
  })

  // Update session metadata
  await db.sessions.updateOne(
    { sessionId },
    {
      $set: { lastActivity: new Date() },
      $inc: {
        messageCount: 1,
        totalTokens: tokenCount
      }
    }
  )

  return messageId
}
```

**Session Context Retrieval:**

```javascript
// Get recent context for LLM
async function getSessionContext(sessionId, maxTokens = 4000) {
  let totalTokens = 0
  const messages = []

  // Get messages in reverse order
  const cursor = db.shortTermMemory
    .find({ sessionId })
    .sort({ turnNumber: -1 })

  for await (const msg of cursor) {
    if (totalTokens + msg.tokenCount > maxTokens) break
    messages.unshift(msg)  // Add to front for chronological order
    totalTokens += msg.tokenCount
  }

  return messages.map(m => ({
    role: m.role,
    content: m.content
  }))
}

// Resume conversation with context
async function resumeConversation(sessionId, newMessage) {
  // Get existing context
  const history = await getSessionContext(sessionId)

  // Add new message
  await addMessage(sessionId, "user", newMessage)

  // Get relevant long-term memory
  const session = await db.sessions.findOne({ sessionId })
  const memories = await retrieveRelevantMemories(newMessage, session.userId)

  // Build full context
  return {
    messages: [
      ...buildMemoryContext(memories),
      ...history,
      { role: "user", content: newMessage }
    ]
  }
}
```

**Session Summary for Long Conversations:**

```javascript
// Summarize conversation when it gets long
async function summarizeSession(sessionId) {
  const session = await db.sessions.findOne({ sessionId })

  // Only summarize if conversation is long
  if (session.messageCount < 10) return

  // Get all messages
  const messages = await db.shortTermMemory
    .find({ sessionId })
    .sort({ turnNumber: 1 })
    .toArray()

  // Generate summary via LLM
  const summaryPrompt = `Summarize this conversation in 2-3 sentences, capturing key topics and any user preferences learned:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`

  const summary = await llm.complete(summaryPrompt)
  const summaryEmbedding = await embed(summary)

  // Update session with summary
  await db.sessions.updateOne(
    { sessionId },
    {
      $set: {
        summary,
        summaryEmbedding
      }
    }
  )

  return summary
}

// Use summary for quick context
async function getQuickContext(sessionId) {
  const session = await db.sessions.findOne({ sessionId })

  if (session.summary) {
    // Use summary + recent messages
    const recentMessages = await db.shortTermMemory
      .find({ sessionId })
      .sort({ turnNumber: -1 })
      .limit(5)
      .toArray()

    return {
      summary: session.summary,
      recentMessages: recentMessages.reverse()
    }
  }

  return { recentMessages: await getSessionContext(sessionId) }
}
```

**Session Lifecycle Management:**

```javascript
// List user's sessions
async function listSessions(userId, status = "active") {
  return db.sessions
    .find({ userId, status })
    .sort({ lastActivity: -1 })
    .project({ sessionId: 1, title: 1, lastActivity: 1, messageCount: 1 })
    .toArray()
}

// Archive old sessions
async function archiveOldSessions(userId, daysOld = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  await db.sessions.updateMany(
    {
      userId,
      status: "active",
      lastActivity: { $lt: cutoff }
    },
    { $set: { status: "archived" } }
  )
}

// Delete session and messages
async function deleteSession(sessionId) {
  await db.shortTermMemory.deleteMany({ sessionId })
  await db.sessions.deleteOne({ sessionId })
}
```

**When NOT to use this pattern:**

- Ephemeral interactions (one-shot queries)
- Privacy requirements mandate no storage
- Extremely high-volume, low-value interactions

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB AI Agents](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)
