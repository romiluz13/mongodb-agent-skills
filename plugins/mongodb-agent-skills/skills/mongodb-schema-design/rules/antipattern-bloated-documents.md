---
title: Avoid Bloated Documents
impact: CRITICAL
impactDescription: "10-100× memory efficiency, 50-500ms faster queries"
tags: schema, document-size, anti-pattern, working-set, memory, atlas-suggestion
---

## Avoid Bloated Documents

**Large documents destroy working set efficiency.** MongoDB loads entire documents into RAM, even when queries only need a few fields. A 500KB product document that could be 500 bytes means you fit 1,000× fewer documents in memory—turning cached reads into disk reads and 5ms queries into 500ms nightmares.

**Incorrect (everything in one document):**

```javascript
// Product with full history and all images embedded
// Problem: 665KB loaded into RAM just to show product name and price
{
  _id: "prod123",
  name: "Laptop",           // 10 bytes - what you need
  price: 999,               // 8 bytes - what you need
  description: "...",       // 5KB - rarely needed
  fullSpecs: {...},         // 10KB - rarely needed
  images: [...],            // 500KB base64 - almost never needed
  reviews: [...],           // 100KB - paginated separately
  priceHistory: [...]       // 50KB - analytics only
}
// Total: ~665KB per product
// 1GB RAM = 1,500 products cached (should be 150,000)
```

Every query that touches this collection loads 665KB documents, even `db.products.find({}, {name: 1, price: 1})`.

**Correct (hot data only in main document):**

```javascript
// Product - hot data only (~500 bytes)
// This is what 95% of queries actually need
{
  _id: "prod123",
  name: "Laptop",
  price: 999,
  thumbnail: "https://cdn.example.com/prod123-thumb.jpg",
  avgRating: 4.5,
  reviewCount: 127,
  inStock: true
}
// 1GB RAM = 2,000,000 products cached

// Cold data in separate collections - loaded only when needed
// products_details: { productId, description, fullSpecs }
// products_images: { productId, images: [...] }
// products_reviews: { productId, reviews: [...] }  // paginated

// Product detail page: 2 queries instead of 1, but 100× faster
const product = await db.products.findOne({ _id })           // 0.5KB from cache
const details = await db.products_details.findOne({ productId })  // 15KB
```

Two small queries are faster than one huge query when working set exceeds RAM.

**Alternative (projection when you can't refactor):**

```javascript
// If refactoring isn't possible, always use projection
// Only loads ~500 bytes instead of 665KB
db.products.find(
  { category: "electronics" },
  { name: 1, price: 1, thumbnail: 1 }  // Project only needed fields
)
```

Projection reduces network transfer but still loads full documents into memory.

**When NOT to use this pattern:**

- **Small collections that fit in RAM**: If your entire collection is <1GB, document size matters less.
- **Always need all data**: If every access pattern truly needs the full document, splitting adds overhead.
- **Write-heavy with rare reads**: If you write once and rarely read, optimize for write simplicity.

**Verify with:**

```javascript
// Find your largest documents
db.products.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    name: 1
  }},
  { $sort: { size: -1 } },
  { $limit: 10 }
])
// Red flags: documents > 16KB for frequently-queried collections

// Check working set vs RAM
db.serverStatus().wiredTiger.cache
// "bytes currently in the cache" vs "maximum bytes configured"
// If current > 80% of max, you have working set pressure

// Analyze field sizes
db.products.aggregate([
  { $project: {
    total: { $bsonSize: "$$ROOT" },
    imagesSize: { $bsonSize: { $ifNull: ["$images", {}] } },
    reviewsSize: { $bsonSize: { $ifNull: ["$reviews", {}] } }
  }},
  { $group: {
    _id: null,
    avgTotal: { $avg: "$total" },
    avgImages: { $avg: "$imagesSize" },
    avgReviews: { $avg: "$reviewsSize" }
  }}
])
// Shows which fields are bloating documents
```

Atlas Schema Suggestions flags: "Document size exceeds recommended limit"

---

## ⚠️ Before You Implement

**I recommend reviewing document sizes, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Actual document sizes | May be smaller than expected | See query below |
| Access patterns | If all fields needed, splitting adds overhead | Review queries |
| Working set vs RAM | Small collections may not need optimization | Check cache stats |

**Measure document sizes:**
```javascript
db.collection.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: {
      _id: null,
      avgSize: { $avg: "$size" },
      maxSize: { $max: "$size" },
      count: { $sum: 1 }
  }}
])
```

**Interpretation:**
- ✅ avgSize < 16KB: Documents are reasonably sized.
- ⚠️ avgSize 16KB-100KB: Consider splitting cold data.
- 🔴 avgSize > 100KB: Strong candidate for restructuring.

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__aggregate` - Measure document sizes
- `mcp__mongodb__db-stats` - Check cache pressure

**Just ask:** "Analyze document sizes in my [collection] collection"

---

Reference: [Reduce Bloated Documents](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/bloated-documents/)
