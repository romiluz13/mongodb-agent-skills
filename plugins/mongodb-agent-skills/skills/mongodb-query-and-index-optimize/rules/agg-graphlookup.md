---
title: Use $graphLookup for Recursive Graph Traversal
impact: HIGH
impactDescription: "Single query replaces N recursive queries; index on connectToField is critical for performance"
tags: aggregation, graphlookup, graph, recursive, tree, hierarchy, traversal
---

## Use $graphLookup for Recursive Graph Traversal

**`$graphLookup` performs recursive searches in a single query, replacing multiple round-trips.** Use it to traverse hierarchies (org charts, categories), find connected nodes (social networks, dependencies), or explore graph-like data with variable depth. Without it, you'd need N queries for N-level depth. Critical: always index the `connectToField` for performance.

**Incorrect (recursive application queries—N round-trips):**

```javascript
// Finding all reports in an org chart recursively
// Each level requires a separate query
async function getAllReports(managerId) {
  const directReports = await db.employees.find({
    reportsTo: managerId
  }).toArray()

  let allReports = [...directReports]

  for (const report of directReports) {
    // Recursive call = another database round-trip
    const subordinates = await getAllReports(report._id)
    allReports = allReports.concat(subordinates)
  }

  return allReports
}

// For a 5-level hierarchy with 100 employees:
// ~20+ database round-trips
// Network latency × 20 = seconds of delay
```

**Correct ($graphLookup—single query):**

```javascript
// Index the field used for matching
db.employees.createIndex({ name: 1 })

// Single query traverses entire hierarchy
db.employees.aggregate([
  { $match: { name: "Dev" } },  // Start from this person
  {
    $graphLookup: {
      from: "employees",           // Collection to search
      startWith: "$name",          // Starting value(s)
      connectFromField: "name",    // Field in matched docs to recurse from
      connectToField: "reportsTo", // Field to match against (INDEX THIS!)
      as: "allReports",            // Output array name
      maxDepth: 10,                // Optional: limit recursion depth
      depthField: "level"          // Optional: track depth in results
    }
  }
])

// Result: Single round-trip returns entire hierarchy
{
  _id: 1,
  name: "Dev",
  allReports: [
    { _id: 2, name: "Eliot", reportsTo: "Dev", level: 0 },
    { _id: 3, name: "Ron", reportsTo: "Eliot", level: 1 },
    { _id: 4, name: "Andrew", reportsTo: "Eliot", level: 1 },
    { _id: 5, name: "Asya", reportsTo: "Ron", level: 2 },
    { _id: 6, name: "Dan", reportsTo: "Andrew", level: 2 }
  ]
}
```

**Index requirement for `$graphLookup`:**

```javascript
// CRITICAL: Index the connectToField
// Without index: collection scan at EACH recursion level
// With index: O(log n) lookup at each level

// If connectToField is "reportsTo":
db.employees.createIndex({ reportsTo: 1 })

// If connectToField is "parentId":
db.categories.createIndex({ parentId: 1 })

// If connectToField is an array (e.g., "connections"):
db.users.createIndex({ connections: 1 })  // Multikey index
```

**Common `$graphLookup` use cases:**

```javascript
// 1. ORG CHART: Find all subordinates
db.employees.aggregate([
  { $match: { name: "CEO" } },
  {
    $graphLookup: {
      from: "employees",
      startWith: "$name",
      connectFromField: "name",
      connectToField: "reportsTo",
      as: "organization"
    }
  }
])

// 2. CATEGORY TREE: Find all subcategories
db.categories.aggregate([
  { $match: { _id: "electronics" } },
  {
    $graphLookup: {
      from: "categories",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "parentId",
      as: "allSubcategories",
      depthField: "depth"
    }
  }
])

// 3. SOCIAL NETWORK: Find friends of friends
db.users.aggregate([
  { $match: { _id: "user123" } },
  {
    $graphLookup: {
      from: "users",
      startWith: "$friends",        // Array of friend IDs
      connectFromField: "friends",  // Each friend's friends
      connectToField: "_id",
      as: "network",
      maxDepth: 2                   // Friends of friends of friends
    }
  }
])

// 4. DEPENDENCY GRAPH: Find all dependencies
db.packages.aggregate([
  { $match: { name: "my-app" } },
  {
    $graphLookup: {
      from: "packages",
      startWith: "$dependencies",   // Array of package names
      connectFromField: "dependencies",
      connectToField: "name",
      as: "allDependencies"
    }
  }
])
```

**Filtering during traversal with `restrictSearchWithMatch`:**

```javascript
// Only include active employees in hierarchy
db.employees.aggregate([
  { $match: { name: "Dev" } },
  {
    $graphLookup: {
      from: "employees",
      startWith: "$name",
      connectFromField: "name",
      connectToField: "reportsTo",
      as: "activeReports",
      restrictSearchWithMatch: {
        status: "active"            // Only traverse active employees
      }
    }
  }
])

// For the filter to be efficient, create compound index:
db.employees.createIndex({ reportsTo: 1, status: 1 })
```

**Memory considerations:**

```javascript
// $graphLookup has memory limits (100MB default for aggregation)
// Large graphs may exceed this limit

// Options for large graphs:

// 1. Limit depth
{
  $graphLookup: {
    // ...
    maxDepth: 5  // Prevent infinite recursion, limit memory
  }
}

// 2. Use allowDiskUse for very large results
db.collection.aggregate([
  { $graphLookup: { ... } }
], { allowDiskUse: true })

// 3. Filter during traversal to reduce results
{
  $graphLookup: {
    // ...
    restrictSearchWithMatch: { type: "important" }
  }
}

// 4. Process in batches for massive graphs
// Start from multiple root nodes separately
```

**`$graphLookup` vs tree patterns in schema:**

```javascript
// Use $graphLookup when:
// - Graph structure (multiple parents possible)
// - Variable/unknown depth
// - Need to traverse at query time
// - Data changes frequently

// Use materialized paths/nested sets when:
// - Strict tree structure (single parent)
// - Fixed/known depth
// - Mostly read operations
// - Path/ancestor queries are primary use case

// Example: Categories might use materialized paths
// BUT social connections need $graphLookup
```

**When NOT to use `$graphLookup`:**

- **Simple parent lookup**: Just need immediate parent? Use regular `$lookup`.
- **Known fixed depth**: Always exactly 3 levels? Multiple `$lookup` stages may be clearer.
- **Huge graphs without limits**: Millions of connected nodes without `maxDepth` = memory explosion.
- **Strict trees**: For hierarchies with single parent, materialized paths or nested sets are more efficient for common operations.

**Verify with:**

```javascript
// Test $graphLookup performance
function analyzeGraphLookup(pipeline, collection) {
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  print("\n$graphLookup Analysis:")

  // Check for COLLSCAN in the graphLookup stage
  const stages = JSON.stringify(explain)
  if (stages.includes("COLLSCAN")) {
    print("⚠️  WARNING: COLLSCAN detected!")
    print("   Create index on connectToField for better performance")
  } else {
    print("✓ Using index for traversal")
  }

  print(`\nExecution time: ${explain.executionStats?.executionTimeMillis || 'N/A'}ms`)

  // Check memory usage
  if (explain.stages) {
    const graphStage = explain.stages.find(s => s.$graphLookup)
    if (graphStage) {
      print(`Documents in result: ${graphStage.nReturned || 'N/A'}`)
    }
  }
}

// Test
const pipeline = [
  { $match: { name: "Dev" } },
  {
    $graphLookup: {
      from: "employees",
      startWith: "$name",
      connectFromField: "name",
      connectToField: "reportsTo",
      as: "allReports"
    }
  }
]

analyzeGraphLookup(pipeline, "employees")
```

---

## Before You Implement

**I recommend using $graphLookup for recursive traversal with indexed connectToField, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Index on connectToField | Without index, each recursion level does COLLSCAN | `db.collection.getIndexes()` |
| Graph depth estimate | Deep graphs may exceed memory limits | Test with maxDepth limits |
| Connected node count | Large result sets need allowDiskUse | `db.collection.countDocuments()` |

**Verification query:**
```javascript
// Check index exists on connectToField
const connectToField = "reportsTo"  // your field
const indexes = db.collection.getIndexes()
const hasIndex = indexes.some(idx => Object.keys(idx.key)[0] === connectToField)
print(`Index on ${connectToField}: ${hasIndex ? "YES" : "NO - CREATE ONE!"}`)
```

**Interpretation:**
- Good result: Index exists on connectToField - $graphLookup will be efficient
- Warning result: No index, small collection (<10K) - May work but slow
- Bad result: No index, large collection - Must create index first

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Verify index on connectToField exists
- `mcp__mongodb__count` - Estimate graph size and potential result count
- `mcp__mongodb__explain` - Check for COLLSCAN in $graphLookup execution

**Just ask:** "Can you check if my $graphLookup on [collection] has the required index on [connectToField]?"

---

Reference: [$graphLookup Aggregation Stage](https://mongodb.com/docs/manual/reference/operator/aggregation/graphLookup/)
