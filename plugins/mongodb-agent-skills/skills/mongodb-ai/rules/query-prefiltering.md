---
title: Pre-Filtering Vector Search
impact: CRITICAL
impactDescription: 10-100x more efficient than post-filtering, better result quality
tags: filter, pre-filter, post-filter, performance
---

## Pre-Filtering Vector Search

Pre-filtering (using `filter` parameter) narrows candidates BEFORE vector comparison. Post-filtering (using $match after) is less efficient and may return fewer results than expected.

**Incorrect (post-filtering):**

```javascript
// WRONG: Post-filtering with $match
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
      // No filter - searches ALL products
    }
  },
  { $match: { category: "electronics" } }  // Filters AFTER
])
// Problem: May return 0-10 results depending on what matched

// WRONG: Expecting exactly 10 results with post-filter
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  { $match: { status: "active", inStock: true } }
])
// Result: Could return 3 documents if only 3 of top 10 match
```

**Correct (pre-filtering):**

```javascript
// CORRECT: Pre-filtering with filter parameter
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: { category: "electronics" }  // Pre-filter: more efficient
    }
  }
])
// Result: Always returns up to 10 electronics products

// CORRECT: Multiple filter conditions
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        $and: [
          { category: "electronics" },
          { status: "active" },
          { price: { $lte: 500 } }
        ]
      }
    }
  }
])
```

**Pre-filter vs Post-filter Comparison:**

| Aspect | Pre-filter | Post-filter |
|--------|------------|-------------|
| Efficiency | High (indexed) | Low (full results) |
| Result Count | Reliable (up to limit) | Variable (0 to limit) |
| Performance | Fast | Slower |
| Fields Required | Must be indexed | Any field |

**Complex Filter Examples:**

```javascript
// Range filter with pre-filtering
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        price: { $gte: 100, $lte: 500 },
        rating: { $gte: 4.0 }
      }
    }
  }
])

// Date range filter
db.articles.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        publishDate: {
          $gte: ISODate("2024-01-01"),
          $lte: ISODate("2024-12-31")
        }
      }
    }
  }
])

// $in filter for multiple values
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        category: { $in: ["electronics", "computers", "phones"] }
      }
    }
  }
])

// $exists filter (November 2025+)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        discount: { $exists: true }  // Only products with discounts
      }
    }
  }
])

// $ne to null filter (September 2025+)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        description: { $ne: null }  // Exclude null descriptions
      }
    }
  }
])

// $not filter (August 2024+)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        status: { $not: { $eq: "discontinued" } }
      }
    }
  }
])
```

**When Post-filtering is Acceptable:**

```javascript
// Post-filter for complex operations not supported in filter
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 50  // Request more to account for post-filter loss
    }
  },
  {
    $match: {
      $expr: { $gt: ["$price", "$costPrice"] }  // Computed field comparison
    }
  },
  { $limit: 10 }
])
```

**Remember: Index filter fields!**

```javascript
// Filter fields must be in index definition
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    { type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" },
    { type: "filter", path: "category" },  // Must index for pre-filtering
    { type: "filter", path: "status" },
    { type: "filter", path: "price" }
  ]
})
```

**When NOT to use this pattern:**

- Filter field not indexed (use post-filter or update index)
- Complex computed filters (use post-filter with larger limit)
- Filtering on nested arrays (not supported in pre-filter)

Reference: [MongoDB $vectorSearch Filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter)
