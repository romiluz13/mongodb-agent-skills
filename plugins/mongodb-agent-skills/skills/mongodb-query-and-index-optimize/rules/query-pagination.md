---
title: Use Range-Based Pagination Instead of skip()
impact: HIGH
impactDescription: "Page 10,000: skip() takes 20 seconds, range-based takes 5ms—O(n) vs O(1)"
tags: query, pagination, skip, cursor, performance, keyset, offset
---

## Use Range-Based Pagination Instead of skip()

**skip() scans and discards documents—it gets slower the deeper you paginate.** Page 1 examines 20 docs; page 10,000 examines 200,000 docs just to discard 199,980. Range-based (keyset) pagination uses indexed field comparisons for O(1) performance on any page. This is why infinite scroll apps stay fast.

**Incorrect (skip degrades linearly with page depth):**

```javascript
// Page 1: skip(0) - fast
db.posts.find().sort({ createdAt: -1 }).skip(0).limit(20)
// Examines: 20 docs, returns: 20 docs
// Time: 5ms ✓

// Page 100: skip(1980) - slower
db.posts.find().sort({ createdAt: -1 }).skip(1980).limit(20)
// Examines: 2,000 docs, discards: 1,980, returns: 20
// Time: 200ms ⚠️

// Page 10,000: skip(199980) - unusable
db.posts.find().sort({ createdAt: -1 }).skip(199980).limit(20)
// Examines: 200,000 docs, discards: 199,980, returns: 20
// Time: 20 seconds ❌

// Why? MongoDB must:
// 1. Start at beginning of index
// 2. Walk through 199,980 entries
// 3. Only THEN return the next 20
// It's O(skip_value) not O(limit)
```

**Correct (range-based / keyset pagination):**

```javascript
// Page 1: Get first page
const page1 = await db.posts
  .find({ status: "published" })
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Remember cursor position
const lastItem = page1[page1.length - 1]
const cursor = lastItem.createdAt

// Page 2: Continue from cursor
const page2 = await db.posts
  .find({
    status: "published",
    createdAt: { $lt: cursor }  // Only docs BEFORE cursor
  })
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Page N: Always the same performance
// Index seeks directly to cursor position
// Examines exactly 20 docs every time
// Time: 5ms regardless of page number
```

**Handle non-unique sort fields (critical for correctness):**

```javascript
// Problem: Multiple posts can have same createdAt
// Result: Some posts get skipped or duplicated

// Solution: Add unique tiebreaker (_id)
// Index must include both fields:
db.posts.createIndex({ createdAt: -1, _id: -1 })

const lastItem = page1[page1.length - 1]

// Compound cursor condition
const page2 = await db.posts.find({
  status: "published",
  $or: [
    // Either strictly before in time
    { createdAt: { $lt: lastItem.createdAt } },
    // Or same time but lower _id
    {
      createdAt: lastItem.createdAt,
      _id: { $lt: lastItem._id }
    }
  ]
})
  .sort({ createdAt: -1, _id: -1 })
  .limit(20)
  .toArray()

// This guarantees: no duplicates, no skips, deterministic order
```

**API design with cursor tokens:**

```javascript
// Encode cursor for API response
function encodeCursor(lastItem) {
  return Buffer.from(JSON.stringify({
    createdAt: lastItem.createdAt,
    _id: lastItem._id
  })).toString("base64")
}

// Decode cursor from request
function decodeCursor(cursorString) {
  return JSON.parse(Buffer.from(cursorString, "base64").toString())
}

// API endpoint
app.get("/api/posts", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)
  const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null

  // Build query
  const query = { status: "published" }
  if (cursor) {
    query.$or = [
      { createdAt: { $lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), _id: { $lt: cursor._id } }
    ]
  }

  const posts = await db.posts
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)  // Fetch one extra to check if more exist
    .toArray()

  const hasMore = posts.length > limit
  const data = hasMore ? posts.slice(0, -1) : posts

  res.json({
    data,
    pagination: {
      hasMore,
      nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null
    }
  })
})

// Client usage:
// GET /api/posts                          → First page
// GET /api/posts?cursor=eyJjcmVhdGVk...   → Next page
```

**Bidirectional pagination (prev/next):**

```javascript
// For "Previous" page, reverse the comparison
async function getPreviousPage(cursor, limit) {
  const posts = await db.posts.find({
    status: "published",
    $or: [
      { createdAt: { $gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $gt: cursor._id } }
    ]
  })
    .sort({ createdAt: 1, _id: 1 })  // Reverse sort
    .limit(limit)
    .toArray()

  return posts.reverse()  // Put back in descending order
}
```

**Performance comparison (10M documents):**

| Page | skip() Time | skip() Docs Examined | Range Time | Range Docs Examined |
|------|-------------|---------------------|------------|---------------------|
| 1 | 5ms | 20 | 5ms | 20 |
| 10 | 10ms | 200 | 5ms | 20 |
| 100 | 200ms | 2,000 | 5ms | 20 |
| 1,000 | 2s | 20,000 | 5ms | 20 |
| 10,000 | 20s | 200,000 | 5ms | 20 |

**When skip() is acceptable:**

- **Small collections**: <10K total documents, skip overhead is negligible.
- **Shallow pagination**: Users never go past page 5-10 (e-commerce search results).
- **Random page access**: Admin UI needs "jump to page 500"—range-based can't do this easily.
- **Consistent snapshot**: Using skip with a snapshot read for data export.

**When NOT to use range-based:**

- **Frequent sort order changes**: If user switches between "newest" and "oldest", cursor is invalidated.
- **Real-time data with high insert rate**: New items between pages may cause duplicates or gaps.
- **Total count needed**: Range-based pagination makes counting total results expensive.

**Verify with:**

```javascript
// Compare pagination methods
async function comparePaginationMethods(collection, pageNumber, pageSize) {
  const skip = (pageNumber - 1) * pageSize

  // Method 1: skip()
  const skipExplain = db[collection]
    .find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .explain("executionStats")

  // Method 2: range-based (simulate cursor at correct position)
  const cursorDoc = await db[collection]
    .find()
    .sort({ createdAt: -1 })
    .skip(skip - 1)
    .limit(1)
    .toArray()

  const rangeExplain = db[collection]
    .find({ createdAt: { $lt: cursorDoc[0]?.createdAt || new Date() } })
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .explain("executionStats")

  print(`\nPage ${pageNumber} (${skip} offset):`)
  print(`  skip() - Docs examined: ${skipExplain.executionStats.totalDocsExamined}`)
  print(`  skip() - Time: ${skipExplain.executionStats.executionTimeMillis}ms`)
  print(`  range  - Docs examined: ${rangeExplain.executionStats.totalDocsExamined}`)
  print(`  range  - Time: ${rangeExplain.executionStats.executionTimeMillis}ms`)
}

// Test at different depths
[1, 10, 100, 1000].forEach(page => {
  comparePaginationMethods("posts", page, 20)
})
```

Reference: [Cursor Methods](https://mongodb.com/docs/manual/reference/method/cursor.skip/)
