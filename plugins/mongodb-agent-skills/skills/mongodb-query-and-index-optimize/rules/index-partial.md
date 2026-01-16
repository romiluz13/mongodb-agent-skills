---
title: Use Partial Indexes to Reduce Size
impact: HIGH
impactDescription: "Index only active records: 90% smaller index, 10× faster writes, fits in RAM"
tags: index, partial, filter, optimization, memory, selective
---

## Use Partial Indexes to Reduce Size

**Partial indexes only include documents matching a filter expression—index the 10% you query, not the 90% you don't.** If you have 10 million orders but only query the 1 million "pending" ones, a partial index on `{ status: "pending" }` is 90% smaller. Smaller indexes mean faster writes, more indexes fit in RAM, and queries on the indexed subset are just as fast.

**Incorrect (full index on rarely-queried data):**

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

**Correct (partial index on active subset):**

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

Reference: [Partial Indexes](https://mongodb.com/docs/manual/core/index-partial/)
