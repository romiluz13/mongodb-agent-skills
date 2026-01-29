---
title: Consider Index Size and Memory Impact
impact: HIGH
impactDescription: "Indexes must fit in RAM for optimal performance—10 indexes × 100MB each = 1GB of working set"
tags: index, memory, size, RAM, working-set, performance, capacity
---

## Consider Index Size and Memory Impact

**Indexes must fit in RAM for optimal performance—when indexes don't fit, queries hit disk and become orders of magnitude slower.** Each index on a 10M document collection might be 100-500MB. Create 10 indexes and you need 1-5GB just for indexes. Monitor index sizes, remove unused indexes, and use partial indexes to keep your working set in memory.

**Incorrect (creating indexes without considering memory impact):**

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

**Correct (strategic indexing with memory awareness):**

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

Reference: [Index Limitations](https://mongodb.com/docs/manual/reference/limits/#indexes)
