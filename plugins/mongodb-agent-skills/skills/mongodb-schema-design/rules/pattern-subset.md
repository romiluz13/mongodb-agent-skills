---
title: Use Subset Pattern for Hot/Cold Data
impact: MEDIUM
impactDescription: "10-100× better working set efficiency, fits 100× more documents in RAM"
tags: schema, patterns, subset, hot-data, cold-data, working-set, memory
---

## Use Subset Pattern for Hot/Cold Data

**Keep frequently-accessed (hot) data in the main document, store rarely-accessed (cold) data in a separate collection.** MongoDB loads entire documents into RAM—a 100KB document with 1KB of hot data wastes 99% of your cache. Separating hot/cold data means 100× more useful documents fit in memory.

**Incorrect (all data in one document):**

```javascript
// Movie with ALL reviews embedded
// Hot data: title, rating, plot (~1KB)
// Cold data: 10,000 reviews (~1MB)
{
  _id: "movie123",
  title: "The Matrix",
  year: 1999,
  rating: 8.7,
  plot: "A computer hacker learns about the true nature...",
  reviews: [
    // 10,000 reviews × 100 bytes each = 1MB cold data
    { user: "critic1", rating: 5, text: "Masterpiece...", date: "..." },
    { user: "user42", rating: 4, text: "Great effects...", date: "..." },
    // ... 9,998 more reviews, 95% never read
  ]
}

// Every movie page load pulls 1MB into RAM
// 1GB RAM = 1,000 movies cached
// Most page views only need title + rating + plot
```

**Correct (subset pattern):**

```javascript
// Movie with only hot data (~2KB)
{
  _id: "movie123",
  title: "The Matrix",
  year: 1999,
  rating: 8.7,
  plot: "A computer hacker learns about the true nature...",
  // Summary stats - no full reviews
  reviewStats: {
    count: 10000,
    avgRating: 4.2,
    distribution: { 5: 4000, 4: 3000, 3: 2000, 2: 700, 1: 300 }
  },
  // Only top 5 featured reviews (~500 bytes)
  featuredReviews: [
    { user: "critic1", rating: 5, text: "Masterpiece", featured: true },
    { user: "critic2", rating: 5, text: "Revolutionary", featured: true }
  ]
}
// 1GB RAM = 500,000 movies cached (500× more)

// Cold data: Full reviews in separate collection
{
  _id: ObjectId("..."),
  movieId: "movie123",
  user: "user456",
  rating: 4,
  text: "Great visual effects and deep storyline...",
  date: ISODate("2024-01-15"),
  helpful: 42
}
// Only loaded when user clicks "Show all reviews"
```

**Access patterns:**

```javascript
// Movie page load: single query, small document, likely cached
const movie = db.movies.findOne({ _id: "movie123" })
// Response time: 1-5ms (from RAM)

// User clicks "Show all reviews": separate query, paginated
const reviews = db.reviews
  .find({ movieId: "movie123" })
  .sort({ helpful: -1 })
  .skip(0)
  .limit(20)
// Response time: 10-50ms (acceptable for user action)
```

**Maintaining the subset:**

```javascript
// When new review is added
// 1. Insert full review into reviews collection
db.reviews.insertOne({
  movieId: "movie123",
  user: "newUser",
  rating: 5,
  text: "Amazing!",
  date: new Date(),
  helpful: 0
})

// 2. Update movie stats and maybe featured reviews
db.movies.updateOne(
  { _id: "movie123" },
  {
    $inc: { "reviewStats.count": 1, "reviewStats.distribution.5": 1 },
    // Recalculate avgRating
    $set: { "reviewStats.avgRating": newAvg }
  }
)

// 3. Periodically refresh featured reviews (background job)
const topReviews = db.reviews
  .find({ movieId: "movie123" })
  .sort({ helpful: -1 })
  .limit(5)
  .toArray()

db.movies.updateOne(
  { _id: "movie123" },
  { $set: { featuredReviews: topReviews } }
)
```

**How to identify hot vs cold data:**

| Hot Data (embed) | Cold Data (separate) |
|------------------|----------------------|
| Displayed on every page load | Only on user action (click, scroll) |
| Used for filtering/sorting | Historical/archival |
| Small size (<1KB per field) | Large size (>10KB) |
| Few items (<10) | Many items (>100) |
| Changes rarely | Changes frequently |

**When NOT to use this pattern:**

- **Small documents**: If total document is <16KB, subset pattern adds complexity without benefit.
- **Always need all data**: If 90% of requests need full reviews, separation hurts.
- **Write-heavy cold data**: If reviews are written 100× more than read, keeping them embedded may simplify writes.

**Verify with:**

```javascript
// Find documents with hot/cold imbalance
db.movies.aggregate([
  { $project: {
    totalSize: { $bsonSize: "$$ROOT" },
    reviewsSize: { $bsonSize: { $ifNull: ["$reviews", []] } },
    hotSize: { $subtract: [
      { $bsonSize: "$$ROOT" },
      { $bsonSize: { $ifNull: ["$reviews", []] } }
    ]}
  }},
  { $match: {
    $expr: { $gt: ["$reviewsSize", { $multiply: ["$hotSize", 10] }] }
  }},  // Cold data > 10× hot data
  { $limit: 10 }
])

// Check working set efficiency
db.serverStatus().wiredTiger.cache
// "bytes currently in the cache" vs "maximum bytes configured"
// If near max, subset pattern will help significantly
```

---

## ⚠️ Before You Implement

**I recommend the subset pattern, but please verify your access patterns first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Hot vs cold data ratio | Subset only helps if cold data is >10x hot data | Measure field sizes separately |
| Access frequency | Confirm cold data is rarely accessed | Check application query patterns |
| Update patterns | Subset requires maintaining summary data | Review how often cold data changes |
| Working set pressure | Pattern most valuable when RAM is constrained | Check cache hit ratio |

**Verification query:**
```javascript
// Analyze hot vs cold data distribution
db.collection.aggregate([
  { $sample: { size: 100 } },
  { $project: {
      totalSize: { $bsonSize: "$$ROOT" },
      // Replace 'coldField' with your suspected cold array field
      coldFieldSize: { $bsonSize: { $ifNull: ["$coldField", []] } },
      coldFieldCount: { $size: { $ifNull: ["$coldField", []] } }
  }},
  { $group: {
      _id: null,
      avgTotal: { $avg: "$totalSize" },
      avgCold: { $avg: "$coldFieldSize" },
      avgColdCount: { $avg: "$coldFieldCount" },
      maxColdCount: { $max: "$coldFieldCount" }
  }},
  { $project: {
      avgTotalKB: { $divide: ["$avgTotal", 1024] },
      avgColdKB: { $divide: ["$avgCold", 1024] },
      coldPercentage: { $multiply: [{ $divide: ["$avgCold", "$avgTotal"] }, 100] },
      avgColdCount: 1,
      maxColdCount: 1
  }}
])
```

**Interpretation:**
- ✅ Cold >80% of document size: Subset pattern will significantly help
- ⚠️ Cold 50-80%: Moderate benefit, consider complexity tradeoff
- 🔴 Cold <50%: Subset pattern adds complexity with limited benefit

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-schema` - Identify candidate cold data arrays
- `mcp__mongodb__aggregate` - Measure hot vs cold data sizes
- `mcp__mongodb__collection-storage-size` - Check overall collection size
- `mcp__mongodb__db-stats` - Analyze working set and cache pressure

**Just ask:** "Can you analyze my collection to see if the subset pattern would help?"

---

Reference: [Building with Patterns - Subset Pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)
