---
title: Index $lookup Foreign Fields
impact: HIGH
impactDescription: 100-1000× faster joins on large collections
tags: aggregation, lookup, join, index, foreign-key, performance
---

## Index $lookup Foreign Fields

Always create an index on the foreignField in $lookup operations. Without an index, MongoDB performs a collection scan of the foreign collection for every document in the pipeline.

**Incorrect (unindexed foreignField):**

```javascript
// Orders joined to customers
db.orders.aggregate([
  { $match: { status: "pending" } },
  {
    $lookup: {
      from: "customers",        // 1M customers
      localField: "customerId", // ordersfield
      foreignField: "_id",      // NO INDEX on customers._id? (actually _id is always indexed)
      as: "customer"
    }
  }
])

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
