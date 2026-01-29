---
title: Use $indexStats to Find Unused Indexes
impact: HIGH
impactDescription: "$indexStats shows access counts—indexes with 0 ops are wasting RAM and slowing writes"
tags: performance, indexStats, unused-indexes, diagnostics, optimization, maintenance
---

## Use $indexStats to Find Unused Indexes

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

Reference: [$indexStats](https://mongodb.com/docs/manual/reference/operator/aggregation/indexStats/)
