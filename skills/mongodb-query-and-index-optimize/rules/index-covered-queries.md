---
title: Design Indexes for Covered Queries
impact: HIGH
impactDescription: 2-10× faster by avoiding document fetch
tags: index, covered-query, projection, performance, ixscan
---

## Design Indexes for Covered Queries

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
