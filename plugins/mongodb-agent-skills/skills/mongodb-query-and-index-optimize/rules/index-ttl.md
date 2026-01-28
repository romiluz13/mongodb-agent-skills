---
title: Use TTL Indexes for Automatic Data Expiration
impact: HIGH
impactDescription: "Auto-delete old sessions/logs: no cron jobs, no manual cleanup, constant collection size"
tags: index, ttl, expiration, cleanup, sessions, logs, time-to-live
---

## Use TTL Indexes for Automatic Data Expiration

**TTL indexes automatically delete documents after a specified time—no cron jobs, no maintenance scripts.** Sessions, logs, and temporary data that should expire after 24 hours? Create a TTL index and MongoDB handles deletion automatically. This keeps collections bounded, queries fast, and eliminates the operational burden of cleanup scripts.

**Incorrect (manual cleanup with cron jobs):**

```javascript
// Sessions collection grows unbounded
// Manual cleanup required:

// Cron job runs every hour:
db.sessions.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 24*60*60*1000) }
})

// Problems:
// 1. Operational burden: Must maintain cron job
// 2. Batch deletes cause load spikes
// 3. Collection grows between cleanup runs
// 4. If cron fails, data accumulates indefinitely
// 5. Delete operations compete with production traffic

// Same issues with logs, tokens, temporary files, etc.
```

**Correct (TTL index for automatic expiration):**

```javascript
// TTL index: Documents deleted automatically after expiry
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours = 86400 seconds
)

// How it works:
// 1. MongoDB background thread checks every 60 seconds
// 2. Finds documents where: createdAt + expireAfterSeconds < now
// 3. Deletes them automatically

// Document lifecycle:
{ _id: "sess1", createdAt: ISODate("2024-01-15T10:00:00Z"), userId: "u1" }
// Created: Jan 15, 10:00 AM
// Expires: Jan 16, 10:00 AM (24 hours later)
// Deleted: Within ~60 seconds after expiry

// Benefits:
// - No cron jobs or cleanup scripts
// - Continuous deletion (no batch spikes)
// - Collection stays bounded
// - Zero operational maintenance
```

**TTL on specific expiration field:**

```javascript
// Option 1: Fixed TTL from creation time
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // 1 hour
)
// Expires 1 hour after createdAt

// Option 2: Explicit expiration timestamp (expireAfterSeconds: 0)
db.sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }  // Document specifies exact expiry time
)

// Document with explicit expiry:
{
  _id: "sess1",
  userId: "u1",
  expiresAt: ISODate("2024-01-15T11:00:00Z")  // Exact expiry time
}

// Why explicit expiry is powerful:
// - Different documents can have different lifetimes
// - "Remember me" sessions: 30 days
// - Regular sessions: 24 hours
// - Password reset tokens: 1 hour

db.sessions.insertOne({
  _id: "regular",
  expiresAt: new Date(Date.now() + 24*60*60*1000)  // 24 hours
})

db.sessions.insertOne({
  _id: "rememberMe",
  expiresAt: new Date(Date.now() + 30*24*60*60*1000)  // 30 days
})
```

**Common TTL use cases:**

```javascript
// 1. Session management
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// Each session sets its own expiresAt based on type

// 2. Rate limiting windows
db.rateLimits.createIndex(
  { windowStart: 1 },
  { expireAfterSeconds: 60 }  // 1-minute sliding windows
)

// 3. Email verification tokens
db.verificationTokens.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours to verify
)

// 4. Password reset tokens
db.passwordResets.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // 1 hour to reset
)

// 5. Temporary file references
db.tempFiles.createIndex(
  { uploadedAt: 1 },
  { expireAfterSeconds: 7200 }  // 2 hours to process
)

// 6. Application logs (keep last 7 days)
db.logs.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 604800 }  // 7 days
)

// 7. Cache with TTL
db.cache.createIndex(
  { cachedAt: 1 },
  { expireAfterSeconds: 300 }  // 5 minutes
)
```

**TTL index requirements:**

```javascript
// Field MUST be a Date or array of Dates
// ✓ Works:
{ createdAt: new Date() }
{ expiresAt: ISODate("2024-01-15T10:00:00Z") }
{ timestamps: [new Date(), new Date()] }  // Uses earliest date

// ✗ Does NOT work:
{ createdAt: "2024-01-15" }           // String, not Date
{ createdAt: 1705312800 }             // Number (epoch), not Date
{ createdAt: { date: new Date() } }   // Nested object

// If field is missing or wrong type, document NEVER expires!

// CRITICAL: Validate your data
db.sessions.find({
  $or: [
    { expiresAt: { $exists: false } },
    { expiresAt: { $not: { $type: "date" } } }
  ]
}).count()
// Should be 0 for proper TTL function
```

**TTL deletion timing:**

```javascript
// TTL background task runs every 60 seconds
// Deletion is NOT instantaneous!

// Timeline:
// T+0:00 - Document expires (createdAt + TTL reached)
// T+0:00 to T+1:00 - Document still exists (waiting for next run)
// T+1:00 - Background task runs, marks document for deletion
// T+1:01 - Document deleted

// Worst case: Document exists up to ~60 seconds past expiry
// Average: ~30 seconds past expiry

// Implications:
// - Don't rely on TTL for exact-time expiration
// - Queries should still check expiry: { expiresAt: { $gt: new Date() } }
// - For time-critical expiry, add application-level check

// Query pattern for active sessions:
db.sessions.find({
  userId: "u1",
  expiresAt: { $gt: new Date() }  // Double-check in query
})
```

**Modifying TTL index:**

```javascript
// Change expireAfterSeconds on existing TTL index:
db.runCommand({
  collMod: "sessions",
  index: {
    keyPattern: { createdAt: 1 },
    expireAfterSeconds: 7200  // Change from 1 hour to 2 hours
  }
})

// Cannot convert regular index to TTL - must recreate:
db.sessions.dropIndex({ createdAt: 1 })
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }
)

// Cannot have TTL on compound indexes:
db.sessions.createIndex(
  { userId: 1, createdAt: 1 },
  { expireAfterSeconds: 3600 }
)
// ERROR: TTL index must be single-field
```

**When NOT to use TTL indexes:**

- **Compound index needed**: TTL only works on single-field indexes. Use cron for complex cleanup.
- **Exact expiration time critical**: TTL has ~60 second delay; use application logic for precision.
- **Audit requirements**: TTL deletes without logging. If you need audit trail, use soft delete + cron.
- **Large batch deletes**: If millions expire simultaneously, TTL can cause load. Consider partitioning.
- **Capped collections**: TTL indexes can't be created on capped collections.

**Verify with:**

```javascript
// Check TTL index configuration
function checkTTLIndexes(collection) {
  const indexes = db[collection].getIndexes()
  const ttlIndexes = indexes.filter(i => i.expireAfterSeconds !== undefined)

  if (ttlIndexes.length === 0) {
    print(`No TTL indexes on ${collection}`)
    return
  }

  print(`TTL indexes on ${collection}:`)
  ttlIndexes.forEach(idx => {
    const field = Object.keys(idx.key)[0]
    const ttlSeconds = idx.expireAfterSeconds
    const ttlHuman = ttlSeconds === 0
      ? "Document-specified (expiresAt field)"
      : `${ttlSeconds} seconds (${(ttlSeconds/3600).toFixed(1)} hours)`

    print(`\n  Index: ${idx.name}`)
    print(`  Field: ${field}`)
    print(`  TTL: ${ttlHuman}`)

    // Check for documents with invalid date field
    const invalidCount = db[collection].countDocuments({
      $or: [
        { [field]: { $exists: false } },
        { [field]: { $not: { $type: "date" } } }
      ]
    })

    if (invalidCount > 0) {
      print(`  ⚠️  WARNING: ${invalidCount} docs missing/invalid ${field} - won't expire!`)
    } else {
      print(`  ✓ All documents have valid ${field}`)
    }
  })

  // Show expiration stats
  print(`\nExpiration stats:`)
  const now = new Date()
  const expired = db[collection].countDocuments({ [Object.keys(ttlIndexes[0].key)[0]]: { $lt: now } })
  const total = db[collection].countDocuments()
  print(`  Documents past expiry (pending deletion): ${expired}`)
  print(`  Total documents: ${total}`)
}

// Usage
checkTTLIndexes("sessions")
```

---

## ⚠️ Before You Implement

**I recommend creating a TTL index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| No existing TTL index | Only one TTL index per collection | `db.collection.getIndexes()` |
| Field is Date type | TTL only works on Date fields | Check field type in documents |
| No existing data issues | Documents with missing/invalid dates won't expire | See query below |

**Check for existing TTL indexes:**
```javascript
db.collection.getIndexes().filter(i => i.expireAfterSeconds !== undefined)
```

**Validate date field:**
```javascript
db.collection.countDocuments({
  $or: [
    { dateField: { $exists: false } },
    { dateField: { $not: { $type: "date" } } }
  ]
})
// Should be 0 for proper TTL function
```

**Interpretation:**
- ✅ No existing TTL + valid dates: Safe to create
- ⚠️ Some documents have invalid dates: Fix data first
- 🔴 TTL index already exists: Cannot add another

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing TTL indexes
- `mcp__mongodb__aggregate` - Validate date field types

**Just ask:** "Verify if I can add a TTL index on [field] in [collection]"

---

Reference: [TTL Indexes](https://mongodb.com/docs/manual/core/index-ttl/)
