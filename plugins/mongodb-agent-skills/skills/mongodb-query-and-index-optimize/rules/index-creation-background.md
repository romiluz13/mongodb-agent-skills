---
title: Create Indexes in Background on Production
impact: HIGH
impactDescription: "Foreground index build blocks all ops; background build allows concurrent reads/writes"
tags: index, creation, background, production, blocking, maintenance
---

## Create Indexes in Background on Production

**Index builds on production databases can block all operations on the collection if not handled correctly.** MongoDB 4.2+ builds indexes in the background by default, but understanding the build process helps avoid downtime. Large indexes on active collections can take hours—plan for monitoring, resource usage, and potential rollback.

**Incorrect (blocking index creation on production):**

```javascript
// Pre-MongoDB 4.2: Foreground build blocked everything
db.orders.createIndex({ customerId: 1 })  // Blocks collection!
// All reads and writes to 'orders' blocked until complete
// On 100M docs: Could take 30+ minutes of complete downtime

// Even in 4.2+, index builds can impact performance
// Large collection + insufficient resources = slow build + degraded ops

// Creating index during peak traffic:
// - Index build competes for CPU, RAM, disk I/O
// - Write operations slow down (index maintained during build)
// - Replica set members may lag
```

**Correct (plan index creation for production):**

```javascript
// MongoDB 4.2+: Background by default (hybrid build)
// But still plan for resource impact

// Step 1: Estimate index size and build time
const stats = db.orders.stats()
const docCount = stats.count
const avgDocSize = stats.avgObjSize
const estimatedIndexSizeBytes = docCount * 50  // ~50 bytes per entry estimate

print(`Documents: ${docCount.toLocaleString()}`)
print(`Est. index size: ${(estimatedIndexSizeBytes/1024/1024).toFixed(0)}MB`)
print(`Build time: Varies by disk speed (minutes to hours)`)

// Step 2: Create during low-traffic window
db.orders.createIndex(
  { customerId: 1, createdAt: -1 },
  { name: "customer_created_idx" }
)

// Step 3: Monitor build progress
db.currentOp({ "command.createIndexes": { $exists: true } })
```

**Index build phases (MongoDB 4.2+):**

```javascript
// Hybrid index build (default in 4.2+):

// Phase 1: Collection scan (reads not blocked)
// - Scans all documents
// - Builds index keys
// - Write ops continue (captured in side write table)

// Phase 2: Drain side writes (brief exclusive lock)
// - Applies captured writes to index
// - Very brief blocking (~milliseconds)
// - Repeats until side table empty

// Phase 3: Commit (brief exclusive lock)
// - Finalizes index
// - Makes index available for queries
// - Millisecond-level lock

// Key insight: Most build time is non-blocking
// Only brief locks at transitions
```

**Monitor index build progress:**

```javascript
// Check ongoing index builds
function monitorIndexBuilds() {
  const ops = db.currentOp({
    $or: [
      { "command.createIndexes": { $exists: true } },
      { "msg": /Index Build/ }
    ]
  }).inprog

  if (ops.length === 0) {
    print("No index builds in progress")
    return
  }

  ops.forEach(op => {
    print(`\nIndex build on: ${op.ns}`)
    print(`  Operation ID: ${op.opid}`)
    print(`  Progress: ${op.progress?.done || "N/A"} / ${op.progress?.total || "N/A"}`)
    print(`  Running: ${op.secs_running || 0} seconds`)

    if (op.msg) {
      print(`  Status: ${op.msg}`)
    }
  })
}

// Run periodically during build
monitorIndexBuilds()

// Or watch with interval:
// while (true) { monitorIndexBuilds(); sleep(10000); }
```

**Resource considerations:**

```javascript
// Index builds consume:
// 1. Disk I/O - Reading docs + writing index
// 2. CPU - Key generation, sorting
// 3. Memory - Sort buffer (default 200MB for index build)
// 4. Disk space - Temporary space during build

// Check available resources before building:
db.serverStatus().mem  // Memory usage
db.serverStatus().wiredTiger.cache  // Cache status

// Large collections: Consider increasing memory for build
// MongoDB 4.4+:
db.adminCommand({
  setParameter: 1,
  maxIndexBuildMemoryUsageMegabytes: 500  // Default: 200MB
})

// More memory = faster build (up to a point)
// Balance against production workload needs
```

**Replica set considerations:**

```javascript
// Index builds on replica sets:
// - Build happens on ALL members simultaneously (4.4+)
// - Primary coordinates, secondaries build in parallel
// - If secondary falls behind, it can impact elections

// Check replica set status during build:
rs.status().members.forEach(m => {
  print(`${m.name}: ${m.stateStr}, lag: ${m.optimeDate}`)
})

// Rolling index builds (pre-4.4 pattern, still useful):
// 1. Build on secondary (remove from replica set first)
// 2. Wait for sync
// 3. Step down primary
// 4. Repeat for old primary
// Avoids performance impact but complex

// Modern approach (4.4+): Simultaneous build
// Simpler, but monitor all nodes
```

**Abort and rollback:**

```javascript
// Kill a running index build
db.killOp(opid)  // Get opid from currentOp()

// Or use dropIndexes
db.collection.dropIndexes("index_name")
// Aborts in-progress build with that name

// Failed builds clean up automatically
// But check for orphaned temp files in dbpath

// Verify index doesn't exist after abort:
db.collection.getIndexes()
```

**Best practices for production index creation:**

```javascript
// 1. Test on staging first
// - Measure build time
// - Check query plans with new index
// - Verify index is actually used

// 2. Create during maintenance window
// - Low traffic period
// - Team available to monitor

// 3. Use meaningful index names
db.orders.createIndex(
  { customerId: 1 },
  { name: "orders_by_customer" }  // Not auto-generated name
)

// 4. Set maxTimeMS for safety
db.orders.createIndex(
  { customerId: 1 },
  { maxTimeMS: 3600000 }  // Fail if takes > 1 hour
)

// 5. Consider partial indexes to reduce size/build time
db.orders.createIndex(
  { customerId: 1 },
  { partialFilterExpression: { status: "active" } }
)
// Smaller index = faster build
```

**When to avoid live index creation:**

- **Very large collections (100M+ docs)**: Consider offline build during maintenance.
- **Limited disk I/O**: SSD strongly recommended for index builds.
- **Memory constrained**: Index build buffer competes with working set.
- **Active OLTP workload**: High write throughput can slow builds significantly.

**Verify with:**

```javascript
// Pre-build assessment
function assessIndexBuild(collection, indexSpec) {
  const stats = db[collection].stats()
  const docCount = stats.count
  const collSizeGB = stats.size / 1024 / 1024 / 1024

  print(`Index build assessment for ${collection}:`)
  print(`  Documents: ${docCount.toLocaleString()}`)
  print(`  Collection size: ${collSizeGB.toFixed(2)} GB`)

  // Check existing similar indexes
  const indexes = db[collection].getIndexes()
  const similar = indexes.filter(idx => {
    const specKeys = Object.keys(indexSpec)
    const idxKeys = Object.keys(idx.key)
    return specKeys.some(k => idxKeys.includes(k))
  })

  if (similar.length > 0) {
    print(`\n⚠️  Similar indexes exist:`)
    similar.forEach(idx => print(`    ${idx.name}: ${JSON.stringify(idx.key)}`))
  }

  // Estimate time
  const estimatedMinutes = Math.ceil(docCount / 1000000) * 5  // Rough: 5 min per 1M docs
  print(`\n  Estimated build time: ${estimatedMinutes}-${estimatedMinutes*2} minutes`)
  print(`  (Varies widely based on hardware and load)`)

  // Check memory
  const memStatus = db.serverStatus().mem
  print(`\n  Server memory:`)
  print(`    Resident: ${memStatus.resident}MB`)
  print(`    Virtual: ${memStatus.virtual}MB`)

  print(`\n  Recommendation:`)
  if (docCount > 10000000) {
    print(`    Schedule during low-traffic window`)
    print(`    Monitor with: db.currentOp({ msg: /Index Build/ })`)
  } else {
    print(`    Safe to create during normal operations`)
  }
}

// Usage
assessIndexBuild("orders", { customerId: 1, createdAt: -1 })
```

Reference: [Index Build Process](https://mongodb.com/docs/manual/core/index-creation/)
