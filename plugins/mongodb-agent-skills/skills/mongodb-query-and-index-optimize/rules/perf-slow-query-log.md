---
title: Use Slow Query Log to Find Performance Issues
impact: HIGH
impactDescription: "System profiler captures queries exceeding threshold—find the 20% of queries causing 80% of load"
tags: performance, profiler, slow-queries, diagnostics, monitoring, optimization
---

## Use Slow Query Log to Find Performance Issues

**MongoDB's database profiler captures slow operations, revealing which queries need optimization.** Instead of guessing which queries are slow, enable profiling to capture operations exceeding a threshold (e.g., 100ms). The system.profile collection stores query patterns, execution times, and documents examined—everything you need to prioritize optimization work.

**Incorrect (guessing which queries are slow):**

```javascript
// "I think this query is slow, let me optimize it"
db.orders.createIndex({ status: 1 })  // Created index based on intuition

// Later: Application still slow
// "Maybe this query is the problem?"
db.orders.createIndex({ customerId: 1, createdAt: -1 })

// Result: Created 5 indexes based on guesses
// Actual slow query: db.products.find({ category: "electronics" })
// which was never optimized because we didn't know about it!
// Wasted effort on wrong queries, real bottleneck remains
```

**Correct (using profiler to find actual slow queries):**

```javascript
// Enable profiler to capture slow operations
db.setProfilingLevel(1, { slowms: 100 })

// Wait for traffic, then find the actual bottlenecks
db.system.profile.find({ planSummary: "COLLSCAN" })
  .sort({ millis: -1 })
  .limit(5)
// Output shows: products.find({ category: "electronics" }) - 2500ms COLLSCAN!

// Now create the RIGHT index
db.products.createIndex({ category: 1 })

// Verify improvement
db.products.find({ category: "electronics" }).explain("executionStats")
// executionTimeMillis: 5ms (was 2500ms) - 500× improvement!
```

**Enable database profiler:**

```javascript
// Level 0: Off (default)
// Level 1: Log operations slower than slowms
// Level 2: Log ALL operations (use cautiously)

// Enable profiling for slow queries (recommended)
db.setProfilingLevel(1, { slowms: 100 })
// Logs operations taking >100ms

// Check current profiling status
db.getProfilingStatus()
// { "was": 1, "slowms": 100, "sampleRate": 1.0 }

// Sample rate for high-traffic systems (MongoDB 4.0+)
db.setProfilingLevel(1, { slowms: 100, sampleRate: 0.5 })
// Logs 50% of slow operations (reduces overhead)

// Disable profiling
db.setProfilingLevel(0)
```

**Query the profiler collection:**

```javascript
// system.profile is a capped collection
// Stores recent profiled operations

// Find slowest queries
db.system.profile.find().sort({ millis: -1 }).limit(10)

// Find queries on specific collection
db.system.profile.find({
  ns: "mydb.orders"
}).sort({ millis: -1 }).limit(10)

// Find COLLSCAN queries (missing indexes!)
db.system.profile.find({
  planSummary: "COLLSCAN"
}).sort({ millis: -1 })

// Find queries with high docsExamined:returned ratio
db.system.profile.find({
  $expr: {
    $gt: [
      "$docsExamined",
      { $multiply: ["$nreturned", 100] }
    ]
  }
}).sort({ millis: -1 })
```

**Profile entry structure:**

```javascript
// Sample profile document:
{
  "op": "query",                           // Operation type
  "ns": "mydb.orders",                     // Namespace
  "command": {                             // The actual query
    "find": "orders",
    "filter": { "status": "pending" },
    "sort": { "createdAt": -1 },
    "limit": 100
  },
  "planSummary": "IXSCAN { status: 1 }",  // Query plan used
  "keysExamined": 150,                     // Index keys scanned
  "docsExamined": 150,                     // Documents examined
  "nreturned": 100,                        // Results returned
  "millis": 245,                           // Execution time (ms)
  "ts": ISODate("2024-01-15T10:30:00Z"),  // Timestamp
  "client": "192.168.1.100",               // Client IP
  "appName": "myapp",                      // Application name
  "user": "appuser"                        // Authenticated user
}
```

**Find optimization candidates:**

```javascript
// Top slow queries by total time spent
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: {
      _id: {
        ns: "$ns",
        planSummary: "$planSummary",
        // Normalize query pattern (remove literal values)
        queryPattern: { $objectToArray: "$command.filter" }
      },
      count: { $sum: 1 },
      totalMillis: { $sum: "$millis" },
      avgMillis: { $avg: "$millis" },
      maxMillis: { $max: "$millis" },
      avgDocsExamined: { $avg: "$docsExamined" }
  }},
  { $sort: { totalMillis: -1 } },
  { $limit: 10 }
])

// Find queries that would benefit from indexes
db.system.profile.aggregate([
  { $match: {
      op: "query",
      planSummary: "COLLSCAN"
  }},
  { $group: {
      _id: "$ns",
      queries: { $push: "$command.filter" },
      count: { $sum: 1 },
      avgMillis: { $avg: "$millis" }
  }},
  { $sort: { count: -1 } }
])
// Shows which collections/queries need indexes most
```

**N+1 query detection:**

```javascript
// Detect N+1 pattern: Same query shape repeated many times
db.system.profile.aggregate([
  { $match: {
      op: "query",
      ts: { $gte: new Date(Date.now() - 60000) }  // Last minute
  }},
  { $group: {
      _id: {
        ns: "$ns",
        // Group by query structure (keys only)
        queryKeys: { $objectToArray: "$command.filter" }
      },
      count: { $sum: 1 },
      totalMillis: { $sum: "$millis" }
  }},
  { $match: { count: { $gt: 10 } } },  // Same query 10+ times
  { $sort: { count: -1 } }
])

// If same query pattern appears 100+ times in quick succession:
// Likely N+1 pattern - should batch with $in
```

**Monitor in real-time:**

```javascript
// Watch for slow queries as they happen
// (Run in separate shell)
db.system.profile.find({
  ts: { $gte: new Date() }
}).tailable().addOption(DBQuery.Option.awaitData)

// Or use $currentOp for active operations
db.currentOp({
  "secs_running": { $gte: 5 },  // Running > 5 seconds
  "op": { $ne: "none" }
})
```

**Profiler best practices:**

```javascript
// 1. Start with conservative threshold
db.setProfilingLevel(1, { slowms: 200 })  // 200ms threshold
// Lower gradually as you fix issues

// 2. Use sample rate on high-traffic systems
db.setProfilingLevel(1, { slowms: 100, sampleRate: 0.1 })
// 10% sample avoids profiler becoming bottleneck

// 3. Clear old profile data periodically
// system.profile is capped, but you can resize:
db.setProfilingLevel(0)
db.system.profile.drop()
db.createCollection("system.profile", { capped: true, size: 104857600 })  // 100MB
db.setProfilingLevel(1, { slowms: 100 })

// 4. Don't enable level 2 in production
// Level 2 logs EVERYTHING - massive overhead

// 5. Profile specific collections if needed (MongoDB 4.4+)
// Use db.setProfilingLevel() per database
```

**Export slow queries for analysis:**

```javascript
// Export recent slow queries to JSON
const slowQueries = db.system.profile.find({
  millis: { $gt: 500 },
  ts: { $gte: new Date(Date.now() - 86400000) }  // Last 24h
}).toArray()

// Or use mongoexport:
// mongoexport --db=mydb --collection=system.profile --query='{"millis":{"$gt":500}}' --out=slow_queries.json
```

**When NOT to use profiler:**

- **Level 2 on production**: Too much overhead, logs everything.
- **Without sample rate on high traffic**: Profiler itself becomes slow.
- **Long-term storage**: Use MongoDB Atlas Performance Advisor or external monitoring instead.
- **Already using APM**: Tools like Datadog/New Relic may be better for production monitoring.

**Verify profiling setup:**

```javascript
// Complete profiler analysis function
function analyzeSlowQueries(thresholdMs = 100, minutes = 60) {
  const status = db.getProfilingStatus()
  print(`Profiling status: Level ${status.was}, slowms: ${status.slowms}`)

  if (status.was === 0) {
    print("\n⚠️  Profiling disabled. Enable with:")
    print(`   db.setProfilingLevel(1, { slowms: ${thresholdMs} })`)
    return
  }

  const since = new Date(Date.now() - minutes * 60 * 1000)
  const total = db.system.profile.countDocuments({ ts: { $gte: since } })
  print(`\nProfiled operations (last ${minutes} min): ${total}`)

  // Summary by operation type
  print("\n--- By Operation Type ---")
  db.system.profile.aggregate([
    { $match: { ts: { $gte: since } } },
    { $group: {
        _id: "$op",
        count: { $sum: 1 },
        avgMillis: { $avg: "$millis" },
        maxMillis: { $max: "$millis" }
    }},
    { $sort: { count: -1 } }
  ]).forEach(doc => {
    print(`${doc._id}: ${doc.count} ops, avg ${doc.avgMillis.toFixed(0)}ms, max ${doc.maxMillis}ms`)
  })

  // COLLSCAN queries
  print("\n--- COLLSCAN Queries (need indexes!) ---")
  const collscans = db.system.profile.find({
    ts: { $gte: since },
    planSummary: "COLLSCAN"
  }).sort({ millis: -1 }).limit(5).toArray()

  collscans.forEach(doc => {
    print(`${doc.ns}: ${doc.millis}ms - ${JSON.stringify(doc.command?.filter || {})}`)
  })

  if (collscans.length === 0) {
    print("None found ✓")
  }

  // Top 5 slowest
  print("\n--- Top 5 Slowest Queries ---")
  db.system.profile.find({ ts: { $gte: since } })
    .sort({ millis: -1 })
    .limit(5)
    .forEach(doc => {
      print(`${doc.millis}ms - ${doc.ns}`)
      print(`  Plan: ${doc.planSummary}`)
      print(`  Filter: ${JSON.stringify(doc.command?.filter || {})}`)
    })
}

// Usage
analyzeSlowQueries(100, 60)  // Queries >100ms in last hour
```

---

## Before You Implement

**I recommend enabling the profiler to find actual slow queries, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current profiling level | May already be enabled | `db.getProfilingStatus()` |
| slowms threshold | Too low = overhead, too high = miss issues | Check current setting |
| Sample rate | High traffic needs sampling to reduce overhead | Check sampleRate setting |

**Verification query:**
```javascript
// Check profiler status and recent slow queries
print("Profiler status:", JSON.stringify(db.getProfilingStatus()))
print("Recent slow queries:", db.system.profile.countDocuments({
  ts: { $gte: new Date(Date.now() - 3600000) }  // last hour
}))
```

**Interpretation:**
- Good result: Profiler enabled, capturing slow queries - Analyze and optimize
- Warning result: Profiler off or threshold too high - Enable with appropriate settings
- Bad result: Level 2 in production - Too much overhead, switch to level 1

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__find` on system.profile - Retrieve actual slow queries
- `mcp__mongodb__aggregate` on system.profile - Group by query pattern to find worst offenders
- `mcp__mongodb__explain` - Analyze specific slow queries identified

**Just ask:** "Can you check my slow query log and identify the top performance issues?"

---

Reference: [Database Profiler](https://mongodb.com/docs/manual/tutorial/manage-the-database-profiler/)
