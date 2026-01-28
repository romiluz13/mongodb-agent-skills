---
title: Understand Multikey Indexes for Arrays
impact: HIGH
impactDescription: "Query any element in array fields efficiently—one index entry per array element"
tags: index, multikey, array, elemMatch, tags, categories
---

## Understand Multikey Indexes for Arrays

**Multikey indexes automatically create one index entry per array element, enabling efficient queries on array contents.** When you index a field containing `["tag1", "tag2", "tag3"]`, MongoDB creates three index entries pointing to that document. This makes `find({ tags: "tag2" })` fast. But compound multikey indexes have restrictions you must understand.

**Incorrect (no index on array field—COLLSCAN):**

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

**Correct (multikey index on array field):**

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

**Compound multikey indexes (critical restriction):**

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

**Array of objects (embedded documents):**

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

---

## ⚠️ Before You Implement

**I recommend a multikey index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Array sizes bounded | Large arrays = huge index | See analysis query |
| Only one array in compound | Can't index parallel arrays | Review index fields |
| No existing multikey | Avoid duplicates | `db.collection.getIndexes()` |

**Analyze array sizes:**
```javascript
db.collection.aggregate([
  { $project: { arrSize: { $size: { $ifNull: ["$arrayField", []] } } } },
  { $group: {
      _id: null,
      avgSize: { $avg: "$arrSize" },
      maxSize: { $max: "$arrSize" }
  }}
])
```

**Interpretation:**
- ✅ avgSize < 50, maxSize < 200: Standard multikey index is fine
- ⚠️ avgSize > 100: Large index, monitor size
- 🔴 maxSize > 1000: Very large arrays, consider schema redesign

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing multikey indexes
- `mcp__mongodb__aggregate` - Analyze array sizes

**Just ask:** "Analyze array sizes for [field] on [collection]"

---

Reference: [Multikey Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
