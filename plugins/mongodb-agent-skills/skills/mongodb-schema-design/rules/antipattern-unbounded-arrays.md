---
title: Avoid Unbounded Arrays
impact: CRITICAL
impactDescription: "Prevents 16MB document crashes and 10-100× write performance degradation"
tags: schema, arrays, anti-pattern, document-size, atlas-suggestion, 16mb-limit
---

## Avoid Unbounded Arrays

**Unbounded arrays are the #1 cause of MongoDB production outages.** When arrays grow indefinitely, documents approach the 16MB BSON limit and eventually crash your application. Even before hitting the limit, large arrays cause 10-100× slower updates because MongoDB must rewrite the entire document and potentially relocate it on disk.

**Incorrect (array grows forever):**

```javascript
// User document with unbounded activity log
// Problem: After 1 year, this array has 100,000+ entries
// Impact: Document size ~15MB, updates take 500ms+, approaching crash
{
  _id: "user123",
  name: "Alice",
  activityLog: [
    { action: "login", ts: ISODate("2024-01-01") },
    { action: "purchase", ts: ISODate("2024-01-02") },
    // ... grows to 100,000+ entries over time
    // Each entry ~150 bytes × 100,000 = 15MB
  ]
}
```

Every update to this document rewrites the entire 15MB, causing 500ms+ latency and potential timeouts. When it hits 16MB, all writes fail permanently.

**Correct (separate collection with reference):**

```javascript
// User document (bounded, ~200 bytes)
{ _id: "user123", name: "Alice", lastActivity: ISODate("2024-01-02") }

// Activity in separate collection (one document per event)
// Each document ~150 bytes, independent writes, no size limits
{ userId: "user123", action: "login", ts: ISODate("2024-01-01") }
{ userId: "user123", action: "purchase", ts: ISODate("2024-01-02") }

// Query recent activity with index on {userId, ts}
db.activities.find({ userId: "user123" }).sort({ ts: -1 }).limit(10)
```

Each activity is an independent document. Writes are O(1), queries use indexes, no size limits.

**Alternative (bucket pattern for time-series):**

```javascript
// Activity bucket - one document per user per day
// Bounded to ~24 hours of activity, typically <100 entries
{
  userId: "user123",
  date: ISODate("2024-01-01"),
  activities: [
    { action: "login", ts: ISODate("2024-01-01T09:00:00Z") },
    { action: "purchase", ts: ISODate("2024-01-01T14:30:00Z") }
  ],
  count: 2  // Denormalized for efficient queries
}

// Query: find today's activity
db.activityBuckets.findOne({
  userId: "user123",
  date: ISODate("2024-01-01")
})
```

Bucket pattern reduces document count 10-100× while keeping arrays bounded by time window.

**When NOT to use this pattern:**

- **Truly bounded arrays are fine**: Tags (max 20), roles (max 5), shipping addresses (max 10). If you can enforce a hard limit, embedding is appropriate.
- **Low-volume applications**: If a user generates <100 events total lifetime, an embedded array may be simpler than a separate collection.
- **Read-heavy with rare writes**: If you read the full array constantly but rarely add to it, embedding avoids $lookup overhead.

## Verify with

```javascript
// Check document sizes in collection
db.users.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    arrayLength: { $size: { $ifNull: ["$activityLog", []] } }
  }},
  { $sort: { size: -1 } },
  { $limit: 10 }
])
// Red flags: size > 1MB or arrayLength > 1000

// Check for arrays that could grow unbounded
db.users.aggregate([
  { $match: { "activityLog.999": { $exists: true } } },
  { $count: "documentsWithLargeArrays" }
])
// Any result > 0 indicates unbounded growth
```

Atlas Schema Suggestions flags: "Array field 'activityLog' may grow without bound"

Reference: [Avoid Unbounded Arrays](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/)
