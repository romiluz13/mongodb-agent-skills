---
title: Interpret explain() Output for Query Optimization
impact: CRITICAL
impactDescription: "explain() reveals COLLSCAN vs IXSCAN, documents examined, and execution time—your primary diagnostic tool"
tags: performance, explain, query-plan, diagnostics, optimization, COLLSCAN, IXSCAN
---

## Interpret explain() Output for Query Optimization

**explain() is your single most important tool for understanding query performance—it shows exactly how MongoDB executes your query.** The difference between COLLSCAN (scanning every document) and IXSCAN (using an index) can be 10,000× performance. Learn to read explain output fluently: check the stage, examine keys vs documents examined, and understand index bounds.

**Basic explain() usage:**

```javascript
// Three verbosity levels:
db.orders.find({ status: "pending" }).explain()
// "queryPlanner": Shows winning plan, no execution

db.orders.find({ status: "pending" }).explain("executionStats")
// Shows actual execution metrics (most useful!)

db.orders.find({ status: "pending" }).explain("allPlansExecution")
// Shows all candidate plans (for deep debugging)

// For aggregations:
db.orders.aggregate([...]).explain("executionStats")
// Or:
db.orders.explain("executionStats").aggregate([...])
```

**Key fields to examine:**

```javascript
// Run explain with executionStats
const explain = db.orders.find({ status: "pending" }).explain("executionStats")

// CRITICAL FIELDS:

// 1. queryPlanner.winningPlan.stage
//    COLLSCAN = Full collection scan (BAD)
//    IXSCAN = Index scan (GOOD)
//    FETCH = Retrieving documents after index scan
//    SORT = In-memory sort (may be expensive)

// 2. executionStats.totalDocsExamined
//    How many documents MongoDB looked at
//    Should be close to nReturned for efficient queries

// 3. executionStats.totalKeysExamined
//    How many index keys were scanned
//    High ratio to docsExamined may indicate index not selective

// 4. executionStats.nReturned
//    Actual results returned
//    Compare to docsExamined for efficiency

// 5. executionStats.executionTimeMillis
//    Total execution time
//    Baseline for optimization comparison
```

**Reading a COLLSCAN (bad):**

```javascript
db.orders.find({ customerId: "cust123" }).explain("executionStats")

// Output (simplified):
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN",  // ← RED FLAG: No index used!
      "filter": { "customerId": { "$eq": "cust123" } },
      "direction": "forward"
    }
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 50,
    "executionTimeMillis": 4500,        // 4.5 seconds!
    "totalKeysExamined": 0,             // No keys = no index
    "totalDocsExamined": 10000000       // Scanned ALL 10M docs!
  }
}

// Diagnosis: Missing index on customerId
// Fix: db.orders.createIndex({ customerId: 1 })
```

**Reading an IXSCAN (good):**

```javascript
// After creating index
db.orders.createIndex({ customerId: 1 })
db.orders.find({ customerId: "cust123" }).explain("executionStats")

// Output:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "FETCH",              // Fetching docs after index lookup
      "inputStage": {
        "stage": "IXSCAN",           // ← Using index!
        "keyPattern": { "customerId": 1 },
        "indexName": "customerId_1",
        "indexBounds": {
          "customerId": [
            "[\"cust123\", \"cust123\"]"  // Exact match bounds
          ]
        }
      }
    }
  },
  "executionStats": {
    "nReturned": 50,
    "executionTimeMillis": 2,          // 2ms vs 4500ms!
    "totalKeysExamined": 50,           // Only 50 keys
    "totalDocsExamined": 50            // Only 50 docs
  }
}

// Efficiency metrics:
// Keys examined : Returned = 50:50 = 1:1 (perfect!)
// Docs examined : Returned = 50:50 = 1:1 (perfect!)
```

**Covered query (optimal):**

```javascript
// Create index including projected fields
db.orders.createIndex({ customerId: 1, status: 1 })

// Query using only indexed fields
db.orders.find(
  { customerId: "cust123" },
  { _id: 0, customerId: 1, status: 1 }
).explain("executionStats")

// Output:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "PROJECTION_COVERED",   // No FETCH needed!
      "inputStage": {
        "stage": "IXSCAN",
        "indexName": "customerId_1_status_1"
      }
    }
  },
  "executionStats": {
    "totalDocsExamined": 0,  // ← Zero docs examined!
    "totalKeysExamined": 50
  }
}

// No disk read for documents - all data from index RAM
```

**In-memory SORT (potentially bad):**

```javascript
db.orders.find({ status: "pending" }).sort({ createdAt: -1 }).explain("executionStats")

// Output showing in-memory sort:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "SORT",                    // In-memory sort
      "sortPattern": { "createdAt": -1 },
      "memLimit": 104857600,              // 100MB limit
      "inputStage": {
        "stage": "FETCH",
        "inputStage": {
          "stage": "IXSCAN",
          "indexName": "status_1"         // Index for filter only
        }
      }
    }
  },
  "executionStats": {
    "executionTimeMillis": 500,
    // Large sort buffer used...
  }
}

// Diagnosis: Index doesn't support sort order
// Fix: db.orders.createIndex({ status: 1, createdAt: -1 })
```

**Rejected plans analysis:**

```javascript
db.orders.find({ status: "pending", customerId: "x" }).explain("allPlansExecution")

// Shows all candidate plans MongoDB considered:
{
  "queryPlanner": {
    "winningPlan": { /* chosen plan */ },
    "rejectedPlans": [
      {
        "stage": "FETCH",
        "inputStage": {
          "stage": "IXSCAN",
          "indexName": "status_1"    // Rejected: less efficient
        }
      }
    ]
  }
}

// MongoDB picks plan with lowest "works" (effort score)
// Rejected plans help understand why an index wasn't used
```

**Common explain patterns and fixes:**

```javascript
// Pattern 1: COLLSCAN
// Problem: No suitable index
// Fix: Create index on filter fields

// Pattern 2: IXSCAN with high totalDocsExamined:nReturned ratio
// Problem: Index not selective enough
// Fix: Add more fields to compound index

// Pattern 3: FETCH → SORT (instead of just IXSCAN)
// Problem: Sort not covered by index
// Fix: Include sort field in index

// Pattern 4: Large totalKeysExamined with small nReturned
// Problem: Index scan range too wide
// Fix: More selective index (ESR rule)

// Pattern 5: "isMultiKey": true with unexpected behavior
// Problem: Multikey index bounds interpretation
// Fix: Understand multikey index behavior for arrays
```

**Automated explain analysis:**

```javascript
// Helper function to analyze explain output
function analyzeQuery(collection, query, options = {}) {
  const cursor = db[collection].find(query)
  if (options.sort) cursor.sort(options.sort)
  if (options.projection) cursor.project(options.projection)

  const explain = cursor.explain("executionStats")
  const stats = explain.executionStats
  const plan = explain.queryPlanner.winningPlan

  // Extract stage (handle nested stages)
  function getStage(p) {
    if (p.inputStage) return p.stage + " → " + getStage(p.inputStage)
    return p.stage
  }

  print("Query Analysis:")
  print(`  Stages: ${getStage(plan)}`)
  print(`  Time: ${stats.executionTimeMillis}ms`)
  print(`  Returned: ${stats.nReturned}`)
  print(`  Keys examined: ${stats.totalKeysExamined}`)
  print(`  Docs examined: ${stats.totalDocsExamined}`)

  // Efficiency check
  const keyEfficiency = stats.nReturned > 0
    ? (stats.totalKeysExamined / stats.nReturned).toFixed(1)
    : "N/A"
  const docEfficiency = stats.nReturned > 0
    ? (stats.totalDocsExamined / stats.nReturned).toFixed(1)
    : "N/A"

  print(`\n  Efficiency:`)
  print(`    Keys/Returned: ${keyEfficiency}:1 ${parseFloat(keyEfficiency) > 10 ? "⚠️" : "✓"}`)
  print(`    Docs/Returned: ${docEfficiency}:1 ${parseFloat(docEfficiency) > 10 ? "⚠️" : "✓"}`)

  // Warnings
  if (getStage(plan).includes("COLLSCAN")) {
    print(`\n❌ COLLSCAN detected - add index for: ${JSON.stringify(query)}`)
  }
  if (getStage(plan).includes("SORT") && !getStage(plan).includes("SORT_KEY_GENERATOR")) {
    print(`\n⚠️  In-memory SORT - consider index that covers sort`)
  }
  if (stats.totalDocsExamined === 0) {
    print(`\n✓ Covered query - no document fetch needed`)
  }

  return explain
}

// Usage
analyzeQuery("orders", { status: "pending", customerId: "x" }, { sort: { createdAt: -1 } })
```

---

## ⚠️ Before You Implement

**explain() is a diagnostic tool—use it to verify issues before optimizing:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Run explain first | Don't optimize without data | `query.explain("executionStats")` |
| Check stage | COLLSCAN vs IXSCAN | Look at winningPlan.stage |
| Compare docs examined vs returned | High ratio = inefficiency | executionStats |

**Quick explain check:**
```javascript
const explain = db.collection.find(query).explain("executionStats")
print(`Stage: ${explain.queryPlanner.winningPlan.stage}`)
print(`Docs examined: ${explain.executionStats.totalDocsExamined}`)
print(`Returned: ${explain.executionStats.nReturned}`)
print(`Time: ${explain.executionStats.executionTimeMillis}ms`)
```

**Interpretation:**
- ✅ IXSCAN + low ratio: Query is optimized
- ⚠️ IXSCAN + high ratio: Index may not be selective
- 🔴 COLLSCAN: Missing index

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to run explain for you.

**What I'll check:**
- `mcp__mongodb__explain` - Run explain on your query
- `mcp__mongodb__collection-indexes` - List available indexes

**Just ask:** "Analyze query performance for [query] on [collection]"

---

Reference: [Explain Results](https://mongodb.com/docs/manual/reference/explain-results/)
