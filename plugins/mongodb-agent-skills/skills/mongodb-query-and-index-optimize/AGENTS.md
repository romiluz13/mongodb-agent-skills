# MongoDB Query & Index Optimization

**Version 2.0.0**
MongoDB
January 2025

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or reviewing MongoDB schemas and queries. Humans may also
> find it useful, but guidance here is optimized for automation and
> consistency by AI-assisted workflows.

---

## Abstract

MongoDB query optimization and indexing strategies for AI agents and developers. Contains 30 rules across 5 categories: Index Essentials (CRITICAL - ESR rule, compound field order, covered queries, prefix principle, index sizing), Specialized Indexes (HIGH - partial, sparse, TTL, text search, wildcard, multikey, geospatial), Query Patterns (HIGH - projections, avoiding $ne/$nin, anchored regex, batching, pagination, $exists behavior), Aggregation Optimization (HIGH - $match/$project early, $sort+$limit coalescence, $lookup indexing, $unwind control, allowDiskUse), and Performance Diagnostics (MEDIUM - explain() interpretation, slow query profiler, $indexStats analysis). Each rule includes incorrect/correct code examples with quantified impact metrics, 'When NOT to use' exceptions, and verification diagnostics.

---

## Table of Contents

1. [Index Essentials](#1-index-essentials) — **CRITICAL**
   - 1.1 [Consider Index Size and Memory Impact](#11-consider-index-size-and-memory-impact)
   - 1.2 [Create Indexes in Background on Production](#12-create-indexes-in-background-on-production)
   - 1.3 [Design Indexes for Covered Queries](#13-design-indexes-for-covered-queries)
   - 1.4 [Ensure Queries Use Indexes](#14-ensure-queries-use-indexes)
   - 1.5 [Order Compound Index Fields Correctly (ESR Rule)](#15-order-compound-index-fields-correctly-esr-rule)
   - 1.6 [Put High-Cardinality Fields First in Equality Conditions](#16-put-high-cardinality-fields-first-in-equality-conditions)
   - 1.7 [Remove Unused Indexes](#17-remove-unused-indexes)
   - 1.8 [Understand Index Prefix Principle](#18-understand-index-prefix-principle)
   - 1.9 [Understand Multikey Indexes for Arrays](#19-understand-multikey-indexes-for-arrays)
   - 1.10 [Use Geospatial Indexes for Location Queries](#110-use-geospatial-indexes-for-location-queries)
   - 1.11 [Use Partial Indexes to Reduce Size](#111-use-partial-indexes-to-reduce-size)
   - 1.12 [Use Sparse Indexes for Optional Fields](#112-use-sparse-indexes-for-optional-fields)
   - 1.13 [Use Text Indexes for Full-Text Search](#113-use-text-indexes-for-full-text-search)
   - 1.14 [Use TTL Indexes for Automatic Data Expiration](#114-use-ttl-indexes-for-automatic-data-expiration)
   - 1.15 [Use Wildcard Indexes for Dynamic Fields](#115-use-wildcard-indexes-for-dynamic-fields)
3. [Query Patterns](#3-query-patterns) — **HIGH**
   - 3.1 [Anchor Regex Patterns with ^](#31-anchor-regex-patterns-with-)
   - 3.2 [Avoid $ne and $nin Operators](#32-avoid-ne-and-nin-operators)
   - 3.3 [Batch Operations to Avoid N+1 Queries](#33-batch-operations-to-avoid-n1-queries)
   - 3.4 [Understand $exists Behavior with Sparse Indexes](#34-understand-exists-behavior-with-sparse-indexes)
   - 3.5 [Use Projections to Limit Fields](#35-use-projections-to-limit-fields)
   - 3.6 [Use Range-Based Pagination Instead of skip()](#36-use-range-based-pagination-instead-of-skip)
4. [Aggregation Optimization](#4-aggregation-optimization) — **HIGH**
   - 4.1 [Avoid $unwind on Large Arrays](#41-avoid-unwind-on-large-arrays)
   - 4.2 [Combine $sort with $limit for Top-N Queries](#42-combine-sort-with-limit-for-top-n-queries)
   - 4.3 [Index $lookup Foreign Fields](#43-index-lookup-foreign-fields)
   - 4.4 [Place $match at Pipeline Start](#44-place-match-at-pipeline-start)
   - 4.5 [Use $project Early to Reduce Document Size](#45-use-project-early-to-reduce-document-size)
   - 4.6 [Use allowDiskUse for Large Aggregations](#46-use-allowdiskuse-for-large-aggregations)
5. [Performance Diagnostics](#5-performance-diagnostics) — **MEDIUM**
   - 5.1 [Interpret explain() Output for Query Optimization](#51-interpret-explain-output-for-query-optimization)
   - 5.2 [Use $indexStats to Find Unused Indexes](#52-use-indexstats-to-find-unused-indexes)
   - 5.3 [Use Slow Query Log to Find Performance Issues](#53-use-slow-query-log-to-find-performance-issues)

---

## 1. Index Essentials

**Impact: CRITICAL**

Without an index, every query is a collection scan—MongoDB reads every document to find matches. On a 10M document collection, that's 10M document reads for every single query, turning 5ms indexed lookups into 30-second full scans. Compound index field order matters: {status, date} supports queries on status alone OR status+date, but NOT date alone. The ESR rule (Equality-Sort-Range) determines optimal field ordering. Covered queries return results directly from the index without touching documents, making them 10-100× faster. Getting indexes wrong is the #1 cause of "MongoDB is slow" complaints—it's almost never MongoDB, it's missing or misconfigured indexes.

### 1.1 Consider Index Size and Memory Impact

**Impact: HIGH (Indexes must fit in RAM for optimal performance—10 indexes × 100MB each = 1GB of working set)**

**Indexes must fit in RAM for optimal performance—when indexes don't fit, queries hit disk and become orders of magnitude slower.** Each index on a 10M document collection might be 100-500MB. Create 10 indexes and you need 1-5GB just for indexes. Monitor index sizes, remove unused indexes, and use partial indexes to keep your working set in memory.

**Incorrect: creating indexes without considering memory impact**

```javascript
// Creating indexes for every possible query pattern
// 10M document collection
db.orders.createIndex({ customerId: 1 })           // 150MB
db.orders.createIndex({ status: 1 })               // 80MB
db.orders.createIndex({ createdAt: -1 })           // 170MB
db.orders.createIndex({ productId: 1 })            // 160MB
db.orders.createIndex({ shippingAddress.city: 1 }) // 200MB
db.orders.createIndex({ totalAmount: 1 })          // 80MB
db.orders.createIndex({ customerId: 1, status: 1 })// 180MB
db.orders.createIndex({ status: 1, createdAt: -1 })// 200MB
// Total: 1.2GB of indexes for this one collection!
// Server has 2GB WiredTiger cache → indexes don't fit!
// Result: Constant page eviction, 10× slower queries
```

**Correct: strategic indexing with memory awareness**

```javascript
// Step 1: Audit existing indexes
db.orders.aggregate([{ $indexStats: {} }])
// Found: status_1 has 0 ops (unused), drop it

// Step 2: Use compound indexes to cover multiple query patterns
db.orders.createIndex({ customerId: 1, createdAt: -1 })
// Serves: customerId queries, customerId+createdAt queries

// Step 3: Use partial indexes for filtered queries
db.orders.createIndex(
  { status: 1, createdAt: -1 },
  { partialFilterExpression: { status: { $in: ["pending", "processing"] } } }
)
// Only indexes 10% of documents (active orders)
// Size: 20MB instead of 200MB

// Step 4: Monitor total index size vs cache
const cache = db.serverStatus().wiredTiger.cache["maximum bytes configured"]
const indexSize = db.orders.stats().totalIndexSize
print(`Index/cache ratio: ${(indexSize/cache*100).toFixed(1)}%`)
// Target: < 50%
```

**Check index sizes:**

```javascript
// Get index sizes for a collection
db.orders.stats().indexSizes
// {
//   "_id_": 389283840,           // 371MB
//   "customerId_1": 156389376,   // 149MB
//   "createdAt_-1": 178257920,   // 170MB
//   "status_1_createdAt_-1": 234881024  // 224MB
// }

// Total index size
db.orders.stats().totalIndexSize
// 958812160 (914MB total)

// Human-readable format
function showIndexSizes(collection) {
  const stats = db[collection].stats()
  const sizes = stats.indexSizes

  print(`Collection: ${collection}`)
  print(`Documents: ${stats.count.toLocaleString()}`)
  print(`Data size: ${(stats.size/1024/1024).toFixed(1)}MB`)
  print(`\nIndexes:`)

  Object.entries(sizes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, size]) => {
      print(`  ${name}: ${(size/1024/1024).toFixed(1)}MB`)
    })

  print(`\nTotal index size: ${(stats.totalIndexSize/1024/1024).toFixed(1)}MB`)
}

showIndexSizes("orders")
```

**Calculate index size per document:**

```javascript
// Estimate index entry size
function estimateIndexEntrySize(indexSpec, sampleDoc) {
  // Approximate sizes:
  // - ObjectId: 12 bytes
  // - String: length + overhead (~5-10 bytes)
  // - Number (int32): 4 bytes
  // - Number (int64/double): 8 bytes
  // - Date: 8 bytes
  // - Boolean: 1 byte
  // - Index overhead: ~20 bytes per entry

  let size = 20  // Base overhead

  Object.keys(indexSpec).forEach(field => {
    const value = sampleDoc[field]

    if (value === undefined || value === null) {
      size += 1  // Null marker
    } else if (typeof value === "string") {
      size += value.length + 5
    } else if (typeof value === "number") {
      size += 8
    } else if (value instanceof Date) {
      size += 8
    } else if (typeof value === "boolean") {
      size += 1
    } else if (value._bsontype === "ObjectId") {
      size += 12
    }
  })

  return size
}

// Example
const sampleDoc = db.orders.findOne()
const indexSpec = { customerId: 1, createdAt: -1 }
const entrySize = estimateIndexEntrySize(indexSpec, sampleDoc)
const totalDocs = db.orders.countDocuments()

print(`Estimated entry size: ${entrySize} bytes`)
print(`Documents: ${totalDocs.toLocaleString()}`)
print(`Estimated index size: ${(entrySize * totalDocs / 1024 / 1024).toFixed(1)}MB`)
```

**Memory and working set:**

```javascript
// Check server memory status
db.serverStatus().mem
// {
//   "bits": 64,
//   "resident": 4096,      // MB currently in RAM
//   "virtual": 8192,       // MB including disk-backed
//   "supported": true
// }

// WiredTiger cache status
db.serverStatus().wiredTiger.cache
// {
//   "bytes currently in the cache": 3892314112,
//   "maximum bytes configured": 4294967296,
//   "pages read into cache": 1234567,
//   "pages evicted": 987654
// }

// If pages evicted is high relative to pages read:
// Working set doesn't fit in cache → performance degradation

// Rule of thumb:
// - Total index size should be < 50% of WiredTiger cache
// - Leave room for data and query buffers
```

**Strategies to reduce index size:**

```javascript
// 1. Use partial indexes
// Instead of indexing all 10M docs, index just active 1M
db.orders.createIndex(
  { customerId: 1 },
  { partialFilterExpression: { status: "active" } }
)
// Index size: 10% of full index

// 2. Remove redundant indexes (prefix rule)
// { a: 1 } is redundant if { a: 1, b: 1 } exists
db.orders.dropIndex("a_1")

// 3. Remove unused indexes
// Use $indexStats to find zeros
db.orders.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0, name: { $ne: "_id_" } } }
])

// 4. Use shorter field names in indexed fields
// { "customerIdentifier": 1 } vs { "cid": 1 }
// Saves ~15 bytes per entry on string difference

// 5. Use integer IDs instead of strings where possible
// ObjectId: 12 bytes, UUID string: 36 bytes
// 3× difference at scale

// 6. Compound indexes replace multiple single-field indexes
// One { a: 1, b: 1, c: 1 } instead of three separate indexes
```

**Warning signs of index pressure:**

```javascript
// Monitor these metrics
function checkIndexHealth() {
  const serverStatus = db.serverStatus()
  const cacheStats = serverStatus.wiredTiger.cache

  // Cache pressure
  const cacheUsed = cacheStats["bytes currently in the cache"]
  const cacheMax = cacheStats["maximum bytes configured"]
  const cachePercent = (cacheUsed / cacheMax * 100).toFixed(1)

  print(`Cache usage: ${cachePercent}%`)
  if (parseFloat(cachePercent) > 90) {
    print("⚠️  HIGH: Working set may not fit in memory")
  }

  // Page evictions (should be low)
  const evicted = cacheStats["pages evicted because they exceeded the in-memory maximum"]
  const readIn = cacheStats["pages read into cache"]

  if (evicted > 0 && readIn > 0) {
    const evictionRatio = (evicted / readIn * 100).toFixed(1)
    print(`Eviction ratio: ${evictionRatio}%`)
    if (parseFloat(evictionRatio) > 10) {
      print("⚠️  HIGH: Significant page eviction occurring")
    }
  }

  // Per-database index sizes
  print("\nDatabase index sizes:")
  db.adminCommand({ listDatabases: 1 }).databases.forEach(dbInfo => {
    const dbStats = db.getSiblingDB(dbInfo.name).stats()
    print(`  ${dbInfo.name}: ${(dbStats.indexSize/1024/1024).toFixed(1)}MB indexes`)
  })
}

checkIndexHealth()
```

**Index size by type:**

```javascript
// Different index types have different overhead

// Single field: ~30 bytes per entry (base)
// Compound: +field size per additional field
// Multikey (arrays): entries per array element × base size
// Text: Variable, can be 10× larger than base
// Geospatial: ~50-100 bytes per entry
// Wildcard: Variable based on field patterns

// Multikey warning:
db.products.createIndex({ tags: 1 })
// If avg 10 tags per product:
// 10M products × 10 tags = 100M index entries!
// Much larger than expected

// Text index warning:
db.articles.createIndex({ content: "text" })
// Indexes every word
// 1000-word articles = 1000 entries per document
```

**When NOT to worry about index size:**

- **Indexes fit comfortably in RAM**: <50% of available cache.

- **Write-light workloads**: Index write overhead is minimal.

- **Critical query performance**: Sometimes you need the index regardless of size.

- **Cloud auto-scaling**: Atlas adjusts resources automatically.

**Verify and monitor:**

```javascript
// Comprehensive index size report
function indexSizeReport() {
  const serverMem = db.serverStatus().mem.resident * 1024 * 1024
  const cacheSize = db.serverStatus().wiredTiger.cache["maximum bytes configured"]

  let totalIndexSize = 0

  print("=== Index Size Report ===\n")

  db.adminCommand({ listDatabases: 1 }).databases.forEach(dbInfo => {
    if (dbInfo.name === "admin" || dbInfo.name === "local" || dbInfo.name === "config") return

    const targetDb = db.getSiblingDB(dbInfo.name)
    let dbIndexSize = 0

    targetDb.getCollectionNames().forEach(collName => {
      if (collName.startsWith("system.")) return

      try {
        const stats = targetDb[collName].stats()
        dbIndexSize += stats.totalIndexSize || 0
      } catch (e) {
        // Skip collections we can't access
      }
    })

    totalIndexSize += dbIndexSize
    print(`${dbInfo.name}: ${(dbIndexSize/1024/1024).toFixed(1)}MB`)
  })

  print(`\n--- Summary ---`)
  print(`Total index size: ${(totalIndexSize/1024/1024).toFixed(1)}MB`)
  print(`WiredTiger cache: ${(cacheSize/1024/1024).toFixed(1)}MB`)
  print(`Index/Cache ratio: ${(totalIndexSize/cacheSize*100).toFixed(1)}%`)

  if (totalIndexSize > cacheSize * 0.5) {
    print(`\n⚠️  WARNING: Indexes exceed 50% of cache`)
    print(`   Consider: removing unused indexes, using partial indexes`)
  } else {
    print(`\n✓ Index size within healthy range`)
  }
}

indexSizeReport()
```

Reference: [https://mongodb.com/docs/manual/reference/limits/#indexes](https://mongodb.com/docs/manual/reference/limits/#indexes)

### 1.2 Create Indexes in Background on Production

**Impact: HIGH (Foreground index build blocks all ops; background build allows concurrent reads/writes)**

**Index builds on production databases can block all operations on the collection if not handled correctly.** MongoDB 4.2+ builds indexes in the background by default, but understanding the build process helps avoid downtime. Large indexes on active collections can take hours—plan for monitoring, resource usage, and potential rollback.

**Incorrect: blocking index creation on production**

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

**Correct: plan index creation for production**

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

**Index build phases: MongoDB 4.2+**

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

Reference: [https://mongodb.com/docs/manual/core/index-creation/](https://mongodb.com/docs/manual/core/index-creation/)

### 1.3 Design Indexes for Covered Queries

**Impact: HIGH (2-10× faster reads by eliminating disk I/O—return results from index RAM without touching documents)**

**A covered query returns results entirely from the index without fetching documents from disk.** Since indexes live in RAM and documents may be on disk, covered queries can be 2-10× faster. The key is including all queried AND projected fields in the index. When you see `totalDocsExamined: 0` in explain(), you've achieved a covered query.

**Incorrect: query fetches documents—disk I/O**

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

**Correct: covered query—no disk I/O**

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

Reference: [https://mongodb.com/docs/manual/core/query-optimization/#covered-query](https://mongodb.com/docs/manual/core/query-optimization/#covered-query)

### 1.4 Ensure Queries Use Indexes

**Impact: CRITICAL (COLLSCAN on 10M docs = 45 seconds; IXSCAN = 2 milliseconds—22,000× difference)**

**Every production query must use an index. No exceptions.** A COLLSCAN (collection scan) reads every document in the collection—linear O(n) time that kills performance as data grows. We've seen production systems brought down by a single missing index. This is the most common cause of MongoDB performance problems.

**Incorrect: no index—COLLSCAN death spiral**

```javascript
// Query on field without index
db.orders.find({ customerId: "cust123" })

// explain("executionStats") reveals the horror:
{
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 47,                    // Only wanted 47 docs
    "executionTimeMillis": 45000,       // 45 SECONDS
    "totalKeysExamined": 0,             // No index used
    "totalDocsExamined": 10000000       // Read ALL 10M documents
  },
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN",              // FULL COLLECTION SCAN
      "direction": "forward"
    }
  }
}

// Why this kills your app:
// - 45 seconds per query = timeout errors
// - Reads 10M docs from disk = saturates I/O
// - Holds locks = blocks other operations
// - Under load = cascading failures
```

**Correct: indexed query—IXSCAN**

```javascript
// Create the index
db.orders.createIndex({ customerId: 1 })
// Build time: ~1 min for 10M docs (one-time cost)

// Same query, now indexed
db.orders.find({ customerId: "cust123" })

// explain("executionStats") shows:
{
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 47,                    // Same 47 docs
    "executionTimeMillis": 2,           // 2 MILLISECONDS (22,000× faster)
    "totalKeysExamined": 47,            // Examined only matching keys
    "totalDocsExamined": 47             // Fetched only matching docs
  },
  "queryPlanner": {
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",              // INDEX SCAN
        "indexName": "customerId_1",
        "indexBounds": {
          "customerId": ["[\"cust123\", \"cust123\"]"]
        }
      }
    }
  }
}
```

**The explain() command—your diagnostic tool:**

```javascript
// Three verbosity levels:
db.orders.find({ customerId: "x" }).explain()                    // queryPlanner only
db.orders.find({ customerId: "x" }).explain("executionStats")    // + actual execution
db.orders.find({ customerId: "x" }).explain("allPlansExecution") // + rejected plans

// ALWAYS use "executionStats" for real diagnostics
// It actually runs the query and shows real numbers
```

**Key metrics to check in explain():**

| Metric | Healthy | Problem | What It Means |

|--------|---------|---------|---------------|

| `stage` | `IXSCAN` | `COLLSCAN` | No index → full scan |

| `totalDocsExamined / nReturned` | ~1 | >>1 | Examining docs that don't match |

| `totalKeysExamined / nReturned` | 1-2 | >>10 | Index not selective enough |

| `executionTimeMillis` | <100 | >1000 | Query is too slow |

| `indexBounds` | Tight ranges | `[MinKey, MaxKey]` | Index used but not efficiently |

**Compound index prefix rule: critical to understand**

```javascript
// Index: { a: 1, b: 1, c: 1 }
// This index can satisfy queries on:

db.col.find({ a: "x" })                    // YES - uses prefix {a}
db.col.find({ a: "x", b: "y" })            // YES - uses prefix {a, b}
db.col.find({ a: "x", b: "y", c: "z" })    // YES - uses full index
db.col.find({ a: "x", c: "z" })            // PARTIAL - uses {a}, scans for c

// These CANNOT use the index:
db.col.find({ b: "y" })                    // NO - a not present
db.col.find({ c: "z" })                    // NO - a, b not present
db.col.find({ b: "y", c: "z" })            // NO - a not present

// Index fields must be used LEFT TO RIGHT
// You can skip trailing fields but not leading ones
```

**Finding missing indexes—production audit:**

```javascript
// Method 1: Check slow query log
db.setProfilingLevel(1, { slowms: 100 })  // Log queries >100ms
db.system.profile.find({
  "command.filter": { $exists: true },
  "planSummary": "COLLSCAN"
}).sort({ ts: -1 }).limit(20)

// Method 2: Aggregate COLLSCAN queries from profile
db.system.profile.aggregate([
  { $match: { planSummary: "COLLSCAN" } },
  { $group: {
    _id: { ns: "$ns", filter: "$command.filter" },
    count: { $sum: 1 },
    avgMs: { $avg: "$millis" }
  }},
  { $sort: { count: -1 } }
])

// Method 3: Atlas Performance Advisor (recommended)
// Automatically analyzes slow queries and suggests indexes
// Shows estimated improvement for each suggestion
```

**When NOT to expect index usage:**

- **Tiny collections**: <1000 docs, COLLSCAN may be faster than index lookup overhead.

- **Returning most documents**: If query matches >30% of collection, COLLSCAN can win.

- **$where and $text without index**: These have special requirements.

- **Negation operators alone**: `{ field: { $ne: value } }` rarely uses indexes well.

**Verify with:**

```javascript
// Quick check: Is my query using an index?
function checkIndexUsage(query) {
  const explain = query.explain("executionStats")
  const stage = explain.queryPlanner.winningPlan.stage ||
                explain.queryPlanner.winningPlan.inputStage?.stage

  const stats = explain.executionStats
  const ratio = stats.totalDocsExamined / Math.max(stats.nReturned, 1)

  print(`Stage: ${stage}`)
  print(`Docs examined: ${stats.totalDocsExamined}`)
  print(`Docs returned: ${stats.nReturned}`)
  print(`Efficiency ratio: ${ratio.toFixed(2)}`)
  print(`Time: ${stats.executionTimeMillis}ms`)

  if (stage === "COLLSCAN") {
    print("⚠️  COLLSCAN detected - create an index!")
  } else if (ratio > 10) {
    print("⚠️  Index exists but not selective - check field order")
  } else {
    print("✓ Query is using index efficiently")
  }
}

// Usage:
checkIndexUsage(db.orders.find({ customerId: "cust123" }))
```

Reference: [https://mongodb.com/docs/manual/tutorial/analyze-query-plan/](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)

### 1.5 Order Compound Index Fields Correctly (ESR Rule)

**Impact: CRITICAL (10-100× query performance—wrong order forces full index scan + in-memory sort)**

**The ESR rule (Equality → Sort → Range) is the single most important concept for compound index design.** Wrong field order forces MongoDB to scan massive portions of the index and perform expensive in-memory sorts. A 10ms query becomes a 10-second query with incorrect ordering. This is the #1 cause of index-related performance issues.

**Incorrect: range field before sort—kills performance**

```javascript
// Query: Find active users, sorted by name, in age range
db.users.find({
  status: "active",              // Equality: exact match
  age: { $gte: 21, $lte: 65 }   // Range: bounds
}).sort({ name: 1 })             // Sort: ordering

// WRONG: Range before Sort
db.users.createIndex({ status: 1, age: 1, name: 1 })
//                      E          R        S (wrong!)

// What happens:
// 1. Jump to status="active" (good - equality works)
// 2. Scan ALL ages 21-65 in index order (bad - millions of entries)
// 3. Collect results, THEN sort in memory (terrible - 100MB+ RAM)
// Result: "SORT_KEY_GENERATOR" stage, memory limits hit, query killed
```

**Correct: Equality → Sort → Range**

```javascript
// Same query, ESR-compliant index
db.users.createIndex({ status: 1, name: 1, age: 1 })
//                      E          S        R (correct!)

// What happens:
// 1. Jump to status="active" (equality narrows to subset)
// 2. Walk index in name order (sort is FREE - index already ordered)
// 3. For each entry, check if age in range (filter inline)
// Result: No in-memory sort, streaming results, 10ms response
```

**The ESR rule explained:**

```javascript
┌─────────────────────────────────────────────────────────────────┐
│  E - Equality fields first                                      │
│      Exact match (=) narrows to small subset instantly          │
│      { status: "active" } → jumps directly to matching entries  │
├─────────────────────────────────────────────────────────────────┤
│  S - Sort fields second                                         │
│      Index order matches query sort → no memory sort needed     │
│      .sort({ name: 1 }) → walk index in natural order           │
├─────────────────────────────────────────────────────────────────┤
│  R - Range fields last                                          │
│      Bounds ($gt, $lt, $gte, $lte, $ne) filter remaining        │
│      { age: { $gte: 21 } } → checked inline during scan         │
└─────────────────────────────────────────────────────────────────┘
```

**Multiple equality fields—cardinality matters:**

```javascript
// Query with multiple equality conditions
db.orders.find({
  status: "shipped",      // E: ~5 distinct values
  customerId: "cust123",  // E: ~100K distinct values
  region: "US"            // E: ~50 distinct values
}).sort({ createdAt: -1 })

// Best: highest cardinality equality field first within E
db.orders.createIndex({
  customerId: 1,  // E: highest cardinality (most selective)
  region: 1,      // E: medium cardinality
  status: 1,      // E: lowest cardinality
  createdAt: -1   // S: sort field
})
// Narrows to ~50 docs at first hop instead of ~2M
```

**Real-world example—e-commerce product search:**

```javascript
// Query: In-stock electronics under $500, sorted by rating
db.products.find({
  category: "electronics",        // E: exact match
  inStock: true,                  // E: exact match (boolean)
  price: { $lte: 500 }           // R: range
}).sort({ rating: -1 }).limit(20) // S: sort

// ESR-compliant index
db.products.createIndex({
  category: 1,    // E
  inStock: 1,     // E
  rating: -1,     // S (sort before range!)
  price: 1        // R (last, even though it appears before sort in query)
})

// Execution: Jump to electronics+inStock, walk by rating desc, filter price
// Returns top 20 in <10ms even with 10M products
```

**When NOT to use strict ESR:**

- **No sort in query**: If query has no `.sort()`, you can put range anywhere after equality fields.

- **Covered queries priority**: Sometimes including projection fields matters more than perfect ESR.

- **Index reuse**: A single index serving multiple query patterns may need compromise ordering.

- **Very small result sets**: If equality already narrows to <100 docs, in-memory sort is negligible.

**Verify with explain():**

```javascript
// Check for in-memory sort (the killer)
const stats = db.users.find({
  status: "active",
  age: { $gte: 21, $lte: 65 }
}).sort({ name: 1 }).explain("executionStats")

// GOOD indicators:
// - No "SORT" stage in executionStages
// - "stage": "IXSCAN" feeds directly to "PROJECTION" or "FETCH"
// - totalDocsExamined close to nReturned

// BAD indicators (wrong field order):
// - "stage": "SORT" or "SORT_KEY_GENERATOR" appears
// - "memUsage" or "memLimit" in sort stage
// - totalKeysExamined >> nReturned

// Check winning plan stages
function hasInMemorySort(explainResult) {
  const stages = JSON.stringify(explainResult.queryPlanner.winningPlan)
  return stages.includes('"SORT"') && !stages.includes('"SORT_MERGE"')
}

if (hasInMemorySort(stats)) {
  print("WARNING: Query requires in-memory sort - check ESR order")
}
```

**Common ESR mistakes:**

```javascript
// Mistake 1: Range before Sort
// Query: { price: { $lt: 100 } }.sort({ rating: -1 })
{ price: 1, rating: -1 }  // BAD: R before S
{ rating: -1, price: 1 }  // GOOD: S before R

// Mistake 2: Treating $in as equality (it's not always)
// Query: { status: { $in: ["a", "b", "c"] } }.sort({ date: -1 })
// $in with few values acts like equality
// $in with many values acts more like range

// Mistake 3: Forgetting sort direction matters
// Query: .sort({ date: -1 })
{ date: 1 }   // Works but scans backwards (less efficient)
{ date: -1 }  // Optimal: natural index order matches query
```

Reference: [https://mongodb.com/docs/manual/tutorial/equality-sort-range-rule/](https://mongodb.com/docs/manual/tutorial/equality-sort-range-rule/)

### 1.6 Put High-Cardinality Fields First in Equality Conditions

**Impact: HIGH (6,000× fewer keys examined—low cardinality first scans millions, high cardinality first scans hundreds)**

**For multiple equality fields, put the highest cardinality (most unique values) field first.** Cardinality determines how quickly the index narrows results. A field with 100,000 unique values eliminates 99.999% of documents on first lookup; a field with 5 values only eliminates 80%. This ordering can mean the difference between scanning 500 index entries vs 3 million.

**Incorrect: low cardinality first—scans millions**

```javascript
// Query: Find orders by status and customerId
db.orders.find({ status: "completed", customerId: "cust123" })

// BAD index: status first (only 5 distinct values)
db.orders.createIndex({ status: 1, customerId: 1 })

// What happens on 10M orders:
// 1. Jump to status="completed" → matches 3M documents (30% of collection)
// 2. Within those 3M, scan for customerId="cust123" → finds 500 matches
// Result: totalKeysExamined = 3,000,000 to find 500 documents

// explain() shows:
{
  "totalKeysExamined": 3000000,   // Scanned 3M index entries!
  "totalDocsExamined": 500,
  "nReturned": 500,
  "executionTimeMillis": 1200     // Over a second
}
```

**Correct: high cardinality first—scans hundreds**

```javascript
// GOOD index: customerId first (100K distinct values)
db.orders.createIndex({ customerId: 1, status: 1 })

// What happens:
// 1. Jump to customerId="cust123" → matches 500 documents (0.005% of collection)
// 2. Within those 500, filter status="completed" → finds 350 matches
// Result: totalKeysExamined = 500 to find 350 documents

// explain() shows:
{
  "totalKeysExamined": 500,       // Only 500 index entries!
  "totalDocsExamined": 350,
  "nReturned": 350,
  "executionTimeMillis": 2        // 2 milliseconds
}

// Same query, 600× fewer keys examined, 600× faster
```

**Understanding selectivity: the math**

```javascript
// Selectivity = 1 / number of distinct values
// Higher selectivity = better for leading position

// Example with 10M orders:
// status: 5 distinct → selectivity = 0.2 → matches ~2M docs
// customerId: 100K distinct → selectivity = 0.00001 → matches ~100 docs
// orderId: 10M distinct (unique) → selectivity = 0.0000001 → matches 1 doc

// Rule: Put highest selectivity (lowest match count) first
```

**Cardinality reference table:**

| Field Type | Example Field | Typical Cardinality | Selectivity |

|------------|--------------|---------------------|-------------|

| Unique ID | `_id`, `orderId` | = doc count | Perfect |

| User identifier | `userId`, `email` | High (100K+) | Excellent |

| Timestamp | `createdAt` | High | Excellent |

| Category | `category`, `department` | Medium (10-1000) | Good |

| Status | `status`, `state` | Low (3-10) | Poor |

| Boolean | `isActive`, `isDeleted` | Very low (2) | Very poor |

| Constant | `type: "order"` | 1 | Useless |

**Measuring cardinality:**

```javascript
// Quick cardinality check
db.orders.distinct("status").length        // 5
db.orders.distinct("customerId").length    // 100000
db.orders.distinct("region").length        // 12

// For very large collections, estimate with aggregation
db.orders.aggregate([
  { $group: { _id: "$status" } },
  { $count: "distinctCount" }
])  // { distinctCount: 5 }

// Full cardinality analysis for multiple fields
db.orders.aggregate([
  { $facet: {
    status: [{ $group: { _id: "$status" } }, { $count: "n" }],
    customerId: [{ $group: { _id: "$customerId" } }, { $count: "n" }],
    region: [{ $group: { _id: "$region" } }, { $count: "n" }]
  }}
])
// Returns: { status: [{n: 5}], customerId: [{n: 100000}], region: [{n: 12}] }
// Order: customerId > region > status
```

**Real-world example—multi-tenant SaaS:**

```javascript
// Query: Find active users for a tenant
db.users.find({
  tenantId: "tenant123",     // ~1000 distinct (1000 customers)
  status: "active",          // ~3 distinct (active/inactive/pending)
  role: "admin"              // ~5 distinct (admin/user/viewer/etc)
})

// Calculate expected matches at each level (100K total users):
// tenantId first: 100K / 1000 = 100 users → then filter status/role
// status first: 100K / 3 = 33,333 users → then filter tenantId/role
// role first: 100K / 5 = 20,000 users → then filter tenantId/status

// Best index order (highest cardinality first):
db.users.createIndex({ tenantId: 1, role: 1, status: 1 })
// Narrows to ~100 on first lookup, then ~20, then ~15
```

**When NOT to put high cardinality first:**

- **ESR rule takes precedence**: If you have Sort in query, ESR order (Equality→Sort→Range) beats pure cardinality optimization.

- **Index reuse across queries**: If one query needs `{status}` alone and another needs `{status, customerId}`, putting status first serves both.

- **Covered query requirements**: Projection fields may need specific index positions.

- **Near-equal cardinality**: If fields have similar cardinality, prefer the one queried more often as leading field.

**Verify with:**

```javascript
// Compare index efficiency for different orderings
function compareIndexOrder(collection, query, index1, index2) {
  // Create both indexes
  db[collection].createIndex(index1, { name: "test_order_1" })
  db[collection].createIndex(index2, { name: "test_order_2" })

  // Test with first index
  const explain1 = db[collection].find(query)
    .hint("test_order_1")
    .explain("executionStats")

  // Test with second index
  const explain2 = db[collection].find(query)
    .hint("test_order_2")
    .explain("executionStats")

  print("Index 1:", JSON.stringify(index1))
  print("  Keys examined:", explain1.executionStats.totalKeysExamined)
  print("  Time:", explain1.executionStats.executionTimeMillis, "ms")

  print("Index 2:", JSON.stringify(index2))
  print("  Keys examined:", explain2.executionStats.totalKeysExamined)
  print("  Time:", explain2.executionStats.executionTimeMillis, "ms")

  // Cleanup
  db[collection].dropIndex("test_order_1")
  db[collection].dropIndex("test_order_2")
}

// Usage
compareIndexOrder(
  "orders",
  { status: "completed", customerId: "cust123" },
  { status: 1, customerId: 1 },    // Low cardinality first
  { customerId: 1, status: 1 }     // High cardinality first
)
```

Reference: [https://mongodb.com/docs/manual/tutorial/create-queries-that-ensure-selectivity/](https://mongodb.com/docs/manual/tutorial/create-queries-that-ensure-selectivity/)

### 1.7 Remove Unused Indexes

**Impact: HIGH (Each unused index adds 10-30% write latency and wastes RAM—5 unused indexes can double write times)**

**Every index costs write performance and memory whether it's used or not.** Each insert and update must maintain all indexes on a collection. We've seen production systems with 15 indexes where 10 were never used—removing them cut write latency by 60%. Audit indexes regularly and remove any that aren't serving queries.

**Incorrect: keeping all indexes "just in case"**

```javascript
// Collection with accumulated indexes over 3 years of development
db.products.getIndexes()
// Returns 12 indexes:
[
  { name: "_id_" },                    // Required, cannot remove
  { name: "sku_1" },                   // Used frequently
  { name: "category_1" },              // Redundant! (see below)
  { name: "category_1_brand_1" },      // Covers category_1 queries
  { name: "name_text" },               // Created for feature that was removed
  { name: "price_1" },                 // Used once per quarter for reports
  { name: "createdAt_1" },             // Migration script, never used since
  { name: "tags_1" },                  // Feature never launched
  { name: "vendor_1_price_1" },        // Old query pattern, deprecated
  { name: "status_1" },                // Only 3 values, rarely selective
  { name: "updatedAt_1" },             // TTL candidate, not TTL index
  { name: "legacy_id_1" }              // Migration complete 2 years ago
]

// Cost of 12 indexes:
// - Insert: Must write to 12 B-trees (6× slower than 2 indexes)
// - Memory: ~500MB index data competing for 1GB WiredTiger cache
// - Storage: 2GB index files vs 800MB needed
```

**Correct: audit and remove unused**

```javascript
// Step 1: Get index usage statistics
db.products.aggregate([{ $indexStats: {} }])

// Output shows access patterns since last server restart:
[
  { name: "_id_", accesses: { ops: 150000, since: ISODate("2024-01-01") } },
  { name: "sku_1", accesses: { ops: 125000 } },           // Heavy use
  { name: "category_1", accesses: { ops: 0 } },           // ZERO - redundant
  { name: "category_1_brand_1", accesses: { ops: 45000 } }, // Covers category queries
  { name: "name_text", accesses: { ops: 0 } },            // ZERO - dead feature
  { name: "price_1", accesses: { ops: 12 } },             // Negligible
  { name: "createdAt_1", accesses: { ops: 0 } },          // ZERO - migration relic
  { name: "tags_1", accesses: { ops: 0 } },               // ZERO - never launched
  { name: "vendor_1_price_1", accesses: { ops: 3 } },     // Nearly zero
  { name: "status_1", accesses: { ops: 89 } },            // Low, low cardinality
  { name: "updatedAt_1", accesses: { ops: 0 } },          // ZERO
  { name: "legacy_id_1", accesses: { ops: 0 } }           // ZERO - migration done
]

// Step 2: Identify candidates for removal
// Rule: ops = 0 over 30+ days → drop
// Rule: ops < 100 and low cardinality → probably not helping

// Step 3: Remove unused indexes (one at a time, monitor)
db.products.dropIndex("name_text")        // Dead feature
db.products.dropIndex("createdAt_1")      // Migration relic
db.products.dropIndex("tags_1")           // Never launched
db.products.dropIndex("legacy_id_1")      // Migration complete
db.products.dropIndex("updatedAt_1")      // Not serving queries
db.products.dropIndex("category_1")       // Redundant with compound

// Step 4: Evaluate low-usage indexes
// price_1 (12 ops) - keep if quarterly reports need it
// vendor_1_price_1 (3 ops) - investigate, probably drop
// status_1 (89 ops) - low cardinality, check if actually helping

// Result: 12 indexes → 6 indexes
// Write latency: -45%
// Memory freed: ~300MB for cache
```

**Index redundancy rules:**

```javascript
// REDUNDANT: Compound index makes single-field prefix redundant
{ a: 1 }           // DROP - redundant
{ a: 1, b: 1 }     // KEEP - covers queries on {a} AND {a, b}

// NOT REDUNDANT: Single field does NOT make compound redundant
{ a: 1 }           // Useful for some queries
{ a: 1, b: 1 }     // Useful for different queries
// Both may be needed depending on query patterns

// REDUNDANT: Subset prefix
{ a: 1, b: 1 }           // DROP - redundant
{ a: 1, b: 1, c: 1 }     // KEEP - covers {a}, {a,b}, and {a,b,c}

// NOT REDUNDANT: Different sort directions
{ a: 1, b: 1 }     // Supports .sort({ a: 1, b: 1 })
{ a: 1, b: -1 }    // Supports .sort({ a: 1, b: -1 }) - different!
// Both may be needed for different sort patterns
```

**Index cost breakdown:**

| Resource | Impact per Index | 10 Unused Indexes |

|----------|-----------------|-------------------|

| Insert latency | +5-15% | +50-150% slower |

| Update latency | +5-15% | +50-150% slower |

| Storage | 10-30% of data size | 100-300% overhead |

| RAM (WiredTiger cache) | Competes for cache | Less data cached |

| Replication lag | More oplog entries | Secondaries fall behind |

**When NOT to drop an index:**

- **Infrequent but critical queries**: Monthly reports, audit queries—low ops but essential.

- **Disaster recovery queries**: May have 0 ops but needed for incident response.

- **Recently created**: Wait 30+ days to assess usage.

- **Unique constraints**: Even if rarely queried, enforces data integrity.

- **TTL indexes**: May show low ops but handle expiration automatically.

**Verify with:**

```javascript
// Complete index audit script
function auditIndexes(collectionName) {
  const stats = db[collectionName].aggregate([{ $indexStats: {} }]).toArray()
  const indexes = db[collectionName].getIndexes()

  print(`\n=== Index Audit: ${collectionName} ===`)
  print(`Total indexes: ${indexes.length}`)

  // Find unused (0 ops)
  const unused = stats.filter(s => s.accesses.ops === 0 && s.name !== "_id_")
  if (unused.length > 0) {
    print(`\n⚠️  UNUSED INDEXES (0 ops):`)
    unused.forEach(i => print(`  - ${i.name}`))
  }

  // Find low usage (<100 ops)
  const lowUsage = stats.filter(s =>
    s.accesses.ops > 0 && s.accesses.ops < 100 && s.name !== "_id_"
  )
  if (lowUsage.length > 0) {
    print(`\n⚠️  LOW USAGE INDEXES (<100 ops):`)
    lowUsage.forEach(i => print(`  - ${i.name}: ${i.accesses.ops} ops`))
  }

  // Find potential redundant prefixes
  const indexKeys = indexes.map(i => ({
    name: i.name,
    keys: Object.keys(i.key).join(",")
  }))
  print(`\n📋 Check for redundant prefixes manually:`)
  indexKeys.forEach(i => print(`  ${i.name}: [${i.keys}]`))

  // Calculate index sizes
  const collStats = db[collectionName].stats()
  const indexSize = collStats.totalIndexSize
  const dataSize = collStats.size
  print(`\n📊 Size: ${(indexSize/1024/1024).toFixed(1)}MB indexes vs ${(dataSize/1024/1024).toFixed(1)}MB data`)
  print(`   Ratio: ${(indexSize/dataSize*100).toFixed(1)}% of data size`)
}

// Run audit
auditIndexes("products")
```

Reference: [https://mongodb.com/docs/manual/tutorial/measure-index-use/](https://mongodb.com/docs/manual/tutorial/measure-index-use/)

### 1.8 Understand Index Prefix Principle

**Impact: CRITICAL (One { a: 1, b: 1, c: 1 } index serves queries on a, a+b, and a+b+c—saves 2 redundant indexes)**

**A compound index supports queries on any prefix of its fields—you don't need separate indexes.** Index `{ a: 1, b: 1, c: 1 }` supports queries on `{ a }`, `{ a, b }`, and `{ a, b, c }`. Understanding this eliminates redundant indexes that waste RAM, slow writes, and complicate maintenance. The flip side: queries on `{ b }`, `{ c }`, or `{ b, c }` cannot use this index at all.

**Incorrect: redundant indexes—wasted resources**

```javascript
// Common mistake: Creating overlapping indexes
db.orders.createIndex({ customerId: 1 })                    // Index 1
db.orders.createIndex({ customerId: 1, status: 1 })        // Index 2
db.orders.createIndex({ customerId: 1, status: 1, date: -1 }) // Index 3

// Query support:
// - find({ customerId: x }) → Uses Index 1, 2, OR 3
// - find({ customerId: x, status: y }) → Uses Index 2 OR 3
// - find({ customerId: x, status: y, date: z }) → Uses Index 3 only

// Problem: Index 1 and Index 2 are REDUNDANT
// Index 3 already covers all their use cases!

// Cost of redundancy:
// - 3 indexes instead of 1
// - 3× write overhead (each insert/update touches 3 indexes)
// - 3× RAM usage for index pages
// - 3× maintenance during compaction
```

**Correct: single compound index—prefix coverage**

```javascript
// Single index covers all three query patterns
db.orders.createIndex({ customerId: 1, status: 1, date: -1 })

// Prefix coverage:
// - { customerId: 1 } ← First field prefix
//   find({ customerId: "cust123" }) ✓ USES INDEX
//
// - { customerId: 1, status: 1 } ← Two-field prefix
//   find({ customerId: "cust123", status: "completed" }) ✓ USES INDEX
//
// - { customerId: 1, status: 1, date: -1 } ← Full index
//   find({ customerId: "cust123", status: "completed", date: { $gte: d } }) ✓ USES INDEX

// NOT supported (non-prefixes):
// - { status: 1 } ← Not a prefix (doesn't start with customerId)
//   find({ status: "completed" }) ✗ COLLSCAN
//
// - { date: 1 } ← Not a prefix
//   find({ date: { $gte: d } }) ✗ COLLSCAN
//
// - { status: 1, date: 1 } ← Not a prefix (skips customerId)
//   find({ status: "completed", date: { $gte: d } }) ✗ COLLSCAN
```

**Prefix principle visualized:**

```javascript
// Index: { a: 1, b: 1, c: 1, d: 1 }
//
// Valid prefixes (can use this index):
// ┌───┬───┬───┬───┐
// │ a │   │   │   │ ✓ Prefix: {a}
// ├───┼───┼───┼───┤
// │ a │ b │   │   │ ✓ Prefix: {a, b}
// ├───┼───┼───┼───┤
// │ a │ b │ c │   │ ✓ Prefix: {a, b, c}
// ├───┼───┼───┼───┤
// │ a │ b │ c │ d │ ✓ Full index: {a, b, c, d}
// └───┴───┴───┴───┘
//
// Invalid (NOT prefixes - cannot use this index):
// ┌───┬───┬───┬───┐
// │   │ b │   │   │ ✗ Skips 'a'
// ├───┼───┼───┼───┤
// │   │   │ c │   │ ✗ Skips 'a', 'b'
// ├───┼───┼───┼───┤
// │ a │   │ c │   │ ✗ Skips 'b' (must be contiguous)
// ├───┼───┼───┼───┤
// │   │ b │ c │ d │ ✗ Skips 'a'
// └───┴───┴───┴───┘
```

**Index consolidation strategy:**

```javascript
// Before: Multiple overlapping indexes
db.products.getIndexes()
// { category: 1 }
// { category: 1, brand: 1 }
// { category: 1, brand: 1, price: 1 }
// { category: 1, price: 1 }  ← This one is NOT covered!

// Analysis:
// - { category: 1 } is prefix of { category: 1, brand: 1, price: 1 }
// - { category: 1, brand: 1 } is prefix of { category: 1, brand: 1, price: 1 }
// - { category: 1, price: 1 } is NOT a prefix (skips brand)

// After: Optimal index set
db.products.dropIndex({ category: 1 })
db.products.dropIndex({ category: 1, brand: 1 })
// Keep: { category: 1, brand: 1, price: 1 }
// Keep: { category: 1, price: 1 } ← Still needed, different field order

// Result: 2 indexes instead of 4 (50% reduction)
```

**Prefix principle with sort:**

```javascript
// Index: { status: 1, createdAt: -1 }

// Queries using prefix:
db.orders.find({ status: "pending" }).sort({ createdAt: -1 })
// ✓ Both filter (status) and sort (createdAt) use index

db.orders.find({ status: "pending" })
// ✓ Filter uses prefix

// Sort-only queries:
db.orders.find().sort({ status: 1, createdAt: -1 })
// ✓ Sort uses full index (no filter needed for sort)

db.orders.find().sort({ createdAt: -1 })
// ✗ Cannot use index - sort field not at prefix position
// Must scan full index or do in-memory sort

// Key insight: For sort-only, first sort field must be at index start
```

**Common prefix mistakes:**

```javascript
// Mistake 1: Creating index for every query variation
// BAD:
db.users.createIndex({ tenantId: 1 })
db.users.createIndex({ tenantId: 1, email: 1 })
db.users.createIndex({ tenantId: 1, email: 1, status: 1 })

// GOOD: Single compound index
db.users.createIndex({ tenantId: 1, email: 1, status: 1 })

// Mistake 2: Thinking field ORDER doesn't matter
// These are DIFFERENT indexes with different prefixes:
db.orders.createIndex({ status: 1, date: 1 })
// Prefix: {status}, {status, date}

db.orders.createIndex({ date: 1, status: 1 })
// Prefix: {date}, {date, status}

// Choose based on your most common query patterns

// Mistake 3: Forgetting sort fields affect prefix usage
db.orders.createIndex({ status: 1, amount: 1 })
db.orders.find({ status: "pending" }).sort({ date: -1 })
// ✗ date not in index → in-memory sort!

// Fix: Include sort field
db.orders.createIndex({ status: 1, date: -1, amount: 1 })
```

**When to create non-prefix indexes:**

- **Different leading field needed**: Queries filter on different fields first.

- **Different sort orders**: Ascending vs descending sorts (can't flip multi-field sort).

- **Covered query optimization**: Different projections need different field combinations.

- **Cardinality considerations**: Sometimes a different leading field is more selective.

**Verify with:**

```javascript
// Find redundant indexes (covered by prefixes of other indexes)
function findRedundantIndexes(collection) {
  const indexes = db[collection].getIndexes().filter(idx => idx.name !== "_id_")

  const redundant = []

  for (const idx of indexes) {
    const idxFields = Object.keys(idx.key)

    for (const other of indexes) {
      if (idx.name === other.name) continue

      const otherFields = Object.keys(other.key)

      // Check if idx is a prefix of other
      if (idxFields.length < otherFields.length) {
        const isPrefix = idxFields.every((field, i) =>
          field === otherFields[i] && idx.key[field] === other.key[field]
        )

        if (isPrefix) {
          redundant.push({
            redundantIndex: idx.name,
            coveredBy: other.name,
            reason: `${idx.name} is a prefix of ${other.name}`
          })
        }
      }
    }
  }

  if (redundant.length === 0) {
    print("No redundant indexes found ✓")
  } else {
    print(`Found ${redundant.length} redundant index(es):`)
    redundant.forEach(r => {
      print(`\n  DROP: ${r.redundantIndex}`)
      print(`  Covered by: ${r.coveredBy}`)
    })
  }

  return redundant
}

// Usage
findRedundantIndexes("orders")
```

Reference: [https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/](https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/)

### 1.9 Understand Multikey Indexes for Arrays

**Impact: HIGH (Query any element in array fields efficiently—one index entry per array element)**

**Multikey indexes automatically create one index entry per array element, enabling efficient queries on array contents.** When you index a field containing `["tag1", "tag2", "tag3"]`, MongoDB creates three index entries pointing to that document. This makes `find({ tags: "tag2" })` fast. But compound multikey indexes have restrictions you must understand.

**Incorrect: no index on array field—COLLSCAN**

```javascript
// Products with tags array
{
  _id: "prod1",
  name: "Laptop",
  tags: ["electronics", "computers", "portable", "gaming"]
}

// Without index, array queries scan every document
db.products.find({ tags: "gaming" })
// COLLSCAN: Checks every document's tags array
// 1M products = 1M array scans

db.products.find({ tags: { $all: ["electronics", "gaming"] } })
// Even worse: Multiple array scans per document
```

**Correct: multikey index on array field**

```javascript
// Create index on array field
db.products.createIndex({ tags: 1 })

// MongoDB automatically creates MULTIKEY index
// Index entries for prod1:
// "computers" → prod1
// "electronics" → prod1
// "gaming" → prod1
// "portable" → prod1

// Now array queries use index:
db.products.find({ tags: "gaming" })
// IXSCAN: Direct lookup for "gaming" in index

db.products.find({ tags: { $in: ["gaming", "electronics"] } })
// IXSCAN: Two index lookups, merge results

db.products.find({ tags: { $all: ["gaming", "electronics"] } })
// IXSCAN: Both terms must match (intersection)
```

**How multikey indexes work:**

```javascript
// Document:
{
  _id: 1,
  title: "Article",
  authors: ["Alice", "Bob", "Charlie"]
}

// Regular index stores: one key → one document
// Multikey index stores: N keys → one document (N = array length)

// Index entries created:
// "Alice" → doc 1
// "Bob" → doc 1
// "Charlie" → doc 1

// Query: { authors: "Bob" }
// Index seek to "Bob" → find doc 1 → return document

// Memory implication:
// 1M docs × 5 avg array elements = 5M index entries
// Multikey indexes can be much larger than expected!
```

**Compound multikey indexes: critical restriction**

```javascript
// RULE: Only ONE array field allowed in compound index
// MongoDB can't efficiently index multiple arrays (Cartesian product)

// ✓ Works: One array field
db.products.createIndex({ category: 1, tags: 1 })
// category = scalar, tags = array

db.products.find({ category: "electronics", tags: "gaming" })
// ✓ Uses compound index

// ✗ Fails: Two array fields
db.products.createIndex({ tags: 1, categories: 1 })
// If BOTH are arrays in documents:
// ERROR: "cannot index parallel arrays"

// Document that causes the error:
{
  tags: ["a", "b"],
  categories: ["x", "y"]
}
// Would need 4 index entries: (a,x), (a,y), (b,x), (b,y)
// Scales exponentially, so MongoDB forbids it

// Workaround: Combine into single array
{
  attributes: [
    { type: "tag", value: "a" },
    { type: "tag", value: "b" },
    { type: "category", value: "x" }
  ]
}
db.products.createIndex({ "attributes.type": 1, "attributes.value": 1 })
```

**Array of objects: embedded documents**

```javascript
// Common pattern: Array of objects
{
  _id: "order1",
  items: [
    { product: "laptop", quantity: 1, price: 999 },
    { product: "mouse", quantity: 2, price: 29 }
  ]
}

// Index on nested field within array
db.orders.createIndex({ "items.product": 1 })
// Creates entries: "laptop" → order1, "mouse" → order1

// Query:
db.orders.find({ "items.product": "laptop" })
// ✓ Uses index

// Compound on array subfields:
db.orders.createIndex({ "items.product": 1, "items.price": 1 })
// ✓ Works! Both fields are in SAME array

// Query both:
db.orders.find({
  "items.product": "laptop",
  "items.price": { $lt: 1000 }
})
// ⚠️ May match different array elements!
// Matches if ANY item is laptop AND ANY item is <$1000
// NOT necessarily the same item!
```

**$elemMatch for same-element conditions:**

```javascript
// Problem: Multiple conditions across different elements
db.orders.find({
  "items.product": "laptop",
  "items.price": { $lt: 500 }
})
// Matches order with laptop($999) AND mouse($29)
// Because: some item is "laptop", some item is <$500

// Solution: $elemMatch ensures same element
db.orders.find({
  items: {
    $elemMatch: {
      product: "laptop",
      price: { $lt: 500 }
    }
  }
})
// Only matches if SAME item is laptop AND <$500
// This order doesn't match (laptop is $999)

// Index usage with $elemMatch:
// Still uses multikey index, but additional filtering in memory
// Consider: { "items.product": 1, "items.price": 1 } compound index
```

**Multikey index bounds:**

```javascript
// Important: Multikey indexes have different bound behavior

// Regular index bounds are tight:
// { price: { $gte: 100, $lte: 200 } }
// Bounds: [100, 200]

// Multikey index bounds can be loose:
db.orders.createIndex({ "items.price": 1 })

db.orders.find({
  "items.price": { $gte: 100, $lte: 200 }
})

// Index bounds: [100, 200]
// BUT: Returns docs where ANY item is in range
// Then filters to ensure at least one item matches full condition

// explain() shows: "isMultiKey": true
// This affects how bounds are applied
```

**When NOT to use multikey indexes:**

- **Huge arrays**: 1000+ element arrays create 1000+ index entries per document.

- **Frequently updated arrays**: Each array change updates multiple index entries.

- **$all with many terms**: Performance degrades with many required terms.

- **Position-based queries**: `{ "arr.0": value }` can use index, but position queries are uncommon.

**Verify with:**

```javascript
// Analyze multikey index characteristics
function analyzeMultikeyIndex(collection, indexName) {
  const indexes = db[collection].getIndexes()
  const idx = indexes.find(i => i.name === indexName)

  if (!idx) {
    print(`Index "${indexName}" not found`)
    return
  }

  print(`Index: ${indexName}`)
  print(`Key: ${JSON.stringify(idx.key)}`)

  // Check if multikey by examining a query
  const field = Object.keys(idx.key)[0]
  const explain = db[collection].find({ [field]: { $exists: true } })
    .hint(indexName)
    .explain()

  const isMultiKey = explain.queryPlanner.winningPlan.inputStage?.isMultiKey ||
                     explain.queryPlanner.winningPlan.isMultiKey

  print(`Multikey: ${isMultiKey ? "YES" : "NO"}`)

  if (isMultiKey) {
    // Analyze array sizes
    const stats = db[collection].aggregate([
      { $project: { arraySize: { $size: `$${field}` } } },
      { $group: {
          _id: null,
          avgSize: { $avg: "$arraySize" },
          maxSize: { $max: "$arraySize" },
          minSize: { $min: "$arraySize" },
          count: { $sum: 1 }
      }}
    ]).toArray()[0]

    if (stats) {
      print(`\nArray statistics for "${field}":`)
      print(`  Documents: ${stats.count}`)
      print(`  Avg array size: ${stats.avgSize?.toFixed(1) || "N/A"}`)
      print(`  Max array size: ${stats.maxSize || "N/A"}`)
      print(`  Estimated index entries: ${Math.round(stats.count * (stats.avgSize || 1))}`)

      if (stats.avgSize > 100) {
        print(`\n⚠️  Large arrays detected - consider array size limits`)
      }
    }
  }
}

// Usage
analyzeMultikeyIndex("products", "tags_1")
```

Reference: [https://mongodb.com/docs/manual/core/indexes/index-types/index-multikey/](https://mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)

### 1.10 Use Geospatial Indexes for Location Queries

**Impact: HIGH (Find nearby locations: 2dsphere index with $near returns results in milliseconds vs scanning all)**

**Geospatial indexes enable efficient queries for nearby locations, points within areas, and distance calculations.** Searching for "restaurants within 5km" without a geospatial index means calculating distances for every document. With a 2dsphere index, MongoDB uses spatial data structures to find candidates immediately. For real-world coordinates (lat/long), always use 2dsphere.

**Incorrect: no geospatial index—COLLSCAN**

```javascript
// Stores with location
{
  _id: "store1",
  name: "Downtown Store",
  location: {
    type: "Point",
    coordinates: [-73.9857, 40.7484]  // [longitude, latitude]
  }
}

// Without geospatial index, can't efficiently query by location
// Would need to calculate distance for EVERY store
db.stores.find({
  // Can't even express "nearby" query without $near
  // $near REQUIRES geospatial index
})

// Manual distance calculation for every document:
// O(n) complexity, slow on large datasets
```

**Correct: 2dsphere index for geospatial queries**

```javascript
// Create 2dsphere index on GeoJSON field
db.stores.createIndex({ location: "2dsphere" })

// Now efficient geospatial queries work:

// Find stores within 5km of a point
db.stores.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9857, 40.7484]  // User's location
      },
      $maxDistance: 5000  // 5km in meters
    }
  }
})
// Returns stores sorted by distance, nearest first
// Uses spatial index for efficient candidate selection

// Find stores within a polygon (delivery zone)
db.stores.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.0, 40.7],
          [-73.9, 40.7],
          [-73.9, 40.8],
          [-74.0, 40.8],
          [-74.0, 40.7]  // Close the polygon
        ]]
      }
    }
  }
})
```

**GeoJSON format: required for 2dsphere**

```javascript
// Point (most common)
{
  location: {
    type: "Point",
    coordinates: [-73.9857, 40.7484]  // [longitude, latitude]
  }
}
// IMPORTANT: Order is [longitude, latitude], NOT [lat, long]!

// LineString (routes, paths)
{
  route: {
    type: "LineString",
    coordinates: [
      [-73.9857, 40.7484],
      [-73.9900, 40.7500],
      [-73.9950, 40.7550]
    ]
  }
}

// Polygon (areas, zones)
{
  serviceArea: {
    type: "Polygon",
    coordinates: [[
      [-74.0, 40.7],
      [-73.9, 40.7],
      [-73.9, 40.8],
      [-74.0, 40.8],
      [-74.0, 40.7]  // First and last point must match
    ]]
  }
}
```

**Common geospatial query patterns:**

```javascript
// 1. Find N nearest (with distance)
db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9857, 40.7484] },
      distanceField: "distance",  // Adds distance to results
      maxDistance: 10000,          // 10km
      spherical: true
    }
  },
  { $limit: 10 }
])
// Returns: { ...store, distance: 1234.5 } (meters)

// 2. Find within radius
db.stores.find({
  location: {
    $geoWithin: {
      $centerSphere: [
        [-73.9857, 40.7484],  // Center point
        5 / 6378.1             // 5km / Earth radius in km
      ]
    }
  }
})
// Note: $geoWithin doesn't sort by distance

// 3. Find intersecting geometries
db.deliveryZones.find({
  area: {
    $geoIntersects: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9857, 40.7484]
      }
    }
  }
})
// "Which delivery zones cover this point?"

// 4. $near with min and max distance (ring)
db.stores.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
      $minDistance: 1000,  // At least 1km away
      $maxDistance: 5000   // At most 5km away
    }
  }
})
```

**Compound geospatial indexes:**

```javascript
// Combine geospatial with other fields
db.stores.createIndex({ location: "2dsphere", category: 1 })

// Query: "Restaurants within 5km"
db.stores.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
      $maxDistance: 5000
    }
  },
  category: "restaurant"
})
// Both conditions use the compound index

// Important: Geospatial field can be anywhere in compound index
db.stores.createIndex({ category: 1, location: "2dsphere" })
// Also works, different query patterns may prefer different order
```

**2d vs 2dsphere indexes:**

```javascript
// 2dsphere: For real-world Earth coordinates (GeoJSON)
// - Accounts for Earth's spherical shape
// - Distances in meters
// - Supports GeoJSON types
// - USE THIS for lat/long coordinates
db.stores.createIndex({ location: "2dsphere" })

// 2d: For flat (planar) coordinate systems
// - Euclidean geometry (flat plane)
// - Distances in coordinate units
// - Only supports points
// - Use for: game maps, floor plans, non-Earth data
db.gameObjects.createIndex({ position: "2d" })

// Legacy coordinate pairs (2d only):
{
  position: [50, 100]  // x, y coordinates
}

// 2d query example:
db.gameObjects.find({
  position: {
    $near: [50, 100],
    $maxDistance: 10
  }
})
```

**Performance considerations:**

```javascript
// Geospatial queries have specific characteristics:

// 1. $near always returns sorted results (nearest first)
//    Can't combine with .sort() on other fields

// 2. $geoWithin doesn't sort
//    Faster if you don't need distance sorting
//    Can combine with .sort() on other fields

// 3. Use $geoNear aggregation for most control
db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9, 40.7] },
      distanceField: "dist",
      query: { category: "restaurant", isOpen: true },  // Additional filters
      maxDistance: 5000,
      spherical: true
    }
  },
  { $match: { rating: { $gte: 4 } } },  // Post-filter
  { $limit: 20 }
])

// 4. Large result sets: Add $maxDistance to bound query
// Without maxDistance, may scan entire index
```

**When NOT to use 2dsphere:**

- **Non-geographic data**: Game coordinates, floor plans → use 2d index.

- **Simple bounding box**: If just filtering by lat/long ranges, regular compound index may suffice.

- **Text location**: If locations are addresses (not coordinates), you need geocoding first.

- **Very high precision required**: Geospatial indexes have precision limits.

**Verify with:**

```javascript
// Analyze geospatial index and query
function analyzeGeoQuery(collection, centerPoint, maxDistanceMeters) {
  // Check for geospatial index
  const indexes = db[collection].getIndexes()
  const geoIndex = indexes.find(i =>
    Object.values(i.key).some(v => v === "2dsphere" || v === "2d")
  )

  if (!geoIndex) {
    print(`No geospatial index on ${collection}`)
    return
  }

  print(`Geospatial index: ${geoIndex.name}`)
  print(`Type: ${Object.values(geoIndex.key).find(v => v === "2dsphere" || v === "2d")}`)

  // Test query
  const explain = db[collection].find({
    [Object.keys(geoIndex.key)[0]]: {
      $near: {
        $geometry: { type: "Point", coordinates: centerPoint },
        $maxDistance: maxDistanceMeters
      }
    }
  }).explain("executionStats")

  const stats = explain.executionStats
  print(`\nQuery: $near within ${maxDistanceMeters}m`)
  print(`  Results: ${stats.nReturned}`)
  print(`  Index keys examined: ${stats.totalKeysExamined}`)
  print(`  Docs examined: ${stats.totalDocsExamined}`)
  print(`  Time: ${stats.executionTimeMillis}ms`)

  // Show sample distances
  const results = db[collection].aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: centerPoint },
        distanceField: "distance",
        maxDistance: maxDistanceMeters,
        spherical: true
      }
    },
    { $limit: 5 }
  ]).toArray()

  print(`\nNearest 5:`)
  results.forEach((doc, i) => {
    print(`  ${i+1}. ${doc.name || doc._id} - ${doc.distance.toFixed(0)}m`)
  })
}

// Usage: Find stores near Times Square
analyzeGeoQuery("stores", [-73.9857, 40.7580], 5000)
```

Reference: [https://mongodb.com/docs/manual/core/indexes/index-types/index-geospatial/](https://mongodb.com/docs/manual/core/indexes/index-types/index-geospatial/)

### 1.11 Use Partial Indexes to Reduce Size

**Impact: HIGH (Index only active records: 90% smaller index, 10× faster writes, fits in RAM)**

**Partial indexes only include documents matching a filter expression—index the 10% you query, not the 90% you don't.** If you have 10 million orders but only query the 1 million "pending" ones, a partial index on `{ status: "pending" }` is 90% smaller. Smaller indexes mean faster writes, more indexes fit in RAM, and queries on the indexed subset are just as fast.

**Incorrect: full index on rarely-queried data**

```javascript
// Orders collection: 10M documents
// - 9M completed (rarely queried)
// - 1M pending (constantly queried)

// Full index includes ALL orders
db.orders.createIndex({ customerId: 1, createdAt: -1 })

// Index stats:
// - Size: 500MB (10M entries)
// - RAM usage: 500MB
// - Write cost: Every insert/update touches this index

// But your production queries are:
db.orders.find({ customerId: "x", status: "pending" })
// Only 10% of index entries are ever accessed!
// 90% of index size is wasted RAM
```

**Correct: partial index on active subset**

```javascript
// Partial index: Only pending orders
db.orders.createIndex(
  { customerId: 1, createdAt: -1 },
  { partialFilterExpression: { status: "pending" } }
)

// Index stats:
// - Size: 50MB (1M entries, not 10M)
// - RAM usage: 50MB (90% reduction!)
// - Write cost: Only touches index when status = "pending"

// Query that USES this index:
db.orders.find({
  customerId: "x",
  status: "pending"  // Must include filter condition!
}).sort({ createdAt: -1 })
// ✓ Index used - matches partialFilterExpression

// Query that CANNOT use this index:
db.orders.find({ customerId: "x" })
// ✗ Index not used - doesn't include status: "pending"
// MongoDB can't prove query results won't include completed orders
```

**Partial filter expression syntax:**

```javascript
// Supported operators in partialFilterExpression:
// $eq, $exists, $gt, $gte, $lt, $lte, $type, $and, $or

// Example 1: Active records only
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { isActive: true } }
)

// Example 2: Recent records (last 30 days)
db.events.createIndex(
  { userId: 1, type: 1 },
  { partialFilterExpression: {
      timestamp: { $gte: new Date(Date.now() - 30*24*60*60*1000) }
  }}
)
// WARNING: This date is fixed at index creation!
// Index won't auto-update as time passes

// Example 3: Non-null field (sparse alternative)
db.profiles.createIndex(
  { externalId: 1 },
  { partialFilterExpression: { externalId: { $exists: true } } }
)

// Example 4: Multiple conditions
db.orders.createIndex(
  { customerId: 1 },
  { partialFilterExpression: {
      $and: [
        { status: { $in: ["pending", "processing"] } },
        { total: { $gte: 100 } }
      ]
  }}
)
```

**Query must include filter expression:**

```javascript
// Partial index definition:
db.products.createIndex(
  { category: 1, price: 1 },
  { partialFilterExpression: { inStock: true } }
)

// ✓ WILL use index (query includes filter expression):
db.products.find({ category: "electronics", inStock: true })
db.products.find({ category: "electronics", price: { $lt: 100 }, inStock: true })

// ✗ WILL NOT use index (missing filter expression):
db.products.find({ category: "electronics" })
db.products.find({ category: "electronics", inStock: false })
db.products.find({ category: "electronics", inStock: { $ne: false } })

// Key insight: Query filter must GUARANTEE it only returns
// documents that would be in the partial index

// Even equivalent logic doesn't work:
db.products.find({
  category: "electronics",
  quantity: { $gt: 0 }  // Implies inStock, but MongoDB doesn't know that
})
// ✗ Won't use index - must explicitly include { inStock: true }
```

**Partial indexes vs sparse indexes:**

```javascript
// Sparse index: Excludes documents where field doesn't exist
db.users.createIndex({ email: 1 }, { sparse: true })
// Indexes docs where 'email' exists, skips docs without 'email'

// Partial index: More flexible filter expressions
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { email: { $exists: true } } }
)
// Same as sparse, but can add more conditions:

db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: {
      email: { $exists: true },
      isVerified: true
  }}
)
// Only verified users with email addresses

// Recommendation: Use partial indexes instead of sparse
// They're more powerful and clearer about what's indexed
```

**Common partial index use cases:**

```javascript
// 1. Multi-tenant "hot" data
db.documents.createIndex(
  { tenantId: 1, createdAt: -1 },
  { partialFilterExpression: { archived: { $ne: true } } }
)

// 2. Unique constraint on subset
db.users.createIndex(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true } }
  }
)
// Allows multiple docs without email, but unique among those with email

// 3. Priority queue pattern
db.tasks.createIndex(
  { priority: -1, createdAt: 1 },
  { partialFilterExpression: { status: "queued" } }
)
// Only index tasks waiting to be processed

// 4. Feature flag / A/B test data
db.users.createIndex(
  { experimentVariant: 1, createdAt: -1 },
  { partialFilterExpression: { experimentId: "exp123" } }
)
// Only index users in active experiment
```

**Partial index size savings:**

```javascript
// Measure actual savings
function measurePartialIndexSavings(collection, indexFields, filterExpression) {
  const totalDocs = db[collection].countDocuments()
  const filteredDocs = db[collection].countDocuments(filterExpression)

  const percentage = ((totalDocs - filteredDocs) / totalDocs * 100).toFixed(1)

  print(`Collection: ${collection}`)
  print(`Total documents: ${totalDocs.toLocaleString()}`)
  print(`Documents matching filter: ${filteredDocs.toLocaleString()}`)
  print(`Documents excluded: ${(totalDocs - filteredDocs).toLocaleString()} (${percentage}%)`)
  print(`\nEstimated index size reduction: ~${percentage}%`)

  if (parseFloat(percentage) > 50) {
    print(`\n✓ Partial index recommended - significant savings`)
  } else {
    print(`\n⚠️ Consider if partial index is worth the complexity`)
  }
}

// Check if partial index makes sense
measurePartialIndexSavings(
  "orders",
  { customerId: 1, createdAt: -1 },
  { status: "pending" }
)
```

**When NOT to use partial indexes:**

- **Query patterns vary**: If you query both included and excluded documents, you need both indexes.

- **Filter expression changes**: The filter is fixed at creation; changing it requires recreating the index.

- **Small percentage excluded**: If only 10% excluded, complexity may not be worth the savings.

- **Date-based filters**: Static dates in partialFilterExpression don't auto-update.

**Verify with:**

```javascript
// Check if query uses partial index
function checkPartialIndexUsage(collection, query) {
  const explain = db[collection].find(query).explain("executionStats")
  const plan = JSON.stringify(explain.queryPlanner.winningPlan)

  const usesIndex = plan.includes("IXSCAN")
  const indexName = explain.queryPlanner.winningPlan.inputStage?.indexName ||
                    explain.queryPlanner.winningPlan.indexName || "none"

  print(`Query: ${JSON.stringify(query)}`)
  print(`Uses index: ${usesIndex ? "YES ✓" : "NO ✗"}`)
  print(`Index name: ${indexName}`)

  // Check if it's a partial index
  const indexes = db[collection].getIndexes()
  const usedIndex = indexes.find(i => i.name === indexName)

  if (usedIndex?.partialFilterExpression) {
    print(`Partial filter: ${JSON.stringify(usedIndex.partialFilterExpression)}`)

    // Verify query includes filter
    const filterStr = JSON.stringify(usedIndex.partialFilterExpression)
    const queryStr = JSON.stringify(query)

    print(`\nQuery includes partial filter: Verify manually above`)
  }

  return usesIndex
}

// Test
checkPartialIndexUsage("orders", { customerId: "x", status: "pending" })
```

Reference: [https://mongodb.com/docs/manual/core/index-partial/](https://mongodb.com/docs/manual/core/index-partial/)

### 1.12 Use Sparse Indexes for Optional Fields

**Impact: HIGH (Optional field in 10% of docs: sparse index is 10× smaller, unique constraints work correctly)**

**Sparse indexes skip documents where the indexed field doesn't exist—essential for optional fields.** If only 100K of 1M documents have a `twitterHandle` field, a sparse index contains 100K entries (not 1M). This saves space and makes unique constraints work correctly for optional fields (without sparse, `null` would conflict with itself).

**Incorrect: regular index on optional field**

```javascript
// Users collection: 1M documents
// - 100K have twitterHandle (10%)
// - 900K don't have twitterHandle (90%)

// Regular index includes ALL documents
db.users.createIndex({ twitterHandle: 1 })

// Index contains:
// - 100K entries with actual values
// - 900K entries with null (field doesn't exist → indexed as null)

// Problems:
// 1. Index size: 1M entries (10× larger than needed)
// 2. Query inefficiency:
db.users.find({ twitterHandle: "@alice" })
// Must skip through 900K null entries

// 3. Unique constraint FAILS:
db.users.createIndex({ twitterHandle: 1 }, { unique: true })
// ERROR: Duplicate key error on null
// All 900K docs without twitterHandle have null, violating unique
```

**Correct: sparse index on optional field**

```javascript
// Sparse index skips documents where field doesn't exist
db.users.createIndex({ twitterHandle: 1 }, { sparse: true })

// Index contains:
// - 100K entries (only documents WITH twitterHandle)
// - 0 null entries

// Benefits:
// 1. Index size: 100K entries (90% reduction)
// 2. Query efficiency: No null entries to skip

// 3. Unique constraint WORKS:
db.users.createIndex({ twitterHandle: 1 }, { unique: true, sparse: true })
// ✓ Works! Multiple docs without twitterHandle are allowed
// Only docs WITH twitterHandle must be unique
```

**How sparse indexes handle missing vs null:**

```javascript
// Document states:
{ _id: 1, name: "Alice", twitterHandle: "@alice" }  // Has field
{ _id: 2, name: "Bob", twitterHandle: null }        // Explicitly null
{ _id: 3, name: "Charlie" }                         // Field missing

// Sparse index { twitterHandle: 1 } contains:
// - Doc 1: "@alice" ✓ Indexed
// - Doc 2: null ✓ Indexed (field EXISTS, value is null)
// - Doc 3: (not indexed) ✓ Skipped (field DOESN'T EXIST)

// Key distinction:
// - Sparse skips: Field doesn't exist
// - Sparse includes: Field exists with any value (including null)

// If you want to exclude null values too, use partial index:
db.users.createIndex(
  { twitterHandle: 1 },
  { partialFilterExpression: { twitterHandle: { $type: "string" } } }
)
// Only indexes string values, excludes missing AND null
```

**Sparse index query behavior:**

```javascript
// Sparse index: { optionalField: 1 }

// Queries that CAN use sparse index:
db.collection.find({ optionalField: "value" })  // ✓
db.collection.find({ optionalField: { $gt: 10 } })  // ✓
db.collection.find({ optionalField: { $exists: true } })  // ✓

// Queries that CANNOT use sparse index for full results:
db.collection.find({ optionalField: null })
// Returns docs with optionalField: null AND docs without optionalField
// Sparse index only has docs WITH the field → would miss results!

db.collection.find({ optionalField: { $exists: false } })
// Looking for docs WITHOUT the field
// Sparse index doesn't contain these → COLLSCAN needed

db.collection.find().sort({ optionalField: 1 })
// Sort needs all documents
// Sparse index missing 900K docs → can't use for complete sort
// MongoDB may still use it with SORT_MERGE if beneficial
```

**Sparse + unique for optional unique fields:**

```javascript
// Use case: Optional but unique email field
// - Some users sign up with email
// - Some users sign up with phone only (no email)
// - Emails must be unique when present

// WRONG: Unique without sparse
db.users.createIndex({ email: 1 }, { unique: true })
// Fails: Multiple docs without email all have null → duplicate

// CORRECT: Unique with sparse
db.users.createIndex({ email: 1 }, { unique: true, sparse: true })
// ✓ Docs without email: allowed (not in index)
// ✓ Docs with email: must be unique

// Insert behavior:
db.users.insertOne({ name: "Alice" })  // ✓ No email, not indexed
db.users.insertOne({ name: "Bob" })    // ✓ No email, not indexed
db.users.insertOne({ name: "Charlie", email: "c@x.com" })  // ✓ Unique email
db.users.insertOne({ name: "Dave", email: "c@x.com" })     // ✗ Duplicate email!
```

**Compound sparse indexes:**

```javascript
// SPARSE: Simple "field exists" case
// Use when: You only care if the field exists or not
db.users.createIndex({ twitterHandle: 1 }, { sparse: true })

// PARTIAL: Complex filter conditions
// Use when: You need more than just existence check
db.users.createIndex(
  { twitterHandle: 1 },
  { partialFilterExpression: {
      twitterHandle: { $exists: true },
      isVerified: true  // Additional condition
  }}
)

// PARTIAL: Exclude null values
// Sparse includes null, partial can exclude it
db.users.createIndex(
  { optionalScore: 1 },
  { partialFilterExpression: {
      optionalScore: { $type: "number" }  // Excludes missing AND null
  }}
)

// Recommendation: Prefer partial indexes for new code
// They're more explicit and flexible than sparse
```

**Sparse vs Partial: When to use which:**

**When NOT to use sparse indexes:**

- **Sort operations on full collection**: Sparse index can't sort docs without the field.

- **Queries for missing/null values**: `{ field: null }` or `{ field: { $exists: false } }` can't use sparse.

- **Coverage queries**: If you need the field value for all docs, sparse won't help.

- **Field usually exists**: If 90% of docs have the field, sparse saves little.

**Verify with:**

```javascript
// Check sparse index behavior
function analyzeSparseIndex(collection, field) {
  const total = db[collection].countDocuments()
  const withField = db[collection].countDocuments({ [field]: { $exists: true } })
  const withNull = db[collection].countDocuments({ [field]: null })
  const withoutField = total - withField

  // Note: withNull includes both explicit null AND missing field
  const explicitNull = withNull - withoutField

  print(`Field: ${field}`)
  print(`Total documents: ${total.toLocaleString()}`)
  print(`With field (any value): ${withField.toLocaleString()} (${(withField/total*100).toFixed(1)}%)`)
  print(`  - With explicit null: ${explicitNull.toLocaleString()}`)
  print(`Without field: ${withoutField.toLocaleString()} (${(withoutField/total*100).toFixed(1)}%)`)

  print(`\nSparse index would contain: ${withField.toLocaleString()} entries`)
  print(`Regular index would contain: ${total.toLocaleString()} entries`)
  print(`Savings: ${((total-withField)/total*100).toFixed(1)}%`)

  if (withoutField > total * 0.3) {
    print(`\n✓ Sparse index recommended (>30% docs without field)`)
  }

  // Check existing indexes
  const indexes = db[collection].getIndexes()
  const fieldIndex = indexes.find(i => Object.keys(i.key)[0] === field)
  if (fieldIndex) {
    print(`\nExisting index: ${fieldIndex.name}`)
    print(`  Sparse: ${fieldIndex.sparse ? "YES" : "NO"}`)
    print(`  Unique: ${fieldIndex.unique ? "YES" : "NO"}`)
  }
}

// Usage
analyzeSparseIndex("users", "twitterHandle")
```

Reference: [https://mongodb.com/docs/manual/core/index-sparse/](https://mongodb.com/docs/manual/core/index-sparse/)

### 1.13 Use Text Indexes for Full-Text Search

**Impact: HIGH (Keyword search across documents: text index with stemming and ranking vs regex COLLSCAN)**

**Text indexes enable efficient keyword search with stemming, stop words, and relevance ranking.** Searching for "running" matches "run", "runs", "runner" automatically. Without text indexes, you'd need regex patterns that can't use regular indexes and scan every document. For production search, consider Atlas Search for more features.

**Incorrect: regex for keyword search—COLLSCAN**

```javascript
// Search for articles about "running"
db.articles.find({ content: /running/i })

// Problems:
// 1. COLLSCAN: Scans every document (unanchored regex)
// 2. No stemming: Misses "run", "runs", "runner"
// 3. No ranking: All matches treated equally
// 4. Case handling: Manual /i flag needed
// 5. Performance: O(n) where n = all documents

// On 1M articles: 30+ seconds for a simple search

// Trying to match variations manually:
db.articles.find({
  content: { $regex: /\b(run|runs|running|runner)\b/i }
})
// Still COLLSCAN, and you missed "ran"
```

**Correct: text index with stemming and ranking**

```javascript
// Create text index
db.articles.createIndex({ title: "text", content: "text" })

// Search with $text operator
db.articles.find({
  $text: { $search: "running" }
})

// Automatic features:
// - Stemming: "running" matches run, runs, running, runner
// - Stop words: Common words (the, is, a) ignored
// - Case insensitive: Built-in
// - Relevance score: Available via $meta

// With relevance ranking:
db.articles.find(
  { $text: { $search: "running marathon training" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })

// Returns articles ranked by relevance
// More matches = higher score
```

**Text search syntax:**

```javascript
// Single word
db.articles.find({ $text: { $search: "mongodb" } })
// Matches: mongodb, MongoDB, MongoDBs (stemmed)

// Multiple words (OR by default)
db.articles.find({ $text: { $search: "mongodb database" } })
// Matches documents with "mongodb" OR "database"

// Phrase search (exact phrase in quotes)
db.articles.find({ $text: { $search: "\"mongodb database\"" } })
// Matches exact phrase "mongodb database"

// Exclude words (negation with -)
db.articles.find({ $text: { $search: "database -sql" } })
// Matches "database" but NOT "sql"

// Combined: phrase + words + exclusion
db.articles.find({
  $text: { $search: "\"nosql database\" mongodb -deprecated" }
})
// Phrase "nosql database" OR word "mongodb", excluding "deprecated"
```

**Text index on multiple fields:**

```javascript
// Index multiple fields
db.products.createIndex({
  name: "text",
  description: "text",
  tags: "text"
})

// Search across all indexed fields
db.products.find({ $text: { $search: "wireless headphones" } })
// Searches name, description, AND tags

// Weight fields differently
db.products.createIndex(
  {
    name: "text",
    description: "text",
    tags: "text"
  },
  {
    weights: {
      name: 10,        // Title matches worth 10×
      tags: 5,         // Tag matches worth 5×
      description: 1   // Description matches baseline
    }
  }
)

// Now "headphones" in title scores higher than in description
```

**Language and stemming:**

```javascript
// Default language (English)
db.articles.createIndex(
  { content: "text" },
  { default_language: "english" }
)
// Stems: running → run, better → good, mice → mouse

// Other languages
db.articles.createIndex(
  { content: "text" },
  { default_language: "spanish" }
)
// Spanish stemming: corriendo → correr

// Per-document language
db.articles.createIndex(
  { content: "text" },
  { language_override: "lang" }  // Field specifying document language
)

// Document with language:
{
  content: "Bonjour le monde",
  lang: "french"
}

// Disable stemming ("none" language)
db.articles.createIndex(
  { content: "text" },
  { default_language: "none" }
)
// Exact word matching only
```

**Text index limitations:**

```javascript
// ONE text index per collection
db.articles.createIndex({ title: "text" })
db.articles.createIndex({ content: "text" })  // ERROR: Already has text index

// Combine all text fields in one index:
db.articles.createIndex({ title: "text", content: "text", summary: "text" })

// No compound with text as non-first field
db.articles.createIndex({ title: "text", authorId: 1 })  // ✓ OK
db.articles.createIndex({ authorId: 1, title: "text" })  // ✗ ERROR

// Combine text search with other filters:
db.articles.find({
  $text: { $search: "mongodb" },
  status: "published",
  authorId: "author1"
})
// Works, but only $text uses text index
// Other filters need separate indexes or scan results
```

**Text search vs Atlas Search:**

```javascript
// Built-in text index:
// ✓ Basic keyword search
// ✓ Stemming and stop words
// ✓ Simple relevance ranking
// ✗ No fuzzy matching (typo tolerance)
// ✗ No autocomplete
// ✗ No facets/aggregations
// ✗ Limited analyzers

// Atlas Search (recommended for production):
db.products.aggregate([
  {
    $search: {
      index: "default",
      text: {
        query: "wireles headphons",  // Typos!
        path: ["name", "description"],
        fuzzy: { maxEdits: 2 }  // Tolerates typos
      }
    }
  },
  {
    $project: {
      name: 1,
      score: { $meta: "searchScore" }
    }
  }
])
// Features: fuzzy, autocomplete, facets, synonyms, custom analyzers

// Recommendation:
// - Dev/simple use: Built-in text index
// - Production search: Atlas Search
```

**When NOT to use text indexes:**

- **Prefix/autocomplete search**: Text indexes don't support partial word matching. Use Atlas Search or regex with anchored patterns.

- **Numeric search**: Text indexes are for text. Use regular indexes for numeric ranges.

- **Complex search requirements**: Facets, fuzzy matching, synonyms → Atlas Search.

- **Single field exact match**: Regular index more efficient for exact string match.

- **Memory constraints**: Text indexes can be large. Consider Atlas Search for scalability.

**Verify with:**

```javascript
// Check text index and search performance
function analyzeTextSearch(collection, searchTerms) {
  // Check for text index
  const indexes = db[collection].getIndexes()
  const textIndex = indexes.find(i =>
    Object.values(i.key).includes("text")
  )

  if (!textIndex) {
    print(`No text index on ${collection}`)
    print(`Create with: db.${collection}.createIndex({ field: "text" })`)
    return
  }

  print(`Text index: ${textIndex.name}`)
  print(`Fields: ${Object.keys(textIndex.key).filter(k => textIndex.key[k] === "text").join(", ")}`)
  print(`Language: ${textIndex.default_language || "english"}`)

  if (textIndex.weights) {
    print(`Weights: ${JSON.stringify(textIndex.weights)}`)
  }

  // Test search
  const explain = db[collection].find({
    $text: { $search: searchTerms }
  }).explain("executionStats")

  const stats = explain.executionStats
  print(`\nSearch for "${searchTerms}":`)
  print(`  Results: ${stats.nReturned}`)
  print(`  Docs examined: ${stats.totalDocsExamined}`)
  print(`  Time: ${stats.executionTimeMillis}ms`)

  // Show top results with scores
  const results = db[collection].find(
    { $text: { $search: searchTerms } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } }).limit(5).toArray()

  print(`\nTop 5 results:`)
  results.forEach((doc, i) => {
    print(`  ${i+1}. Score: ${doc.score.toFixed(2)} - ${doc.title || doc._id}`)
  })
}

// Usage
analyzeTextSearch("articles", "mongodb database performance")
```

Reference: [https://mongodb.com/docs/manual/core/indexes/index-types/index-text/](https://mongodb.com/docs/manual/core/indexes/index-types/index-text/)

### 1.14 Use TTL Indexes for Automatic Data Expiration

**Impact: HIGH (Auto-delete old sessions/logs: no cron jobs, no manual cleanup, constant collection size)**

**TTL indexes automatically delete documents after a specified time—no cron jobs, no maintenance scripts.** Sessions, logs, and temporary data that should expire after 24 hours? Create a TTL index and MongoDB handles deletion automatically. This keeps collections bounded, queries fast, and eliminates the operational burden of cleanup scripts.

**Incorrect: manual cleanup with cron jobs**

```javascript
// Sessions collection grows unbounded
// Manual cleanup required:

// Cron job runs every hour:
db.sessions.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 24*60*60*1000) }
})

// Problems:
// 1. Operational burden: Must maintain cron job
// 2. Batch deletes cause load spikes
// 3. Collection grows between cleanup runs
// 4. If cron fails, data accumulates indefinitely
// 5. Delete operations compete with production traffic

// Same issues with logs, tokens, temporary files, etc.
```

**Correct: TTL index for automatic expiration**

```javascript
// TTL index: Documents deleted automatically after expiry
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours = 86400 seconds
)

// How it works:
// 1. MongoDB background thread checks every 60 seconds
// 2. Finds documents where: createdAt + expireAfterSeconds < now
// 3. Deletes them automatically

// Document lifecycle:
{ _id: "sess1", createdAt: ISODate("2024-01-15T10:00:00Z"), userId: "u1" }
// Created: Jan 15, 10:00 AM
// Expires: Jan 16, 10:00 AM (24 hours later)
// Deleted: Within ~60 seconds after expiry

// Benefits:
// - No cron jobs or cleanup scripts
// - Continuous deletion (no batch spikes)
// - Collection stays bounded
// - Zero operational maintenance
```

**TTL on specific expiration field:**

```javascript
// Option 1: Fixed TTL from creation time
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // 1 hour
)
// Expires 1 hour after createdAt

// Option 2: Explicit expiration timestamp (expireAfterSeconds: 0)
db.sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }  // Document specifies exact expiry time
)

// Document with explicit expiry:
{
  _id: "sess1",
  userId: "u1",
  expiresAt: ISODate("2024-01-15T11:00:00Z")  // Exact expiry time
}

// Why explicit expiry is powerful:
// - Different documents can have different lifetimes
// - "Remember me" sessions: 30 days
// - Regular sessions: 24 hours
// - Password reset tokens: 1 hour

db.sessions.insertOne({
  _id: "regular",
  expiresAt: new Date(Date.now() + 24*60*60*1000)  // 24 hours
})

db.sessions.insertOne({
  _id: "rememberMe",
  expiresAt: new Date(Date.now() + 30*24*60*60*1000)  // 30 days
})
```

**Common TTL use cases:**

```javascript
// 1. Session management
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// Each session sets its own expiresAt based on type

// 2. Rate limiting windows
db.rateLimits.createIndex(
  { windowStart: 1 },
  { expireAfterSeconds: 60 }  // 1-minute sliding windows
)

// 3. Email verification tokens
db.verificationTokens.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours to verify
)

// 4. Password reset tokens
db.passwordResets.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // 1 hour to reset
)

// 5. Temporary file references
db.tempFiles.createIndex(
  { uploadedAt: 1 },
  { expireAfterSeconds: 7200 }  // 2 hours to process
)

// 6. Application logs (keep last 7 days)
db.logs.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 604800 }  // 7 days
)

// 7. Cache with TTL
db.cache.createIndex(
  { cachedAt: 1 },
  { expireAfterSeconds: 300 }  // 5 minutes
)
```

**TTL index requirements:**

```javascript
// Field MUST be a Date or array of Dates
// ✓ Works:
{ createdAt: new Date() }
{ expiresAt: ISODate("2024-01-15T10:00:00Z") }
{ timestamps: [new Date(), new Date()] }  // Uses earliest date

// ✗ Does NOT work:
{ createdAt: "2024-01-15" }           // String, not Date
{ createdAt: 1705312800 }             // Number (epoch), not Date
{ createdAt: { date: new Date() } }   // Nested object

// If field is missing or wrong type, document NEVER expires!

// CRITICAL: Validate your data
db.sessions.find({
  $or: [
    { expiresAt: { $exists: false } },
    { expiresAt: { $not: { $type: "date" } } }
  ]
}).count()
// Should be 0 for proper TTL function
```

**TTL deletion timing:**

```javascript
// TTL background task runs every 60 seconds
// Deletion is NOT instantaneous!

// Timeline:
// T+0:00 - Document expires (createdAt + TTL reached)
// T+0:00 to T+1:00 - Document still exists (waiting for next run)
// T+1:00 - Background task runs, marks document for deletion
// T+1:01 - Document deleted

// Worst case: Document exists up to ~60 seconds past expiry
// Average: ~30 seconds past expiry

// Implications:
// - Don't rely on TTL for exact-time expiration
// - Queries should still check expiry: { expiresAt: { $gt: new Date() } }
// - For time-critical expiry, add application-level check

// Query pattern for active sessions:
db.sessions.find({
  userId: "u1",
  expiresAt: { $gt: new Date() }  // Double-check in query
})
```

**Modifying TTL index:**

```javascript
// Change expireAfterSeconds on existing TTL index:
db.runCommand({
  collMod: "sessions",
  index: {
    keyPattern: { createdAt: 1 },
    expireAfterSeconds: 7200  // Change from 1 hour to 2 hours
  }
})

// Cannot convert regular index to TTL - must recreate:
db.sessions.dropIndex({ createdAt: 1 })
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }
)

// Cannot have TTL on compound indexes:
db.sessions.createIndex(
  { userId: 1, createdAt: 1 },
  { expireAfterSeconds: 3600 }
)
// ERROR: TTL index must be single-field
```

**When NOT to use TTL indexes:**

- **Compound index needed**: TTL only works on single-field indexes. Use cron for complex cleanup.

- **Exact expiration time critical**: TTL has ~60 second delay; use application logic for precision.

- **Audit requirements**: TTL deletes without logging. If you need audit trail, use soft delete + cron.

- **Large batch deletes**: If millions expire simultaneously, TTL can cause load. Consider partitioning.

- **Capped collections**: TTL indexes can't be created on capped collections.

**Verify with:**

```javascript
// Check TTL index configuration
function checkTTLIndexes(collection) {
  const indexes = db[collection].getIndexes()
  const ttlIndexes = indexes.filter(i => i.expireAfterSeconds !== undefined)

  if (ttlIndexes.length === 0) {
    print(`No TTL indexes on ${collection}`)
    return
  }

  print(`TTL indexes on ${collection}:`)
  ttlIndexes.forEach(idx => {
    const field = Object.keys(idx.key)[0]
    const ttlSeconds = idx.expireAfterSeconds
    const ttlHuman = ttlSeconds === 0
      ? "Document-specified (expiresAt field)"
      : `${ttlSeconds} seconds (${(ttlSeconds/3600).toFixed(1)} hours)`

    print(`\n  Index: ${idx.name}`)
    print(`  Field: ${field}`)
    print(`  TTL: ${ttlHuman}`)

    // Check for documents with invalid date field
    const invalidCount = db[collection].countDocuments({
      $or: [
        { [field]: { $exists: false } },
        { [field]: { $not: { $type: "date" } } }
      ]
    })

    if (invalidCount > 0) {
      print(`  ⚠️  WARNING: ${invalidCount} docs missing/invalid ${field} - won't expire!`)
    } else {
      print(`  ✓ All documents have valid ${field}`)
    }
  })

  // Show expiration stats
  print(`\nExpiration stats:`)
  const now = new Date()
  const expired = db[collection].countDocuments({ [Object.keys(ttlIndexes[0].key)[0]]: { $lt: now } })
  const total = db[collection].countDocuments()
  print(`  Documents past expiry (pending deletion): ${expired}`)
  print(`  Total documents: ${total}`)
}

// Usage
checkTTLIndexes("sessions")
```

Reference: [https://mongodb.com/docs/manual/core/index-ttl/](https://mongodb.com/docs/manual/core/index-ttl/)

### 1.15 Use Wildcard Indexes for Dynamic Fields

**Impact: HIGH (Dynamic/polymorphic schemas: one wildcard index covers arbitrary field patterns vs N indexes)**

**Wildcard indexes automatically index all fields (or fields matching a pattern) in documents with dynamic or polymorphic schemas.** When you store arbitrary key-value attributes like `{ attributes: { color: "red", size: "L", customField1: "x" } }`, you can't know all field names upfront. A wildcard index on `attributes.$**` indexes every field under attributes, enabling queries on any attribute without predefined indexes.

**Incorrect: trying to index unknown fields**

```javascript
// Product catalog with dynamic attributes
// Different product types have different fields
{
  _id: "laptop1",
  type: "laptop",
  attributes: {
    brand: "Dell",
    screenSize: 15.6,
    ram: "16GB",
    processor: "Intel i7"
  }
}

{
  _id: "shirt1",
  type: "clothing",
  attributes: {
    brand: "Nike",
    size: "L",
    color: "blue",
    material: "cotton"
  }
}

// Problem: Can't create indexes for every possible attribute
db.products.createIndex({ "attributes.brand": 1 })
db.products.createIndex({ "attributes.color": 1 })
db.products.createIndex({ "attributes.size": 1 })
db.products.createIndex({ "attributes.screenSize": 1 })
// ... hundreds more?

// New attributes require new indexes
// Custom user-defined attributes impossible to predict
```

**Correct: wildcard index on dynamic fields**

```javascript
// Wildcard index covers ALL fields under attributes
db.products.createIndex({ "attributes.$**": 1 })

// Now ALL attribute queries use this index:
db.products.find({ "attributes.brand": "Dell" })        // ✓ Uses index
db.products.find({ "attributes.color": "blue" })        // ✓ Uses index
db.products.find({ "attributes.customField": "value" }) // ✓ Uses index
db.products.find({ "attributes.any.nested.path": 1 })   // ✓ Uses index

// One index, unlimited fields
// New attributes automatically indexed without schema changes
```

**Wildcard index patterns:**

```javascript
// Pattern 1: All fields in entire document
db.collection.createIndex({ "$**": 1 })
// Indexes every field at every level
// WARNING: Can be very large!

// Pattern 2: All fields under specific path
db.products.createIndex({ "attributes.$**": 1 })
// Only indexes fields under "attributes"

// Pattern 3: Include/exclude specific paths
db.events.createIndex(
  { "$**": 1 },
  {
    wildcardProjection: {
      metadata: 1,      // Include metadata and its subfields
      tags: 1,          // Include tags
      _id: 0,           // Exclude _id (default excluded anyway)
      largeBlob: 0      // Exclude largeBlob
    }
  }
)
// Indexes metadata.*, tags, but NOT largeBlob

// Pattern 4: Compound with wildcard (MongoDB 7.0+)
db.products.createIndex({ type: 1, "attributes.$**": 1 })
// Query: { type: "laptop", "attributes.ram": "16GB" }
// Both fields use index!
```

**Query patterns with wildcard indexes:**

```javascript
// Wildcard index: { "attributes.$**": 1 }

// ✓ Queries that USE wildcard index:
db.products.find({ "attributes.brand": "Dell" })
db.products.find({ "attributes.size": { $in: ["S", "M", "L"] } })
db.products.find({ "attributes.price": { $gte: 100, $lte: 500 } })
db.products.find({ "attributes.nested.deep.field": "value" })

// ✗ Queries that CANNOT use wildcard index:
db.products.find({ "attributes": { brand: "Dell" } })
// Exact object match, not field query

db.products.find({ attributes: { $exists: true } })
// Checking existence of parent field, not contents

db.products.find({
  $or: [
    { "attributes.brand": "Dell" },
    { "attributes.brand": "HP" }
  ]
})
// Uses index for each clause, but may choose COLLSCAN if OR is large

// CRITICAL: Wildcard indexes don't support:
// - Queries on the indexed field's parent document
// - Sorting on wildcard paths (can't sort by "attributes.unknown")
// - Covered queries (must fetch document)
```

**Wildcard vs explicit indexes:**

```javascript
// Explicit index: { "attributes.brand": 1 }
// - Faster for queries on "attributes.brand" specifically
// - Supports sorting on "attributes.brand"
// - Smaller (single field)
// - Must know field names upfront

// Wildcard index: { "attributes.$**": 1 }
// - Slightly slower per-query (more general)
// - Cannot sort on wildcard fields
// - Larger (all fields)
// - Works for ANY field, including unknown ones

// Best practice: Use explicit indexes for known, frequent queries
// Use wildcard for truly dynamic/user-defined fields

// Hybrid approach:
db.products.createIndex({ "attributes.brand": 1 })         // Fast brand queries
db.products.createIndex({ "attributes.category": 1 })      // Fast category queries
db.products.createIndex({ "customAttributes.$**": 1 })     // User-defined attrs
```

**Common wildcard use cases:**

```javascript
// 1. E-commerce product attributes
db.products.createIndex({ "specs.$**": 1 })
// Query any spec: { "specs.cpuCores": 8 }, { "specs.batteryLife": "10hr" }

// 2. IoT sensor data
db.sensorReadings.createIndex({ "readings.$**": 1 })
// Different sensors have different fields

// 3. User preferences/settings
db.users.createIndex({ "preferences.$**": 1 })
// Users have varying preference structures

// 4. Event properties
db.events.createIndex({ "properties.$**": 1 })
// Analytics events with arbitrary properties

// 5. API request/response logging
db.apiLogs.createIndex({ "requestBody.$**": 1 })
// Search within logged request bodies

// 6. CMS/content management
db.content.createIndex({ "metadata.$**": 1 })
// Variable metadata per content type
```

**When NOT to use wildcard indexes:**

- **Known, stable schema**: Explicit indexes are faster and smaller.

- **Sorting required**: Wildcard indexes don't support sort operations.

- **Covered queries needed**: Wildcard indexes always require document fetch.

- **High-cardinality paths**: If most paths have unique values, index becomes huge.

- **Array elements**: Wildcard indexes can index arrays, but behavior is complex.

**Verify with:**

```javascript
// Analyze wildcard index usage
function analyzeWildcardIndex(collection) {
  const indexes = db[collection].getIndexes()
  const wildcardIndexes = indexes.filter(i =>
    Object.keys(i.key).some(k => k.includes("$**"))
  )

  if (wildcardIndexes.length === 0) {
    print(`No wildcard indexes on ${collection}`)
    return
  }

  print(`Wildcard indexes on ${collection}:`)
  wildcardIndexes.forEach(idx => {
    print(`\n  Name: ${idx.name}`)
    print(`  Pattern: ${JSON.stringify(idx.key)}`)
    if (idx.wildcardProjection) {
      print(`  Projection: ${JSON.stringify(idx.wildcardProjection)}`)
    }
  })

  // Get index stats
  const stats = db[collection].aggregate([
    { $indexStats: {} }
  ]).toArray()

  const wildcardStats = stats.filter(s =>
    wildcardIndexes.some(i => i.name === s.name)
  )

  wildcardStats.forEach(s => {
    print(`\n  Usage (${s.name}):`)
    print(`    Operations: ${s.accesses.ops}`)
    print(`    Since: ${s.accesses.since}`)
  })

  // Show indexed paths (sample)
  print(`\nSample indexed paths:`)
  const sample = db[collection].findOne()
  if (sample) {
    const wildcardPath = Object.keys(wildcardIndexes[0].key)[0].replace(".$**", "")
    const targetObj = wildcardPath ? sample[wildcardPath.split(".")[0]] : sample

    function printPaths(obj, prefix = wildcardPath || "") {
      for (const [key, value] of Object.entries(obj || {})) {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          printPaths(value, path)
        } else {
          print(`    ${path}`)
        }
      }
    }
    printPaths(targetObj)
  }
}

// Usage
analyzeWildcardIndex("products")
```

Reference: [https://mongodb.com/docs/manual/core/indexes/index-types/index-wildcard/](https://mongodb.com/docs/manual/core/indexes/index-types/index-wildcard/)

---

## 3. Query Patterns

**Impact: HIGH**

Even with perfect indexes, bad query patterns force collection scans. $ne and $nin cannot use indexes efficiently—they must scan everything to find "not equal" matches. Unanchored regex /pattern/ scans every document; anchored regex /^pattern/ uses the index. $exists:false forces scans because indexes don't contain missing values. The $in operator is optimized but has limits—1000+ values may be slower than multiple queries. Projections reduce network transfer and memory usage by 50-90% when you only need specific fields. These patterns determine whether your indexes actually get used or sit idle while MongoDB scans.

### 3.1 Anchor Regex Patterns with ^

**Impact: HIGH (Anchored regex uses index (5ms); unanchored forces COLLSCAN (30 seconds on 10M docs))**

**Only regex patterns starting with `^` can use indexes—unanchored patterns force a full collection scan.** An index on `email` makes `/^alice/` fast (seeks to "alice" range), but `/gmail/` must check every single document regardless of indexes. This is often a 1000× performance difference.

**Incorrect: unanchored regex—COLLSCAN regardless of index**

```javascript
// "Find users with gmail addresses"
db.users.find({ email: /gmail/ })

// What you expect: Use index on email, find gmail matches
// What happens: FULL COLLECTION SCAN

// Even with index:
db.users.createIndex({ email: 1 })

// explain() shows:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN"  // Full scan despite index!
    }
  },
  "executionStats": {
    "totalDocsExamined": 10000000,  // All 10M docs
    "executionTimeMillis": 32000    // 32 seconds
  }
}

// Why? "gmail" could be ANYWHERE in string:
// - alice@gmail.com ✓
// - bob@gmail.co.uk ✓
// - gmail_user@yahoo.com ✓ (contains "gmail")
// Index can't help—must check every value
```

**Correct: anchored regex—efficient IXSCAN**

```javascript
// "Find users whose email starts with 'alice'"
db.users.find({ email: /^alice/ })

// Index CAN be used because:
// - All matches start with "alice"
// - Index is sorted alphabetically
// - Seek to "alice", scan until "alicf" (first non-match)

// explain() shows:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "IXSCAN",
      "indexName": "email_1",
      "indexBounds": {
        "email": [
          "[\"alice\", \"alicf\")",  // Bounded range!
          "[/^alice/, /^alice/]"
        ]
      }
    }
  },
  "executionStats": {
    "totalKeysExamined": 1547,     // Only ~1500 entries
    "totalDocsExamined": 1547,
    "executionTimeMillis": 5       // 5ms vs 32 seconds!
  }
}
```

**Common anchored regex patterns:**

```javascript
// Autocomplete: user types "jo"
db.users.createIndex({ name: 1 })
db.users.find({ name: /^jo/i })  // Case-insensitive anchor
// Returns: John, Joseph, Joanna, jonathan...

// Prefix matching: product SKUs
db.products.createIndex({ sku: 1 })
db.products.find({ sku: /^ELEC-2024-/ })
// Returns: ELEC-2024-001, ELEC-2024-002...

// Path prefix: file system queries
db.files.createIndex({ path: 1 })
db.files.find({ path: /^\/home\/alice\/documents\// })
// Returns all files in alice's documents folder

// Version prefix: semantic versioning
db.packages.createIndex({ version: 1 })
db.packages.find({ version: /^2\./ })
// Returns: 2.0.0, 2.1.0, 2.15.3...
```

**Regex pattern performance matrix:**

| Pattern | Index Used | Explanation |

|---------|------------|-------------|

| `/^prefix/` | ✅ Yes | Anchored start—bounded range scan |

| `/^prefix/i` | ✅ Yes | Case-insensitive but still anchored |

| `/^prefix.*suffix$/` | ⚠️ Partial | Uses index for prefix, filters suffix |

| `/suffix$/` | ❌ No | End anchor—must scan all |

| `/contains/` | ❌ No | Substring—must scan all |

| `/.*any.*/` | ❌ No | Greedy match—must scan all |

| `/^(a|b|c)/` | ❌ No | Alternation breaks anchoring |

**Alternatives for substring search:**

```javascript
// OPTION 1: Text Index (built-in, good for keywords)
db.articles.createIndex({ title: "text", content: "text" })
db.articles.find({ $text: { $search: "mongodb" } })
// Tokenized search, handles stemming
// Limitation: Word boundaries only, no partial matches

// OPTION 2: Atlas Search (recommended for production)
db.products.aggregate([
  {
    $search: {
      index: "default",  // Atlas Search index
      autocomplete: {    // Partial match support
        query: "lapt",
        path: "name",
        fuzzy: { maxEdits: 1 }  // Typo tolerance
      }
    }
  },
  { $limit: 10 },
  { $project: { name: 1, score: { $meta: "searchScore" } } }
])
// Features: fuzzy matching, synonyms, facets, highlighting
// Much faster than regex for complex search

// OPTION 3: Computed search field (DIY approach)
// Store lowercase, no-spaces version for searching
{
  name: "John Smith",
  nameSearch: "johnsmith"  // Index this
}
db.users.createIndex({ nameSearch: 1 })
db.users.find({ nameSearch: /^john/ })  // Anchored on normalized field
```

**When NOT to worry about anchored regex:**

- **Small collections**: <10K documents, COLLSCAN is fast anyway.

- **Rare queries**: Admin-only search run occasionally.

- **Already filtered**: `{ tenantId: "x", name: /smith/ }` where tenantId reduces to small set first.

- **Text/Atlas Search available**: Use proper search instead of regex.

**Verify with:**

```javascript
// Check if regex can use index
function checkRegexIndexUse(collection, field, pattern) {
  const regex = new RegExp(pattern)
  const explain = db[collection]
    .find({ [field]: regex })
    .explain("executionStats")

  const plan = JSON.stringify(explain.queryPlanner.winningPlan)
  const usesIndex = plan.includes("IXSCAN")
  const stage = explain.queryPlanner.winningPlan.stage

  print(`Pattern: /${pattern}/`)
  print(`Stage: ${stage}`)
  print(`Uses index: ${usesIndex ? "YES ✓" : "NO - COLLSCAN"}`)
  print(`Docs examined: ${explain.executionStats.totalDocsExamined}`)
  print(`Time: ${explain.executionStats.executionTimeMillis}ms`)

  if (!usesIndex && !pattern.startsWith("^")) {
    print(`\n💡 TIP: Add ^ anchor: /^${pattern}/`)
  }
}

// Usage
checkRegexIndexUse("users", "email", "gmail")      // No index
checkRegexIndexUse("users", "email", "^alice")     // Uses index
```

Reference: [https://mongodb.com/docs/manual/reference/operator/query/regex/](https://mongodb.com/docs/manual/reference/operator/query/regex/)

### 3.2 Avoid $ne and $nin Operators

**Impact: HIGH (Negation scans 90%+ of index—$in with positive values is 10-100× faster)**

**Negation operators ($ne, $nin, $not) cannot efficiently use indexes—they scan everything except the excluded values.** If your collection has 1 million documents and you query `{ status: { $ne: "deleted" } }`, MongoDB scans 950,000 index entries to exclude 50,000. Use positive matching with $in instead, or restructure your schema to avoid negation patterns.

**Incorrect: negation—scans almost entire index**

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

**Correct: positive matching—targeted index scan**

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

**Verify with:**

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

Reference: [https://mongodb.com/docs/manual/reference/operator/query/](https://mongodb.com/docs/manual/reference/operator/query/)

### 3.3 Batch Operations to Avoid N+1 Queries

**Impact: HIGH (101 round trips → 2 round trips—50× faster by eliminating N+1 query pattern)**

**Never query inside a loop—the N+1 pattern is the most common cause of slow APIs.** One query returns N items, then N follow-up queries fetch related data. With 100ms network latency, 100 items = 10+ seconds. Batch with `$in` or `$lookup` to reduce N+1 queries to 1-2 queries regardless of N.

**Incorrect: N+1 queries—linear scaling horror**

```javascript
// "Get pending orders with customer details"
const orders = await db.orders.find({ status: "pending" }).toArray()

// N+1 anti-pattern: loop queries
for (const order of orders) {
  // Each iteration = 1 database round trip
  order.customer = await db.customers.findOne({ _id: order.customerId })
}

// Cost breakdown for 100 orders:
// - Initial query: 1 round trip, 5ms
// - Customer lookups: 100 round trips, 5ms each = 500ms
// - Total: 101 round trips, ~505ms minimum
//
// At scale:
// - 1,000 orders = 1,001 queries = 5+ seconds
// - 10,000 orders = 10,001 queries = 50+ seconds
//
// With network latency (cloud/microservices):
// - 100ms latency × 100 queries = 10 SECONDS just waiting for network

// Even worse: nested N+1
for (const order of orders) {
  order.customer = await db.customers.findOne({ _id: order.customerId })
  order.items = await db.items.find({ orderId: order._id }).toArray()
  for (const item of order.items) {
    item.product = await db.products.findOne({ _id: item.productId })
  }
}
// 100 orders × 3 items each = 100 + 100 + 300 = 500+ queries
```

**Correct: batch with $in—constant round trips**

```javascript
// Get orders
const orders = await db.orders.find({ status: "pending" }).toArray()

// Collect all customer IDs (deduplicated)
const customerIds = [...new Set(orders.map(o => o.customerId))]

// Single batch query for ALL customers
const customers = await db.customers.find({
  _id: { $in: customerIds }
}).toArray()

// Build lookup map for O(1) access
const customerMap = new Map(
  customers.map(c => [c._id.toString(), c])
)

// Attach customers to orders (in-memory, no DB)
orders.forEach(o => {
  o.customer = customerMap.get(o.customerId.toString())
})

// Cost: 2 round trips total, regardless of order count
// 100 orders = 2 queries = 10ms
// 10,000 orders = 2 queries = ~50ms (larger payload)
```

**Correct: $lookup—single aggregation**

```javascript
// All in one database operation
const ordersWithCustomers = await db.orders.aggregate([
  { $match: { status: "pending" } },
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",  // Must be indexed!
      as: "customer"
    }
  },
  { $unwind: "$customer" }  // Convert array to single object
]).toArray()

// Cost: 1 round trip, database handles join internally
// IMPORTANT: Ensure index on customers._id (it's _id, so automatic)
// For non-_id joins: db.customers.createIndex({ externalId: 1 })
```

**Batch operations for writes:**

```javascript
// BAD: Insert one at a time
const users = generateUsers(1000)
for (const user of users) {
  await db.users.insertOne(user)  // 1000 round trips
}
// Time: 1000 × 5ms = 5 seconds

// GOOD: Batch insert
await db.users.insertMany(users)  // 1 round trip
// Time: ~50ms (includes bulk write overhead)

// BAD: Update one at a time
const ids = getIdsToUpdate()
for (const id of ids) {
  await db.items.updateOne(
    { _id: id },
    { $set: { processed: true } }
  )
}

// GOOD: Batch update with $in
await db.items.updateMany(
  { _id: { $in: ids } },
  { $set: { processed: true } }
)

// GOOD: bulkWrite for heterogeneous operations
await db.items.bulkWrite([
  { updateOne: { filter: { _id: id1 }, update: { $set: { status: "a" } } } },
  { updateOne: { filter: { _id: id2 }, update: { $set: { status: "b" } } } },
  { deleteOne: { filter: { _id: id3 } } },
  { insertOne: { document: newDoc } }
])
// Multiple different operations in 1 round trip
```

**Complex example—dashboard with multiple relations:**

```javascript
// Dashboard needs: orders, customers, products, and shipping info
// N+1 approach would be 400+ queries for 100 orders

// Optimized batch approach:
async function getDashboardData(userId) {
  // Query 1: Get orders
  const orders = await db.orders
    .find({ userId, status: { $in: ["pending", "processing"] } })
    .toArray()

  // Collect all IDs upfront
  const customerIds = [...new Set(orders.map(o => o.customerId))]
  const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))]
  const shippingIds = orders.filter(o => o.shippingId).map(o => o.shippingId)

  // Queries 2-4: Batch fetch all related data in parallel
  const [customers, products, shipments] = await Promise.all([
    db.customers.find({ _id: { $in: customerIds } }).toArray(),
    db.products.find({ _id: { $in: productIds } }).toArray(),
    db.shipments.find({ _id: { $in: shippingIds } }).toArray()
  ])

  // Build lookup maps
  const customerMap = new Map(customers.map(c => [c._id.toString(), c]))
  const productMap = new Map(products.map(p => [p._id.toString(), p]))
  const shipmentMap = new Map(shipments.map(s => [s._id.toString(), s]))

  // Assemble in memory
  return orders.map(order => ({
    ...order,
    customer: customerMap.get(order.customerId.toString()),
    shipment: order.shippingId ? shipmentMap.get(order.shippingId.toString()) : null,
    items: order.items.map(item => ({
      ...item,
      product: productMap.get(item.productId.toString())
    }))
  }))
}

// Total: 4 queries (1 + 3 parallel) instead of 400+
// Time: ~20ms instead of 2+ seconds
```

**When N+1 is acceptable:**

- **N is always small**: Max 5-10 items, overhead is minimal.

- **Lazy loading UI**: User clicks to expand details, single lookup is fine.

- **Caching layer**: Related data is cached, no DB hit anyway.

- **Different databases**: Can't $lookup across MongoDB instances, must query separately.

**Verify with:**

```javascript
// Detect N+1 patterns in slow query log
db.setProfilingLevel(1, { slowms: 50 })

// Find repeated similar queries (N+1 signature)
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: {
    _id: {
      ns: "$ns",
      queryShape: { $objectToArray: "$command.filter" }
    },
    count: { $sum: 1 },
    avgMs: { $avg: "$millis" }
  }},
  { $match: { count: { $gt: 10 } } },  // Same query 10+ times
  { $sort: { count: -1 } }
])
// High count + similar query shape = likely N+1
```

Reference: [https://mongodb.com/docs/manual/core/query-optimization/](https://mongodb.com/docs/manual/core/query-optimization/)

### 3.4 Understand $exists Behavior with Sparse Indexes

**Impact: HIGH ({ field: { $exists: true } } may not use sparse index—understand the subtle interaction)**

**Sparse indexes and $exists queries have a counterintuitive interaction that can cause COLLSCAN or incorrect results.** A sparse index only contains documents WHERE THE FIELD EXISTS, so `{ $exists: false }` queries can't use it (those documents aren't in the index). Even `{ $exists: true }` may not use the index efficiently if MongoDB can't prove the query semantics match.

**Incorrect (expecting sparse index to support $exists: false):**

**Correct: understand what sparse indexes can and cannot do**

```javascript
// Sparse index { twitterHandle: 1 } SUPPORTS:
db.users.find({ twitterHandle: "alice123" })
// ✓ Uses index - looks up specific value

db.users.find({ twitterHandle: { $exists: true } })
// ✓ Can use index - all entries in sparse index have the field
// MongoDB may use index scan since sparse only contains docs with field

db.users.find({ twitterHandle: { $in: ["alice", "bob"] } })
// ✓ Uses index - multiple value lookups

// Sparse index { twitterHandle: 1 } CANNOT SUPPORT:
db.users.find({ twitterHandle: { $exists: false } })
// ✗ COLLSCAN - documents without field aren't in index

db.users.find({ twitterHandle: null })
// ⚠️ Complex - null matches BOTH explicit null AND missing field
// Sparse index has explicit nulls but not missing docs
// May result in incorrect results or COLLSCAN

db.users.find().sort({ twitterHandle: 1 })
// ✗ Can't use sparse for full-collection sort
// Missing 900K documents from sort order
```

**The null vs missing distinction:**

```javascript
// Three document states:
{ _id: 1, name: "Alice", twitterHandle: "@alice" }  // Has value
{ _id: 2, name: "Bob", twitterHandle: null }        // Explicitly null
{ _id: 3, name: "Charlie" }                         // Missing field

// Query: { twitterHandle: null }
// Matches: Doc 2 (explicit null) AND Doc 3 (missing)!
// This is MongoDB's default behavior

// Query: { twitterHandle: { $exists: false } }
// Matches: Doc 3 only (missing)

// Query: { twitterHandle: { $exists: true } }
// Matches: Doc 1 AND Doc 2 (both have the field, even if null)

// Sparse index contains:
// - "@alice" → Doc 1
// - null → Doc 2
// - (Doc 3 not in index - field missing)

// Why { twitterHandle: null } is problematic with sparse:
// Query wants Doc 2 AND Doc 3
// Sparse index only has Doc 2
// Must COLLSCAN to find Doc 3
```

**Use partial index for cleaner $exists behavior:**

```javascript
// Option 1: Add a boolean flag field
// Instead of checking if field exists, check explicit flag
{
  name: "Alice",
  twitterHandle: "@alice",
  hasTwitter: true
}

{
  name: "Bob",
  hasTwitter: false
}

db.users.createIndex({ hasTwitter: 1 })
db.users.find({ hasTwitter: false })  // ✓ Uses regular index

// Option 2: Use covered query with projection
// If you need $exists: false, accept COLLSCAN but minimize impact
db.users.find(
  { twitterHandle: { $exists: false } },
  { _id: 1, name: 1 }  // Small projection
)

// Option 3: Separate collection for users without optional field
// If query is frequent and performance-critical
// Move users without twitter to separate collection

// Option 4: Set explicit null instead of omitting field
// All docs have field, regular index works
{
  name: "Bob",
  twitterHandle: null  // Explicit null, indexed
}

db.users.createIndex({ twitterHandle: 1 })  // Regular, not sparse
db.users.find({ twitterHandle: null })  // ✓ Uses index for null lookup
```

**Strategies for $exists: false queries:**

**Compound indexes with sparse:**

```javascript
// Sparse compound index
db.users.createIndex(
  { status: 1, twitterHandle: 1 },
  { sparse: true }
)

// Sparse on compound: Document excluded if ANY indexed field missing
// Doc { status: "active" } - twitterHandle missing → NOT in index
// Doc { twitterHandle: "@x" } - status missing → NOT in index

// This is often NOT what you want!
// Use partial index for precise control:
db.users.createIndex(
  { status: 1, twitterHandle: 1 },
  { partialFilterExpression: { twitterHandle: { $exists: true } } }
)
// Only excludes docs without twitterHandle (status can be missing)
```

**When sparse + $exists works correctly:**

- **$exists: true with no other conditions**: Full index scan of sparse index.

- **Value queries**: `{ field: "value" }` works perfectly.

- **$in queries**: Multiple value lookups work.

- **Range queries**: `{ field: { $gt: x } }` works for docs with field.

**When sparse + $exists does NOT work:**

- **$exists: false**: Always COLLSCAN (docs not in index).

- **{ field: null }**: Partial coverage (misses missing docs).

- **Sort on sparse field**: Incomplete results.

- **Covered queries for full collection**: Missing docs.

**Verify with:**

```javascript
// Check $exists query behavior with sparse indexes
function checkExistsWithSparse(collection, field) {
  const indexes = db[collection].getIndexes()
  const sparseIndex = indexes.find(i =>
    i.sparse && Object.keys(i.key)[0] === field
  )

  if (!sparseIndex) {
    print(`No sparse index on ${collection}.${field}`)
    return
  }

  print(`Sparse index found: ${sparseIndex.name}`)

  // Count documents
  const total = db[collection].countDocuments()
  const withField = db[collection].countDocuments({ [field]: { $exists: true } })
  const withoutField = total - withField

  print(`\nCollection stats:`)
  print(`  Total: ${total}`)
  print(`  With ${field}: ${withField} (${(withField/total*100).toFixed(1)}%)`)
  print(`  Without ${field}: ${withoutField} (${(withoutField/total*100).toFixed(1)}%)`)

  // Test queries
  print(`\nQuery analysis:`)

  const queries = [
    { [field]: { $exists: true } },
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: "someValue" }
  ]

  queries.forEach(query => {
    const explain = db[collection].find(query).explain("executionStats")
    const stage = explain.queryPlanner.winningPlan.stage ||
                  explain.queryPlanner.winningPlan.inputStage?.stage
    const usesIndex = stage === "IXSCAN" || stage === "FETCH"

    print(`  ${JSON.stringify(query)}`)
    print(`    Stage: ${stage}`)
    print(`    Uses sparse index: ${usesIndex ? "YES ✓" : "NO (COLLSCAN) ✗"}`)
  })
}

// Usage
checkExistsWithSparse("users", "twitterHandle")
```

Reference: [https://mongodb.com/docs/manual/core/index-sparse/](https://mongodb.com/docs/manual/core/index-sparse/)

### 3.5 Use Projections to Limit Fields

**Impact: HIGH (50MB→200KB data transfer, 60× less bandwidth—only fetch what you display)**

**Always specify only the fields you need—projections can reduce data transfer by 100× or more.** Without projections, MongoDB returns entire documents including fields you never use. We've seen API response times drop from 30 seconds to 0.5 seconds just by adding a projection that fetches 3 fields instead of 200.

**Incorrect: fetching entire documents—bandwidth killer**

```javascript
// "Just get active users" - fetches EVERYTHING
const users = await db.users.find({ status: "active" }).toArray()

// What you actually use in your code:
users.map(u => ({ name: u.name, email: u.email }))

// What you transferred over the network:
// - name: 50 bytes
// - email: 50 bytes
// - profile: 2KB (bio, avatar URL, social links)
// - preferences: 5KB (notification settings, UI config)
// - activityHistory: 40KB (last 1000 events)
// - metadata: 3KB (audit fields, tags, scores)
// Total per doc: ~50KB

// 1,000 active users × 50KB = 50MB transferred
// You only needed: 1,000 × 100 bytes = 100KB (500× waste)
```

**Correct: projection limits to needed fields**

```javascript
// Explicitly request only what you need
const users = await db.users.find(
  { status: "active" },
  { projection: { name: 1, email: 1, _id: 0 } }
).toArray()

// Returns:
// [
//   { name: "Alice", email: "alice@ex.com" },
//   { name: "Bob", email: "bob@ex.com" },
//   ...
// ]

// 1,000 users × 100 bytes = 100KB transferred
// Response time: 50ms instead of 30s
```

**Projection syntax reference:**

```javascript
// INCLUDE mode: specify fields to return (1 = include)
{ name: 1, email: 1 }           // Returns _id, name, email
{ name: 1, email: 1, _id: 0 }   // Returns only name, email

// EXCLUDE mode: specify fields to omit (0 = exclude)
{ largeBlob: 0, history: 0 }    // Everything except these

// CRITICAL: Cannot mix include/exclude (except _id)
{ name: 1, largeBlob: 0 }       // ERROR: Projection cannot have mix

// Nested fields use dot notation
{ "profile.name": 1, "profile.email": 1 }

// Computed fields with aggregation expressions (4.4+)
{
  fullName: { $concat: ["$firstName", " ", "$lastName"] },
  age: { $subtract: [{ $year: "$$NOW" }, { $year: "$birthDate" }] }
}
```

**Array projections: advanced**

```javascript
// Original document
{
  _id: 1,
  title: "Article",
  comments: [/* 500 comments, 100KB */]
}

// $slice: Limit array elements
{ comments: { $slice: 5 } }      // First 5 comments
{ comments: { $slice: -3 } }     // Last 3 comments
{ comments: { $slice: [10, 5] }} // Skip 10, take 5 (pagination)

// $elemMatch: Single matching element
db.posts.find(
  { _id: postId },
  { comments: { $elemMatch: { userId: "user123" } } }
)
// Returns only the first comment by user123

// $ positional: First match from query
db.posts.find(
  { "comments.userId": "user123" },
  { "comments.$": 1 }
)
// Returns post with only the matching comment
```

**Nested document projections:**

```javascript
// Document structure
{
  profile: {
    name: "Alice",            // 50 bytes
    bio: "Long bio...",       // 10KB
    avatar: "base64...",      // 500KB
    settings: {
      theme: "dark",
      notifications: {...}
    }
  },
  analytics: {/* 50KB */}
}

// Project specific nested paths
db.users.find(
  { _id: userId },
  {
    "profile.name": 1,
    "profile.settings.theme": 1,
    _id: 0
  }
)
// Returns: { profile: { name: "Alice", settings: { theme: "dark" } } }
// ~100 bytes instead of ~560KB
```

**When NOT to use projections:**

- **Need entire document**: Detail pages, edit forms—projection adds complexity with no benefit.

- **Document already small**: <1KB documents, projection overhead may not be worth it.

- **Frequent schema changes**: Projection breaks if fields are renamed; exclusion mode is safer.

- **Covered query optimization**: You might need specific fields in index for coverage.

**Verify with:**

```javascript
// Compare response sizes
async function measureProjectionImpact(collection, filter, projection) {
  // Without projection
  const fullDocs = await db[collection].find(filter).limit(100).toArray()
  const fullSize = JSON.stringify(fullDocs).length

  // With projection
  const projectedDocs = await db[collection]
    .find(filter, { projection })
    .limit(100)
    .toArray()
  const projectedSize = JSON.stringify(projectedDocs).length

  const reduction = ((fullSize - projectedSize) / fullSize * 100).toFixed(1)

  print(`Without projection: ${(fullSize/1024).toFixed(1)}KB`)
  print(`With projection: ${(projectedSize/1024).toFixed(1)}KB`)
  print(`Reduction: ${reduction}%`)
  print(`Savings per 10K docs: ${((fullSize - projectedSize) * 100 / 1024 / 1024).toFixed(1)}MB`)
}

// Usage
measureProjectionImpact(
  "users",
  { status: "active" },
  { name: 1, email: 1, _id: 0 }
)
```

Reference: [https://mongodb.com/docs/manual/tutorial/project-fields-from-query-results/](https://mongodb.com/docs/manual/tutorial/project-fields-from-query-results/)

### 3.6 Use Range-Based Pagination Instead of skip()

**Impact: HIGH (Page 10,000: skip() takes 20 seconds, range-based takes 5ms—O(n) vs O(1))**

**skip() scans and discards documents—it gets slower the deeper you paginate.** Page 1 examines 20 docs; page 10,000 examines 200,000 docs just to discard 199,980. Range-based (keyset) pagination uses indexed field comparisons for O(1) performance on any page. This is why infinite scroll apps stay fast.

**Incorrect: skip degrades linearly with page depth**

```javascript
// Page 1: skip(0) - fast
db.posts.find().sort({ createdAt: -1 }).skip(0).limit(20)
// Examines: 20 docs, returns: 20 docs
// Time: 5ms ✓

// Page 100: skip(1980) - slower
db.posts.find().sort({ createdAt: -1 }).skip(1980).limit(20)
// Examines: 2,000 docs, discards: 1,980, returns: 20
// Time: 200ms ⚠️

// Page 10,000: skip(199980) - unusable
db.posts.find().sort({ createdAt: -1 }).skip(199980).limit(20)
// Examines: 200,000 docs, discards: 199,980, returns: 20
// Time: 20 seconds ❌

// Why? MongoDB must:
// 1. Start at beginning of index
// 2. Walk through 199,980 entries
// 3. Only THEN return the next 20
// It's O(skip_value) not O(limit)
```

**Correct: range-based / keyset pagination**

```javascript
// Page 1: Get first page
const page1 = await db.posts
  .find({ status: "published" })
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Remember cursor position
const lastItem = page1[page1.length - 1]
const cursor = lastItem.createdAt

// Page 2: Continue from cursor
const page2 = await db.posts
  .find({
    status: "published",
    createdAt: { $lt: cursor }  // Only docs BEFORE cursor
  })
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Page N: Always the same performance
// Index seeks directly to cursor position
// Examines exactly 20 docs every time
// Time: 5ms regardless of page number
```

**Handle non-unique sort fields (critical for correctness):**

```javascript
// Problem: Multiple posts can have same createdAt
// Result: Some posts get skipped or duplicated

// Solution: Add unique tiebreaker (_id)
// Index must include both fields:
db.posts.createIndex({ createdAt: -1, _id: -1 })

const lastItem = page1[page1.length - 1]

// Compound cursor condition
const page2 = await db.posts.find({
  status: "published",
  $or: [
    // Either strictly before in time
    { createdAt: { $lt: lastItem.createdAt } },
    // Or same time but lower _id
    {
      createdAt: lastItem.createdAt,
      _id: { $lt: lastItem._id }
    }
  ]
})
  .sort({ createdAt: -1, _id: -1 })
  .limit(20)
  .toArray()

// This guarantees: no duplicates, no skips, deterministic order
```

**API design with cursor tokens:**

```javascript
// Encode cursor for API response
function encodeCursor(lastItem) {
  return Buffer.from(JSON.stringify({
    createdAt: lastItem.createdAt,
    _id: lastItem._id
  })).toString("base64")
}

// Decode cursor from request
function decodeCursor(cursorString) {
  return JSON.parse(Buffer.from(cursorString, "base64").toString())
}

// API endpoint
app.get("/api/posts", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)
  const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null

  // Build query
  const query = { status: "published" }
  if (cursor) {
    query.$or = [
      { createdAt: { $lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), _id: { $lt: cursor._id } }
    ]
  }

  const posts = await db.posts
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)  // Fetch one extra to check if more exist
    .toArray()

  const hasMore = posts.length > limit
  const data = hasMore ? posts.slice(0, -1) : posts

  res.json({
    data,
    pagination: {
      hasMore,
      nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null
    }
  })
})

// Client usage:
// GET /api/posts                          → First page
// GET /api/posts?cursor=eyJjcmVhdGVk...   → Next page
```

**Bidirectional pagination: prev/next**

```javascript
// For "Previous" page, reverse the comparison
async function getPreviousPage(cursor, limit) {
  const posts = await db.posts.find({
    status: "published",
    $or: [
      { createdAt: { $gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $gt: cursor._id } }
    ]
  })
    .sort({ createdAt: 1, _id: 1 })  // Reverse sort
    .limit(limit)
    .toArray()

  return posts.reverse()  // Put back in descending order
}
```

**Performance comparison: 10M documents**

| Page | skip() Time | skip() Docs Examined | Range Time | Range Docs Examined |

|------|-------------|---------------------|------------|---------------------|

| 1 | 5ms | 20 | 5ms | 20 |

| 10 | 10ms | 200 | 5ms | 20 |

| 100 | 200ms | 2,000 | 5ms | 20 |

| 1,000 | 2s | 20,000 | 5ms | 20 |

| 10,000 | 20s | 200,000 | 5ms | 20 |

**When skip() is acceptable:**

- **Small collections**: <10K total documents, skip overhead is negligible.

- **Shallow pagination**: Users never go past page 5-10 (e-commerce search results).

- **Random page access**: Admin UI needs "jump to page 500"—range-based can't do this easily.

- **Consistent snapshot**: Using skip with a snapshot read for data export.

**When NOT to use range-based:**

- **Frequent sort order changes**: If user switches between "newest" and "oldest", cursor is invalidated.

- **Real-time data with high insert rate**: New items between pages may cause duplicates or gaps.

- **Total count needed**: Range-based pagination makes counting total results expensive.

**Verify with:**

```javascript
// Compare pagination methods
async function comparePaginationMethods(collection, pageNumber, pageSize) {
  const skip = (pageNumber - 1) * pageSize

  // Method 1: skip()
  const skipExplain = db[collection]
    .find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .explain("executionStats")

  // Method 2: range-based (simulate cursor at correct position)
  const cursorDoc = await db[collection]
    .find()
    .sort({ createdAt: -1 })
    .skip(skip - 1)
    .limit(1)
    .toArray()

  const rangeExplain = db[collection]
    .find({ createdAt: { $lt: cursorDoc[0]?.createdAt || new Date() } })
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .explain("executionStats")

  print(`\nPage ${pageNumber} (${skip} offset):`)
  print(`  skip() - Docs examined: ${skipExplain.executionStats.totalDocsExamined}`)
  print(`  skip() - Time: ${skipExplain.executionStats.executionTimeMillis}ms`)
  print(`  range  - Docs examined: ${rangeExplain.executionStats.totalDocsExamined}`)
  print(`  range  - Time: ${rangeExplain.executionStats.executionTimeMillis}ms`)
}

// Test at different depths
[1, 10, 100, 1000].forEach(page => {
  comparePaginationMethods("posts", page, 20)
})
```

Reference: [https://mongodb.com/docs/manual/reference/method/cursor.skip/](https://mongodb.com/docs/manual/reference/method/cursor.skip/)

---

## 4. Aggregation Optimization

**Impact: HIGH**

Aggregation pipelines are powerful but expensive if designed poorly. Stage order is everything: $match at the start filters documents BEFORE processing—a $match that removes 90% of documents makes every subsequent stage 10× faster. $project early to drop unneeded fields, reducing memory usage throughout the pipeline. $sort + $limit coalesce into a single operation that only tracks top N results, using O(N) memory instead of O(all). $lookup without an index on the foreign collection causes nested collection scans—O(N×M) complexity that brings servers to their knees. $unwind on large arrays explodes document count, turning 1000 documents into 1M. The optimizer helps, but understanding pipeline mechanics lets you write 100× faster aggregations.

### 4.1 Avoid $unwind on Large Arrays

**Impact: HIGH (100 posts × 10K comments each = 1M docs in memory; array operators keep it at 100 docs)**

**$unwind creates one document per array element—10,000-element arrays become 10,000 documents.** If you have 100 posts with 10,000 comments each and $unwind the comments, you've just created 1 million documents in your pipeline from 100 inputs. This explodes memory usage, exceeds the 100MB stage limit, and forces disk spills. Use array operators ($size, $filter, $slice, $reduce) to process arrays without unwinding.

**Incorrect: $unwind on large arrays—document explosion**

```javascript
// Document: Popular post with 10,000 comments
{
  _id: "post123",
  title: "Viral Post",
  content: "...",
  comments: [
    { author: "user1", text: "Great!", date: ISODate("...") },
    { author: "user2", text: "Thanks!", date: ISODate("...") },
    // ... 9,998 more comments
  ]
}

// "Count comments per author across posts"
db.posts.aggregate([
  { $match: { featured: true } },
  // Returns: 100 featured posts

  { $unwind: "$comments" },
  // EXPLOSION: 100 posts × 10K comments = 1,000,000 documents!
  // Each doc: post data + 1 comment
  // Memory: 1M × 1KB = 1GB (exceeds 100MB limit)
  // Result: Disk spill, 10+ minute execution

  { $group: {
      _id: "$comments.author",
      commentCount: { $sum: 1 }
  }}
])

// Even worse: nested $unwind
db.posts.aggregate([
  { $unwind: "$comments" },      // 100 → 1M docs
  { $unwind: "$comments.replies" } // 1M → 100M docs!
  // Memory: Explosion beyond any reasonable limit
])
```

**Correct: array operators—no document explosion**

```javascript
// Option 1: Use array operators instead of $unwind
db.posts.aggregate([
  { $match: { featured: true } },
  // Returns: 100 posts (stays 100 throughout)

  {
    $project: {
      title: 1,
      // Count without unwinding
      commentCount: { $size: "$comments" },

      // Get unique authors without unwinding
      uniqueAuthors: {
        $reduce: {
          input: "$comments.author",
          initialValue: [],
          in: { $setUnion: ["$$value", ["$$this"]] }
        }
      },

      // Get recent comments without unwinding
      recentComments: { $slice: ["$comments", -5] },

      // Filter specific comments without unwinding
      approvedComments: {
        $filter: {
          input: "$comments",
          cond: { $eq: ["$$this.approved", true] }
        }
      }
    }
  }
])
// Memory: 100 docs × 10KB = 1MB (not 1GB)
```

**When you must $unwind, filter first:**

```javascript
// Must $unwind to group by comment author
// Solution: Filter array BEFORE unwinding

db.posts.aggregate([
  { $match: { featured: true } },
  // 100 posts

  // Step 1: Filter array to reduce size before $unwind
  {
    $addFields: {
      comments: {
        $filter: {
          input: "$comments",
          cond: {
            $and: [
              { $eq: ["$$this.approved", true] },
              { $gte: ["$$this.date", lastWeek] }
            ]
          }
        }
      }
    }
  },
  // 10,000 comments → ~100 recent approved comments per post

  // Step 2: Now $unwind is safe
  { $unwind: "$comments" },
  // 100 posts × 100 comments = 10,000 docs (not 1M)

  { $group: {
      _id: "$comments.author",
      count: { $sum: 1 }
  }}
])
// Memory: 10K docs × 1KB = 10MB (fits easily)
```

**Use $slice to bound array before $unwind:**

```javascript
// Instead of storing and unwinding 10K comments...

// Original (problematic for aggregation):
{
  _id: "post123",
  title: "Viral Post",
  comments: [/* 10,000 comments */]  // Huge, can't efficiently aggregate
}

// Redesigned (aggregation-friendly):
{
  _id: "post123",
  title: "Viral Post",

  // Pre-computed stats (updated on each comment add)
  stats: {
    commentCount: 10000,
    uniqueAuthors: 4523,
    lastCommentAt: ISODate("2024-01-15")
  },

  // Top authors (maintained by background job)
  topCommenters: [
    { author: "user1", count: 47 },
    { author: "user2", count: 38 }
  ],

  // Only recent comments embedded
  recentComments: [/* last 10 */]
}

// Comments in separate collection
{
  _id: "comment_abc",
  postId: "post123",
  author: "user1",
  text: "Great!",
  date: ISODate("...")
}

// Now aggregation is simple:
db.posts.find({ featured: true }, { stats: 1, topCommenters: 1 })
// No aggregation needed for common queries
```

**Alternative: Pre-aggregate in schema:**

**$unwind memory math:**

```javascript
// Calculate document explosion
function calculateUnwindExplosion(collection, arrayField, filter = {}) {
  const sample = db[collection].aggregate([
    { $match: filter },
    { $sample: { size: 100 } },
    {
      $group: {
        _id: null,
        avgArraySize: { $avg: { $size: `$${arrayField}` } },
        maxArraySize: { $max: { $size: `$${arrayField}` } },
        docCount: { $sum: 1 }
      }
    }
  ]).toArray()[0]

  const totalDocs = db[collection].countDocuments(filter)
  const estimatedExplosion = totalDocs * sample.avgArraySize

  print(`$unwind analysis for ${collection}.${arrayField}:`)
  print(`  Documents matching filter: ${totalDocs.toLocaleString()}`)
  print(`  Average array size: ${Math.round(sample.avgArraySize)}`)
  print(`  Max array size: ${sample.maxArraySize}`)
  print(`  Estimated docs after $unwind: ${estimatedExplosion.toLocaleString()}`)
  print(`  Explosion factor: ${Math.round(sample.avgArraySize)}×`)

  const memoryEstimateMB = (estimatedExplosion * 1024) / (1024 * 1024)
  print(`  Estimated memory: ${memoryEstimateMB.toFixed(0)}MB`)
  print(`  100MB limit: ${memoryEstimateMB > 100 ? "EXCEEDED ⚠️" : "OK ✓"}`)

  if (memoryEstimateMB > 100) {
    print(`\n  Recommendation: Filter array before $unwind or use array operators`)
  }
}

// Check before using $unwind
calculateUnwindExplosion("posts", "comments", { featured: true })
```

**When $unwind IS acceptable:**

- **Small, bounded arrays**: <100 elements, known maximum (e.g., product categories).

- **Filtered arrays**: After $filter or $slice reduces to small set.

- **One-time analytics**: Batch reporting where you can allow disk use.

- **$lookup results**: When $lookup returns small result sets.

- **Pivot operations**: When you truly need to transform array→documents for $group.

**When NOT to use $unwind:**

- **Unbounded arrays**: User content (comments, events, logs) with no upper limit.

- **Large arrays**: >100 elements average, even if bounded.

- **Counting/aggregating arrays**: Use $size, $reduce instead.

- **Extracting array subset**: Use $slice, $filter, $arrayElemAt.

- **Production real-time queries**: Unpredictable memory usage = unpredictable latency.

**Verify with:**

```javascript
// Test if $unwind will cause problems
function testUnwindImpact(collection, pipeline) {
  // Find the $unwind stage
  const unwindStage = pipeline.find(s => s.$unwind)
  if (!unwindStage) {
    print("No $unwind stage found")
    return
  }

  const arrayField = typeof unwindStage.$unwind === "string"
    ? unwindStage.$unwind.replace("$", "")
    : unwindStage.$unwind.path.replace("$", "")

  // Run explain
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  // Check for disk usage
  const explainStr = JSON.stringify(explain)
  const usedDisk = explainStr.includes('"usedDisk":true') ||
                   explainStr.includes('"usedDisk": true')

  print(`$unwind on "${arrayField}":`)
  print(`  Spilled to disk: ${usedDisk ? "YES ⚠️" : "NO ✓"}`)

  if (usedDisk) {
    print(`\n  Consider:`)
    print(`  1. Add $filter before $unwind to reduce array size`)
    print(`  2. Add $slice before $unwind to cap array size`)
    print(`  3. Use array operators ($size, $reduce) instead`)
  }
}

// Test your pipeline
testUnwindImpact("posts", [
  { $match: { featured: true } },
  { $unwind: "$comments" },
  { $group: { _id: "$comments.author", count: { $sum: 1 } } }
])
```

Reference: [https://mongodb.com/docs/manual/reference/operator/aggregation/unwind/](https://mongodb.com/docs/manual/reference/operator/aggregation/unwind/)

### 4.2 Combine $sort with $limit for Top-N Queries

**Impact: HIGH (Top 10 from 1M docs: separated stages use 100MB+; coalesced uses 10KB—10,000× less memory)**

**$sort followed immediately by $limit triggers MongoDB's top-N optimization—it tracks only N documents instead of sorting everything.** Getting the top 10 scores from 1 million documents: without coalescence, MongoDB sorts all 1M docs in memory (100MB+, spills to disk). With coalescence, it maintains a 10-element heap (10KB), completing 1000× faster.

**Incorrect: $sort without $limit or with stages between**

```javascript
// Pattern 1: $sort without $limit (sorts EVERYTHING)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } }
  // Returns ALL 1M documents, sorted
  // Memory: 100MB+ (spills to disk)
  // Time: 30+ seconds
])

// Pattern 2: Stages between $sort and $limit (breaks optimization)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  // Full sort happens here (1M docs)

  { $addFields: { rank: { $literal: "calculating..." } } },
  // This stage BREAKS coalescence!
  // MongoDB doesn't know $limit is coming

  { $limit: 10 }
  // Too late - full sort already done
])

// Pattern 3: $project between (also breaks optimization)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $project: { score: 1, player: 1 } },  // Breaks coalescence
  { $limit: 10 }
])
```

**Correct: $limit immediately after $sort**

```javascript
// Top 10 scores - optimal pattern
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
  // COALESCED: MongoDB maintains 10-element heap
  // Memory: ~10KB (not 100MB)
  // Time: <100ms (not 30s)
])

// explain() shows:
{
  "sortLimitCoalesced": true  // ← Optimization applied!
}

// Add transformations AFTER $limit
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 },
  // Coalescence happened ✓

  // Now safe to add fields (only 10 docs)
  { $addFields: { rank: { $indexOfArray: [/* */] } } },
  { $project: { player: 1, score: 1, rank: 1 } }
])
```

**How coalescence works internally:**

```javascript
// Without coalescence (full sort):
// 1. Scan all 1M documents
// 2. Load into memory/disk
// 3. Sort all 1M by score
// 4. Return all (or slice if $limit later)
// Memory: O(n) where n = total docs

// With coalescence (heap-based):
// 1. Initialize 10-element min-heap
// 2. For each document:
//    - If score > min(heap), replace min
//    - If score <= min(heap), skip
// 3. Return heap contents sorted
// Memory: O(k) where k = limit value

// Example with scores [85, 92, 78, 95, 88, 91, 73, 99, 82, 87, 94, 76]:
// Limit 3, descending:
// Heap after each doc: [85] → [92,85] → [92,85,78] →
// [95,92,85] → [95,92,88] → [95,92,91] → [95,92,91] →
// [99,95,92] → [99,95,92] → [99,95,92] → [99,95,94] → [99,95,94]
// Result: [99, 95, 94] - never stored more than 3 docs
```

**Index-backed sort (eliminates in-memory sort entirely):**

```javascript
// Create compound index matching query + sort
db.scores.createIndex({ gameId: 1, score: -1 })

// Query reads documents in sorted order from index
db.scores.aggregate([
  { $match: { gameId: "game123" } },  // Equality on gameId
  { $sort: { score: -1 } },            // Already sorted by index!
  { $limit: 10 }
])

// explain() shows:
{
  "stage": "IXSCAN",
  "indexBounds": {
    "gameId": ["game123", "game123"],
    "score": ["[MaxKey, MinKey]"]
  },
  "direction": "forward"  // Reading index in order
}
// No in-memory sort needed - returns first 10 from index
// Memory: ~0 (just document retrieval)
// Time: <10ms
```

**$skip with $sort + $limit (pagination):**

```javascript
// Page 3: items 21-30
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $skip: 20 },
  { $limit: 10 }
])

// MongoDB optimizes this as:
// - Track top 30 documents (skip + limit)
// - Return documents 21-30
// Memory: 30-element heap (not 1M docs)

// HOWEVER: Deep pagination still degrades
// Page 10,000: skip(99990) + limit(10) = 100,000-element heap
// Solution: Use range-based pagination for deep pages
// See: query-pagination.md for cursor-based approach
```

**Multiple sort fields:**

```javascript
// Sort by rating, then review count
db.products.aggregate([
  { $match: { category: "electronics" } },
  { $sort: { rating: -1, reviewCount: -1 } },
  { $limit: 20 }
])

// Compound index for this exact sort:
db.products.createIndex({ category: 1, rating: -1, reviewCount: -1 })
// ESR: Equality (category), Sort (rating, reviewCount), Range (none)
```

**When NOT to use $sort + $limit coalescence:**

- **Need total count**: If you also need `count`, you must process all docs anyway.

- **Multiple $sorts needed**: Complex aggregations may need intermediate full sorts.

- **$facet pipelines**: Each facet runs independently; coalescence applies within each.

- **Post-sort filtering**: If you need to filter after sorting (e.g., `$match` on computed rank), full sort required.

- **Random sampling**: Use `$sample` instead for random selection (doesn't sort).

**Verify with:**

```javascript
// Check if coalescence is applied
function checkSortLimitCoalescence(collection, pipeline) {
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  // Look for coalescence indicator
  const explainStr = JSON.stringify(explain)
  const coalesced = explainStr.includes("sortLimitCoalesced") &&
                    explainStr.includes("true")

  // Find $sort stage
  const sortStageIndex = pipeline.findIndex(s => s.$sort)
  const limitStageIndex = pipeline.findIndex(s => s.$limit)

  print("Pipeline analysis:")
  print(`  $sort at stage: ${sortStageIndex}`)
  print(`  $limit at stage: ${limitStageIndex}`)
  print(`  Stages between: ${limitStageIndex - sortStageIndex - 1}`)
  print(`  Coalescence applied: ${coalesced ? "YES ✓" : "NO ✗"}`)

  if (!coalesced && sortStageIndex !== -1 && limitStageIndex !== -1) {
    if (limitStageIndex - sortStageIndex > 1) {
      print("\n⚠️  TIP: Move $limit immediately after $sort")
      print("   Current stages between $sort and $limit block coalescence")
    }
  }

  // Check for index-backed sort
  const indexSort = explainStr.includes("IXSCAN") &&
                    !explainStr.includes("sortStage")

  if (indexSort) {
    print("\n✓ BONUS: Sort is index-backed (no in-memory sort)")
  }

  // Show memory usage
  const execStats = explain.executionStats ||
                    explain.stages?.[explain.stages.length-1]?.executionStats

  if (execStats) {
    print(`\nExecution time: ${execStats.executionTimeMillis}ms`)
  }

  return coalesced
}

// Test your pipeline
checkSortLimitCoalescence("scores", [
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
])
```

Reference: [https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#sort-limit-coalescence](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#sort-limit-coalescence)

### 4.3 Index $lookup Foreign Fields

**Impact: HIGH (Unindexed $lookup: 10K × 100K = 1B comparisons (minutes); indexed: 10K × log(100K) = 170K (seconds))**

**Every $lookup without an index on foreignField does a full collection scan of the foreign collection—for every input document.** If you join 10K orders to 100K products on an unindexed `sku` field, that's 10,000 collection scans × 100,000 documents = 1 billion document comparisons. With an index: 10,000 × log₂(100,000) ≈ 170,000 comparisons. That's 6,000× less work.

**Incorrect: unindexed foreignField—nested collection scans**

```javascript
// Orders collection: 10,000 documents
// Products collection: 100,000 documents (unindexed sku field)

db.orders.aggregate([
  { $match: { status: "pending" } },
  // Returns: 10,000 pending orders

  {
    $lookup: {
      from: "products",
      localField: "sku",        // orders.sku
      foreignField: "sku",      // products.sku - NO INDEX!
      as: "product"
    }
  }
])

// What happens internally:
// For EACH of 10,000 orders:
//   Scan ALL 100,000 products looking for matching sku
//   Total comparisons: 10,000 × 100,000 = 1,000,000,000

// explain() shows:
{
  "$lookup": {
    "from": "products",
    "foreignField": "sku",
    "as": "product",
    "unwinding": { "preserveNullAndEmptyArrays": false }
  },
  "totalDocsExamined": 1000000000,  // 1 BILLION
  "executionTimeMillis": 180000      // 3 MINUTES
}
```

**Correct (indexed foreignField—O(log n) lookups):**

```javascript
// Step 1: Create index on the foreign collection's join field
db.products.createIndex({ sku: 1 })

// Step 2: Same $lookup now uses index
db.orders.aggregate([
  { $match: { status: "pending" } },
  {
    $lookup: {
      from: "products",
      localField: "sku",
      foreignField: "sku",      // NOW INDEXED ✓
      as: "product"
    }
  }
])

// What happens internally:
// For EACH of 10,000 orders:
//   Binary search index for matching sku: O(log 100,000) ≈ 17 comparisons
//   Total comparisons: 10,000 × 17 = 170,000

// explain() shows:
{
  "$lookup": {
    "from": "products",
    "foreignField": "sku",
    "as": "product"
  },
  "totalDocsExamined": 10000,      // Just the matched products
  "executionTimeMillis": 150        // 150ms (1200× faster)
}
```

**Common $lookup patterns requiring indexes:**

```javascript
// 1. Order items → Products (by custom ID)
db.products.createIndex({ productId: 1 })  // NOT _id
db.orders.aggregate([
  { $lookup: {
      from: "products",
      localField: "items.productId",  // Array of IDs
      foreignField: "productId",       // Index needed
      as: "products"
  }}
])

// 2. Users → Events (by external ID)
db.events.createIndex({ userId: 1, timestamp: -1 })
db.users.aggregate([
  { $lookup: {
      from: "events",
      localField: "externalId",
      foreignField: "userId",          // Index needed
      as: "recentEvents"
  }}
])

// 3. Posts → Comments (one-to-many)
db.comments.createIndex({ postId: 1, createdAt: -1 })
db.posts.aggregate([
  { $lookup: {
      from: "comments",
      localField: "_id",
      foreignField: "postId",          // Index needed
      as: "comments"
  }}
])

// 4. Categories → Products (hierarchical)
db.products.createIndex({ "categories": 1 })  // Array field
db.categories.aggregate([
  { $lookup: {
      from: "products",
      localField: "_id",
      foreignField: "categories",      // Multikey index needed
      as: "products"
  }}
])
```

**Optimized $lookup with pipeline (filter + project + limit):**

```javascript
// Basic $lookup pulls ALL matching documents
// Pipeline $lookup allows filtering DURING the join

// Without pipeline: Gets ALL reviews, then you filter
{
  $lookup: {
    from: "reviews",
    localField: "_id",
    foreignField: "productId",
    as: "reviews"
  }
}
// Returns 500 reviews per product (250KB each = 125MB per product!)

// With pipeline: Filter and limit during join
{
  $lookup: {
    from: "reviews",
    let: { productId: "$_id" },
    pipeline: [
      // Step 1: Match (uses index)
      { $match: {
          $expr: { $eq: ["$productId", "$$productId"] },
          rating: { $gte: 4 }         // Additional filter
      }},
      // Step 2: Sort
      { $sort: { helpful: -1 } },
      // Step 3: Limit
      { $limit: 5 },
      // Step 4: Project
      { $project: { text: 1, rating: 1, author: 1 } }
    ],
    as: "topReviews"
  }
}
// Returns only 5 reviews, projected to 500 bytes each = 2.5KB per product

// Required index for this pipeline:
db.reviews.createIndex({ productId: 1, rating: -1, helpful: -1 })
```

**Compound indexes for filtered $lookup:**

```javascript
// If your $lookup pipeline has $match conditions,
// create compound index starting with foreignField

// Pipeline $match: { productId: X, status: "approved", rating: { $gte: 4 } }
// Optimal index (ESR rule applies):
db.reviews.createIndex({
  productId: 1,    // Equality (foreignField)
  status: 1,       // Equality (filter)
  rating: -1       // Range (filter)
})
```

**When foreignField is _id (already indexed):**

```javascript
// _id is ALWAYS indexed - no action needed
db.orders.aggregate([
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",      // _id index automatic ✓
      as: "customer"
    }
  }
])

// HOWEVER: If you're NOT using _id, you MUST create an index
// Common mistake: Using string userId instead of ObjectId _id
db.users.aggregate([
  {
    $lookup: {
      from: "profiles",
      localField: "_id",           // users._id (ObjectId)
      foreignField: "userId",      // profiles.userId (string) - NEEDS INDEX
      as: "profile"
    }
  }
])
// Required: db.profiles.createIndex({ userId: 1 })
```

**When NOT to worry about $lookup index:**

- **Tiny foreign collection**: <1,000 documents, collection scan is fast anyway.

- **One-time analytics**: Batch job running at 3 AM where speed doesn't matter.

- **Already joining on _id**: The _id index always exists.

- **$graphLookup special case**: Uses different optimization strategies; still benefits from indexes.

**Verify with:**

```javascript
// Check if $lookup uses index on foreign collection
function checkLookupIndex(collection, lookupStage) {
  const foreignCollection = lookupStage.$lookup.from
  const foreignField = lookupStage.$lookup.foreignField

  // Check if index exists on foreign collection
  const indexes = db[foreignCollection].getIndexes()
  const hasIndex = indexes.some(idx => {
    const firstKey = Object.keys(idx.key)[0]
    return firstKey === foreignField
  })

  print(`$lookup analysis:`)
  print(`  Foreign collection: ${foreignCollection}`)
  print(`  Foreign field: ${foreignField}`)
  print(`  Index exists: ${hasIndex ? "YES ✓" : "NO ✗"}`)

  if (!hasIndex && foreignField !== "_id") {
    print(`\n⚠️  WARNING: No index on ${foreignCollection}.${foreignField}`)
    print(`   Create with: db.${foreignCollection}.createIndex({ ${foreignField}: 1 })`)

    // Show impact estimate
    const foreignCount = db[foreignCollection].countDocuments()
    print(`\n   Foreign collection size: ${foreignCount.toLocaleString()} docs`)
    print(`   Each $lookup does: ${foreignCount.toLocaleString()} comparisons (COLLSCAN)`)
    print(`   With index would do: ~${Math.ceil(Math.log2(foreignCount))} comparisons`)
  }

  // Run explain to verify
  const pipeline = [{ $limit: 1 }, lookupStage]
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  return hasIndex
}

// Test your $lookup
checkLookupIndex("orders", {
  $lookup: {
    from: "products",
    localField: "sku",
    foreignField: "sku",
    as: "product"
  }
})
```

Reference: [https://mongodb.com/docs/manual/reference/operator/aggregation/lookup/](https://mongodb.com/docs/manual/reference/operator/aggregation/lookup/)

### 4.4 Place $match at Pipeline Start

**Impact: HIGH ($match after $lookup: 10M lookups; $match before: 10K lookups—1000× less work)**

**$match at the pipeline start can use indexes; $match after $lookup cannot.** Every document that enters your pipeline flows through all subsequent stages. If you have 10 million orders but only 10,000 are "completed", putting `$match: { status: "completed" }` first means 10K documents flow through $lookup instead of 10M. That's the difference between 100ms and 10 minutes.

**Incorrect: $match after expensive operations—processes everything**

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

**Correct: $match first—filters before expensive operations**

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

Reference: [https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)

### 4.5 Use $project Early to Reduce Document Size

**Impact: HIGH (500KB docs → 500 bytes: 1000× less memory, avoids 100MB limit and disk spills)**

**Every stage processes entire documents—drop unnecessary fields early to stay in RAM.** Aggregation pipelines have a 100MB memory limit per stage. If you're processing 10,000 articles at 500KB each (5GB), you'll spill to disk immediately. Project to the 3 fields you need (500 bytes each = 5MB) and the entire pipeline runs in memory, 100× faster.

**Incorrect: carrying full documents through pipeline**

```javascript
// Document structure: 500KB each
// {
//   _id, title, authorId, publishedAt,  // 200 bytes (what we need)
//   content: "...",                      // 100KB (HTML article body)
//   rawMarkdown: "...",                  // 80KB (source markdown)
//   revisionHistory: [...],              // 200KB (50 revisions)
//   metadata: {...},                     // 50KB (SEO, analytics)
//   comments: [...]                      // 70KB (embedded comments)
// }

db.articles.aggregate([
  { $match: { status: "published" } },
  // 10,000 published articles × 500KB = 5GB flowing through

  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    }
  },
  // Still 5GB + author data per doc

  { $unwind: "$author" },
  // 5GB in memory for $unwind

  { $sort: { publishedAt: -1 } },
  // 5GB SORT OPERATION
  // Exceeds 100MB limit → spills to disk
  // Disk sort: 10-100× slower than in-memory

  { $limit: 10 },

  // Project LAST - after all the damage is done
  { $project: { title: 1, "author.name": 1, publishedAt: 1 } }
])

// Pipeline stats:
// - Memory used: 5GB+ (100MB limit exceeded)
// - Disk spills: Yes, multiple times
// - Time: 45 seconds
```

**Correct: $project immediately after $match**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // 10,000 docs enter pipeline

  // IMMEDIATELY reduce to needed fields
  {
    $project: {
      title: 1,
      authorId: 1,       // Need for $lookup
      publishedAt: 1     // Need for $sort
      // Dropped: content, rawMarkdown, revisionHistory, metadata, comments
      // 500KB → 200 bytes per doc
    }
  },
  // Now: 10,000 × 200 bytes = 2MB (not 5GB!)

  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author",
      // Project INSIDE $lookup too
      pipeline: [
        { $project: { name: 1, avatar: 1 } }  // Only needed author fields
      ]
    }
  },
  // 2MB + 100 bytes per author = still ~2MB

  { $unwind: "$author" },
  // 2MB

  { $sort: { publishedAt: -1 } },
  // 2MB sort - fits in memory easily

  { $limit: 10 }
])

// Pipeline stats:
// - Memory used: ~2MB (well under 100MB)
// - Disk spills: None
// - Time: 200ms (225× faster)
```

**Project inside $lookup (critical for joins):**

```javascript
// Without inner projection: pulls entire foreign documents
{
  $lookup: {
    from: "comments",     // Comments: 2KB average
    localField: "_id",
    foreignField: "postId",
    as: "comments"
  }
}
// 100 comments × 2KB = 200KB added per post

// With inner projection: pulls only needed fields
{
  $lookup: {
    from: "comments",
    localField: "_id",
    foreignField: "postId",
    as: "comments",
    pipeline: [
      { $match: { approved: true } },           // Filter first
      { $project: { author: 1, createdAt: 1 } }, // Then project
      { $sort: { createdAt: -1 } },
      { $limit: 5 }                              // Limit last
    ]
  }
}
// 5 comments × 50 bytes = 250 bytes added per post (800× less)
```

**$project vs $addFields vs $unset:**

```javascript
// $project: WHITELIST - explicitly specify fields to keep
// Use when: You need few fields, want to drop most
{ $project: { name: 1, email: 1 } }
// Output: { _id, name, email } - everything else gone

// $addFields: ADD or MODIFY fields, keep everything else
// Use when: Adding computed fields to existing document
{ $addFields: { fullName: { $concat: ["$first", " ", "$last"] } } }
// Output: all original fields + fullName

// $unset: BLACKLIST - remove specific fields, keep rest
// Use when: Dropping a few large fields
{ $unset: ["content", "revisionHistory", "metadata"] }
// Output: all fields except the three specified

// Performance equivalence (pick by readability):
{ $project: { content: 0, revisionHistory: 0 } }  // Exclusion mode
{ $unset: ["content", "revisionHistory"] }         // Same result
```

**Memory limit and allowDiskUse:**

```javascript
// Aggregation has 100MB per-stage memory limit
// Stages affected: $sort, $group, $bucket, $facet

// When exceeded without allowDiskUse:
// Error: "Sort exceeded memory limit of 104857600 bytes"

// With allowDiskUse:
db.collection.aggregate([...], { allowDiskUse: true })
// Works, but 10-100× slower due to disk I/O

// BETTER: Project early so you never hit the limit
// 100MB limit ÷ document size = max docs in memory
// - 500KB docs: 200 docs before disk spill
// - 500 byte docs: 200,000 docs before disk spill
```

**Practical sizing math:**

```javascript
// Calculate memory usage for your pipeline
function estimatePipelineMemory(docCount, avgDocSizeKB, projectedSizeBytes) {
  const beforeProject = docCount * avgDocSizeKB * 1024
  const afterProject = docCount * projectedSizeBytes
  const limit = 100 * 1024 * 1024  // 100MB

  print(`Before $project: ${(beforeProject / 1024 / 1024).toFixed(1)}MB`)
  print(`After $project: ${(afterProject / 1024 / 1024).toFixed(1)}MB`)
  print(`100MB limit: ${beforeProject > limit ? "EXCEEDED ❌" : "OK ✓"}`)
  print(`With projection: ${afterProject > limit ? "Still exceeded" : "Fits in memory ✓"}`)
  print(`Memory reduction: ${((beforeProject - afterProject) / beforeProject * 100).toFixed(0)}%`)
}

// Example: 10K articles, 500KB each, projecting to 500 bytes
estimatePipelineMemory(10000, 500, 500)
// Before $project: 4882.8MB
// After $project: 4.8MB
// 100MB limit: EXCEEDED ❌
// With projection: Fits in memory ✓
// Memory reduction: 99%
```

**When NOT to use early $project:**

- **Document already small**: <1KB documents, projection overhead isn't worth it.

- **Need most fields later**: If you're projecting 80% of fields, $unset the 20% instead.

- **Covered query possible**: Sometimes keeping all fields in projection allows index-only queries.

- **$facet pipelines**: Each facet starts fresh from input documents; project in each facet.

- **Dynamic field access**: If later stages use `$objectToArray` or dynamic paths, project can break them.

**Verify with:**

```javascript
// Check pipeline memory usage
function analyzePipelineMemory(collection, pipeline) {
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  // Find memory-intensive stages
  const stages = explain.stages || [explain]

  stages.forEach((stage, i) => {
    const stageName = Object.keys(stage).find(k => k.startsWith("$"))
    if (!stageName) return

    // Check for disk usage indicators
    const stageStr = JSON.stringify(stage)
    const usedDisk = stageStr.includes("usedDisk") && stageStr.includes("true")
    const memLimit = stageStr.includes("memoryLimitExceeded")

    if (usedDisk || memLimit) {
      print(`\n⚠️  Stage ${i} (${stageName}): Disk spill detected`)
      print("   Consider adding $project before this stage")
    }
  })

  // Show overall execution
  const stats = explain.stages?.[explain.stages.length - 1] ||
                explain.executionStats ||
                {}

  print(`\nTotal execution time: ${stats.executionTimeMillis || "N/A"}ms`)
}

// Test your pipeline
analyzePipelineMemory("articles", [
  { $match: { status: "published" } },
  { $project: { title: 1, authorId: 1, publishedAt: 1 } },
  { $sort: { publishedAt: -1 } },
  { $limit: 100 }
])
```

Reference: [https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/](https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/)

### 4.6 Use allowDiskUse for Large Aggregations

**Impact: MEDIUM (Aggregations exceeding 100MB limit: allowDiskUse prevents failure but is 10-100× slower than in-memory)**

**Aggregation pipeline stages have a 100MB memory limit per stage—allowDiskUse lets them spill to disk when exceeded.** Without it, large $sort, $group, or $bucket operations fail with "exceeded memory limit". Enable it for batch jobs and analytics, but understand it's 10-100× slower than in-memory. The real fix is optimizing your pipeline to fit in memory.

**Incorrect: large aggregation fails without allowDiskUse**

```javascript
// Sorting 1M large documents
db.orders.aggregate([
  { $match: { year: 2024 } },      // 1M orders
  { $sort: { totalAmount: -1 } }   // Sort ALL of them
])

// ERROR: Sort exceeded memory limit of 104857600 bytes

// Why 100MB isn't enough:
// 1M docs × ~200 bytes each = 200MB for sort buffer
// Exceeds 100MB limit → operation fails

// Same problem with $group on high-cardinality field:
db.events.aggregate([
  { $group: { _id: "$sessionId", count: { $sum: 1 } } }
])
// 5M unique sessions = 5M group keys = exceeds memory
```

**Correct: allowDiskUse for large operations**

```javascript
// Enable disk spilling for large aggregations
db.orders.aggregate(
  [
    { $match: { year: 2024 } },
    { $sort: { totalAmount: -1 } }
  ],
  { allowDiskUse: true }  // Allow disk spill
)

// Now works, but:
// - Uses temporary files on disk
// - 10-100× slower than in-memory
// - Consumes disk I/O bandwidth
// - Appropriate for batch jobs, not real-time queries
```

**When allowDiskUse is triggered:**

```javascript
// STRATEGY 1: $project early to reduce document size
// Before: 500KB docs, 100MB / 500KB = 200 docs max in memory
// After: 500 byte docs, 100MB / 500 bytes = 200,000 docs in memory

db.orders.aggregate([
  { $match: { year: 2024 } },
  // Reduce document size BEFORE memory-intensive stages
  { $project: { totalAmount: 1, customerId: 1, date: 1 } },
  { $sort: { totalAmount: -1 } }  // Now sorts smaller docs
])
// May fit in memory without allowDiskUse

// STRATEGY 2: Add $limit before $sort (top-N optimization)
db.orders.aggregate([
  { $match: { year: 2024 } },
  { $sort: { totalAmount: -1 } },
  { $limit: 100 }  // Top-N coalescence uses minimal memory
])
// Only tracks top 100, not all 1M documents

// STRATEGY 3: Use indexes for $sort
db.orders.createIndex({ year: 1, totalAmount: -1 })
db.orders.aggregate([
  { $match: { year: 2024 } },
  { $sort: { totalAmount: -1 } }
])
// Index provides sorted order, no in-memory sort needed

// STRATEGY 4: Pre-aggregate with $match
db.orders.aggregate([
  { $match: { year: 2024, status: "completed" } },  // More selective
  { $sort: { totalAmount: -1 } }
])
// Fewer documents to sort
```

**Better approach: Optimize to avoid disk use:**

**Monitor disk usage in aggregation:**

```javascript
// explain() shows if disk was used
const explain = db.orders.aggregate(
  [
    { $match: { year: 2024 } },
    { $sort: { totalAmount: -1 } }
  ],
  { allowDiskUse: true, explain: true }
)

// Look for in explain output:
// "usedDisk": true  ← Disk spill occurred
// "spills": N       ← Number of disk spills
// "spillFileSizeBytes": N  ← Size of temp files

// Or use $currentOp during execution:
db.adminCommand({ currentOp: true }).inprog.filter(op =>
  op.command?.aggregate && op.usedDisk
)
```

**allowDiskUse in drivers:**

```javascript
// Node.js
const results = await collection.aggregate(pipeline, {
  allowDiskUse: true
}).toArray()

// Python (PyMongo)
results = collection.aggregate(pipeline, allowDiskUse=True)

// Java
collection.aggregate(pipeline)
  .allowDiskUse(true)
  .into(new ArrayList<>())

// mongosh / shell
db.collection.aggregate(pipeline, { allowDiskUse: true })
```

**When NOT to use allowDiskUse:**

- **Real-time queries**: Disk I/O adds latency. Optimize pipeline instead.

- **High-concurrency scenarios**: Multiple disk spills compete for I/O.

- **Frequent queries**: If running often, fix the pipeline to fit in memory.

- **SSD concerns**: Excessive disk use can wear SSDs faster.

**When allowDiskUse IS appropriate:**

- **Batch analytics**: Nightly reports, data exports.

- **One-time data processing**: Migrations, backfills.

- **Ad-hoc queries**: Exploratory analytics by data team.

- **Large aggregations with no optimization path**: When you genuinely need all the data.

**Verify with:**

```javascript
// Check if aggregation needs allowDiskUse
function analyzeAggregationMemory(collection, pipeline) {
  // Try without allowDiskUse first
  try {
    const explain = db[collection].explain("executionStats").aggregate(pipeline)

    // Check for memory usage indicators
    const explainStr = JSON.stringify(explain)
    const usedDisk = explainStr.includes('"usedDisk":true') ||
                     explainStr.includes('"usedDisk": true')

    if (usedDisk) {
      print("⚠️  Aggregation used disk (allowDiskUse was implicitly needed)")
    } else {
      print("✓ Aggregation fits in memory")
    }

    // Find memory-intensive stages
    const stages = explain.stages || []
    stages.forEach((stage, i) => {
      const stageStr = JSON.stringify(stage)
      if (stageStr.includes("$sort") || stageStr.includes("$group")) {
        print(`\nStage ${i}: Memory-intensive operation detected`)
      }
    })

    const execTime = explain.executionStats?.executionTimeMillis
    print(`\nExecution time: ${execTime}ms`)

  } catch (err) {
    if (err.message.includes("memory limit")) {
      print("❌ Aggregation EXCEEDS memory limit")
      print("   Requires: { allowDiskUse: true }")
      print("\n   Better solutions:")
      print("   1. Add $project early to reduce document size")
      print("   2. Add $limit after $sort for top-N optimization")
      print("   3. Create index for $sort field")
      print("   4. Add more selective $match filters")
    } else {
      throw err
    }
  }
}

// Test your pipeline
analyzeAggregationMemory("orders", [
  { $match: { year: 2024 } },
  { $sort: { totalAmount: -1 } }
])
```

Reference: [https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/](https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/)

---

## 5. Performance Diagnostics

**Impact: MEDIUM**

You can't optimize what you can't measure. explain("executionStats") reveals exactly what MongoDB did: COLLSCAN means no index was used, IXSCAN means indexed lookup, totalDocsExamined vs. nReturned shows scan efficiency (10000 examined for 10 returned = 99.9% wasted work). $indexStats shows which indexes are actually being used—unused indexes waste disk space and slow down writes. The slow query log captures queries exceeding a threshold. MongoDB Profiler records all operations with timing. Atlas Performance Advisor automatically suggests missing indexes. These tools turn "it's slow" into "this specific query scans 10M documents because it's missing an index on {userId, createdAt}".

### 5.1 Interpret explain() Output for Query Optimization

**Impact: CRITICAL (explain() reveals COLLSCAN vs IXSCAN, documents examined, and execution time—your primary diagnostic tool)**

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

**Reading a COLLSCAN: bad**

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

**Reading an IXSCAN: good**

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

**Covered query: optimal**

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

Reference: [https://mongodb.com/docs/manual/reference/explain-results/](https://mongodb.com/docs/manual/reference/explain-results/)

### 5.2 Use $indexStats to Find Unused Indexes

**Impact: HIGH ($indexStats shows access counts—indexes with 0 ops are wasting RAM and slowing writes)**

**$indexStats reveals which indexes are actually used—unused indexes waste RAM, slow writes, and add maintenance overhead.** Every index consumes memory (often in your expensive working set) and must be updated on every write. An index that's never queried is pure cost. Regular $indexStats audits help maintain optimal index health.

**Query index statistics:**

```javascript
// Get stats for all indexes on a collection
db.orders.aggregate([{ $indexStats: {} }])

// Output:
[
  {
    "name": "_id_",
    "key": { "_id": 1 },
    "host": "mongodb-server:27017",
    "accesses": {
      "ops": 1523847,                   // Times index was used
      "since": ISODate("2024-01-01")    // Stats reset time
    },
    "shard": "shard-1",                 // If sharded
    "spec": { /* index spec */ }
  },
  {
    "name": "customerId_1",
    "key": { "customerId": 1 },
    "accesses": {
      "ops": 0,                         // NEVER USED!
      "since": ISODate("2024-01-01")
    }
  },
  // ...
]
```

**Find unused indexes:**

```javascript
// Indexes with zero operations
db.orders.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } },
  { $project: {
      name: 1,
      key: 1,
      "accesses.since": 1
  }}
])

// Important: Consider the "since" field
// An index with 0 ops since yesterday might just be new
// An index with 0 ops since 6 months ago is likely unused
```

**Comprehensive index audit:**

```javascript
// Full index utilization report
function auditIndexes(collection) {
  const stats = db[collection].aggregate([{ $indexStats: {} }]).toArray()
  const collStats = db[collection].stats()

  print(`\n=== Index Audit: ${collection} ===`)
  print(`Collection size: ${(collStats.size/1024/1024).toFixed(1)}MB`)
  print(`Total index size: ${(collStats.totalIndexSize/1024/1024).toFixed(1)}MB`)
  print(`Documents: ${collStats.count.toLocaleString()}`)

  // Sort by usage
  const sorted = stats.sort((a, b) => b.accesses.ops - a.accesses.ops)

  print(`\n--- Index Usage (by ops) ---`)
  sorted.forEach(idx => {
    const sizeInfo = db[collection].stats().indexSizes[idx.name]
    const sizeMB = sizeInfo ? (sizeInfo/1024/1024).toFixed(1) : "?"

    const daysSinceReset = Math.floor(
      (Date.now() - new Date(idx.accesses.since)) / 86400000
    )

    const opsPerDay = daysSinceReset > 0
      ? Math.round(idx.accesses.ops / daysSinceReset)
      : idx.accesses.ops

    let status = "✓"
    if (idx.accesses.ops === 0 && daysSinceReset > 7) status = "❌ UNUSED"
    else if (opsPerDay < 10 && daysSinceReset > 7) status = "⚠️  LOW USE"

    print(`${status} ${idx.name}`)
    print(`    Keys: ${JSON.stringify(idx.key)}`)
    print(`    Ops: ${idx.accesses.ops.toLocaleString()} (${opsPerDay}/day)`)
    print(`    Size: ${sizeMB}MB`)
    print(`    Since: ${idx.accesses.since} (${daysSinceReset} days)`)
  })

  // Summary
  const unused = sorted.filter(i =>
    i.accesses.ops === 0 && i.name !== "_id_"
  )

  if (unused.length > 0) {
    print(`\n--- Recommended Actions ---`)
    unused.forEach(idx => {
      print(`DROP: db.${collection}.dropIndex("${idx.name}")`)
    })

    const potentialSavings = unused.reduce((sum, idx) => {
      const size = db[collection].stats().indexSizes[idx.name] || 0
      return sum + size
    }, 0)
    print(`\nPotential RAM savings: ${(potentialSavings/1024/1024).toFixed(1)}MB`)
  }
}

// Usage
auditIndexes("orders")
```

**Check for redundant indexes:**

```javascript
// Redundant indexes: covered by prefix of another index
function findRedundantIndexes(collection) {
  const stats = db[collection].aggregate([{ $indexStats: {} }]).toArray()

  const redundant = []

  for (const idx of stats) {
    if (idx.name === "_id_") continue

    const idxKeys = Object.keys(idx.key)

    for (const other of stats) {
      if (idx.name === other.name) continue

      const otherKeys = Object.keys(other.key)

      // Check if idx is a prefix of other
      if (idxKeys.length < otherKeys.length) {
        const isPrefix = idxKeys.every((key, i) =>
          key === otherKeys[i] && idx.key[key] === other.key[key]
        )

        if (isPrefix) {
          redundant.push({
            redundant: idx.name,
            redundantKeys: idx.key,
            coveredBy: other.name,
            coveredByKeys: other.key
          })
        }
      }
    }
  }

  if (redundant.length === 0) {
    print("No redundant indexes found ✓")
  } else {
    print("Redundant indexes found:")
    redundant.forEach(r => {
      print(`\n  ${r.redundant} is prefix of ${r.coveredBy}`)
      print(`    ${r.redundant}: ${JSON.stringify(r.redundantKeys)}`)
      print(`    ${r.coveredBy}: ${JSON.stringify(r.coveredByKeys)}`)
      print(`    Action: db.${collection}.dropIndex("${r.redundant}")`)
    })
  }

  return redundant
}

// Usage
findRedundantIndexes("orders")
```

**Track index usage over time:**

```javascript
// Store snapshots for trend analysis
function snapshotIndexStats(collection) {
  const stats = db[collection].aggregate([{ $indexStats: {} }]).toArray()

  const snapshot = {
    collection: collection,
    timestamp: new Date(),
    indexes: stats.map(idx => ({
      name: idx.name,
      key: idx.key,
      ops: idx.accesses.ops,
      since: idx.accesses.since
    }))
  }

  db.index_stats_history.insertOne(snapshot)
  print(`Snapshot saved: ${snapshot.timestamp}`)
}

// Compare snapshots
function compareIndexUsage(collection, daysAgo) {
  const since = new Date(Date.now() - daysAgo * 86400000)

  const oldSnapshot = db.index_stats_history.findOne({
    collection: collection,
    timestamp: { $gte: since }
  }, { sort: { timestamp: 1 } })

  const newSnapshot = db.index_stats_history.findOne({
    collection: collection
  }, { sort: { timestamp: -1 } })

  if (!oldSnapshot || !newSnapshot) {
    print("Insufficient snapshot history")
    return
  }

  print(`Comparing: ${oldSnapshot.timestamp} → ${newSnapshot.timestamp}`)

  newSnapshot.indexes.forEach(newIdx => {
    const oldIdx = oldSnapshot.indexes.find(i => i.name === newIdx.name)
    const delta = oldIdx ? newIdx.ops - oldIdx.ops : newIdx.ops

    print(`${newIdx.name}: +${delta.toLocaleString()} ops`)
  })
}
```

**When to check $indexStats:**

- **Monthly audits**: Regular cleanup of unused indexes.

- **Before adding new indexes**: Check if similar index exists.

- **After schema changes**: Old indexes may become unused.

- **Performance reviews**: Part of regular optimization cycles.

- **Cost optimization**: RAM is expensive; unused indexes waste it.

**Caveats with $indexStats:**

```javascript
// 1. Stats reset on mongod restart
//    Check "since" field to know the window

// 2. Stats are per-replica-set-member
//    Query each member separately for complete picture
//    Or use rs.slaveOk() and query secondaries

// 3. Low ops doesn't mean unused
//    Index for rare-but-critical queries (reports, emergencies)
//    Ask team before dropping low-use indexes

// 4. Stats don't show index effectiveness
//    High ops but inefficient queries = false positive
//    Combine with explain() analysis

// 5. Covered query optimization
//    Index may enable covered queries even if not in filter
//    Check if index fields appear in projections
```

**Verify before dropping:**

```javascript
// Before dropping, verify index truly isn't needed
function safeToDropIndex(collection, indexName) {
  // Get index stats
  const stats = db[collection].aggregate([
    { $indexStats: {} },
    { $match: { name: indexName } }
  ]).toArray()[0]

  if (!stats) {
    print(`Index "${indexName}" not found`)
    return false
  }

  print(`\nIndex: ${indexName}`)
  print(`Keys: ${JSON.stringify(stats.key)}`)
  print(`Operations: ${stats.accesses.ops}`)
  print(`Since: ${stats.accesses.since}`)

  const daysSince = Math.floor(
    (Date.now() - new Date(stats.accesses.since)) / 86400000
  )

  // Checks
  const checks = {
    unused: stats.accesses.ops === 0 && daysSince > 7,
    lowUse: stats.accesses.ops < daysSince && daysSince > 7,
    notId: indexName !== "_id_",
    notUnique: !db[collection].getIndexes().find(i => i.name === indexName)?.unique
  }

  print(`\nSafety checks:`)
  print(`  Unused (0 ops, >7 days): ${checks.unused ? "YES" : "NO"}`)
  print(`  Low use (<1/day): ${checks.lowUse ? "YES" : "NO"}`)
  print(`  Not _id: ${checks.notId ? "YES" : "NO"}`)
  print(`  Not unique: ${checks.notUnique ? "YES (assumed)" : "CHECK MANUALLY"}`)

  if (checks.unused && checks.notId) {
    print(`\n✓ Safe to drop: db.${collection}.dropIndex("${indexName}")`)
    return true
  } else {
    print(`\n⚠️  Verify with team before dropping`)
    return false
  }
}

// Usage
safeToDropIndex("orders", "old_unused_index_1")
```

Reference: [https://mongodb.com/docs/manual/reference/operator/aggregation/indexStats/](https://mongodb.com/docs/manual/reference/operator/aggregation/indexStats/)

### 5.3 Use Slow Query Log to Find Performance Issues

**Impact: HIGH (System profiler captures queries exceeding threshold—find the 20% of queries causing 80% of load)**

**MongoDB's database profiler captures slow operations, revealing which queries need optimization.** Instead of guessing which queries are slow, enable profiling to capture operations exceeding a threshold (e.g., 100ms). The system.profile collection stores query patterns, execution times, and documents examined—everything you need to prioritize optimization work.

**Incorrect: guessing which queries are slow**

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

**Correct: using profiler to find actual slow queries**

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

Reference: [https://mongodb.com/docs/manual/tutorial/manage-the-database-profiler/](https://mongodb.com/docs/manual/tutorial/manage-the-database-profiler/)

---

## References

1. [https://mongodb.com/docs/manual/indexes/](https://mongodb.com/docs/manual/indexes/)
2. [https://mongodb.com/docs/manual/core/indexes/index-types/](https://mongodb.com/docs/manual/core/indexes/index-types/)
3. [https://mongodb.com/docs/manual/core/indexes/create-index/](https://mongodb.com/docs/manual/core/indexes/create-index/)
4. [https://mongodb.com/docs/manual/tutorial/analyze-query-plan/](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)
5. [https://mongodb.com/docs/manual/reference/explain-results/](https://mongodb.com/docs/manual/reference/explain-results/)
6. [https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
7. [https://mongodb.com/docs/manual/tutorial/manage-the-database-profiler/](https://mongodb.com/docs/manual/tutorial/manage-the-database-profiler/)
8. [https://mongodb.com/docs/manual/reference/operator/aggregation/indexStats/](https://mongodb.com/docs/manual/reference/operator/aggregation/indexStats/)
9. [https://mongodb.com/docs/atlas/performance-advisor/](https://mongodb.com/docs/atlas/performance-advisor/)
10. [https://mongodb.com/developer/products/mongodb/performance-best-practices-indexing/](https://mongodb.com/developer/products/mongodb/performance-best-practices-indexing/)
