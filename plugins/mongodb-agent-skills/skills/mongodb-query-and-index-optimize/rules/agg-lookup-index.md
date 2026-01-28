---
title: Index $lookup Foreign Fields
impact: HIGH
impactDescription: "Unindexed $lookup: 10K × 100K = 1B comparisons (minutes); indexed: 10K × log(100K) = 170K (seconds)"
tags: aggregation, lookup, join, index, foreign-key, performance, nested-lookup
---

## Index $lookup Foreign Fields

**Every $lookup without an index on foreignField does a full collection scan of the foreign collection—for every input document.** If you join 10K orders to 100K products on an unindexed `sku` field, that's 10,000 collection scans × 100,000 documents = 1 billion document comparisons. With an index: 10,000 × log₂(100,000) ≈ 170,000 comparisons. That's 6,000× less work.

**Incorrect (unindexed foreignField—nested collection scans):**

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

---

## ⚠️ Before You Implement

**I recommend indexing the foreignField, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| foreignField is not _id | _id is automatically indexed | Review $lookup definition |
| Index doesn't exist | Avoid duplicates | `db.foreignColl.getIndexes()` |
| Foreign collection size | Small collections may not need | `db.foreignColl.countDocuments()` |

**Check foreign collection index:**
```javascript
const foreignColl = "products"  // your foreign collection
const foreignField = "sku"      // your foreignField
db[foreignColl].getIndexes().forEach(i =>
  print(`${i.name}: ${JSON.stringify(i.key)}`)
)
// Look for index starting with foreignField
```

**Interpretation:**
- ✅ No index on foreignField: Create one
- ⚠️ foreignField is _id: No action needed
- 🔴 Index already exists: No action needed

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check foreign collection indexes
- `mcp__mongodb__count` - Check foreign collection size

**Just ask:** "Verify if my $lookup needs index on [foreignCollection].[foreignField]"

---

Reference: [$lookup Aggregation](https://mongodb.com/docs/manual/reference/operator/aggregation/lookup/)
