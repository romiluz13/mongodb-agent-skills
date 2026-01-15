---
title: Use Subset Pattern for Hot/Cold Data
impact: MEDIUM
impactDescription: Reduces working set size, improves cache efficiency
tags: schema, patterns, subset, hot-data, cold-data, working-set
---

## Use Subset Pattern for Hot/Cold Data

Keep frequently-accessed (hot) data in the main document, store rarely-accessed (cold) data in a separate collection. Reduces working set size and improves memory efficiency.

**Incorrect (all data in one document):**

```javascript
// Movie with ALL reviews embedded
{
  _id: "movie123",
  title: "The Matrix",
  year: 1999,
  rating: 8.7,
  plot: "...",
  reviews: [
    // 10,000 reviews, most never read
    { user: "...", rating: 5, text: "...", date: "..." },
    // ... 10KB per review = 100MB document
  ]
}
```

**Correct (subset pattern):**

```javascript
// Movie with only recent/top reviews (hot data)
{
  _id: "movie123",
  title: "The Matrix",
  year: 1999,
  rating: 8.7,
  plot: "...",
  reviewSummary: {
    count: 10000,
    avgRating: 4.2
  },
  topReviews: [
    // Only top 5 featured reviews (~5KB)
    { user: "critic1", rating: 5, text: "Masterpiece", featured: true }
  ]
}

// Full reviews in separate collection (cold data)
{
  _id: "review_xyz",
  movieId: "movie123",
  user: "user456",
  rating: 4,
  text: "Great movie...",
  date: ISODate("2024-01-15"),
  helpful: 42
}
```

**Access patterns:**

```javascript
// Movie page load: single query, small document
db.movies.findOne({ _id: "movie123" })

// User clicks "Show all reviews": separate query
db.reviews.find({ movieId: "movie123" })
  .sort({ helpful: -1 })
  .limit(20)
```

**How to identify hot/cold data:**

| Hot (embed) | Cold (separate) |
|-------------|-----------------|
| Displayed on every page load | Only on user action |
| Used for filtering/sorting | Historical/archival |
| Small size | Large size |
| Few items | Many items |

**Maintenance:**

```javascript
// When new top review comes in, update subset
db.movies.updateOne(
  { _id: "movie123" },
  {
    $push: {
      topReviews: {
        $each: [newTopReview],
        $sort: { helpful: -1 },
        $slice: 5
      }
    },
    $inc: { "reviewSummary.count": 1 }
  }
)
```

Reference: [Building with Patterns - Subset Pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)
