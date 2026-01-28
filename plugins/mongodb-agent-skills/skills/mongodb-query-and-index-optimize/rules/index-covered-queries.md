---
title: Design Indexes for Covered Queries
impact: HIGH
impactDescription: "2-10× faster reads by eliminating disk I/O—return results from index RAM without touching documents"
tags: index, covered-query, projection, performance, ixscan, totalDocsExamined
---

## Design Indexes for Covered Queries

**A covered query returns results entirely from the index without fetching documents from disk.** Since indexes live in RAM and documents may be on disk, covered queries can be 2-10× faster. The key is including all queried AND projected fields in the index. When you see `totalDocsExamined: 0` in explain(), you've achieved a covered query.

**Incorrect (query fetches documents—disk I/O):**

```javascript
// Index only on query field
db.users.createIndex({ email: 1 })

// Query needs fields not in index
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 0 }
)

// explain() shows:
{
  "executionStats": {
    "totalKeysExamined": 1,     // Found 1 index entry
    "totalDocsExamined": 1,     // HAD TO FETCH DOCUMENT
    "nReturned": 1
  },
  "queryPlanner": {
    "winningPlan": {
      "stage": "PROJECTION_SIMPLE",
      "inputStage": {
        "stage": "FETCH",        // FETCH = disk I/O
        "inputStage": {
          "stage": "IXSCAN"      // Index found the match
        }
      }
    }
  }
}

// Flow: Index → Disk → Return
// The FETCH stage reads the full 4KB document just to get "name"
```

**Correct (covered query—no disk I/O):**

```javascript
// Index includes ALL projected fields
db.users.createIndex({ email: 1, name: 1 })

// Same query, now covered
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 0 }  // CRITICAL: Must exclude _id
)

// explain() shows:
{
  "executionStats": {
    "totalKeysExamined": 1,     // Found 1 index entry
    "totalDocsExamined": 0,     // ZERO DOCUMENTS FETCHED!
    "nReturned": 1
  },
  "queryPlanner": {
    "winningPlan": {
      "stage": "PROJECTION_COVERED",  // Covered!
      "inputStage": {
        "stage": "IXSCAN"             // No FETCH stage
      }
    }
  }
}

// Flow: Index → Return
// All data came from index, no document fetch needed
```

**Requirements for covered queries:**

```javascript
// All four conditions must be true:

// 1. All query filter fields are in index
{ email: "x" }                // email must be in index ✓

// 2. All projected fields are in index
{ name: 1, email: 1 }         // name AND email must be in index ✓

// 3. _id is excluded OR _id is in index
{ _id: 0, name: 1, email: 1 } // _id excluded ✓
// OR
db.users.createIndex({ _id: 1, email: 1, name: 1 })  // _id in index ✓

// 4. No operations that prevent coverage
// - No $elemMatch in projection
// - No array field access like "items.0"
// - No nested array queries
```

**The _id gotcha (most common mistake):**

```javascript
// FAILS to be covered - _id is included by default
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1 }  // _id implicitly included!
)
// totalDocsExamined: 1 (not covered)

// WORKS - explicitly exclude _id
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 0 }  // _id excluded
)
// totalDocsExamined: 0 (covered!)

// ALTERNATIVE - include _id in index
db.users.createIndex({ email: 1, name: 1, _id: 1 })
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 1 }  // _id from index
)
// totalDocsExamined: 0 (covered!)
```

**High-value covered query patterns:**

```javascript
// Pattern 1: List view (most common)
// Show list of items with minimal fields
db.products.createIndex({
  category: 1,      // Query filter
  name: 1,          // Display field
  price: 1,         // Display field
  rating: 1         // Display field
})
db.products.find(
  { category: "electronics" },
  { name: 1, price: 1, rating: 1, _id: 0 }
).limit(50)
// Returns 50 products without touching a single document

// Pattern 2: Paginated list with sort
db.posts.createIndex({
  status: 1,        // Query filter
  createdAt: -1,    // Sort field
  title: 1,         // Display field
  author: 1         // Display field
})
db.posts.find(
  { status: "published" },
  { title: 1, author: 1, createdAt: 1, _id: 0 }
).sort({ createdAt: -1 }).limit(20)

// Pattern 3: Exists/count checks
db.users.createIndex({ email: 1 })
db.users.find(
  { email: "test@example.com" },
  { email: 1, _id: 0 }  // Just checking existence
).limit(1)
// Returns instantly from index, no doc fetch

// Pattern 4: Aggregation with covered $match/$project
db.orders.createIndex({ customerId: 1, total: 1, createdAt: 1 })
db.orders.aggregate([
  { $match: { customerId: "cust123" } },
  { $project: { total: 1, createdAt: 1, _id: 0 } },  // Covered!
  { $group: { _id: null, sum: { $sum: "$total" } } }
])
```

**When NOT to design for covered queries:**

- **Wide projections**: If you need 10+ fields, adding them all to index isn't worth it—index becomes huge.
- **Frequently changing fields**: Adding volatile fields to index increases write overhead significantly.
- **Detail views**: Single-document fetches for full detail are fine—overhead is minimal.
- **Hot data**: If documents are already in WiredTiger cache, covered query benefit is reduced.

**Verify with:**

```javascript
// Check if query is covered
function isCovered(query, projection) {
  const explain = query.project(projection).explain("executionStats")
  const stats = explain.executionStats

  const covered = stats.totalDocsExamined === 0 && stats.nReturned > 0

  print(`Documents examined: ${stats.totalDocsExamined}`)
  print(`Documents returned: ${stats.nReturned}`)
  print(`Covered query: ${covered ? "YES ✓" : "NO - needs FETCH"}`)

  if (!covered) {
    const plan = JSON.stringify(explain.queryPlanner.winningPlan)
    if (plan.includes("FETCH")) {
      print("Issue: FETCH stage present - add missing fields to index or exclude _id")
    }
  }

  return covered
}

// Usage
isCovered(
  db.users.find({ email: "alice@example.com" }),
  { name: 1, email: 1, _id: 0 }
)

// Bulk check all indexes for coverage opportunities
db.users.getIndexes().forEach(idx => {
  const fields = Object.keys(idx.key)
  print(`Index ${idx.name} can cover projections on: ${fields.join(", ")}`)
})
```

---

## ⚠️ Before You Implement

**I recommend adding fields to index for coverage, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current index | May already cover your projection | `db.collection.getIndexes()` |
| totalDocsExamined | Confirm query is fetching documents | `explain("executionStats")` |
| Index size impact | Adding fields increases index size | Check index size before adding fields |

**Check if query is already covered:**
```javascript
const stats = db.collection.find(filter, projection).explain("executionStats")
print(`totalDocsExamined: ${stats.executionStats.totalDocsExamined}`)
// If 0, query is already covered!
```

**Interpretation:**
- ✅ totalDocsExamined = 0: Already a covered query, no change needed
- ⚠️ totalDocsExamined low, query fast: May not be worth adding fields to index
- 🔴 totalDocsExamined high, query frequent: Good candidate for covered query optimization

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - List current indexes
- `mcp__mongodb__explain` - Check if query fetches documents

**Just ask:** "Check if my [collection] query can be covered"

---

Reference: [Covered Queries](https://mongodb.com/docs/manual/core/query-optimization/#covered-query)
