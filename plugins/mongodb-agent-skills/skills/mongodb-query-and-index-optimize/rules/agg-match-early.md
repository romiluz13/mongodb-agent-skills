---
title: Place $match at Pipeline Start
impact: HIGH
impactDescription: "$match after $lookup: 10M lookups; $match before: 10K lookups—1000× less work"
tags: aggregation, match, filter, optimization, index-usage, pipeline
---

## Place $match at Pipeline Start

**$match at the pipeline start can use indexes; $match after $lookup cannot.** Every document that enters your pipeline flows through all subsequent stages. If you have 10 million orders but only 10,000 are "completed", putting `$match: { status: "completed" }` first means 10K documents flow through $lookup instead of 10M. That's the difference between 100ms and 10 minutes.

**Incorrect ($match after expensive operations—processes everything):**

```javascript
// "Get completed orders with customer details"
db.orders.aggregate([
  // Step 1: Lookup customers for ALL 10M orders
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  // Cost: 10M index lookups on customers collection
  // Memory: 10M documents × (order + customer data)
  // Time: ~45 seconds

  { $unwind: "$customer" },  // Still processing 10M docs

  // Step 2: NOW filter - after all the work is done
  { $match: { status: "completed", "customer.tier": "premium" } }
  // Returns: 500 documents
  // Wasted: 99.995% of the work
])

// What happened:
// - 10M $lookups executed (only needed 10K)
// - 10M $unwinds executed (only needed 10K)
// - 10M documents filtered down to 500
```

**Correct ($match first—filters before expensive operations):**

```javascript
// Split $match: source filters before $lookup, joined filters after
db.orders.aggregate([
  // Step 1: Filter source collection FIRST
  { $match: { status: "completed" } },
  // Uses index on { status: 1 }
  // 10M orders → 10K completed orders
  // Cost: 1 index scan
  // Time: 5ms

  // Step 2: $lookup only the filtered set
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  // Cost: 10K index lookups (not 10M!)
  // Time: ~100ms

  { $unwind: "$customer" },

  // Step 3: Filter on joined data (must be after $lookup)
  { $match: { "customer.tier": "premium" } }
  // Returns: 500 documents
])

// Result: 100ms instead of 45 seconds (450× faster)
```

**Index requirement for $match optimization:**

```javascript
// Only the FIRST $match stage can use indexes
// Subsequent $match stages filter in memory

// Ensure index exists for first $match
db.orders.createIndex({ status: 1, createdAt: -1 })

// This uses index:
db.orders.aggregate([
  { $match: { status: "completed", createdAt: { $gte: lastMonth } } },
  // IXSCAN - bounded index scan
  ...
])

// This does NOT use index (after $lookup):
db.orders.aggregate([
  { $lookup: { from: "customers", ... } },
  { $match: { status: "completed" } }  // COLLSCAN on pipeline data
])
```

**MongoDB's automatic optimizations (and their limits):**

```javascript
// MongoDB WILL reorder these automatically:
db.orders.aggregate([
  { $sort: { createdAt: -1 } },
  { $match: { status: "active" } }  // Moved before $sort ✓
])

db.orders.aggregate([
  { $project: { status: 1, total: 1 } },
  { $match: { status: "active" } }  // Moved before $project ✓
])

// MongoDB CANNOT reorder these:
db.orders.aggregate([
  { $lookup: { from: "customers", ..., as: "customer" } },
  { $match: { "customer.tier": "premium" } }  // Cannot move—field doesn't exist yet
])

db.orders.aggregate([
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $match: { total: { $gt: 1000 } } }  // Cannot move—total computed by $group
])

// YOU must split the $match manually for optimal performance
```

**Complex split $match pattern:**

```javascript
// Dashboard: Premium customers with recent high-value orders
db.orders.aggregate([
  // Part 1: ALL filters on source collection (uses compound index)
  {
    $match: {
      status: "completed",
      createdAt: { $gte: new Date("2024-01-01") },
      total: { $gte: 500 }
    }
  },
  // Index: { status: 1, createdAt: -1, total: 1 }
  // Filters: 10M → 50K orders

  // Part 2: Lookup with its own filtering
  {
    $lookup: {
      from: "customers",
      let: { custId: "$customerId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$custId"] } } },
        // Filter INSIDE $lookup—reduces joined data
        { $match: { tier: "premium", status: "active" } }
      ],
      as: "customer"
    }
  },
  // Only premium, active customers attached

  // Part 3: Filter orders that have matching customers
  { $match: { customer: { $ne: [] } } },
  // Removes orders where customer lookup returned empty

  { $unwind: "$customer" }
])
```

**When NOT to split $match:**

- **Simple pipelines**: If you only have $match + $project, MongoDB optimizes automatically.
- **No expensive stages**: Without $lookup, $group, or $unwind, order matters less.
- **Filtering on computed fields**: `$match: { computedField: x }` must come after the stage that creates it.
- **$graphLookup**: Graph traversal can't be pre-filtered in the same way.

**Verify with:**

```javascript
// Check if $match uses index
function checkMatchOptimization(aggregation) {
  const explain = db.orders.explain("executionStats").aggregate(aggregation)

  // Find the first stage that touches data
  const stages = explain.stages || [explain]
  const firstStage = stages[0]?.$cursor || stages[0]

  const usesIndex = JSON.stringify(firstStage).includes("IXSCAN")
  const executionStats = firstStage?.executionStats || explain.executionStats

  print("First stage uses index:", usesIndex ? "YES ✓" : "NO - COLLSCAN ✗")
  print("Documents examined:", executionStats?.totalDocsExamined || "N/A")
  print("Execution time:", executionStats?.executionTimeMillis + "ms" || "N/A")

  // Check for $match before $lookup
  const pipeline = aggregation
  const lookupIndex = pipeline.findIndex(s => s.$lookup)
  const matchIndex = pipeline.findIndex(s => s.$match)

  if (lookupIndex !== -1 && matchIndex > lookupIndex) {
    print("\n⚠️  WARNING: $match appears after $lookup")
    print("   Consider splitting filters to place source filters before $lookup")
  }

  return usesIndex
}

// Test your pipeline
checkMatchOptimization([
  { $match: { status: "completed" } },
  { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } }
])
```

---

## ⚠️ Before You Implement

**I recommend moving $match early, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Index exists for $match | First $match can use indexes | `db.collection.getIndexes()` |
| Filter fields exist early | Can't filter on computed fields before they exist | Review pipeline |
| Split $match if needed | Source filters before $lookup | Review pipeline structure |

**Check $match placement:**
```javascript
const explain = db.collection.explain("executionStats")
  .aggregate([{ $match: {...} }, ...])
// Check if first stage uses IXSCAN
```

**Interpretation:**
- ✅ First $match uses index: Optimal placement
- ⚠️ $match after $lookup: Split filters
- 🔴 No index for $match fields: Create supporting index

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for supporting index
- `mcp__mongodb__explain` - Analyze pipeline optimization

**Just ask:** "Analyze $match placement in my aggregation on [collection]"

---

Reference: [Aggregation Pipeline Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
