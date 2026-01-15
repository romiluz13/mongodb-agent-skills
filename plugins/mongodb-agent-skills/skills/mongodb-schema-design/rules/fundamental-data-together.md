---
title: Store Data That's Accessed Together
impact: HIGH
impactDescription: Eliminates network round trips, enables single-document atomicity
tags: schema, embedding, access-patterns, fundamentals, mongodb-philosophy
---

## Store Data That's Accessed Together

MongoDB's core principle: data that is accessed together should be stored together. Design schemas around queries, not entities.

**Incorrect (entity-based design):**

```javascript
// Designed like SQL tables - 3 queries needed
// articles: { _id, title, content, authorId }
// authors: { _id, name, bio }
// article_tags: { articleId, tag }

// Display article page requires 3 queries
const article = await db.articles.findOne({ _id: articleId })
const author = await db.authors.findOne({ _id: article.authorId })
const tags = await db.article_tags.find({ articleId }).toArray()
```

**Correct (query-based design):**

```javascript
// Everything needed for article page in one document
{
  _id: "article123",
  title: "MongoDB Best Practices",
  content: "...",
  author: {
    _id: "auth456",
    name: "Jane Developer",
    avatar: "https://..."
  },
  tags: ["mongodb", "database", "performance"],
  publishedAt: ISODate("2024-01-15"),
  readingTime: 8
}

// Single query returns complete article
const article = await db.articles.findOne({ _id: articleId })
```

**How to identify access patterns:**

1. List all queries your app makes
2. For each query, note which fields are returned
3. Group fields that appear together
4. Design documents to match groups

**Common patterns:**

```javascript
// Product page: embed reviews summary, reference full reviews
{
  _id: "prod123",
  name: "Widget",
  price: 29.99,
  reviewSummary: {
    avgRating: 4.5,
    count: 127,
    recentReviews: [/* top 3 reviews */]
  }
}

// User dashboard: embed counts, reference detailed lists
{
  _id: "user123",
  name: "Alice",
  stats: {
    orderCount: 42,
    totalSpent: 1234.56,
    lastOrderDate: ISODate("...")
  }
}
```

Reference: [Data Modeling Introduction](https://mongodb.com/docs/manual/data-modeling/)
