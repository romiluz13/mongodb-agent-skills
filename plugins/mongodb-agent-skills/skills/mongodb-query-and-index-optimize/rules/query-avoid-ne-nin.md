---
title: Avoid $ne and $nin Operators
impact: HIGH
impactDescription: "Negation scans 90%+ of index—$in with positive values is 10-100× faster"
tags: query, operators, ne, nin, anti-pattern, index-usage, negation
---

## Avoid $ne and $nin Operators

**Negation operators ($ne, $nin, $not) cannot efficiently use indexes—they scan everything except the excluded values.** If your collection has 1 million documents and you query `{ status: { $ne: "deleted" } }`, MongoDB scans 950,000 index entries to exclude 50,000. Use positive matching with $in instead, or restructure your schema to avoid negation patterns.

**Incorrect (negation—scans almost entire index):**

```javascript
// "Find all non-deleted users"
db.users.find({ status: { $ne: "deleted" } })

// Data distribution in 1M users:
// status="active": 700,000 docs
// status="pending": 150,000 docs
// status="suspended": 100,000 docs
// status="deleted": 50,000 docs

// With index on { status: 1 }, MongoDB must:
// 1. Scan "active" range (700K entries) → return all
// 2. Scan "pending" range (150K entries) → return all
// 3. Scan "suspended" range (100K entries) → return all
// 4. Skip "deleted" range (50K entries) → ignore
// Total: Scans 950,000 index entries = 95% of index

// explain() shows:
{
  "totalKeysExamined": 950000,  // Almost full index scan
  "totalDocsExamined": 950000,
  "executionTimeMillis": 4500
}

// Similarly problematic:
db.orders.find({ status: { $nin: ["cancelled", "refunded", "failed"] } })
// Scans everything except 3 statuses
```

**Correct (positive matching—targeted index scan):**

```javascript
// Explicitly list the values you WANT
db.users.find({
  status: { $in: ["active", "pending", "suspended"] }
})

// MongoDB execution:
// 1. Three targeted index seeks
// 2. Returns exact matches only
// 3. No scanning of unwanted values

// explain() shows:
{
  "totalKeysExamined": 950000,  // Same count but...
  "indexBounds": {
    "status": [
      "[\"active\", \"active\"]",
      "[\"pending\", \"pending\"]",
      "[\"suspended\", \"suspended\"]"
    ]
  },
  "executionTimeMillis": 450    // 10× faster!
}

// Why faster? Index seeks vs index scan
// $ne: Continuous scan skipping values (seek + scan + skip + scan)
// $in: Direct seeks to each value (seek + seek + seek)
```

**Schema redesign to eliminate negation:**

```javascript
// PATTERN 1: Boolean flag for common filter
// Instead of: { status: { $ne: "deleted" } }

// Add boolean field:
{
  status: "inactive",
  isDeleted: false    // Index this!
}

// Query becomes positive:
db.users.createIndex({ isDeleted: 1, status: 1 })
db.users.find({ isDeleted: false })
// Instant jump to isDeleted=false in index

// PATTERN 2: Separate collection for archived/deleted
// Instead of: { status: { $ne: "deleted" } } on users

// Move deleted to archive:
db.users.deleteOne({ _id: userId })
db.users_archive.insertOne({
  ...deletedUser,
  deletedAt: new Date(),
  deletedBy: adminId
})

// Active query needs no filter:
db.users.find({ status: "active" })

// PATTERN 3: Lifecycle status with clear states
// Instead of: { status: { $nin: ["cancelled", "refunded", "expired"] } }

// Add "isActive" or use status groups:
{
  status: "processing",
  statusGroup: "active"  // "active" | "terminal" | "archived"
}

db.orders.createIndex({ statusGroup: 1, createdAt: -1 })
db.orders.find({ statusGroup: "active" })
```

**Why negation is fundamentally inefficient:**

```javascript
// Index structure (B-tree):
//
//          [status index]
//         /      |       \
//     active  deleted   pending   suspended
//       |        |         |          |
//     700K     50K       150K       100K
//
// $ne: "deleted" must visit ALL branches except "deleted"
// - Cannot skip to a single point
// - Must scan multiple ranges
// - Order of scanning is: active → pending → suspended
//
// $in: ["active", "pending"] does targeted seeks
// - Seek to "active", read that subtree
// - Seek to "pending", read that subtree
// - Done. No wasted scanning.
```

**When $ne/$nin is acceptable:**

- **Tiny collections**: <10K documents where full scan is fast anyway.
- **Excluding rare values**: If excluded value is <1% of data, overhead is minimal.
- **No better alternative**: Complex polymorphic data where positive enumeration isn't practical.
- **Combined with selective equality**: `{ tenantId: "x", type: { $ne: "system" } }` where tenantId reduces to small set first.

## Verify with

```javascript
// Compare negation vs positive matching
async function compareNegationVsPositive(collection, field, excludeValue) {
  // Get all distinct values
  const allValues = await db[collection].distinct(field)
  const positiveValues = allValues.filter(v => v !== excludeValue)

  // Test negation
  const negExplain = db[collection]
    .find({ [field]: { $ne: excludeValue } })
    .explain("executionStats")

  // Test positive $in
  const posExplain = db[collection]
    .find({ [field]: { $in: positiveValues } })
    .explain("executionStats")

  print(`\n$ne query:`)
  print(`  Keys examined: ${negExplain.executionStats.totalKeysExamined}`)
  print(`  Time: ${negExplain.executionStats.executionTimeMillis}ms`)

  print(`\n$in query (${positiveValues.length} values):`)
  print(`  Keys examined: ${posExplain.executionStats.totalKeysExamined}`)
  print(`  Time: ${posExplain.executionStats.executionTimeMillis}ms`)

  const improvement = (
    negExplain.executionStats.executionTimeMillis /
    posExplain.executionStats.executionTimeMillis
  ).toFixed(1)
  print(`\nPositive matching is ${improvement}× faster`)
}

// Usage
compareNegationVsPositive("users", "status", "deleted")
```

Reference: [\$ne Operator](https://mongodb.com/docs/manual/reference/operator/query/ne/), [\$nin Operator](https://mongodb.com/docs/manual/reference/operator/query/nin/)
