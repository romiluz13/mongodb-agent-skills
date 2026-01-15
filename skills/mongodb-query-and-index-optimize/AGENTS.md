# MongoDB Query and Index Optimization Best Practices

> MongoDB query optimization and indexing strategies for AI agents and developers. Contains 15 rules across 3 categories.

**Version:** 1.0.0
**Organization:** MongoDB
**Date:** January 2025

## When to Apply

Use this skill when:
- Creating or reviewing indexes for MongoDB collections
- Optimizing slow queries identified by profiler or Performance Advisor
- Writing aggregation pipelines
- Analyzing explain() output to understand query performance
- Troubleshooting collection scans (COLLSCAN)

## Quick Reference

| Category | Impact | Rules |
|----------|--------|-------|
| Index Strategies | CRITICAL | 1.1-1.5 |
| Query Patterns | HIGH | 2.1-2.5 |
| Aggregation Optimization | HIGH | 3.1-3.5 |

---

## 1. Index Strategies

**Impact:** CRITICAL
**Description:** Proper indexing is the foundation of MongoDB performance. Without indexes, every query scans the entire collection. Index strategy determines whether queries run in milliseconds or minutes.

### 1.1 Order Compound Index Fields Correctly

In compound indexes, put equality fields first, then sort fields, then range fields. This order maximizes index efficiency by narrowing results before sorting and filtering.

**Incorrect (range field first):**

```javascript
// Query: Find active users, sorted by name, in age range
db.users.find({
  status: "active",     // equality
  age: { $gte: 21, $lte: 65 }  // range
}).sort({ name: 1 })

// Wrong index order - range before sort
db.users.createIndex({ age: 1, name: 1, status: 1 })
// Forces in-memory sort, scans many documents
```

**Correct (equality → sort → range):**

```javascript
// Same query, optimal index
db.users.createIndex({ status: 1, name: 1, age: 1 })
//                      equality   sort     range

// Execution:
// 1. Jump to status="active" (equality narrows instantly)
// 2. Walk index in name order (no memory sort needed)
// 3. Filter by age range (at the end)
```

**Why this order works:**

```
Equality: Exact match → narrows to subset instantly
Sort:     Index order matches sort → no in-memory sort
Range:    Filters remaining results → applied last
```

**Verify with explain():**

```javascript
db.users.find({...}).sort({...}).explain("executionStats")

// Good: "stage": "IXSCAN", no SORT stage
// Bad:  "stage": "SORT" indicates in-memory sort
```

Reference: [Compound Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/)

---

### 1.2 Ensure Queries Use Indexes

Every production query must use an index. Without indexes, MongoDB performs a COLLSCAN—reading every document in the collection. Always verify index usage with explain().

**Incorrect (no index, COLLSCAN):**

```javascript
// Query on field without index
db.orders.find({ customerId: "cust123" })

// explain() shows:
{
  "stage": "COLLSCAN",  // BAD: Full collection scan
  "totalDocsExamined": 10000000,
  "executionTimeMillis": 45000
}
```

**Correct (indexed query, IXSCAN):**

```javascript
// Create index first
db.orders.createIndex({ customerId: 1 })

// Same query now uses index
db.orders.find({ customerId: "cust123" })

// explain() shows:
{
  "stage": "IXSCAN",  // GOOD: Index scan
  "totalDocsExamined": 47,  // Only matching docs
  "executionTimeMillis": 2
}
```

**How to verify index usage:**

```javascript
// Check query plan
db.orders.find({ customerId: "cust123" }).explain("executionStats")

// Key metrics to check:
// 1. winningPlan.stage should be IXSCAN, not COLLSCAN
// 2. totalDocsExamined should be close to nReturned
// 3. totalKeysExamined should be close to nReturned
```

**Warning signs in explain():**

| Metric | Good | Bad |
|--------|------|-----|
| stage | IXSCAN | COLLSCAN |
| totalDocsExamined/nReturned | ~1 | >>1 |
| executionTimeMillis | <100ms | >1000ms |

**Compound index prefix rule:**

```javascript
// Index: { a: 1, b: 1, c: 1 }
db.col.find({ a: "x" })           // Uses index (prefix)
db.col.find({ a: "x", b: "y" })   // Uses index (prefix)
db.col.find({ b: "y" })           // Does NOT use index
db.col.find({ c: "z" })           // Does NOT use index
```

**Atlas Performance Advisor** automatically suggests indexes for slow queries. Enable it in Atlas to get recommendations.

Reference: [Analyze Query Performance](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)

---

### 1.3 Remove Unused Indexes

Every index costs write performance and memory. Unused indexes waste resources without benefit. Audit indexes regularly with $indexStats and remove those not serving queries.

**Incorrect (keeping all indexes "just in case"):**

```javascript
// Collection with accumulated indexes
db.products.getIndexes()
// [
//   { name: "_id_", ... },
//   { name: "sku_1", ... },
//   { name: "category_1", ... },      // Used
//   { name: "category_1_brand_1", ... }, // Covers category_1 queries too
//   { name: "name_text", ... },       // Never used
//   { name: "price_1", ... },         // Used once in 90 days
//   { name: "createdAt_1", ... }      // Never used
// ]
// 7 indexes = 7× write overhead
```

**Correct (audit and remove unused):**

```javascript
// Check index usage statistics
db.products.aggregate([{ $indexStats: {} }])

// Output shows access patterns:
[
  { name: "_id_", accesses: { ops: 50000 } },
  { name: "sku_1", accesses: { ops: 25000 } },
  { name: "category_1", accesses: { ops: 0 } },  // Redundant
  { name: "category_1_brand_1", accesses: { ops: 15000 } },
  { name: "name_text", accesses: { ops: 0 } },   // Never used
  { name: "price_1", accesses: { ops: 3 } },     // Rarely used
  { name: "createdAt_1", accesses: { ops: 0 } }  // Never used
]

// Remove unused indexes
db.products.dropIndex("name_text")
db.products.dropIndex("createdAt_1")
db.products.dropIndex("category_1")  // Redundant with compound
```

**Index redundancy rules:**

```javascript
// Index { a: 1, b: 1 } makes { a: 1 } redundant
// Keep only the compound index

// Index { a: 1 } does NOT make { a: 1, b: 1 } redundant
// They serve different queries
```

**When to drop an index:**

1. Zero accesses in $indexStats over 30+ days
2. Redundant prefix (covered by compound index)
3. Very low usage compared to collection size
4. Atlas Performance Advisor marks it unused

**Index costs:**

- Storage: Each index adds 10-30% to data size
- Memory: Indexes compete for WiredTiger cache
- Writes: Every insert/update must update all indexes

Atlas Schema Suggestions flags this as: "Remove unnecessary indexes".

Reference: [Remove Unnecessary Indexes](https://mongodb.com/docs/manual/tutorial/remove-indexes/)

---

### 1.4 Put High-Cardinality Fields First

In compound indexes with multiple equality fields, put the most selective (highest cardinality) field first. Higher cardinality means fewer matching documents at each index level.

**Incorrect (low cardinality first):**

```javascript
// Query: Find orders by status and customerId
db.orders.find({ status: "completed", customerId: "cust123" })

// Bad index: status has only ~5 distinct values
db.orders.createIndex({ status: 1, customerId: 1 })

// Execution on 10M orders:
// status="completed" matches 3M docs → then scan for customerId
// totalKeysExamined: 3,000,000
```

**Correct (high cardinality first):**

```javascript
// Same query, better index order
db.orders.createIndex({ customerId: 1, status: 1 })

// Execution:
// customerId="cust123" matches 500 docs → then filter status
// totalKeysExamined: 500
```

**Cardinality examples:**

| Field | Cardinality | Example Values |
|-------|-------------|----------------|
| _id | Unique | 10M values in 10M docs |
| email | High | ~10M unique |
| userId | High | ~100K unique |
| country | Medium | ~200 |
| status | Low | 3-10 values |
| isActive | Very Low | 2 values (boolean) |

**Decision guide:**

```javascript
// Query: { a: value1, b: value2 }
// If a has 1000 distinct values and b has 5:
//   Index { a: 1, b: 1 } → scan ~10 docs
//   Index { b: 1, a: 1 } → scan ~2000 docs
```

**Check cardinality:**

```javascript
// Count distinct values for a field
db.orders.distinct("status").length    // 5
db.orders.distinct("customerId").length // 100000

// customerId has higher cardinality → put first
```

Reference: [Indexing Strategies](https://mongodb.com/docs/manual/applications/indexes/)

---

### 1.5 Design Indexes for Covered Queries

A covered query returns results entirely from the index without fetching documents. Include projected fields in the index to eliminate the document lookup step.

**Incorrect (query fetches documents):**

```javascript
// Index only on query field
db.users.createIndex({ email: 1 })

// Query needs fields not in index
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 0 }
)

// Execution:
// 1. IXSCAN: Find matching index entry
// 2. FETCH: Load document from disk to get "name"
// totalDocsExamined: 1
```

**Correct (covered query):**

```javascript
// Index includes projected fields
db.users.createIndex({ email: 1, name: 1 })

// Same query, now covered
db.users.find(
  { email: "alice@example.com" },
  { name: 1, email: 1, _id: 0 }  // Must exclude _id unless indexed
)

// Execution:
// 1. IXSCAN: Find entry, return name and email from index
// No FETCH stage needed
// totalDocsExamined: 0
```

**Verify covered query in explain():**

```javascript
db.users.find({...}, {...}).explain("executionStats")

// Covered query indicators:
{
  "totalDocsExamined": 0,  // No documents fetched
  "executionStages": {
    "stage": "PROJECTION_COVERED",  // or just IXSCAN with no FETCH
  }
}

// NOT covered (has FETCH stage):
{
  "totalDocsExamined": 1,
  "executionStages": {
    "stage": "FETCH"
  }
}
```

**Rules for covered queries:**

1. All query fields must be in index
2. All projected fields must be in index
3. Must exclude _id or include _id in index
4. Cannot use $elemMatch in projection

**Common covered query patterns:**

```javascript
// Lookup by ID, return specific fields
db.products.createIndex({ sku: 1, name: 1, price: 1 })
db.products.find({ sku: "ABC123" }, { name: 1, price: 1, _id: 0 })

// List with pagination
db.posts.createIndex({ status: 1, createdAt: -1, title: 1 })
db.posts.find(
  { status: "published" },
  { title: 1, createdAt: 1, _id: 0 }
).sort({ createdAt: -1 }).limit(20)
```

Reference: [Covered Queries](https://mongodb.com/docs/manual/core/query-optimization/#covered-query)

---

## 2. Query Patterns

**Impact:** HIGH
**Description:** How you write queries affects whether indexes can be used effectively. Certain patterns force collection scans even when indexes exist. Optimized query patterns maximize index efficiency.

### 2.1 Use Projections to Limit Fields

Always specify only the fields you need. Fetching entire documents wastes bandwidth, memory, and CPU when you only need a few fields.

**Incorrect (fetching entire document):**

```javascript
// Get user names - fetches everything
const users = await db.users.find({ status: "active" }).toArray()

// Each document: 50KB (profile, preferences, history, etc.)
// 1000 users = 50MB transferred
// You only use: user.name, user.email
```

**Correct (projection limits fields):**

```javascript
// Get only needed fields
const users = await db.users.find(
  { status: "active" },
  { projection: { name: 1, email: 1 } }
).toArray()

// Each document: 200 bytes
// 1000 users = 200KB transferred (250× smaller)
```

**Projection syntax:**

```javascript
// Include specific fields (1 = include)
{ name: 1, email: 1 }  // Returns _id, name, email

// Exclude _id if not needed
{ name: 1, email: 1, _id: 0 }  // Returns only name, email

// Exclude specific fields (0 = exclude)
{ largeField: 0, history: 0 }  // Returns everything except these

// Cannot mix include/exclude (except _id)
{ name: 1, largeField: 0 }  // ERROR
```

**Array element projection:**

```javascript
// Get first N elements of array
{ items: { $slice: 5 } }  // First 5
{ items: { $slice: -3 } }  // Last 3
{ items: { $slice: [10, 5] } }  // Skip 10, take 5

// Get matching array element
{ "items.$": 1 }  // First matching element
```

Reference: [Project Fields to Return](https://mongodb.com/docs/manual/tutorial/project-fields-from-query-results/)

---

### 2.2 Avoid $ne and $nin Operators

Negation operators ($ne, $nin) cannot efficiently use indexes. They must scan all index entries except the excluded values. Use positive matching with $in or restructure the query.

**Incorrect (negation scans most of index):**

```javascript
// Find non-deleted users
db.users.find({ status: { $ne: "deleted" } })

// Even with index on status, this scans:
// - All "active" entries
// - All "pending" entries
// - All "suspended" entries
// Essentially a full index scan minus "deleted"

// Similarly bad:
db.orders.find({ status: { $nin: ["cancelled", "refunded"] } })
```

**Correct (positive matching):**

```javascript
// Explicitly list wanted values
db.users.find({ status: { $in: ["active", "pending", "suspended"] } })

// If you frequently query "not deleted", add a boolean field
db.users.find({ isActive: true })
// Index { isActive: 1 } for instant lookup

// For orders:
db.orders.find({ status: { $in: ["pending", "processing", "shipped", "delivered"] } })
```

**Schema design to avoid $ne:**

```javascript
// Instead of checking status != "deleted"
// Use a separate boolean or move deleted to archive

// Option 1: Boolean field
{
  status: "inactive",
  isDeleted: false  // Index this
}
db.users.find({ isDeleted: false, ... })

// Option 2: Move deleted to archive collection
db.users.deleteOne({ _id: userId })
db.users_archive.insertOne({ ...deletedUser, deletedAt: new Date() })
```

**When $ne is acceptable:**

- Small collections (<10K documents)
- Query will return most documents anyway
- No better alternative exists

Reference: [Query Operators](https://mongodb.com/docs/manual/reference/operator/query/)

---

### 2.3 Anchor Regex Patterns with ^

Only anchored regex patterns (starting with ^) can use indexes. Unanchored regex forces a full collection scan regardless of indexes.

**Incorrect (unanchored regex, COLLSCAN):**

```javascript
// Search for emails containing "gmail"
db.users.find({ email: /gmail/ })

// Even with index on email, this is a COLLSCAN
// Must check every document for "gmail" anywhere in string
// 10M users = 10M string comparisons
```

**Correct (anchored regex, IXSCAN):**

```javascript
// Search for emails starting with pattern
db.users.find({ email: /^alice/ })

// Uses index on email field
// Jumps to "alice" in index, scans only matching range
// Much faster on large collections
```

**Use cases for anchored regex:**

```javascript
// Autocomplete - user types "jo"
db.users.find({ name: /^jo/i })  // Case-insensitive anchor

// Prefix matching
db.products.find({ sku: /^ELEC-/ })  // All electronics

// Starts-with search
db.files.find({ path: /^\/home\/user123\// })
```

**For substring search, use text index:**

```javascript
// Create text index
db.articles.createIndex({ title: "text", content: "text" })

// Search for keyword anywhere
db.articles.find({ $text: { $search: "mongodb" } })

// Much faster than /mongodb/ regex
```

**Regex performance comparison:**

| Pattern | Index Used | Performance |
|---------|------------|-------------|
| `/^prefix/` | Yes | Fast |
| `/^prefix/i` | Yes (case-insensitive) | Fast |
| `/suffix$/` | No | Full scan |
| `/contains/` | No | Full scan |
| `/.*pattern.*/` | No | Full scan |

Reference: [Regular Expressions](https://mongodb.com/docs/manual/reference/operator/query/regex/)

---

### 2.4 Batch Operations to Avoid N+1 Queries

Never query in a loop. The N+1 pattern (1 query + N follow-up queries) creates N unnecessary round trips. Use $in or $lookup to batch operations.

**Incorrect (N+1 queries):**

```javascript
// Get orders, then fetch customer for each
const orders = await db.orders.find({ status: "pending" }).toArray()

// N+1 problem: 1 query + 100 queries
for (const order of orders) {
  order.customer = await db.customers.findOne({ _id: order.customerId })
}
// 100 orders = 101 database round trips
// At 5ms per query = 500ms total
```

**Correct (batch with $in):**

```javascript
// Get orders
const orders = await db.orders.find({ status: "pending" }).toArray()

// Batch fetch all customers in one query
const customerIds = orders.map(o => o.customerId)
const customers = await db.customers.find({
  _id: { $in: customerIds }
}).toArray()

// Build lookup map
const customerMap = new Map(customers.map(c => [c._id.toString(), c]))

// Attach to orders
orders.forEach(o => {
  o.customer = customerMap.get(o.customerId.toString())
})
// 100 orders = 2 database round trips = 10ms total
```

**Correct (single query with $lookup):**

```javascript
// All in one aggregation
const ordersWithCustomers = await db.orders.aggregate([
  { $match: { status: "pending" } },
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  { $unwind: "$customer" }
]).toArray()
// 1 round trip, database handles join
```

**Batch inserts:**

```javascript
// Bad: Insert one at a time
for (const doc of documents) {
  await db.items.insertOne(doc)  // N round trips
}

// Good: Batch insert
await db.items.insertMany(documents)  // 1 round trip
```

Reference: [Query Optimization](https://mongodb.com/docs/manual/core/query-optimization/)

---

### 2.5 Use Range-Based Pagination

Avoid skip() for pagination—it scans and discards documents. Use range-based pagination with indexed fields for consistent O(1) performance on any page.

**Incorrect (skip degrades on deep pages):**

```javascript
// Page 1: skip 0, fast
db.posts.find().sort({ createdAt: -1 }).skip(0).limit(20)
// Examines 20 docs

// Page 100: skip 1980, slow
db.posts.find().sort({ createdAt: -1 }).skip(1980).limit(20)
// Examines 2000 docs, discards 1980

// Page 10000: skip 199980, very slow
db.posts.find().sort({ createdAt: -1 }).skip(199980).limit(20)
// Examines 200000 docs, discards 199980
```

**Correct (range-based / cursor pagination):**

```javascript
// Page 1: Get first 20
const page1 = await db.posts.find()
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Store last item's sort value
const lastCreatedAt = page1[page1.length - 1].createdAt

// Page 2: Query from where page 1 left off
const page2 = await db.posts.find({
  createdAt: { $lt: lastCreatedAt }
})
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Always examines only 20 docs, regardless of page number
```

**Handle ties in sort field:**

```javascript
// If createdAt can have duplicates, add _id as tiebreaker
// Index: { createdAt: -1, _id: -1 }

const lastItem = page1[page1.length - 1]

const page2 = await db.posts.find({
  $or: [
    { createdAt: { $lt: lastItem.createdAt } },
    {
      createdAt: lastItem.createdAt,
      _id: { $lt: lastItem._id }
    }
  ]
})
  .sort({ createdAt: -1, _id: -1 })
  .limit(20)
  .toArray()
```

**Performance comparison (10M documents):**

| Page | skip() time | Range time |
|------|-------------|------------|
| 1 | 5ms | 5ms |
| 100 | 200ms | 5ms |
| 10000 | 20s | 5ms |

**When skip() is acceptable:**

- Small collections (<10K docs)
- Users won't paginate deeply
- Random access to any page required

Reference: [Pagination Best Practices](https://mongodb.com/docs/manual/reference/method/cursor.skip/)

---

## 3. Aggregation Optimization

**Impact:** HIGH
**Description:** Aggregation pipelines process data in stages. Stage order and design determine whether MongoDB can use indexes and how much data flows through the pipeline. Early filtering is critical.

### 3.1 Place $match at Pipeline Start

Put $match stages as early as possible in aggregation pipelines. Early filtering reduces the number of documents flowing through subsequent stages and enables index usage.

**Incorrect ($match after expensive operations):**

```javascript
db.orders.aggregate([
  // Process ALL orders first
  {
    $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },

  // Then filter - 10M lookups for 1000 results
  { $match: { status: "completed", "product.category": "electronics" } }
])
```

**Correct ($match first):**

```javascript
db.orders.aggregate([
  // Filter first - uses index on status
  { $match: { status: "completed" } },

  // Now $lookup only on filtered set
  {
    $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },

  // Additional filter after $lookup
  { $match: { "product.category": "electronics" } }
])
// 10K lookups instead of 10M
```

**Split $match for optimization:**

```javascript
// When filtering on both source and looked-up fields:
db.orders.aggregate([
  // Part 1: Filter source collection (uses index)
  { $match: { status: "completed", date: { $gte: lastMonth } } },

  // $lookup
  { $lookup: { from: "customers", ... as: "customer" } },
  { $unwind: "$customer" },

  // Part 2: Filter on joined data (after $lookup)
  { $match: { "customer.tier": "premium" } }
])
```

**Verify index usage:**

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  ...
]).explain("executionStats")

// Check for IXSCAN in first stage, not COLLSCAN
```

Reference: [Aggregation Pipeline Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)

---

### 3.2 Use $project Early to Reduce Document Size

Add $project or $addFields early to drop unnecessary fields. Large documents flowing through multiple stages waste memory and slow processing.

**Incorrect (carrying large documents through pipeline):**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // 500KB articles with full content flowing through
  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    }
  },
  { $unwind: "$author" },
  { $sort: { publishedAt: -1 } },
  { $limit: 10 },
  // Only NOW reducing fields
  { $project: { title: 1, "author.name": 1, publishedAt: 1 } }
])
// Sorted 100KB × 10000 docs in memory
```

**Correct ($project early):**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // Immediately reduce to needed fields
  {
    $project: {
      title: 1,
      authorId: 1,
      publishedAt: 1
      // Dropped: content (100KB), metadata (10KB), etc.
    }
  },
  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author",
      pipeline: [
        { $project: { name: 1 } }  // Also limit lookup result
      ]
    }
  },
  { $unwind: "$author" },
  { $sort: { publishedAt: -1 } },
  { $limit: 10 }
])
// Sorted 500 bytes × 10000 docs in memory
```

**Use $project in $lookup pipeline:**

```javascript
// Limit fields from joined collection
{
  $lookup: {
    from: "comments",
    localField: "_id",
    foreignField: "postId",
    as: "comments",
    pipeline: [
      { $match: { approved: true } },
      { $project: { text: 1, author: 1, createdAt: 1 } },
      { $limit: 5 }
    ]
  }
}
```

**Memory limit awareness:**

```javascript
// Aggregation has 100MB memory limit per stage
// Large documents hit this quickly

// If you must handle large docs, allow disk use:
db.collection.aggregate([...], { allowDiskUse: true })
// But better to $project early and avoid disk
```

Reference: [Aggregation Pipeline Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)

---

### 3.3 Combine $sort with $limit for Top-N Queries

When getting top N results, place $limit immediately after $sort. MongoDB optimizes this pattern to maintain only N documents in memory instead of sorting the entire dataset.

**Incorrect ($sort without $limit or separated):**

```javascript
// Sorts ALL documents in memory
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } }
  // Returns 1M sorted documents
  // Uses 100MB+ memory, may spill to disk
])

// Or: $limit separated by other stages
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $addFields: { rank: "..." } },  // Breaks optimization
  { $limit: 10 }
])
```

**Correct ($limit immediately after $sort):**

```javascript
// Top 10 scores - optimized
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
  // MongoDB only tracks top 10 during sort
  // Uses ~10KB memory regardless of collection size
])

// Add fields AFTER $limit
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 },
  { $addFields: { rank: "top10" } }  // After limit is fine
])
```

**Index-backed sort (even better):**

```javascript
// Create index matching sort
db.scores.createIndex({ gameId: 1, score: -1 })

// Query uses index order - no in-memory sort needed
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
])
// IXSCAN, returns first 10 from index
```

**Verify optimization in explain:**

```javascript
db.scores.aggregate([...]).explain()

// Look for:
// "sortLimitCoalesced": true
// or in-memory sort size matching limit, not collection size
```

Reference: [Sort and Limit Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#sort-limit-coalescence)

---

### 3.4 Index $lookup Foreign Fields

Always create an index on the foreignField in $lookup operations. Without an index, MongoDB performs a collection scan of the foreign collection for every document in the pipeline.

**Incorrect (unindexed foreignField):**

```javascript
// Real problem: joining on non-_id field
db.orders.aggregate([
  {
    $lookup: {
      from: "products",
      localField: "sku",
      foreignField: "sku",  // No index on products.sku
      as: "product"
    }
  }
])
// 10K orders × 100K products = 1B comparisons
```

**Correct (indexed foreignField):**

```javascript
// Create index on foreign collection's join field
db.products.createIndex({ sku: 1 })

// Same $lookup now uses index
db.orders.aggregate([
  {
    $lookup: {
      from: "products",
      localField: "sku",
      foreignField: "sku",  // Now indexed
      as: "product"
    }
  }
])
// 10K orders × O(log n) lookups = fast
```

**Common $lookup patterns needing indexes:**

```javascript
// 1. userId lookups
db.users.createIndex({ id: 1 })  // If not using _id

// 2. Order items to products
db.products.createIndex({ productId: 1 })

// 3. Comments to posts
db.posts.createIndex({ postId: 1 })  // On posts collection

// 4. Events to users
db.users.createIndex({ externalId: 1 })
```

**Verify index usage in $lookup:**

```javascript
db.orders.aggregate([
  {
    $lookup: {
      from: "products",
      localField: "sku",
      foreignField: "sku",
      as: "product"
    }
  }
]).explain("executionStats")

// In explain output, look for IXSCAN in $lookup stage
// Bad: COLLSCAN in foreign collection
// Good: IXSCAN on foreignField index
```

**Optimize $lookup with pipeline:**

```javascript
// Filter and project within $lookup
{
  $lookup: {
    from: "reviews",
    let: { productId: "$_id" },
    pipeline: [
      { $match: { $expr: { $eq: ["$productId", "$$productId"] } } },
      { $match: { rating: { $gte: 4 } } },  // Additional filter
      { $project: { text: 1, rating: 1 } },
      { $limit: 5 }
    ],
    as: "topReviews"
  }
}
// Ensure index: db.reviews.createIndex({ productId: 1, rating: -1 })
```

Reference: [$lookup Aggregation](https://mongodb.com/docs/manual/reference/operator/aggregation/lookup/)

---

### 3.5 Avoid $unwind on Large Arrays

$unwind creates one document per array element. Large arrays explode document count, consuming memory and slowing the pipeline. Filter or limit arrays before unwinding.

**Incorrect ($unwind on large arrays):**

```javascript
// Post with 10,000 comments
{
  _id: "post123",
  title: "Popular Post",
  comments: [/* 10,000 comments */]
}

// Unwind creates 10,000 documents per post
db.posts.aggregate([
  { $match: { _id: "post123" } },
  { $unwind: "$comments" },  // 1 doc → 10,000 docs
  { $group: { _id: "$comments.author", count: { $sum: 1 } } }
])
// 100 posts × 10K comments = 1M documents in memory
```

**Correct (array operations without $unwind):**

```javascript
// Use array operators instead of $unwind
db.posts.aggregate([
  { $match: { _id: "post123" } },
  {
    $project: {
      title: 1,
      commentCount: { $size: "$comments" },
      uniqueAuthors: { $setUnion: "$comments.author" },
      recentComments: { $slice: ["$comments", -5] }
    }
  }
])
// Still 1 document, no explosion
```

**Filter before $unwind:**

```javascript
// If you must $unwind, filter the array first
db.posts.aggregate([
  { $match: { _id: "post123" } },
  {
    $addFields: {
      // Filter to recent comments only
      comments: {
        $filter: {
          input: "$comments",
          cond: { $gte: ["$$this.date", lastWeek] }
        }
      }
    }
  },
  { $unwind: "$comments" },  // Now only unwinding ~100, not 10,000
  { $group: {...} }
])
```

**Limit with $slice before $unwind:**

```javascript
db.posts.aggregate([
  { $match: { featured: true } },
  {
    $addFields: {
      comments: { $slice: ["$comments", 10] }  // Max 10 per post
    }
  },
  { $unwind: "$comments" }  // Bounded: max 10 docs per post
])
```

**When $unwind is acceptable:**

- Small, bounded arrays (<100 elements)
- Arrays filtered/sliced before unwind
- One-time analytics (not production queries)

Reference: [$unwind](https://mongodb.com/docs/manual/reference/operator/aggregation/unwind/)

---

## References

- [MongoDB Indexes](https://mongodb.com/docs/manual/indexes/)
- [Indexing Strategies](https://mongodb.com/docs/manual/applications/indexes/)
- [Analyze Query Performance](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)
- [Aggregation Pipeline Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
- [Atlas Performance Advisor](https://mongodb.com/docs/atlas/performance-advisor/)
- [Performance Best Practices - Indexing](https://mongodb.com/developer/products/mongodb/performance-best-practices-indexing/)
