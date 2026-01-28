---
title: Understand and Manage Query Plan Cache
impact: HIGH
impactDescription: "Avoid unnecessary plan re-evaluation; understand when cached plans become stale"
tags: performance, query-plan, cache, optimization, planCacheStats, explain
---

## Understand and Manage Query Plan Cache

**MongoDB caches query plans to avoid re-evaluating indexes for every query.** The query planner evaluates candidate plans during a trial period, selects the most efficient one, and caches it for subsequent queries with the same shape. Understanding cache behavior helps you diagnose unexpected plan changes and performance regressions.

**How the plan cache works:**

```javascript
// Plan cache has three states:
// 1. Missing  - No entry exists, planner evaluates all candidates
// 2. Inactive - Placeholder entry, still evaluates candidates
// 3. Active   - Cached plan used directly for queries

// Query shape = combination of query filter, sort, and projection
// Same shape → same cached plan (if Active)

// Example: These queries have the SAME shape
db.orders.find({ status: "pending" }).sort({ createdAt: -1 })
db.orders.find({ status: "shipped" }).sort({ createdAt: -1 })
// Both use cached plan for: { status: <val> } + sort { createdAt: -1 }

// These have DIFFERENT shapes
db.orders.find({ status: "pending" })
db.orders.find({ status: "pending", priority: "high" })
// Different filter structure = different cache entries
```

**View plan cache contents:**

```javascript
// Use $planCacheStats to see all cached plans
db.orders.aggregate([{ $planCacheStats: {} }])

// Returns for each cached query shape:
// - planCacheKey: unique identifier
// - isActive: true if plan is being used
// - works: cost metric (lower = better)
// - cachedPlan: the actual execution plan
// - estimatedSizeBytes: memory used by this entry

// Example output:
{
  planCacheKey: "ABC123...",
  isActive: true,
  works: 156,
  cachedPlan: {
    stage: "FETCH",
    inputStage: {
      stage: "IXSCAN",
      indexName: "status_1_createdAt_1"
    }
  }
}
```

**When plan cache is invalidated:**

```javascript
// The plan cache is cleared when:
// 1. mongod restarts (cache is in-memory only)
// 2. Index changes (create, drop, hide, unhide)
// 3. Collection changes (drop, rename)
// 4. LRU eviction when cache exceeds limits

// After dropping an index:
db.orders.dropIndex("status_1_createdAt_1")
// ALL plan cache entries for this collection are cleared
// Next queries will re-evaluate available indexes

// IMPORTANT: Plan cache does NOT persist across restarts
// After restart, first queries will be slower (plan evaluation)
```

**Manually clear the plan cache:**

```javascript
// Clear entire cache for a collection
db.orders.getPlanCache().clear()

// Clear cache for specific query shape
db.orders.getPlanCache().clearPlansByQuery(
  { status: "pending" },           // query
  { createdAt: -1 },               // sort
  { _id: 1, status: 1, total: 1 }  // projection
)

// When to manually clear:
// - After adding indexes that should be used
// - When explain() shows suboptimal plan being cached
// - During performance testing to ensure fresh evaluation
```

**Diagnose plan cache issues:**

```javascript
// Problem: Query suddenly slower after working fine
// Diagnosis: Check if plan changed

// Step 1: Run explain to see current plan
const explain = db.orders.find({ status: "pending" })
  .sort({ createdAt: -1 })
  .explain("executionStats")

// Check these fields:
print("Plan cache key:", explain.queryPlanner.planCacheKey)
print("Winning plan:", explain.queryPlanner.winningPlan.stage)
print("Docs examined:", explain.executionStats.totalDocsExamined)
print("Time:", explain.executionStats.executionTimeMillis, "ms")

// Step 2: Check if index filter is forcing a plan
print("Index filter set:", explain.queryPlanner.indexFilterSet)
// If true, an index filter overrides normal plan selection

// Step 3: Compare with $planCacheStats
db.orders.aggregate([
  { $planCacheStats: {} },
  { $match: { planCacheKey: explain.queryPlanner.planCacheKey } }
])
```

**Plan cache size limits:**

```javascript
// Plan cache has size limits to prevent memory issues
// When cumulative size > 0.5 GB:
// - New entries stored WITHOUT debug info
// - Missing: createdFromQuery, cachedPlan, creationExecStats

// Check cache memory usage:
db.orders.aggregate([
  { $planCacheStats: {} },
  { $group: {
      _id: null,
      totalEntries: { $sum: 1 },
      totalBytes: { $sum: "$estimatedSizeBytes" }
    }
  }
])

// If cache is large, consider:
// - Reducing query shape variations
// - Using parameterized queries (same shape, different values)
```

**Index filters (force specific indexes):**

```javascript
// Index filters override plan cache for specific query shapes
// Use sparingly - they bypass the optimizer

// Set an index filter
db.runCommand({
  planCacheSetFilter: "orders",
  query: { status: { $exists: true } },
  sort: { createdAt: -1 },
  indexes: ["status_1_createdAt_1"]  // Force this index
})

// List active filters
db.runCommand({ planCacheListFilters: "orders" })

// Clear filters
db.runCommand({ planCacheClearFilters: "orders" })

// WARNING: Index filters persist until cleared or server restart
// They can hide problems - use hint() for one-off queries instead
```

**Best practices:**

```javascript
// 1. Use consistent query shapes
// BAD: Dynamic field selection creates many cache entries
const fields = user.isAdmin ? { all: 1 } : { public: 1 }
db.data.find(query, fields)

// GOOD: Consistent projection, filter in application
db.data.find(query, { all: 1, public: 1 })

// 2. After adding indexes, verify they're used
db.orders.createIndex({ status: 1, createdAt: -1 })
// Clear cache to force re-evaluation
db.orders.getPlanCache().clear()
// Verify with explain
db.orders.find({ status: "pending" }).sort({ createdAt: -1 }).explain()

// 3. Monitor plan cache in production
// High cache churn may indicate too many query variations
```

**When NOT to worry about plan cache:**

- **Development/testing**: Cache behavior matters less with small data.
- **Infrequent queries**: One-off queries don't benefit from caching.
- **After intentional index changes**: Cache invalidation is expected.

**Verify with:**

```javascript
// Comprehensive plan cache analysis
function analyzePlanCache(collectionName) {
  const coll = db[collectionName]

  // Get cache stats
  const stats = coll.aggregate([{ $planCacheStats: {} }]).toArray()

  print(`\n=== Plan Cache for ${collectionName} ===`)
  print(`Total entries: ${stats.length}`)

  const totalBytes = stats.reduce((sum, s) => sum + (s.estimatedSizeBytes || 0), 0)
  print(`Total size: ${(totalBytes / 1024).toFixed(2)} KB`)

  const activeCount = stats.filter(s => s.isActive).length
  print(`Active plans: ${activeCount}`)
  print(`Inactive plans: ${stats.length - activeCount}`)

  // Show top 5 by size
  print(`\nTop 5 entries by size:`)
  stats
    .sort((a, b) => (b.estimatedSizeBytes || 0) - (a.estimatedSizeBytes || 0))
    .slice(0, 5)
    .forEach((s, i) => {
      print(`  ${i + 1}. ${s.isActive ? "ACTIVE" : "inactive"} - ${s.estimatedSizeBytes} bytes`)
      if (s.cachedPlan) {
        print(`     Plan: ${s.cachedPlan.stage}`)
      }
    })

  // Check for index filters
  const filters = db.runCommand({ planCacheListFilters: collectionName })
  if (filters.filters && filters.filters.length > 0) {
    print(`\nWARNING: ${filters.filters.length} index filter(s) active`)
  }
}

// Usage
analyzePlanCache("orders")
```

---

## Before You Implement

**I recommend understanding plan cache behavior before clearing or modifying it, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current cache contents | See what plans are cached | `db.collection.aggregate([{$planCacheStats:{}}])` |
| Active vs inactive plans | Inactive plans still evaluate candidates | Check isActive field |
| Index filter presence | Filters override normal plan selection | `db.runCommand({planCacheListFilters:"collection"})` |

**Verification query:**
```javascript
// Analyze plan cache state
db.collection.aggregate([
  { $planCacheStats: {} },
  { $group: {
    _id: null,
    totalEntries: { $sum: 1 },
    activeEntries: { $sum: { $cond: ["$isActive", 1, 0] } },
    totalBytes: { $sum: "$estimatedSizeBytes" }
  }}
])
```

**Interpretation:**
- Good result: Mostly active plans, reasonable size - Cache working normally
- Warning result: Many inactive plans - Frequent plan re-evaluation, investigate
- Bad result: Cache very large (>100MB) or index filters set - May need cleanup

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__aggregate` with $planCacheStats - View cached plans and their states
- `mcp__mongodb__explain` - Compare current plan vs cached plan
- `mcp__mongodb__collection-indexes` - Verify index changes that might invalidate cache

**Just ask:** "Can you check the query plan cache for [collection] and identify any issues?"

---

Reference: [Query Plans](https://mongodb.com/docs/manual/core/query-plans/)
