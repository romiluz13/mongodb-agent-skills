---
title: Remove Unused Indexes
impact: HIGH
impactDescription: "Each unused index adds 10-30% write latency and wastes RAM—5 unused indexes can double write times"
tags: index, unused-index, indexstats, maintenance, atlas-suggestion
---

## Remove Unused Indexes

**Every index costs write performance and memory whether it's used or not.** Each insert and update must maintain all indexes on a collection. We've seen production systems with 15 indexes where 10 were never used—removing them cut write latency by 60%. Audit indexes regularly and remove any that aren't serving queries.

**Incorrect (keeping all indexes "just in case"):**

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

**Correct (audit and remove unused):**

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

## Verify with

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

Reference: [Measure Index Use](https://mongodb.com/docs/manual/tutorial/measure-index-use/)
