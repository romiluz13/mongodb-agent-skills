---
title: Respect the 16MB Document Limit
impact: CRITICAL
impactDescription: "Hard limit—exceeding crashes writes, corrupts data, requires emergency refactoring"
tags: schema, fundamentals, document-size, 16mb, bson-limit, atlas-suggestion
---

## Respect the 16MB Document Limit

**MongoDB documents cannot exceed 16 megabytes (16,777,216 bytes).** This is a hard BSON limit—not a guideline. When a document approaches this limit, writes fail, applications crash, and you're forced into emergency schema refactoring. Design to stay well under this limit from day one.

**How documents hit 16MB:**

```javascript
// Scenario 1: Unbounded arrays
{
  _id: "user1",
  activityLog: [
    // 100,000 events × 150 bytes = 15MB
    { action: "login", ts: ISODate("..."), ip: "..." },
    // ... grows forever until crash
  ]
}

// Scenario 2: Large embedded binary
{
  _id: "doc1",
  content: "...",
  attachments: [
    { filename: "report.pdf", data: BinData(0, "...") }  // 10MB PDF
    // One more attachment = crash
  ]
}

// Scenario 3: Deeply nested objects
{
  _id: "config1",
  settings: {
    level1: {
      level2: {
        // ... 100 levels of nesting
        // Metadata + keys alone can reach 16MB
      }
    }
  }
}
```

**Symptoms of approaching 16MB:**

- `Document exceeds maximum allowed size` errors
- Write operations failing sporadically
- Slow queries returning large documents
- Memory spikes when fetching documents

**Correct (design for size constraints):**

```javascript
// Instead of unbounded arrays, use separate collection
// User document stays small
{
  _id: "user1",
  name: "Alice",
  activityCount: 100000,
  lastActivity: ISODate("2024-01-15")
}

// Activities in separate collection
{
  userId: "user1",
  action: "login",
  ts: ISODate("2024-01-15"),
  ip: "192.168.1.1"
}

// Instead of embedded binary, use GridFS
const bucket = new GridFSBucket(db)
const uploadStream = bucket.openUploadStream("report.pdf")
// Store file reference in document
{
  _id: "doc1",
  content: "...",
  attachments: [
    { filename: "report.pdf", gridfsId: ObjectId("...") }
  ]
}
```

**Size estimation:**

```javascript
// Check current document size
db.users.aggregate([
  { $match: { _id: "user1" } },
  { $project: { size: { $bsonSize: "$$ROOT" } } }
])

// Find largest documents in collection
db.users.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $sort: { size: -1 } },
  { $limit: 10 }
])

// Size of specific fields
db.users.aggregate([
  { $project: {
    total: { $bsonSize: "$$ROOT" },
    activitySize: { $bsonSize: { $ifNull: ["$activityLog", []] } },
    profileSize: { $bsonSize: { $ifNull: ["$profile", {}] } }
  }}
])
```

**Safe size thresholds:**

| Document Size | Risk Level | Action |
|---------------|------------|--------|
| <100 KB | Safe | Normal operation |
| 100 KB - 1 MB | Monitor | Watch for growth patterns |
| 1 MB - 5 MB | Warning | Plan refactoring, add alerts |
| 5 MB - 10 MB | Critical | Refactor immediately |
| >10 MB | Emergency | Document at risk of failure |

**Prevention strategies:**

```javascript
// 1. Schema validation with array limits
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        addresses: { maxItems: 10 },
        tags: { maxItems: 100 }
      }
    }
  }
})

// 2. Application-level checks before write
const doc = await db.users.findOne({ _id: userId })
const currentSize = BSON.calculateObjectSize(doc)
if (currentSize > 10 * 1024 * 1024) {  // 10MB warning
  throw new Error("Document approaching size limit")
}

// 3. Use $slice to cap arrays
db.users.updateOne(
  { _id: userId },
  {
    $push: {
      activityLog: {
        $each: [newActivity],
        $slice: -1000  // Keep only last 1000
      }
    }
  }
)
```

**GridFS for large binary data:**

```javascript
// Files >16MB must use GridFS
const { GridFSBucket } = require('mongodb')
const bucket = new GridFSBucket(db, { bucketName: 'attachments' })

// Upload large file
const uploadStream = bucket.openUploadStream('large-video.mp4')
fs.createReadStream('./large-video.mp4').pipe(uploadStream)

// Reference in document
{
  _id: "post1",
  title: "My Video Post",
  videoId: uploadStream.id  // Reference, not embedded
}

// Download when needed
const downloadStream = bucket.openDownloadStream(videoId)
```

**When NOT to worry about 16MB:**

- **Small, fixed schemas**: User profiles, configs, small entities rarely hit limits.
- **Bounded arrays with validation**: If you enforce `maxItems: 50`, you're safe.
- **Read-heavy with controlled writes**: If writes are always small updates.

**Verify with:**

```javascript
// Set up monitoring for large documents
db.createCollection("documentSizeAlerts")

// Periodic check (run via cron/scheduled job)
db.users.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $match: { size: { $gt: 5000000 } } },  // >5MB
  { $merge: {
    into: "documentSizeAlerts",
    whenMatched: "replace"
  }}
])

// Alert if any documents are approaching limit
db.documentSizeAlerts.find({ size: { $gt: 10000000 } })
```

Reference: [BSON Document Size Limit](https://mongodb.com/docs/manual/reference/limits/#std-label-limit-bson-document-size)
