---
title: Index All $or Clauses for Index Usage
impact: HIGH
impactDescription: "Missing one index = full collection scan; all indexed = parallel index scans merged"
tags: query, or, index, logical-operator, collscan, performance
---

## Index All $or Clauses for Index Usage

**If ANY clause in a `$or` query lacks an index, MongoDB performs a full collection scan.** Unlike `$and` where one indexed clause helps, `$or` requires ALL clauses to have indexes. With proper indexes, MongoDB performs parallel index scans and merges results efficiently. Without them, you're scanning every document.

**Incorrect (one clause missing index—full collection scan):**

```javascript
// Indexes: { status: 1 }, { category: 1 }
// Missing: index on { priority: 1 }

db.tasks.find({
  $or: [
    { status: "urgent" },      // Has index ✓
    { category: "critical" },  // Has index ✓
    { priority: { $gte: 9 } }  // NO INDEX ✗
  ]
})

// What happens:
// MongoDB cannot use partial indexes for $or
// Falls back to COLLSCAN of entire collection
// Even though 2 of 3 clauses have indexes!

// explain() shows:
{
  "winningPlan": {
    "stage": "COLLSCAN"  // Full collection scan!
  },
  "totalDocsExamined": 5000000,
  "executionTimeMillis": 8500
}
```

**Correct (all clauses indexed—parallel index scans):**

```javascript
// Create index for the missing clause
db.tasks.createIndex({ priority: 1 })

// Now all three clauses have indexes:
// { status: 1 }, { category: 1 }, { priority: 1 }

db.tasks.find({
  $or: [
    { status: "urgent" },
    { category: "critical" },
    { priority: { $gte: 9 } }
  ]
})

// What happens:
// 1. Scan status index for "urgent" → 1,000 docs
// 2. Scan category index for "critical" → 500 docs
// 3. Scan priority index for >= 9 → 2,000 docs
// 4. Merge and deduplicate results

// explain() shows:
{
  "winningPlan": {
    "stage": "SUBPLAN",
    "inputStages": [
      { "stage": "IXSCAN", "indexName": "status_1" },
      { "stage": "IXSCAN", "indexName": "category_1" },
      { "stage": "IXSCAN", "indexName": "priority_1" }
    ]
  },
  "totalDocsExamined": 3500,  // Only matching docs
  "executionTimeMillis": 45    // 190× faster!
}
```

**Use `$in` instead of `$or` for same-field queries:**

```javascript
// BAD: $or on same field
db.products.find({
  $or: [
    { status: "active" },
    { status: "pending" },
    { status: "review" }
  ]
})

// GOOD: Use $in (more efficient, cleaner)
db.products.find({
  status: { $in: ["active", "pending", "review"] }
})
// Single index scan with multiple seeks
// Much more efficient than $or with 3 clauses
```

**Combining `$or` with other conditions:**

```javascript
// $or within a larger query
db.orders.find({
  customerId: "cust123",          // Equality filter
  $or: [
    { status: "pending" },
    { priority: "high" },
    { dueDate: { $lt: tomorrow } }
  ]
})

// Best indexing strategy: compound indexes starting with customerId
db.orders.createIndex({ customerId: 1, status: 1 })
db.orders.createIndex({ customerId: 1, priority: 1 })
db.orders.createIndex({ customerId: 1, dueDate: 1 })

// MongoDB will:
// 1. Use customerId prefix on all three indexes
// 2. Scan each for the $or clause
// 3. Merge results
```

**Special cases with `$or`:**

```javascript
// 1. $or with $text requires ALL clauses to use text index
// This is INVALID (text requires dedicated index):
db.products.find({
  $or: [
    { $text: { $search: "laptop" } },
    { category: "electronics" }    // Can't mix with $text in $or
  ]
})

// 2. $or with $near is NOT allowed
// $near must be the only geospatial clause
// This is INVALID:
db.places.find({
  $or: [
    { location: { $near: [40, -74] } },
    { featured: true }
  ]
})

// 3. Nested $or is allowed but complex
db.items.find({
  $or: [
    { $or: [{ a: 1 }, { b: 2 }] },
    { c: 3 }
  ]
})
// Ensure ALL leaf clauses have indexes
```

**When NOT to worry about `$or` indexing:**

- **Small collections**: <10K documents where COLLSCAN is fast anyway.
- **Already filtered by equality**: `{ tenantId: X, $or: [...] }` where compound indexes cover all cases.
- **Rare queries**: One-time analytics where performance isn't critical.

**Verify with:**

```javascript
// Check if $or query uses indexes
function checkOrIndexUsage(collection, query) {
  const explain = db[collection].find(query).explain("executionStats")
  const plan = JSON.stringify(explain.queryPlanner.winningPlan)

  const hasCOLLSCAN = plan.includes('"COLLSCAN"')
  const hasOR = plan.includes('"OR"') || plan.includes('"SUBPLAN"')

  print(`\n$or Query Analysis:`)
  print(`  Uses indexes: ${!hasCOLLSCAN ? "YES ✓" : "NO ✗"}`)

  if (hasCOLLSCAN) {
    print(`\n⚠️  COLLSCAN detected!`)
    print(`   At least one $or clause is missing an index.`)
    print(`   Check each clause and create missing indexes.`)
  } else if (hasOR) {
    print(`   Multiple index scans merged (optimal)`)
  }

  print(`\n  Docs examined: ${explain.executionStats.totalDocsExamined}`)
  print(`  Docs returned: ${explain.executionStats.nReturned}`)
  print(`  Time: ${explain.executionStats.executionTimeMillis}ms`)

  return !hasCOLLSCAN
}

// Test your $or query
checkOrIndexUsage("tasks", {
  $or: [
    { status: "urgent" },
    { category: "critical" },
    { priority: { $gte: 9 } }
  ]
})
```

---

## ⚠️ Before You Implement

**I recommend indexing all $or clauses, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Identify all $or clauses | Each clause needs an index | Review query |
| Check existing indexes | May already have coverage | `db.collection.getIndexes()` |
| Consider $in alternative | Same-field OR should use $in | Review query pattern |

**Check $or query index usage:**
```javascript
const explain = db.collection.find({
  $or: [{ field1: "a" }, { field2: "b" }]
}).explain("executionStats")
print(`Stage: ${explain.queryPlanner.winningPlan.stage}`)
// COLLSCAN = at least one clause missing index
```

**Interpretation:**
- ✅ All clauses indexed: Parallel index scans merged
- ⚠️ Same-field $or: Convert to $in
- 🔴 COLLSCAN: Find and index missing clause

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - List all indexes
- `mcp__mongodb__explain` - Analyze $or query

**Just ask:** "Verify $or query indexing on [collection]"

---

Reference: [$or Query Operator](https://mongodb.com/docs/manual/reference/operator/query/or/)
