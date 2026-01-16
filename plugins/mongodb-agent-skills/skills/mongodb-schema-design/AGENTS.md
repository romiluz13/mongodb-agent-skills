# MongoDB Schema Design Best Practices

**Version 2.0.0**
MongoDB
January 2025

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or reviewing MongoDB schemas and queries. Humans may also
> find it useful, but guidance here is optimized for automation and
> consistency by AI-assisted workflows.

---

## Abstract

MongoDB schema design patterns and anti-patterns for AI agents and developers. Contains 23 rules across 5 categories: Schema Anti-Patterns (CRITICAL - unbounded arrays, bloated documents, schema drift), Schema Fundamentals (HIGH - embed vs reference, document model, 16MB awareness), Relationship Patterns (HIGH - one-to-one, one-to-few, one-to-many, many-to-many, tree structures), Design Patterns (MEDIUM - bucket, computed, subset, outlier, extended reference), and Schema Validation (MEDIUM - JSON Schema, validation levels). Each rule includes incorrect/correct code examples with quantified impact metrics, 'When NOT to use' exceptions, and verification diagnostics.

---

## Table of Contents

1. [Schema Anti-Patterns](#1-schema-anti-patterns) — **CRITICAL**
   - 1.1 [Avoid Bloated Documents](#11-avoid-bloated-documents)
   - 1.2 [Avoid Unbounded Arrays](#12-avoid-unbounded-arrays)
   - 1.3 [Limit Array Size](#13-limit-array-size)
   - 1.4 [Prevent Schema Drift](#14-prevent-schema-drift)
   - 1.5 [Reduce Excessive $lookup Usage](#15-reduce-excessive-lookup-usage)
   - 1.6 [Reduce Unnecessary Collections](#16-reduce-unnecessary-collections)
2. [Schema Fundamentals](#2-schema-fundamentals) — **HIGH**
   - 2.1 [Embed vs Reference Decision Framework](#21-embed-vs-reference-decision-framework)
   - 2.2 [Embrace the Document Model](#22-embrace-the-document-model)
   - 2.3 [Respect the 16MB Document Limit](#23-respect-the-16mb-document-limit)
   - 2.4 [Store Data That's Accessed Together](#24-store-data-thats-accessed-together)
   - 2.5 [Use Schema Validation](#25-use-schema-validation)
3. [Relationship Patterns](#3-relationship-patterns) — **HIGH**
   - 3.1 [Model Many-to-Many Relationships](#31-model-many-to-many-relationships)
   - 3.2 [Model One-to-Few Relationships with Embedded Arrays](#32-model-one-to-few-relationships-with-embedded-arrays)
   - 3.3 [Model One-to-Many Relationships with References](#33-model-one-to-many-relationships-with-references)
   - 3.4 [Model One-to-One Relationships with Embedding](#34-model-one-to-one-relationships-with-embedding)
   - 3.5 [Model Tree and Hierarchical Data](#35-model-tree-and-hierarchical-data)
4. [Design Patterns](#4-design-patterns) — **MEDIUM**
   - 4.1 [Use Bucket Pattern for Time-Series Data](#41-use-bucket-pattern-for-time-series-data)
   - 4.2 [Use Computed Pattern for Expensive Calculations](#42-use-computed-pattern-for-expensive-calculations)
   - 4.3 [Use Extended Reference Pattern](#43-use-extended-reference-pattern)
   - 4.4 [Use Outlier Pattern for Exceptional Documents](#44-use-outlier-pattern-for-exceptional-documents)
   - 4.5 [Use Subset Pattern for Hot/Cold Data](#45-use-subset-pattern-for-hotcold-data)
5. [Schema Validation](#5-schema-validation) — **MEDIUM**
   - 5.1 [Choose Validation Level and Action Appropriately](#51-choose-validation-level-and-action-appropriately)
   - 5.2 [Define Validation Rules with JSON Schema](#52-define-validation-rules-with-json-schema)

---

## 1. Schema Anti-Patterns

**Impact: CRITICAL**

Anti-patterns are the #1 cause of MongoDB production outages. A single unbounded array will crash your application when documents hit the 16MB BSON limit—we've seen this take down production systems handling millions of users at 3 AM. Bloated documents exhaust RAM, forcing MongoDB to page to disk and turning 5ms queries into 500ms nightmares. Atlas Performance Advisor and Compass flag these automatically, but catching them during development saves painful zero-downtime migrations. Every pattern in this section represents real production incidents we've seen repeatedly.

### 1.1 Avoid Bloated Documents

**Impact: CRITICAL (10-100× memory efficiency, 50-500ms faster queries)**

**Large documents destroy working set efficiency.** MongoDB loads entire documents into RAM, even when queries only need a few fields. A 500KB product document that could be 500 bytes means you fit 1,000× fewer documents in memory—turning cached reads into disk reads and 5ms queries into 500ms nightmares.

**Incorrect: everything in one document**

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

**Correct: hot data only in main document**

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

**Alternative: projection when you can't refactor**

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

Reference: [https://mongodb.com/docs/manual/data-modeling/design-antipatterns/bloated-documents/](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/bloated-documents/)

### 1.2 Avoid Unbounded Arrays

**Impact: CRITICAL (Prevents 16MB document crashes and 10-100× write performance degradation)**

**Unbounded arrays are the #1 cause of MongoDB production outages.** When arrays grow indefinitely, documents approach the 16MB BSON limit and eventually crash your application. Even before hitting the limit, large arrays cause 10-100× slower updates because MongoDB must rewrite the entire document and potentially relocate it on disk.

**Incorrect: array grows forever**

```javascript
// User document with unbounded activity log
// Problem: After 1 year, this array has 100,000+ entries
// Impact: Document size ~15MB, updates take 500ms+, approaching crash
{
  _id: "user123",
  name: "Alice",
  activityLog: [
    { action: "login", ts: ISODate("2024-01-01") },
    { action: "purchase", ts: ISODate("2024-01-02") },
    // ... grows to 100,000+ entries over time
    // Each entry ~150 bytes × 100,000 = 15MB
  ]
}
```

Every update to this document rewrites the entire 15MB, causing 500ms+ latency and potential timeouts. When it hits 16MB, all writes fail permanently.

**Correct: separate collection with reference**

```javascript
// User document (bounded, ~200 bytes)
{ _id: "user123", name: "Alice", lastActivity: ISODate("2024-01-02") }

// Activity in separate collection (one document per event)
// Each document ~150 bytes, independent writes, no size limits
{ userId: "user123", action: "login", ts: ISODate("2024-01-01") }
{ userId: "user123", action: "purchase", ts: ISODate("2024-01-02") }

// Query recent activity with index on {userId, ts}
db.activities.find({ userId: "user123" }).sort({ ts: -1 }).limit(10)
```

Each activity is an independent document. Writes are O(1), queries use indexes, no size limits.

**Alternative: bucket pattern for time-series**

```javascript
// Activity bucket - one document per user per day
// Bounded to ~24 hours of activity, typically <100 entries
{
  userId: "user123",
  date: ISODate("2024-01-01"),
  activities: [
    { action: "login", ts: ISODate("2024-01-01T09:00:00Z") },
    { action: "purchase", ts: ISODate("2024-01-01T14:30:00Z") }
  ],
  count: 2  // Denormalized for efficient queries
}

// Query: find today's activity
db.activityBuckets.findOne({
  userId: "user123",
  date: ISODate("2024-01-01")
})
```

Bucket pattern reduces document count 10-100× while keeping arrays bounded by time window.

**When NOT to use this pattern:**

- **Truly bounded arrays are fine**: Tags (max 20), roles (max 5), shipping addresses (max 10). If you can enforce a hard limit, embedding is appropriate.

- **Low-volume applications**: If a user generates <100 events total lifetime, an embedded array may be simpler than a separate collection.

- **Read-heavy with rare writes**: If you read the full array constantly but rarely add to it, embedding avoids $lookup overhead.

**Verify with:**

```javascript
// Check document sizes in collection
db.users.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    arrayLength: { $size: { $ifNull: ["$activityLog", []] } }
  }},
  { $sort: { size: -1 } },
  { $limit: 10 }
])
// Red flags: size > 1MB or arrayLength > 1000

// Check for arrays that could grow unbounded
db.users.aggregate([
  { $match: { "activityLog.999": { $exists: true } } },
  { $count: "documentsWithLargeArrays" }
])
// Any result > 0 indicates unbounded growth
```

Atlas Schema Suggestions flags: "Array field 'activityLog' may grow without bound"

Reference: [https://mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/)

### 1.3 Limit Array Size

**Impact: CRITICAL (Prevents O(n) operations, 10-100× write improvement for large arrays)**

**Arrays over 1,000 elements cause severe performance issues.** Every array modification requires rewriting the entire array—adding a comment to a 5,000-element array rewrites 2.5MB. Multikey indexes on large arrays consume 1000× more memory and slow every write. This is different from unbounded arrays: even bounded arrays can be too large.

**Incorrect: large embedded arrays**

```javascript
// Blog post with all comments embedded
// Problem: Each $push rewrites the entire 2.5MB array
{
  _id: "post123",
  title: "Popular Post",
  comments: [
    // 5,000 comments, each ~500 bytes = 2.5MB
    { author: "user1", text: "Great post!", ts: ISODate("...") },
    // ... 4,999 more
  ]
}

// Adding one comment rewrites 2.5MB on disk
// If you have an index on comments.author, that's 5,000 index entries
db.posts.updateOne(
  { _id: "post123" },
  { $push: { comments: newComment } }
)
// Write time: 200-500ms, locks document during write
```

**Correct: bounded array + overflow collection**

```javascript
// Post with only recent comments (hard limit: 20)
{
  _id: "post123",
  title: "Popular Post",
  recentComments: [/* last 20 comments only, ~10KB */],
  commentCount: 5000
}

// All comments in separate collection
// Each comment is an independent document
{
  _id: ObjectId("..."),
  postId: "post123",
  author: "user1",
  text: "Great post!",
  ts: ISODate("2024-01-15")
}

// Add comment: atomic update with $slice keeps array bounded
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: {
      recentComments: {
        $each: [newComment],
        $slice: -20,        // Keep only last 20
        $sort: { ts: -1 }   // Most recent first
      }
    },
    $inc: { commentCount: 1 }
  }
)
// Simultaneously insert into comments collection
db.comments.insertOne({ postId: "post123", ...newComment })
// Write time: <5ms
```

**Alternative: $slice without separate collection**

```javascript
// For simpler cases where you only ever need recent items
// Keep last 100 items, discard older automatically
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: {
      activityLog: {
        $each: [newActivity],
        $slice: -100  // Hard cap at 100 elements
      }
    }
  }
)
```

**Thresholds:**

| Array Size | Recommendation | Rationale |

|------------|----------------|-----------|

| <100 elements | Safe to embed | Negligible overhead |

| 100-500 elements | Use $slice, monitor | May need refactoring |

| 500-1000 elements | Plan migration | Performance degradation starts |

| >1000 elements | Separate collection | Unacceptable write times |

**When NOT to use this pattern:**

- **Write-once arrays**: If you build the array once and never modify, size matters less (still affects working set).

- **Arrays of primitives**: `tags: ["a", "b", "c"]` is much cheaper than array of objects.

- **Infrequent writes**: If array is updated once per day, 200ms writes may be acceptable.

**Verify with:**

```javascript
// Find documents with large arrays
db.posts.aggregate([
  { $project: {
    title: 1,
    commentsCount: { $size: { $ifNull: ["$comments", []] } }
  }},
  { $match: { commentsCount: { $gt: 100 } } },
  { $sort: { commentsCount: -1 } },
  { $limit: 10 }
])
// Red flags: any document with >1000 array elements

// Check multikey index size vs document count
db.posts.stats().indexSizes
// If "comments.author_1" is 100× larger than "_id", arrays are too big

// Profile write times for array updates
db.setProfilingLevel(1, { slowms: 100 })
// Then check db.system.profile for slow $push operations
```

Reference: [https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)

### 1.4 Prevent Schema Drift

**Impact: CRITICAL (Prevents application crashes, data corruption, and query failures from inconsistent schemas)**

**Schema drift—when documents in the same collection have inconsistent structures—causes application crashes and silent data corruption.** MongoDB's flexibility is a feature, but undisciplined field additions lead to code that must handle every possible shape. Use schema validation to prevent drift before it happens.

**Incorrect: uncontrolled schema drift**

```javascript
// Over time, different versions of "user" documents accumulate
// Version 1 (2020)
{ _id: 1, name: "Alice", email: "alice@ex.com" }

// Version 2 (2021) - added phone
{ _id: 2, name: "Bob", email: "bob@ex.com", phone: "555-1234" }

// Version 3 (2022) - restructured name
{ _id: 3, firstName: "Carol", lastName: "Smith", email: "carol@ex.com" }

// Version 4 (2023) - email is now array
{ _id: 4, firstName: "Dave", lastName: "Jones", emails: ["dave@ex.com", "d@work.com"] }

// Application code becomes defensive nightmare
function getUserEmail(user) {
  if (user.email) return user.email
  if (user.emails) return user.emails[0]
  throw new Error("No email found")  // Crashes on some documents
}

// Queries fail silently
db.users.find({ email: "test@ex.com" })  // Misses users with emails[] array
```

**Correct: controlled schema with validation**

```javascript
// Define and enforce consistent schema
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "profile"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        profile: {
          bsonType: "object",
          required: ["firstName", "lastName"],
          properties: {
            firstName: { bsonType: "string", minLength: 1 },
            lastName: { bsonType: "string", minLength: 1 }
          }
        },
        phones: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        schemaVersion: {
          bsonType: "int",
          enum: [1]  // Current version
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// All documents now have consistent structure
{
  _id: 1,
  email: "alice@example.com",
  profile: { firstName: "Alice", lastName: "Smith" },
  phones: ["555-1234"],
  schemaVersion: 1
}
```

**Schema versioning for migrations:**

```javascript
// Include version in documents
{
  _id: 1,
  schemaVersion: 2,
  email: "alice@example.com",
  profile: { firstName: "Alice", lastName: "Smith" }
}

// Migration script for version upgrades
db.users.find({ schemaVersion: 1 }).forEach(user => {
  db.users.updateOne(
    { _id: user._id },
    {
      $set: {
        profile: {
          firstName: user.name.split(" ")[0],
          lastName: user.name.split(" ").slice(1).join(" ")
        },
        schemaVersion: 2
      },
      $unset: { name: "" }
    }
  )
})

// Validation accepts both during migration
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      properties: {
        schemaVersion: { enum: [1, 2] }  // Accept both during migration
      }
    }
  },
  validationLevel: "moderate"  // Don't block existing invalid docs
})
```

**Detecting existing schema drift:**

```javascript
// Find all unique field combinations
db.users.aggregate([
  { $project: { fields: { $objectToArray: "$$ROOT" } } },
  { $project: { keys: "$fields.k" } },
  { $group: { _id: "$keys", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
// Multiple results = schema drift exists

// Find documents missing required fields
db.users.find({
  $or: [
    { email: { $exists: false } },
    { profile: { $exists: false } },
    { "profile.firstName": { $exists: false } }
  ]
})

// Find documents with wrong types
db.users.find({
  $or: [
    { email: { $not: { $type: "string" } } },
    { phones: { $exists: true, $not: { $type: "array" } } }
  ]
})
```

**Common causes of schema drift:**

| Cause | Prevention |

|-------|------------|

| Feature additions without migration | Use schema validation, version fields |

| Multiple app versions writing | Coordinate deployments, use validation |

| Direct database edits | Restrict write access, audit logs |

| Import from external sources | Validate before insert, ETL pipeline |

| Optional fields proliferating | Define allowed fields in schema |

**When NOT to strictly enforce schema:**

- **Truly polymorphic data**: Event logs with different event types may need flexible schemas.

- **Early prototyping**: Skip validation during exploration, add before production.

- **User-defined fields**: Some applications allow custom metadata fields.

**Verify with:**

```javascript
// Check if validation exists
db.getCollectionInfos({ name: "users" })[0].options.validator
// Empty = no validation, drift likely

// Sample documents to detect drift
db.users.aggregate([
  { $sample: { size: 100 } },
  { $project: { fieldTypes: {
    $map: {
      input: { $objectToArray: "$$ROOT" },
      as: "f",
      in: { k: "$$f.k", t: { $type: "$$f.v" } }
    }
  }}}
])

// Count documents failing validation (if validation exists)
db.runCommand({
  validate: "users",
  full: true
})
```

Reference: [https://mongodb.com/docs/manual/core/schema-validation/](https://mongodb.com/docs/manual/core/schema-validation/)

### 1.5 Reduce Excessive $lookup Usage

**Impact: CRITICAL (5-50× faster queries by eliminating joins, O(n×m) → O(n))**

**Frequent $lookup operations mean your schema is over-normalized.** Each $lookup executes a separate query against another collection—without an index on the foreign field, it's a nested collection scan with O(n×m) complexity. If you're always joining the same data, the answer is denormalization, not more indexes.

**Incorrect: constant $lookup for common operations**

```javascript
// Every product page requires 3 collection scans
db.products.aggregate([
  { $match: { _id: productId } },
  { $lookup: {
      from: "categories",          // Collection scan #2
      localField: "categoryId",
      foreignField: "_id",
      as: "category"
  }},
  { $lookup: {
      from: "brands",              // Collection scan #3
      localField: "brandId",
      foreignField: "_id",
      as: "brand"
  }},
  { $unwind: "$category" },
  { $unwind: "$brand" }
])
// 3 queries, 3× network round-trips, 3× query planning overhead
// With 100K products: 100K × 3 = 300K operations for listing page
```

Even with indexes, $lookup adds 2-10ms per join. On a listing page with 50 products, that's 100-500ms just for joins.

**Correct: denormalize frequently-joined data**

```javascript
// Embed data that's always displayed with product
{
  _id: "prod123",
  name: "Laptop Pro",
  price: 1299,
  // Denormalized from categories collection
  category: {
    _id: "cat-electronics",
    name: "Electronics",
    path: "Electronics > Computers > Laptops"
  },
  // Denormalized from brands collection
  brand: {
    _id: "brand-acme",
    name: "Acme Corp",
    logo: "https://cdn.example.com/acme.png"
  }
}

// Single indexed query, no $lookup needed
db.products.findOne({ _id: "prod123" })
// Or listing: 50 products in single query, <5ms total
db.products.find({ "category._id": "cat-electronics" }).limit(50)
```

**Managing denormalized data updates:**

```javascript
// When category name changes (rare), update all products
// Use bulkWrite for efficiency on large updates
db.products.updateMany(
  { "category._id": "cat-electronics" },
  { $set: {
    "category.name": "Consumer Electronics",
    "category.path": "Consumer Electronics > Computers > Laptops"
  }}
)

// For frequently-changing data, keep reference + cache summary
{
  _id: "prod123",
  brandId: "brand-acme",          // Reference for updates
  brandCache: {                    // Denormalized for reads
    name: "Acme Corp",
    cachedAt: ISODate("...")
  }
}
```

**Alternative: $lookup with index for rare joins**

```javascript
// When you must $lookup, ensure foreign field is indexed
db.categories.createIndex({ _id: 1 })  // Already exists
db.brands.createIndex({ _id: 1 })       // Already exists

// For non-_id lookups, create explicit index
db.reviews.createIndex({ productId: 1 })  // Critical for $lookup

// Use pipeline $lookup for filtered joins
db.products.aggregate([
  { $match: { _id: productId } },
  { $lookup: {
      from: "reviews",
      let: { pid: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$productId", "$$pid"] } } },
        { $sort: { rating: -1 } },
        { $limit: 5 }  // Only top 5 reviews
      ],
      as: "topReviews"
  }}
])
```

**When NOT to use this pattern:**

- **Data changes frequently and independently**: If brand logos change daily, denormalization creates update overhead.

- **Rarely-accessed data**: Don't embed review details if only 5% of product views load reviews.

- **Many-to-many with high cardinality**: Products with 1000+ categories shouldn't embed all category data.

- **Analytics queries**: Batch jobs can afford $lookup latency; real-time queries cannot.

**Verify with:**

```javascript
// Find pipelines with multiple $lookup stages
// Check slow query log for aggregations
db.setProfilingLevel(1, { slowms: 50 })
db.system.profile.find({
  "command.aggregate": { $exists: true },
  "command.pipeline": {
    $elemMatch: { "$lookup": { $exists: true } }
  }
}).sort({ millis: -1 })

// Check if $lookup foreign fields are indexed
db.reviews.aggregate([
  { $indexStats: {} }
])
// Look for "productId_1" with high ops - good
// Missing index = every $lookup is a collection scan

// Measure $lookup impact
db.products.aggregate([
  { $match: { category: "electronics" } },
  { $lookup: { from: "brands", localField: "brandId", foreignField: "_id", as: "brand" } }
]).explain("executionStats")
// Check totalDocsExamined in $lookup stage
```

Atlas Schema Suggestions flags: "Reduce $lookup operations"

Reference: [https://mongodb.com/docs/manual/data-modeling/design-antipatterns/reduce-lookup-operations/](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/reduce-lookup-operations/)

### 1.6 Reduce Unnecessary Collections

**Impact: CRITICAL (5-10× faster reads by eliminating joins, single query returns complete data)**

**Too many collections is the most common mistake when migrating from SQL.** Each additional collection requires a separate query or $lookup, adding network round-trips and query planning overhead. MongoDB's document model lets you embed related data and return complete objects in a single read—use it.

**Incorrect: SQL-style normalization**

```javascript
// 5 collections for one order - relational thinking in MongoDB
// orders: { _id, customerId, date, status }
// order_items: { orderId, productId, quantity, price }
// products: { _id, name, sku }
// customers: { _id, name, email }
// addresses: { customerId, street, city }

// Displaying one order requires 5 queries or complex $lookup chain
db.orders.aggregate([
  { $match: { _id: orderId } },
  { $lookup: { from: "order_items", localField: "_id", foreignField: "orderId", as: "items" } },
  { $unwind: "$items" },
  { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "items.product" } },
  { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } },
  { $lookup: { from: "addresses", localField: "customerId", foreignField: "customerId", as: "address" } }
])
// 5 collection scans, O(n×m×p×q×r) complexity
// Response time: 50-500ms depending on data size
```

**Correct: embedded document model**

```javascript
// Single document contains everything needed for order operations
{
  _id: "order123",
  date: ISODate("2024-01-15"),
  status: "shipped",
  // Customer snapshot at time of order (won't change)
  customer: {
    _id: "cust456",
    name: "Alice Smith",
    email: "alice@example.com"
  },
  // Address at time of order (historical accuracy)
  shippingAddress: {
    street: "123 Main St",
    city: "Boston",
    state: "MA",
    zip: "02101"
  },
  // Line items with product snapshot (price at time of order)
  items: [
    {
      sku: "LAPTOP-01",
      name: "Laptop Pro",  // Snapshot, won't change if product renamed
      quantity: 1,
      unitPrice: 999,
      lineTotal: 999
    },
    {
      sku: "MOUSE-02",
      name: "Wireless Mouse",
      quantity: 2,
      unitPrice: 29,
      lineTotal: 58
    }
  ],
  subtotal: 1057,
  tax: 84.56,
  total: 1141.56
}

// One query returns complete order - no joins needed
db.orders.findOne({ _id: "order123" })
// Response time: <5ms
```

This isn't denormalization—it's proper document modeling. Orders are self-contained entities; the embedded data is a snapshot that shouldn't change.

**Alternative: hybrid for reusable entities**

```javascript
// Keep products as separate collection (catalog changes independently)
// But embed product snapshot in order (historical accuracy)
{
  _id: "order123",
  items: [{
    productId: "prod789",        // Reference for inventory updates
    productSnapshot: {           // Embedded for historical record
      name: "Laptop Pro",
      sku: "LAPTOP-01",
      priceAtPurchase: 999
    },
    quantity: 1
  }]
}

// Current product details from products collection
// Order history from embedded snapshot
```

**When to use separate collections:**

| Scenario | Separate Collection | Why |

|----------|--------------------|----|

| Data accessed independently | Yes | User profiles vs. user orders |

| Different update frequencies | Yes | Product catalog vs. orders |

| Unbounded relationships | Yes | Comments on posts |

| Many-to-many | Yes | Students ↔ Courses |

| Shared across entities | Yes | Tags, categories |

| Historical snapshots | No (embed) | Order contains customer at time of purchase |

| 1:1 always together | No (embed) | User and profile |

**When NOT to use this pattern:**

- **Data is genuinely independent**: Products exist separately from orders; don't embed full product catalog in every order.

- **Frequent independent updates**: If customer email changes shouldn't update all historical orders (it shouldn't).

- **Data is accessed in different contexts**: Same address entity used for shipping, billing, user profile—keep it separate.

- **Regulatory requirements**: Some industries require normalized data for audit trails.

**Verify with:**

```javascript
// Count your collections
db.adminCommand({ listDatabases: 1 }).databases
  .forEach(d => {
    const colls = db.getSiblingDB(d.name).getCollectionNames().length
    print(`${d.name}: ${colls} collections`)
  })
// Red flag: 20+ collections for a simple application

// Find $lookup-heavy aggregations
db.setProfilingLevel(1, { slowms: 20 })
db.system.profile.find({
  "command.pipeline.0.$lookup": { $exists: true }
}).count()
// High count = over-normalized schema

// Check if collections are always accessed together
// If orders always needs customer, items, addresses
// → they should be embedded
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: { _id: "$ns", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
// Collections with similar access patterns should be combined
```

Atlas Schema Suggestions flags: "Reduce number of collections"

Reference: [https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)

---

## 2. Schema Fundamentals

**Impact: HIGH**

Get fundamentals wrong, and you'll spend months planning a migration. Get them right, and your schema scales from prototype to production without changes. The document model is fundamentally different from relational—"data that is accessed together should be stored together" means you can eliminate joins entirely and return complete objects in single reads. But embed vs. reference decisions are permanent: embedded documents can't be queried independently, and references require additional round-trips. These rules determine whether your application needs 1 query or 10 to render a page.

### 2.1 Embed vs Reference Decision Framework

**Impact: HIGH (Determines query patterns for lifetime of application—wrong choice costs 2-10× performance)**

**This is the most important schema decision you'll make.** Choose embedding or referencing based on access patterns, not entity relationships. Getting this wrong means living with 2-10× slower queries or painful migrations later.

**Embed when:**

- Data is always accessed together (1:1 or 1:few relationships)

- Child data doesn't make sense without parent

- Updates to both happen atomically

- Child array is bounded (typically <100 elements)

**Reference when:**

- Data is accessed independently

- Many-to-many relationships exist

- Child data is large (>16KB each) or array is unbounded

- Different update frequencies

**Incorrect: reference when should embed**

```javascript
// User with embedded profile - single document
// Always consistent, always atomic
{
  _id: "user123",
  email: "alice@example.com",
  profile: {
    name: "Alice Smith",
    avatar: "https://cdn.example.com/alice.jpg",
    bio: "Software developer"
  },
  createdAt: ISODate("2024-01-01")
}

// Single query returns everything
const user = await db.users.findOne({ _id: userId })
// Atomic updates - profile can't exist without user
db.users.updateOne(
  { _id: userId },
  { $set: { "profile.name": "Alice Johnson" } }
)
```

**Correct (embed 1:1 data):**

**Incorrect: embed when should reference**

```javascript
// Blog post with ALL comments embedded - unbounded!
{
  _id: "post123",
  title: "Popular Post",
  comments: [
    // 50,000 comments × 500 bytes = 25MB document
    // Exceeds 16MB BSON limit - APPLICATION CRASH
    { author: "user1", text: "...", ts: ISODate("...") },
    // ... grows forever
  ]
}
```

**Correct: reference unbounded data**

```javascript
// Post with comment summary embedded
{
  _id: "post123",
  title: "Popular Post",
  commentCount: 50000,
  recentComments: [/* last 5 only - bounded */]
}

// Comments in separate collection - no limit
{
  _id: ObjectId("..."),
  postId: "post123",
  author: "user1",
  text: "Great post!",
  ts: ISODate("2024-01-15")
}
// Index on postId for efficient lookups
```

**Decision Matrix:**

| Relationship | Read Pattern | Write Pattern | Bounded? | Decision |

|--------------|--------------|---------------|----------|----------|

| User → Profile | Always together | Together | Yes (1) | **Embed** |

| Order → Items | Always together | Together | Yes (<50) | **Embed** |

| Post → Comments | Together on load | Separate adds | No (unbounded) | **Reference** |

| Author → Books | Separately | Separate | No (could be 100+) | **Reference** |

| Product ↔ Category | Either way | Either | N/A (many-to-many) | **Reference both ways** |

**When NOT to use embedding:**

- **Data grows unbounded**: Comments, logs, events—separate collection.

- **Large child documents**: If each child is >16KB, embedding few hits 16MB limit.

- **Independent access**: If you ever query child without parent, reference.

- **Different lifecycles**: If child data is archived/deleted separately.

**Verify with:**

```javascript
// Check document sizes for embedded collections
db.posts.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    commentCount: { $size: { $ifNull: ["$comments", []] } }
  }},
  { $match: { size: { $gt: 1000000 } } }  // >1MB
])
// Any results = refactor to reference

// Check for orphaned references
db.profiles.aggregate([
  { $lookup: {
    from: "users",
    localField: "userId",
    foreignField: "_id",
    as: "user"
  }},
  { $match: { user: { $size: 0 } } }
])
// Orphans suggest 1:1 should be embedded
```

Reference: [https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)

### 2.2 Embrace the Document Model

**Impact: HIGH (4× fewer queries, single atomic operation vs multi-table transaction)**

**Don't recreate SQL tables in MongoDB.** The document model exists to eliminate joins, not to store flat rows with foreign keys scattered across collections. Teams migrating from SQL who replicate their table structure see 4× more queries and lose MongoDB's single-document atomicity.

**Incorrect: SQL patterns in MongoDB**

```javascript
// SQL-style: 4 collections for one entity
// customers: { _id, name, email }
// addresses: { _id, customerId, type, street, city, zip }
// phones: { _id, customerId, type, number }
// preferences: { _id, customerId, key, value }

// To load customer profile: 4 queries required
const customer = db.customers.findOne({ _id: "cust123" })  // Query 1
const addresses = db.addresses.find({ customerId: "cust123" })  // Query 2
const phones = db.phones.find({ customerId: "cust123" })  // Query 3
const prefs = db.preferences.find({ customerId: "cust123" })  // Query 4
// Total: 4 round-trips, 4 index lookups, application-side joining
// Update requires transaction or risks inconsistency
```

**Correct: rich document model**

```javascript
// Customer document contains everything about the customer
// All data retrieved in single read, updated atomically
{
  _id: "cust123",
  name: "Alice Smith",
  email: "alice@example.com",
  addresses: [
    { type: "home", street: "123 Main", city: "Boston", zip: "02101" },
    { type: "work", street: "456 Oak", city: "Boston", zip: "02102" }
  ],
  phones: [
    { type: "mobile", number: "555-1234" },
    { type: "work", number: "555-5678" }
  ],
  preferences: {
    newsletter: true,
    theme: "dark",
    language: "en"
  },
  createdAt: ISODate("2024-01-01")
}

// Single query loads complete customer - 1 round-trip
db.customers.findOne({ _id: "cust123" })

// Atomic update - no transaction needed
db.customers.updateOne(
  { _id: "cust123" },
  { $push: { addresses: newAddress }, $set: { "preferences.theme": "light" } }
)
```

**Benefits of document model:**

| Aspect | SQL Approach | Document Approach |

|--------|-------------|-------------------|

| Queries per entity | 4+ | 1 |

| Atomicity | Requires transaction | Built-in |

| Schema changes | ALTER TABLE + migration | Just write new fields |

| Network round-trips | N per entity | 1 per entity |

**When migrating from SQL:**

1. Don't convert tables 1:1 to collections

2. Identify which tables are always joined together

3. Denormalize those joins into single documents

4. Keep separate only what's accessed separately

**When NOT to use this pattern:**

- **Genuinely independent data**: If addresses are shared across users or accessed independently, keep them separate.

- **Unbounded relationships**: User with 10,000 orders should NOT embed all orders.

- **Regulatory requirements**: Some compliance rules require normalized audit trails.

**Verify with:**

```javascript
// Count your collections vs expected entities
db.adminCommand({ listDatabases: 1 }).databases.forEach(d => {
  const colls = db.getSiblingDB(d.name).getCollectionNames().length
  print(`${d.name}: ${colls} collections`)
})
// Red flag: Collection count >> entity count (SQL thinking)

// Check for SQL-style foreign key patterns
db.addresses.aggregate([
  { $group: { _id: "$customerId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 0 } } }
]).itcount()
// If addresses always belong to customers, they should be embedded
```

Reference: [https://mongodb.com/docs/manual/data-modeling/schema-design-process/](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)

### 2.3 Respect the 16MB Document Limit

**Impact: CRITICAL (Hard limit—exceeding crashes writes, corrupts data, requires emergency refactoring)**

**MongoDB documents cannot exceed 16 megabytes (16,777,216 bytes).** This is a hard BSON limit—not a guideline. When a document approaches this limit, writes fail, applications crash, and you're forced into emergency schema refactoring. Design to stay well under this limit from day one.

**How documents hit 16MB:**

```javascript
// Scenario 1: Unbounded arrays
{
  _id: "user1",
  activityLog: [
    // 100,000 events × 150 bytes = 15MB
    { action: "login", ts: ISODate("..."), ip: "..." },
    // ... grows forever until crash
  ]
}

// Scenario 2: Large embedded binary
{
  _id: "doc1",
  content: "...",
  attachments: [
    { filename: "report.pdf", data: BinData(0, "...") }  // 10MB PDF
    // One more attachment = crash
  ]
}

// Scenario 3: Deeply nested objects
{
  _id: "config1",
  settings: {
    level1: {
      level2: {
        // ... 100 levels of nesting
        // Metadata + keys alone can reach 16MB
      }
    }
  }
}
```

**Symptoms of approaching 16MB:**

- `Document exceeds maximum allowed size` errors

- Write operations failing sporadically

- Slow queries returning large documents

- Memory spikes when fetching documents

**Correct: design for size constraints**

```javascript
// Instead of unbounded arrays, use separate collection
// User document stays small
{
  _id: "user1",
  name: "Alice",
  activityCount: 100000,
  lastActivity: ISODate("2024-01-15")
}

// Activities in separate collection
{
  userId: "user1",
  action: "login",
  ts: ISODate("2024-01-15"),
  ip: "192.168.1.1"
}

// Instead of embedded binary, use GridFS
const bucket = new GridFSBucket(db)
const uploadStream = bucket.openUploadStream("report.pdf")
// Store file reference in document
{
  _id: "doc1",
  content: "...",
  attachments: [
    { filename: "report.pdf", gridfsId: ObjectId("...") }
  ]
}
```

**Size estimation:**

```javascript
// Check current document size
db.users.aggregate([
  { $match: { _id: "user1" } },
  { $project: { size: { $bsonSize: "$$ROOT" } } }
])

// Find largest documents in collection
db.users.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $sort: { size: -1 } },
  { $limit: 10 }
])

// Size of specific fields
db.users.aggregate([
  { $project: {
    total: { $bsonSize: "$$ROOT" },
    activitySize: { $bsonSize: { $ifNull: ["$activityLog", []] } },
    profileSize: { $bsonSize: { $ifNull: ["$profile", {}] } }
  }}
])
```

**Safe size thresholds:**

| Document Size | Risk Level | Action |

|---------------|------------|--------|

| <100 KB | Safe | Normal operation |

| 100 KB - 1 MB | Monitor | Watch for growth patterns |

| 1 MB - 5 MB | Warning | Plan refactoring, add alerts |

| 5 MB - 10 MB | Critical | Refactor immediately |

| >10 MB | Emergency | Document at risk of failure |

**Prevention strategies:**

```javascript
// 1. Schema validation with array limits
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        addresses: { maxItems: 10 },
        tags: { maxItems: 100 }
      }
    }
  }
})

// 2. Application-level checks before write
const doc = await db.users.findOne({ _id: userId })
const currentSize = BSON.calculateObjectSize(doc)
if (currentSize > 10 * 1024 * 1024) {  // 10MB warning
  throw new Error("Document approaching size limit")
}

// 3. Use $slice to cap arrays
db.users.updateOne(
  { _id: userId },
  {
    $push: {
      activityLog: {
        $each: [newActivity],
        $slice: -1000  // Keep only last 1000
      }
    }
  }
)
```

**GridFS for large binary data:**

```javascript
// Files >16MB must use GridFS
const { GridFSBucket } = require('mongodb')
const bucket = new GridFSBucket(db, { bucketName: 'attachments' })

// Upload large file
const uploadStream = bucket.openUploadStream('large-video.mp4')
fs.createReadStream('./large-video.mp4').pipe(uploadStream)

// Reference in document
{
  _id: "post1",
  title: "My Video Post",
  videoId: uploadStream.id  // Reference, not embedded
}

// Download when needed
const downloadStream = bucket.openDownloadStream(videoId)
```

**When NOT to worry about 16MB:**

- **Small, fixed schemas**: User profiles, configs, small entities rarely hit limits.

- **Bounded arrays with validation**: If you enforce `maxItems: 50`, you're safe.

- **Read-heavy with controlled writes**: If writes are always small updates.

**Verify with:**

```javascript
// Set up monitoring for large documents
db.createCollection("documentSizeAlerts")

// Periodic check (run via cron/scheduled job)
db.users.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $match: { size: { $gt: 5000000 } } },  // >5MB
  { $merge: {
    into: "documentSizeAlerts",
    whenMatched: "replace"
  }}
])

// Alert if any documents are approaching limit
db.documentSizeAlerts.find({ size: { $gt: 10000000 } })
```

Reference: [https://mongodb.com/docs/manual/reference/limits/#std-label-limit-bson-document-size](https://mongodb.com/docs/manual/reference/limits/#std-label-limit-bson-document-size)

### 2.4 Store Data That's Accessed Together

**Impact: HIGH (3× fewer queries, eliminates network round-trips, enables single-document atomicity)**

**MongoDB's core principle: data that is accessed together should be stored together.** Design schemas around queries, not entities. This is the opposite of relational normalization—we optimize for read patterns, not data purity.

**Incorrect: entity-based design**

```javascript
// Designed like SQL tables - 3 queries for one page
// articles: { _id, title, content, authorId }
// authors: { _id, name, bio }
// article_tags: { articleId, tag }

// Display article page requires 3 separate queries
const article = await db.articles.findOne({ _id: articleId })  // Query 1
const author = await db.authors.findOne({ _id: article.authorId })  // Query 2
const tags = await db.article_tags.find({ articleId }).toArray()  // Query 3
// 3 round-trips, 3 index lookups, application joins
// If author query fails, you still show partial page? Complexity grows.
```

**Correct: query-based design**

```javascript
// Everything needed for article page in one document
// Schema matches the API response shape
{
  _id: "article123",
  title: "MongoDB Best Practices",
  content: "...",
  author: {
    _id: "auth456",           // Keep reference for author profile link
    name: "Jane Developer",    // Embedded for display
    avatar: "https://..."      // Embedded for display
  },
  tags: ["mongodb", "database", "performance"],  // Embedded array
  publishedAt: ISODate("2024-01-15"),
  readingTime: 8
}

// Single query returns complete article - 1ms response
const article = await db.articles.findOne({ _id: articleId })
// API response can return document directly - no transformation
```

**How to identify access patterns:**

```javascript
// Step 1: List your API endpoints/pages
// GET /article/:id - article page
// GET /articles - article list
// GET /author/:id - author profile

// Step 2: For each endpoint, list what data is returned
// /article/:id needs: title, content, author.name, author.avatar, tags
// /articles needs: title, author.name, publishedAt (no content)
// /author/:id needs: full author bio, their articles list

// Step 3: Design documents to match those queries
// Result: Embed author summary in articles, keep full author separate
```

**Common embedding patterns:**

```javascript
// E-commerce: Product with review summary (not all reviews)
{
  _id: "prod123",
  name: "Widget",
  price: 29.99,
  reviewSummary: {
    avgRating: 4.5,
    count: 127,
    distribution: { 5: 80, 4: 30, 3: 10, 2: 5, 1: 2 }
  },
  topReviews: [/* top 3 reviews for product page */]
}

// User dashboard: Embed counts, reference details
{
  _id: "user123",
  name: "Alice",
  stats: {
    orderCount: 42,
    totalSpent: 1234.56,
    lastOrderDate: ISODate("...")
  }
  // Don't embed 42 order documents - reference them
}
```

**When NOT to use this pattern:**

- **Data accessed independently**: Author profile page exists separately from articles—keep full author data in authors collection.

- **Different update frequencies**: If author avatar changes daily but articles never change, embedding creates update overhead.

- **Unbounded growth**: Don't embed all 10,000 comments in a popular post.

**Verify with:**

```javascript
// Profile your actual queries
db.setProfilingLevel(1, { slowms: 10 })

// Find queries that always happen together
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: {
    _id: {
      minute: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$ts" } }
    },
    collections: { $addToSet: "$ns" },
    count: { $sum: 1 }
  }},
  { $match: { "collections.1": { $exists: true } } }  // Multiple collections
])
// Collections queried in same minute = candidates for embedding
```

Reference: [https://mongodb.com/docs/manual/data-modeling/](https://mongodb.com/docs/manual/data-modeling/)

### 2.5 Use Schema Validation

**Impact: MEDIUM (Prevents invalid data at database level, catches bugs before production corruption)**

**Enforce document structure with MongoDB's built-in JSON Schema validation.** Catch invalid data before it corrupts your database, not after you've shipped 10,000 malformed documents to production. Schema validation is your last line of defense when application bugs slip through.

**Incorrect: no validation**

```javascript
// Any document can be inserted - no safety net
db.users.insertOne({ email: "not-an-email", age: "twenty" })
// Now you have: { email: "not-an-email", age: "twenty" }
// Application crashes when parsing age as number
// Or worse: silent data corruption, discovered months later

db.users.insertOne({ name: "Bob" })  // Missing required email
// Downstream systems expect email, fail silently
```

**Correct: schema validation**

```javascript
// Create collection with validation rules
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email address"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "must be 1-100 characters"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150,
          description: "must be integer 0-150"
        },
        status: {
          enum: ["active", "inactive", "pending"],
          description: "must be one of: active, inactive, pending"
        },
        addresses: {
          bsonType: "array",
          maxItems: 10,  // Prevent unbounded arrays
          items: {
            bsonType: "object",
            required: ["city"],
            properties: {
              street: { bsonType: "string" },
              city: { bsonType: "string" },
              zip: { bsonType: "string", pattern: "^[0-9]{5}$" }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Invalid inserts now fail immediately with clear error
db.users.insertOne({ email: "not-an-email" })
// Error: Document failed validation:
// "email" does not match pattern, "name" is required
```

**Validation levels and actions:**

| validationLevel | Behavior |

|-----------------|----------|

| `strict` | Validate ALL inserts and updates (default, recommended) |

| `moderate` | Only validate documents that already match schema |

| validationAction | Behavior |

|------------------|----------|

| `error` | Reject invalid documents (default, recommended) |

| `warn` | Allow but log warning (use during migration only) |

**Add validation to existing collection:**

```javascript
// Start with moderate + warn to discover violations
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: {...} },
  validationLevel: "moderate",  // Don't break existing invalid docs
  validationAction: "warn"       // Log violations, don't block
})

// Check logs for violations, fix existing data
db.users.find({ $nor: [{ email: { $regex: /^[a-zA-Z0-9._%+-]+@/ } }] })

// Then switch to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**When NOT to use this pattern:**

- **Rapid prototyping**: Skip validation during early development, add before production.

- **Schema-per-document designs**: Some collections intentionally store varied document shapes.

- **Log/event collections**: High-write collections where validation overhead matters.

**Verify with:**

```javascript
// Check if validation exists on collection
db.getCollectionInfos({ name: "users" })[0].options.validator
// Empty = no validation (add it!)

// Test your validation rules
db.runCommand({
  validate: "users",
  full: true
})

// Find documents that would fail current validation
db.users.find({
  $nor: [
    { email: { $type: "string" } },
    { name: { $type: "string" } }
  ]
})
```

Reference: [https://mongodb.com/docs/manual/core/schema-validation/](https://mongodb.com/docs/manual/core/schema-validation/)

---

## 3. Relationship Patterns

**Impact: HIGH**

Every relationship in your application needs a modeling decision: embed or reference? One-to-one is almost always embedded. One-to-few (comments on a post, addresses for a user) benefits from embedding with bounded arrays. One-to-many (orders for a customer) and many-to-many (students/courses) require references. Tree structures need special patterns (parent reference, child reference, materialized path). Wrong decisions create either bloated documents that hit the 16MB limit, or chatty applications that make 50 round-trips to load a single page. These patterns give you the decision framework.

### 3.1 Model Many-to-Many Relationships

**Impact: HIGH (Choose embedding or referencing based on query direction—10× query speed difference)**

**Many-to-many relationships require choosing a primary query direction.** Unlike SQL's join tables, MongoDB favors denormalization toward your most common query pattern. Embed references in the collection you query most, and consider duplicating summary data for display efficiency.

**Common many-to-many examples:**

- Students ↔ Classes

- Books ↔ Authors

- Products ↔ Categories

- Users ↔ Roles

- Doctors ↔ Patients

**Incorrect: SQL-style junction table**

```javascript
// SQL thinking: 3 collections, always need joins
// students: { _id, name }
// classes: { _id, name }
// enrollments: { studentId, classId }

// Get student with classes: 2 joins required
db.enrollments.aggregate([
  { $match: { studentId: "student1" } },
  { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } }
])
// Slow, complex, every query needs aggregation
```

**Correct: embed in primary query direction**

```javascript
// If you query "which classes is this student in" most often:
// Embed class references in student
{
  _id: "student1",
  name: "Alice Smith",
  classes: [
    { classId: "class101", name: "Database Systems", instructor: "Dr. Smith" },
    { classId: "class102", name: "Web Development", instructor: "Dr. Jones" }
  ]
}

// If you query "which students are in this class" most often:
// Embed student references in class
{
  _id: "class101",
  name: "Database Systems",
  instructor: "Dr. Smith",
  students: [
    { studentId: "student1", name: "Alice Smith" },
    { studentId: "student2", name: "Bob Jones" }
  ]
}
```

**Bidirectional embedding: when both directions are common**

```javascript
// Book with author summaries embedded
{
  _id: "book001",
  title: "Cell Biology",
  authors: [
    { authorId: "author124", name: "Ellie Smith" },
    { authorId: "author381", name: "John Palmer" }
  ]
}

// Author with book summaries embedded
{
  _id: "author124",
  name: "Ellie Smith",
  books: [
    { bookId: "book001", title: "Cell Biology" },
    { bookId: "book042", title: "Molecular Biology" }
  ]
}

// Trade-off: Data duplication, but fast queries in both directions
// Requires updating both documents when relationship changes
```

**Reference-only pattern (for large cardinality):**

```javascript
// When arrays would be too large, use reference arrays
// Product with category IDs only
{
  _id: "prod123",
  name: "Laptop",
  categoryIds: ["cat1", "cat2", "cat3"]  // Just IDs, small array
}

// Category with product IDs only
{
  _id: "cat1",
  name: "Electronics",
  productIds: ["prod123", "prod456", ...]  // Could be large
}

// Query with $lookup when needed
db.products.aggregate([
  { $match: { _id: "prod123" } },
  { $lookup: {
    from: "categories",
    localField: "categoryIds",
    foreignField: "_id",
    as: "categories"
  }}
])
```

**Choosing your strategy:**

| Query Pattern | Cardinality | Strategy |

|---------------|-------------|----------|

| Students → Classes | Few classes per student | Embed in student |

| Classes → Students | Many students per class | Reference only in class |

| Both directions common | Moderate both sides | Bidirectional embed |

| High cardinality both | 1000+ both sides | Reference-only, use $lookup |

**Maintaining bidirectional data:**

```javascript
// Adding a student to a class requires 2 updates
// 1. Add class to student
db.students.updateOne(
  { _id: "student1" },
  { $push: { classes: { classId: "class101", name: "Database Systems" } } }
)

// 2. Add student to class
db.classes.updateOne(
  { _id: "class101" },
  { $push: { students: { studentId: "student1", name: "Alice Smith" } } }
)

// Use transactions for atomicity in critical applications
const session = client.startSession()
session.withTransaction(async () => {
  await db.students.updateOne({ _id: "student1" }, { $push: {...} }, { session })
  await db.classes.updateOne({ _id: "class101" }, { $push: {...} }, { session })
})
```

**When NOT to use this pattern:**

- **Extremely high cardinality**: 10,000+ connections per entity—use graph database or reference-only with pagination.

- **Frequently changing relationships**: If students change classes hourly, overhead of updating both sides is high.

- **No primary query direction**: If truly 50/50 query split, consider hybrid approach.

**Verify with:**

```javascript
// Check array sizes in many-to-many relationships
db.students.aggregate([
  { $project: { classCount: { $size: { $ifNull: ["$classes", []] } } } },
  { $group: {
    _id: null,
    avg: { $avg: "$classCount" },
    max: { $max: "$classCount" }
  }}
])
// If max > 100, consider reference-only pattern

// Verify bidirectional consistency
db.students.aggregate([
  { $unwind: "$classes" },
  { $lookup: {
    from: "classes",
    let: { sid: "$_id", cid: "$classes.classId" },
    pipeline: [
      { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
      { $match: { $expr: { $in: ["$$sid", "$students.studentId"] } } }
    ],
    as: "match"
  }},
  { $match: { match: { $size: 0 } } }  // Find inconsistencies
])
```

Reference: [https://mongodb.com/docs/manual/tutorial/model-embedded-many-to-many-relationships-between-documents/](https://mongodb.com/docs/manual/tutorial/model-embedded-many-to-many-relationships-between-documents/)

### 3.2 Model One-to-Few Relationships with Embedded Arrays

**Impact: HIGH (Single query for bounded arrays, no $lookup overhead)**

**Embed bounded, small arrays directly in the parent document.** When a parent entity has a small, predictable number of children that are always accessed together, embed them as an array. This eliminates $lookup operations and keeps related data atomic.

**Incorrect: separate collection for few items**

```javascript
// User in users collection
{ _id: "user123", name: "Alice Smith" }

// Addresses in separate collection - user typically has 1-3
{ userId: "user123", type: "home", street: "123 Main", city: "Boston" }
{ userId: "user123", type: "work", street: "456 Oak", city: "Boston" }

// User profile page requires $lookup for 2-3 addresses
db.users.aggregate([
  { $match: { _id: "user123" } },
  { $lookup: {
    from: "addresses",
    localField: "_id",
    foreignField: "userId",
    as: "addresses"
  }}
])
// Extra collection scan for ~2 addresses
// Orphaned addresses when user deleted
```

**Correct: embedded array**

```javascript
// User with embedded addresses - bounded to ~5 max
{
  _id: "user123",
  name: "Alice Smith",
  addresses: [
    { type: "home", street: "123 Main St", city: "Boston", state: "MA", zip: "02101" },
    { type: "work", street: "456 Oak Ave", city: "Boston", state: "MA", zip: "02102" }
  ]
}

// Single query returns user with all addresses
db.users.findOne({ _id: "user123" })

// Add address atomically
db.users.updateOne(
  { _id: "user123" },
  { $push: { addresses: { type: "vacation", street: "789 Beach", city: "Miami" } } }
)

// Update specific address
db.users.updateOne(
  { _id: "user123", "addresses.type": "home" },
  { $set: { "addresses.$.city": "Cambridge" } }
)
```

**Common one-to-few relationships:**

| Parent | Embedded Array | Typical Count | Why Embed |

|--------|---------------|---------------|-----------|

| User | Addresses | 1-5 | Always shown on checkout |

| User | Phone numbers | 1-3 | Part of contact info |

| Product | Variants (S/M/L) | 3-10 | Product page needs all |

| Author | Pen names | 1-3 | Always displayed together |

| Order | Line items | 1-50 | Order is incomplete without items |

**Bounded array with limit enforcement:**

```javascript
// Enforce maximum addresses in application or validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        addresses: {
          bsonType: "array",
          maxItems: 10,  // Hard limit prevents unbounded growth
          items: {
            bsonType: "object",
            required: ["city"],
            properties: {
              type: { enum: ["home", "work", "billing", "shipping"] },
              city: { bsonType: "string" }
            }
          }
        }
      }
    }
  }
})
```

**Alternative: $slice for bounded recent items**

```javascript
// Keep only last N items automatically
db.users.updateOne(
  { _id: "user123" },
  {
    $push: {
      recentSearches: {
        $each: [{ query: "mongodb", ts: new Date() }],
        $slice: -10  // Keep only last 10
      }
    }
  }
)
```

**When NOT to use this pattern:**

- **Unbounded growth**: Comments, orders, events—use separate collection.

- **Independent access**: If addresses are queried without user context.

- **Large child documents**: If each address is >1KB with history, reference instead.

- **More than ~50 items**: Array operations become slow, use bucket or separate collection.

**One-to-Few vs One-to-Many decision:**

| Factor | One-to-Few (Embed) | One-to-Many (Reference) |

|--------|-------------------|------------------------|

| Typical count | <50 | >100 |

| Max possible | <100, enforced | Unbounded |

| Child size | Small (<500 bytes) | Any size |

| Access pattern | Always with parent | Sometimes independent |

| Update frequency | Rare | Frequent |

**Verify with:**

```javascript
// Check embedded array sizes
db.users.aggregate([
  { $project: {
    addressCount: { $size: { $ifNull: ["$addresses", []] } }
  }},
  { $group: {
    _id: null,
    avg: { $avg: "$addressCount" },
    max: { $max: "$addressCount" }
  }}
])
// avg < 10, max < 50 = good for embedding
// max > 100 = consider separate collection

// Find outliers with large arrays
db.users.find({
  $expr: { $gt: [{ $size: { $ifNull: ["$addresses", []] } }, 20] }
})
```

Reference: [https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/](https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/)

### 3.3 Model One-to-Many Relationships with References

**Impact: HIGH (Handles unbounded growth, prevents 16MB crashes, enables independent queries)**

**Use references when the "many" side is unbounded or frequently accessed independently.** Store the parent's ID in each child document. This pattern prevents documents from exceeding 16MB and allows efficient queries from either direction.

**Incorrect: embedding unbounded arrays**

```javascript
// Publisher with ALL books embedded - will crash at scale
{
  _id: "oreilly",
  name: "O'Reilly Media",
  books: [
    // 10,000+ books × 1KB each = 10MB+ document
    { title: "MongoDB: The Definitive Guide", isbn: "123", pages: 400 },
    { title: "Learning Python", isbn: "456", pages: 600 },
    // ... grows forever
  ]
}
// Adding one book rewrites entire 10MB document
// Eventually exceeds 16MB limit → APPLICATION CRASH
```

**Correct: reference in child documents**

```javascript
// Publisher document (simple, fixed size)
{
  _id: "oreilly",
  name: "O'Reilly Media",
  founded: 1980,
  location: "CA",
  bookCount: 10000  // Denormalized count for display
}

// Each book references its publisher
{
  _id: "book123",
  title: "MongoDB: The Definitive Guide",
  authors: ["Kristina Chodorow", "Mike Dirolf"],
  publisher_id: "oreilly",  // Reference to publisher
  isbn: "978-1449344689",
  pages: 432,
  publishedDate: ISODate("2013-05-23")
}

// Create index on reference field
db.books.createIndex({ publisher_id: 1 })

// Query books by publisher efficiently
db.books.find({ publisher_id: "oreilly" }).sort({ publishedDate: -1 })
// Uses index, returns any number of books
```

**Querying referenced data:**

```javascript
// Get publisher with book count (no join needed)
db.publishers.findOne({ _id: "oreilly" })

// Get all books for publisher (indexed query)
db.books.find({ publisher_id: "oreilly" })

// Get books with publisher details ($lookup when needed)
db.books.aggregate([
  { $match: { publisher_id: "oreilly" } },
  { $lookup: {
    from: "publishers",
    localField: "publisher_id",
    foreignField: "_id",
    as: "publisher"
  }},
  { $unwind: "$publisher" }
])
```

**Alternative: hybrid with subset**

```javascript
// Publisher with recent/featured books embedded
{
  _id: "oreilly",
  name: "O'Reilly Media",
  bookCount: 10000,
  featuredBooks: [
    // Only top 5 featured - bounded
    { _id: "book123", title: "MongoDB Guide", isbn: "123" },
    { _id: "book456", title: "Learning Python", isbn: "456" }
  ]
}

// Display publisher page: no $lookup for featured books
// "View all books" link: query books collection
```

**Updating denormalized counts:**

```javascript
// When adding a new book
db.books.insertOne({
  title: "New MongoDB Book",
  publisher_id: "oreilly"
})

// Update publisher's count
db.publishers.updateOne(
  { _id: "oreilly" },
  { $inc: { bookCount: 1 } }
)

// Or use Change Streams for async updates
```

**When to use One-to-Many references:**

| Scenario | Example | Why Reference |

|----------|---------|---------------|

| Unbounded children | Publisher → Books | Could have 100,000+ books |

| Large child documents | User → Orders | Orders have line items, addresses |

| Independent queries | Department → Employees | Query employees directly |

| Different lifecycles | Author → Articles | Archive articles separately |

| Frequent child updates | Post → Comments | Adding comments shouldn't lock post |

**When NOT to use this pattern:**

- **Bounded small arrays**: User's 3 addresses should be embedded, not referenced.

- **Always accessed together**: Order line items should be embedded in order.

- **No independent queries**: If you never query children without parent, consider embedding.

**Verify with:**

```javascript
// Check for missing indexes on reference fields
db.books.getIndexes()
// Must have index on publisher_id for efficient lookups

// Find reference fields without indexes
db.books.aggregate([
  { $sample: { size: 1000 } },
  { $project: { publisher_id: 1 } }
])
// If this is slow, index is missing

// Check for orphaned references
db.books.aggregate([
  { $lookup: {
    from: "publishers",
    localField: "publisher_id",
    foreignField: "_id",
    as: "pub"
  }},
  { $match: { pub: { $size: 0 } } },
  { $count: "orphanedBooks" }
])
// Orphans indicate data integrity issues
```

Reference: [https://mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/](https://mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/)

### 3.4 Model One-to-One Relationships with Embedding

**Impact: HIGH (Single read operation vs 2 queries, atomic updates guaranteed)**

**Embed one-to-one related data directly in the parent document.** When two pieces of data always belong together and are always accessed together, they should live in the same document. Separating 1:1 data into two collections doubles your queries and breaks atomicity.

**Incorrect: separate collections for one-to-one data**

```javascript
// User account collection
{ _id: "user123", email: "alice@example.com", createdAt: ISODate("...") }

// User profile in separate collection - always accessed with user
{ userId: "user123", name: "Alice Smith", avatar: "https://...", bio: "Developer" }

// Every user lookup requires 2 queries
const user = db.users.findOne({ _id: "user123" })
const profile = db.profiles.findOne({ userId: "user123" })
// 2 round-trips, 2 index lookups
// What if profile insert fails? Orphaned user account
// What if user deleted? Orphaned profile
```

**Correct: embedded one-to-one document**

```javascript
// Single document contains user + profile
{
  _id: "user123",
  email: "alice@example.com",
  createdAt: ISODate("2024-01-01"),
  profile: {
    name: "Alice Smith",
    avatar: "https://cdn.example.com/alice.jpg",
    bio: "Developer building cool things"
  }
}

// Single query returns everything
db.users.findOne({ _id: "user123" })

// Atomic update - profile can't exist without user
db.users.updateOne(
  { _id: "user123" },
  { $set: { "profile.name": "Alice Johnson" } }
)

// Delete user, profile goes with it automatically
db.users.deleteOne({ _id: "user123" })
```

**Common 1:1 relationships to embed:**

| Parent | Embedded 1:1 | Why Embed |

|--------|--------------|-----------|

| User | Profile | Always displayed together |

| Country | Capital city | Geographic data accessed together |

| Building | Address | Physical entity needs location |

| Order | Shipping address | Address at time of order (immutable) |

| Product | Dimensions/weight | Shipping calculation needs both |

**Alternative: subdocument for organization**

```javascript
// Use subdocument to logically group related fields
// Even if they're simple, grouping improves readability
{
  _id: "user123",
  email: "alice@example.com",
  auth: {
    passwordHash: "...",
    lastLogin: ISODate("..."),
    mfaEnabled: true
  },
  profile: {
    name: "Alice Smith",
    avatar: "https://..."
  },
  settings: {
    theme: "dark",
    notifications: true
  }
}
// All 1:1 data, logically organized
```

**When NOT to use this pattern:**

- **Data accessed independently**: If profile page is separate from auth operations, consider separation.

- **Different security requirements**: If auth data needs stricter access controls than profile.

- **Extreme size difference**: If embedded doc is >10KB and parent is <1KB, consider separation.

- **Different update frequencies**: If profile changes hourly but auth rarely, separate may reduce write amplification.

**Verify with:**

```javascript
// Find collections that look like 1:1 splits
db.profiles.aggregate([
  { $lookup: {
    from: "users",
    localField: "userId",
    foreignField: "_id",
    as: "user"
  }},
  { $match: { user: { $size: 1 } } },  // Exactly 1 match = 1:1
  { $count: "oneToOneRelationships" }
])
// High count suggests profiles should be embedded in users

// Check for orphaned 1:1 documents
db.profiles.aggregate([
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u" } },
  { $match: { u: { $size: 0 } } },
  { $count: "orphanedProfiles" }
])
// Any orphans = referential integrity problem, embedding solves this
```

Reference: [https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-one-relationships-between-documents/](https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-one-relationships-between-documents/)

### 3.5 Model Tree and Hierarchical Data

**Impact: HIGH (Choose pattern based on query type—10-100× performance difference for tree operations)**

**Hierarchical data requires choosing a tree pattern based on your primary operations.** MongoDB offers five patterns for trees—each optimizes different queries. Pick wrong and your category lookups become O(n) instead of O(1).

**Incorrect: recursive queries for breadcrumbs**

```javascript
// Using only parent references for breadcrumb navigation
{ _id: "MongoDB", parent: "Databases" }
{ _id: "Databases", parent: "Programming" }
{ _id: "Programming", parent: null }

// Building breadcrumb requires recursive queries
async function getBreadcrumb(categoryId) {
  const crumbs = []
  let current = await db.categories.findOne({ _id: categoryId })
  while (current && current.parent) {
    current = await db.categories.findOne({ _id: current.parent })
    crumbs.unshift(current)  // N queries for N-level hierarchy!
  }
  return crumbs
}
// 5-level deep category = 5 database round-trips per page view
```

**Correct: materialized path for breadcrumbs**

```javascript
// Store full path for O(1) ancestor queries
{ _id: "MongoDB", path: ",Programming,Databases,MongoDB,", depth: 3 }

// Single query returns all ancestors
const category = db.categories.findOne({ _id: "MongoDB" })
const ancestors = category.path.split(",").filter(Boolean)
db.categories.find({ _id: { $in: ancestors } }).sort({ depth: 1 })
// 1 query regardless of depth!
```

**Common hierarchical data:**

```javascript
// Each node stores left/right boundaries
{ _id: "Databases", left: 2, right: 7 }
{ _id: "MongoDB", left: 3, right: 4 }
{ _id: "PostgreSQL", left: 5, right: 6 }

// Find all descendants (single range query)
db.categories.find({
  left: { $gt: parent.left },
  right: { $lt: parent.right }
})

// Con: Insert/move requires updating many documents
// Best for read-heavy, rarely-modified hierarchies
```

- Category trees (Electronics > Computers > Laptops)

- Organizational charts

- File/folder structures

- Comment threads

- Geographic hierarchies

**Best for:** Finding parent, updating parent

**Best for:** Finding children, graph-like structures

**Best for:** Finding ancestors, breadcrumb navigation

**Best for:** Finding subtrees, regex-based queries, sorting

**Best for:** Fast subtree queries, rarely-changing trees

| Pattern | Find Parent | Find Children | Find All Descendants | Find All Ancestors | Insert |

|---------|-------------|---------------|---------------------|-------------------|--------|

| Parent References | O(1) | O(1) | O(depth) recursive | O(depth) recursive | O(1) |

| Child References | O(n) | O(1) | O(depth) recursive | O(depth) recursive | O(1) |

| Array of Ancestors | O(1) | O(1) | O(1) indexed | O(1) | O(depth) |

| Materialized Paths | O(1) | O(1) regex | O(1) regex | O(1) | O(depth) |

| Nested Sets | O(1) | O(1) | O(1) range | O(1) range | O(n) |

**Recommended patterns by use case:**

```javascript
// Using Materialized Paths for category navigation
{
  _id: "laptop-gaming",
  name: "Gaming Laptops",
  path: ",electronics,computers,laptops,laptop-gaming,",
  parent: "laptops",
  depth: 4,
  productCount: 234  // Denormalized for display
}

// Create indexes
db.categories.createIndex({ path: 1 })
db.categories.createIndex({ parent: 1 })

// Get full category tree under "computers"
db.categories.find({ path: /^,electronics,computers,/ }).sort({ path: 1 })

// Get breadcrumb for product page
const category = db.categories.findOne({ _id: "laptop-gaming" })
const breadcrumb = category.path.split(",").filter(Boolean)
db.categories.find({ _id: { $in: breadcrumb } }).sort({ depth: 1 })
```

| Use Case | Best Pattern | Why |

|----------|--------------|-----|

| Category breadcrumbs | Array of Ancestors | Fast ancestor lookup |

| File browser | Parent References | Simple, fast child listing |

| Org chart reporting | Materialized Paths | Subtree queries + sorting |

| Static taxonomy | Nested Sets | Fastest reads, rare changes |

| Comment threads | Parent References | Comments change frequently |

**Example: E-commerce category tree**

**When NOT to use tree patterns:**

- **Graph-like data**: If nodes can have multiple parents, use graph database or $graphLookup.

- **Flat structure**: If depth is always 1-2, simple parent reference is sufficient.

- **Extremely deep trees**: 100+ levels may need specialized approaches.

**Verify with:**

```javascript
// Check tree consistency (no orphans)
db.categories.aggregate([
  { $match: { parent: { $ne: null } } },
  { $lookup: {
    from: "categories",
    localField: "parent",
    foreignField: "_id",
    as: "parentDoc"
  }},
  { $match: { parentDoc: { $size: 0 } } },
  { $count: "orphanedNodes" }
])

// Check path consistency (materialized paths)
db.categories.find({
  $expr: {
    $ne: [
      { $size: { $split: ["$path", ","] } },
      { $add: ["$depth", 2] }  // +2 for leading/trailing commas
    ]
  }
})
```

Reference: [https://mongodb.com/docs/manual/applications/data-models-tree-structures/](https://mongodb.com/docs/manual/applications/data-models-tree-structures/)

---

## 4. Design Patterns

**Impact: MEDIUM**

MongoDB's document model enables patterns impossible in relational databases. The Bucket pattern groups time-series data into fixed-size documents, reducing document count 10-100× for IoT and analytics workloads. The Computed pattern pre-calculates expensive aggregations, trading write complexity for read performance. The Subset pattern keeps hot data embedded while archiving cold data, keeping working sets small. The Outlier pattern handles the viral post with 1M comments without penalizing the 99.9% with normal engagement. Apply these patterns when your use case matches—don't over-engineer simple schemas.

### 4.1 Use Bucket Pattern for Time-Series Data

**Impact: MEDIUM (100-3600× fewer documents, 10-50× smaller indexes, 5-20× faster range queries)**

**Group time-series data into buckets instead of one document per event.** A sensor generating 1 reading/second creates 86,400 documents/day with naive schema—bucketing by hour reduces this to 24 documents with 3,600× less index overhead.

**Incorrect: one document per event**

```javascript
// Sensor readings: 1 document per reading
// Each document ~100 bytes + index entries
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:00Z"), value: 22.5 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:01Z"), value: 22.6 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:02Z"), value: 22.5 }
// ...

// Per sensor per year:
// 86,400 docs/day × 365 days = 31,536,000 documents
// 31M index entries for {sensorId, ts} compound index
// Query for 1 day: scan 86,400 index entries
```

**Correct: bucket pattern - group by time window**

```javascript
// One document per sensor per hour
// Readings array bounded to ~3,600 elements
{
  sensorId: "temp-01",
  bucket: ISODate("2024-01-15T10:00:00Z"),  // Hour start
  readings: [
    { m: 0, s: 0, value: 22.5 },   // Minute 0, second 0
    { m: 0, s: 1, value: 22.6 },   // Minute 0, second 1
    { m: 0, s: 2, value: 22.5 },
    // ... up to 3,600 readings
  ],
  count: 3600,
  // Pre-computed aggregates - no need to scan array
  sum: 81234.5,
  min: 21.2,
  max: 24.8,
  avg: 22.56
}

// Per sensor per year:
// 24 docs/day × 365 days = 8,760 documents (3,600× fewer)
// 8,760 index entries (3,600× smaller index)
// Query for 1 day: scan 24 index entries
```

**Insert with automatic bucketing:**

```javascript
// Atomic upsert - creates bucket or adds to existing
const reading = { ts: new Date(), value: 22.7 }
const hour = new Date(reading.ts)
hour.setMinutes(0, 0, 0)  // Round to hour

db.sensor_data.updateOne(
  {
    sensorId: "temp-01",
    bucket: hour,
    count: { $lt: 3600 }  // Start new bucket if full
  },
  {
    $push: {
      readings: {
        m: reading.ts.getMinutes(),
        s: reading.ts.getSeconds(),
        value: reading.value
      }
    },
    $inc: { count: 1, sum: reading.value },
    $min: { min: reading.value },
    $max: { max: reading.value }
  },
  { upsert: true }
)
```

**Query patterns:**

```javascript
// Native time-series support - handles bucketing automatically
db.createCollection("sensor_data", {
  timeseries: {
    timeField: "ts",
    metaField: "sensorId",
    granularity: "seconds"  // or "minutes", "hours"
  },
  expireAfterSeconds: 86400 * 30  // Auto-delete after 30 days
})

// Insert as if one-doc-per-event - MongoDB buckets internally
db.sensor_data.insertOne({
  sensorId: "temp-01",
  ts: new Date(),
  value: 22.5
})
```

**Alternative: MongoDB Time Series Collections (5.0+):**

**When NOT to use this pattern:**

- **Random access patterns**: If you frequently query individual events by ID, not time ranges.

- **Low volume**: <1000 events/day per entity doesn't justify bucketing complexity.

- **Varied event sizes**: Bucketing works best when events are uniform size.

**Verify with:**

```javascript
// Check document counts - should be low for time-series
db.sensor_data.estimatedDocumentCount()
// If count ≈ events, you're not bucketing

// Check average document size
db.sensor_data.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: { _id: null, avgSize: { $avg: "$size" } } }
])
// Bucketed: 10-100KB; Unbucketed: 100-500 bytes
```

Reference: [https://mongodb.com/blog/post/building-with-patterns-the-bucket-pattern](https://mongodb.com/blog/post/building-with-patterns-the-bucket-pattern)

### 4.2 Use Computed Pattern for Expensive Calculations

**Impact: MEDIUM (100-1000× faster reads by pre-computing aggregations)**

**Pre-calculate and store frequently-accessed computed values.** If you're running the same aggregation on every page load, you're wasting CPU cycles. Store the result in the document and update it on write or via background job—trades write complexity for read speed.

**Incorrect: calculate on every read**

```javascript
// Movie with all screenings in separate collection
{ _id: "movie1", title: "The Matrix" }

// Screenings collection - thousands of records
{ movieId: "movie1", date: ISODate("..."), viewers: 344, revenue: 3440 }
{ movieId: "movie1", date: ISODate("..."), viewers: 256, revenue: 2560 }
// ... 10,000 screenings

// Movie page aggregates every time
db.screenings.aggregate([
  { $match: { movieId: "movie1" } },
  { $group: {
    _id: "$movieId",
    totalViewers: { $sum: "$viewers" },
    totalRevenue: { $sum: "$revenue" },
    screeningCount: { $sum: 1 }
  }}
])
// 50-500ms per page load, scanning 10,000 documents
// 1M page views/day = 1M expensive aggregations
```

**Correct: pre-computed values**

```javascript
// Movie with computed stats stored directly
{
  _id: "movie1",
  title: "The Matrix",
  stats: {
    totalViewers: 1840000,
    totalRevenue: 25880000,
    screeningCount: 8500,
    avgViewersPerScreening: 216,
    computedAt: ISODate("2024-01-15T00:00:00Z")
  }
}

// Movie page: instant read, no aggregation
db.movies.findOne({ _id: "movie1" })
// <5ms, single document read
```

**Update strategies:**

```javascript
// Strategy 1: Update on write (low write volume)
// When new screening is added
db.screenings.insertOne({
  movieId: "movie1",
  viewers: 400,
  revenue: 4000
})

// Immediately update computed values
db.movies.updateOne(
  { _id: "movie1" },
  {
    $inc: {
      "stats.totalViewers": 400,
      "stats.totalRevenue": 4000,
      "stats.screeningCount": 1
    },
    $set: { "stats.computedAt": new Date() }
  }
)

// Strategy 2: Background job (high write volume)
// Run hourly/daily aggregation job
db.screenings.aggregate([
  { $group: {
    _id: "$movieId",
    totalViewers: { $sum: "$viewers" },
    totalRevenue: { $sum: "$revenue" },
    count: { $sum: 1 }
  }},
  { $merge: {
    into: "movies",
    on: "_id",
    whenMatched: [{
      $set: {
        "stats.totalViewers": "$$new.totalViewers",
        "stats.totalRevenue": "$$new.totalRevenue",
        "stats.screeningCount": "$$new.count",
        "stats.computedAt": new Date()
      }
    }]
  }}
])
```

**Common computed values:**

| Source Data | Computed Value | Update Strategy |

|-------------|----------------|-----------------|

| Order line items | Order total | On write (single doc) |

| Product reviews | Avg rating, review count | Background job |

| User activity | Engagement score | Background job |

| Transaction history | Account balance | On write |

| Page views | View count, trending score | Batched updates |

**Handling staleness:**

```javascript
// Include timestamp for freshness checks
{
  _id: "movie1",
  stats: {
    totalViewers: 1840000,
    computedAt: ISODate("2024-01-15T00:00:00Z")
  }
}

// Application can check freshness
if (movie.stats.computedAt < oneHourAgo) {
  // Refresh computed values
  await refreshMovieStats(movie._id)
}

// Or show "as of" timestamp to users
// "1,840,000 viewers (updated 1 hour ago)"
```

**Windowed computations:**

```javascript
// Compute for time windows (rolling 30 days)
{
  _id: "movie1",
  stats: {
    allTime: { viewers: 1840000, revenue: 25880000 },
    last30Days: { viewers: 45000, revenue: 630000 },
    last7Days: { viewers: 12000, revenue: 168000 }
  }
}

// Background job updates rolling windows
db.screenings.aggregate([
  { $match: {
    movieId: "movie1",
    date: { $gte: thirtyDaysAgo }
  }},
  { $group: {
    _id: null,
    viewers: { $sum: "$viewers" },
    revenue: { $sum: "$revenue" }
  }}
])
// Then update movie.stats.last30Days
```

**When NOT to use this pattern:**

- **Rarely accessed calculations**: If stat is viewed once/day, compute on demand.

- **High write frequency**: If source data changes every second, update overhead may exceed read savings.

- **Complex multi-collection joins**: Some computations are too complex to maintain incrementally.

- **Strong consistency required**: Computed values may be slightly stale.

**Verify with:**

```javascript
// Find expensive aggregations that should be pre-computed
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find({
  "command.aggregate": { $exists: true },
  millis: { $gt: 100 }
}).sort({ millis: -1 })

// Check if same aggregation runs repeatedly
db.system.profile.aggregate([
  { $match: { "command.aggregate": { $exists: true } } },
  { $group: {
    _id: "$command.pipeline",
    count: { $sum: 1 },
    avgMs: { $avg: "$millis" }
  }},
  { $match: { count: { $gt: 100 } } }  // Repeated 100+ times
])
// High count + high avgMs = candidate for computed pattern
```

Reference: [https://mongodb.com/docs/manual/data-modeling/design-patterns/computed-values/computed-schema-pattern/](https://mongodb.com/docs/manual/data-modeling/design-patterns/computed-values/computed-schema-pattern/)

### 4.3 Use Extended Reference Pattern

**Impact: MEDIUM (Eliminates $lookup for 80% of queries, 5-10× faster list views)**

**Copy frequently-accessed fields from referenced documents into the parent.** If you always display author name with articles, embed it. This eliminates $lookup for common queries while keeping the full data normalized—best of both worlds.

**Incorrect: always $lookup for display data**

```javascript
// Order references customer by ID only
{
  _id: "order123",
  customerId: "cust456",  // Just an ObjectId
  items: [...],
  total: 299.99
}

// Every order list/display requires $lookup
db.orders.aggregate([
  { $match: { status: "pending" } },
  { $lookup: {
    from: "customers",
    localField: "customerId",
    foreignField: "_id",
    as: "customer"
  }},
  { $unwind: "$customer" }
])
// 50 orders × $lookup = 50 extra index lookups
// List view: 50-200ms instead of 5-20ms
```

**Correct: extended reference**

```javascript
// Order contains frequently-needed customer fields
// Full customer data still in customers collection
{
  _id: "order123",
  customer: {
    _id: "cust456",         // Keep reference for full lookup
    name: "Alice Smith",    // Cached for display
    email: "alice@ex.com"   // Cached for notifications
  },
  items: [...],
  total: 299.99,
  createdAt: ISODate("2024-01-15")
}

// Order list without $lookup - single query
db.orders.find({ status: "pending" })
// Returns customer.name directly - no join needed
// 50 orders in 5ms instead of 50ms

// Full customer data available when needed
const fullCustomer = db.customers.findOne({ _id: order.customer._id })
```

**Keeping cached data in sync:**

```javascript
// When customer name changes (rare event)
// 1. Update source of truth
db.customers.updateOne(
  { _id: "cust456" },
  { $set: { name: "Alice Johnson" } }
)

// 2. Update cached copies
// Can be async via Change Streams or background job
db.orders.updateMany(
  { "customer._id": "cust456" },
  { $set: { "customer.name": "Alice Johnson" } }
)

// For frequently-changing data, add timestamp
{
  customer: {
    _id: "cust456",
    name: "Alice Smith",
    cachedAt: ISODate("2024-01-15")
  }
}
// Application can refresh if cachedAt > threshold
```

**What to cache: extend**

```javascript
// For data that changes occasionally
{
  _id: "order123",
  customerId: "cust456",        // Always have reference
  customerCache: {              // Optional cache
    name: "Alice Smith",
    email: "alice@ex.com",
    cachedAt: ISODate("2024-01-15")
  }
}

// Application logic
if (!order.customerCache ||
    order.customerCache.cachedAt < oneDayAgo) {
  // Refresh cache from customers collection
  const customer = db.customers.findOne({ _id: order.customerId })
  db.orders.updateOne(
    { _id: order._id },
    { $set: { customerCache: { ...customer, cachedAt: new Date() } } }
  )
}
```

| Cache | Don't Cache |

|-------|-------------|

| Display name, avatar | Full bio, description |

| Status, type | Sensitive PII |

| Slowly-changing data | Real-time values (balance, inventory) |

| Fields used in sorting/filtering | Large binary data |

**Alternative: Hybrid pattern with cache expiry:**

**When NOT to use this pattern:**

- **Frequently-changing data**: If customer name changes daily, update overhead exceeds $lookup cost.

- **Large cached payloads**: Don't embed 50KB of author bio in every article.

- **Sensitive data segregation**: Don't copy PII into collections with different access controls.

- **Writes >> Reads**: If you write 100× more than read, caching adds overhead.

**Verify with:**

```javascript
// Find $lookup-heavy aggregations in profile
db.setProfilingLevel(1, { slowms: 20 })
db.system.profile.find({
  "command.pipeline": { $elemMatch: { "$lookup": { $exists: true } } }
}).sort({ millis: -1 }).limit(10)

// Check how often lookups hit same collections
db.system.profile.aggregate([
  { $match: { "command.pipeline.$lookup": { $exists: true } } },
  { $unwind: "$command.pipeline" },
  { $match: { "$lookup": { $exists: true } } },
  { $group: { _id: "$command.pipeline.$lookup.from", count: { $sum: 1 } } }
])
// High count = candidate for extended reference
```

Reference: [https://mongodb.com/blog/post/building-with-patterns-the-extended-reference-pattern](https://mongodb.com/blog/post/building-with-patterns-the-extended-reference-pattern)

### 4.4 Use Outlier Pattern for Exceptional Documents

**Impact: MEDIUM (Prevents 95% of queries from being slowed by 5% of outlier documents)**

**Isolate atypical documents with large arrays to prevent them from degrading performance for typical queries.** When 95% of documents have 50 items but 5% have 5,000, those outliers dominate query time. Split the excess into a separate collection and flag the document.

**Problem scenario:**

```javascript
// Typical book: 50 customers purchased
{ _id: "book1", title: "Normal Book", customers: [/* 50 items */] }

// Bestseller: 50,000 customers - outlier!
{
  _id: "book2",
  title: "Harry Potter",
  customers: [/* 50,000 items = ~2.5MB */]
}

// Query affects both equally
db.books.find({ title: /Potter/ })
// Returns 2.5MB document, killing memory and network
// Index on customers array has 50,000 entries for this one doc
```

**Correct: outlier pattern**

```javascript
// Typical book - unchanged
{
  _id: "book1",
  title: "Normal Book",
  customers: ["cust1", "cust2", /* ... 50 items */],
  hasExtras: false  // Flag for application logic
}

// Bestseller - capped at threshold
{
  _id: "book2",
  title: "Harry Potter",
  customers: [/* first 50 items only */],
  hasExtras: true,  // Flag indicating overflow exists
  customerCount: 50000  // Denormalized count
}

// Overflow in separate collection
{
  _id: ObjectId("..."),
  bookId: "book2",
  customers: [/* items 51-1000 */],
  batch: 1
}
{
  _id: ObjectId("..."),
  bookId: "book2",
  customers: [/* items 1001-2000 */],
  batch: 2
}
// ...additional batches as needed
```

**Querying with outlier pattern:**

```javascript
// Most queries - fast, typical documents
const book = db.books.findOne({ _id: "book1" })
// Returns immediately, small document

// Outlier query - check flag first
const book = db.books.findOne({ _id: "book2" })
if (book.hasExtras) {
  // Load extras only when needed
  const extras = db.book_customers_extra.find({ bookId: "book2" }).toArray()
  book.allCustomers = [...book.customers, ...extras.flatMap(e => e.customers)]
}
```

**Implementation with threshold:**

```javascript
const CUSTOMER_THRESHOLD = 50

// Adding a customer to a book
async function addCustomer(bookId, customerId) {
  const book = await db.books.findOne({ _id: bookId })

  if (book.customers.length < CUSTOMER_THRESHOLD) {
    // Normal case - add to embedded array
    await db.books.updateOne(
      { _id: bookId },
      {
        $push: { customers: customerId },
        $inc: { customerCount: 1 }
      }
    )
  } else {
    // Outlier case - add to overflow collection
    await db.book_customers_extra.updateOne(
      { bookId: bookId, count: { $lt: 1000 } },  // Batch limit
      {
        $push: { customers: customerId },
        $inc: { count: 1 },
        $setOnInsert: { bookId: bookId, batch: nextBatch }
      },
      { upsert: true }
    )
    await db.books.updateOne(
      { _id: bookId },
      {
        $set: { hasExtras: true },
        $inc: { customerCount: 1 }
      }
    )
  }
}
```

**Index strategy:**

```javascript
// Index on main collection - only 50 entries per outlier doc
db.books.createIndex({ "customers": 1 })

// Index on overflow collection
db.book_customers_extra.createIndex({ bookId: 1 })
db.book_customers_extra.createIndex({ customers: 1 })
```

**When to use outlier pattern:**

| Scenario | Threshold | Example |

|----------|-----------|---------|

| Book customers | 50-100 | Bestsellers vs. typical books |

| Social followers | 1,000 | Celebrities vs. regular users |

| Product reviews | 100 | Viral products vs. typical |

| Event attendees | 500 | Major events vs. small meetups |

**When NOT to use this pattern:**

- **Uniform distribution**: If all documents have similar array sizes, no outliers to isolate.

- **Always need full data**: If you always display all 50,000 customers, pattern doesn't help.

- **Write-heavy outliers**: Complex update logic may not be worth the read optimization.

- **Small outliers**: If outliers are 200 vs typical 50, just use larger threshold.

**Verify with:**

```javascript
// Find outlier documents
db.books.aggregate([
  { $project: {
    title: 1,
    customerCount: { $size: { $ifNull: ["$customers", []] } }
  }},
  { $sort: { customerCount: -1 } },
  { $limit: 20 }
])

// Calculate distribution
db.books.aggregate([
  { $project: { count: { $size: { $ifNull: ["$customers", []] } } } },
  { $bucket: {
    groupBy: "$count",
    boundaries: [0, 50, 100, 500, 1000, 10000, 100000],
    default: "100000+",
    output: { count: { $sum: 1 } }
  }}
])
// If 95% are <100 and 5% are >1000, use outlier pattern

// Check index sizes
db.books.stats().indexSizes
// Large multikey index suggests outliers are bloating it
```

Reference: [https://mongodb.com/docs/manual/data-modeling/design-patterns/group-data/outlier-pattern/](https://mongodb.com/docs/manual/data-modeling/design-patterns/group-data/outlier-pattern/)

### 4.5 Use Subset Pattern for Hot/Cold Data

**Impact: MEDIUM (10-100× better working set efficiency, fits 100× more documents in RAM)**

**Keep frequently-accessed (hot) data in the main document, store rarely-accessed (cold) data in a separate collection.** MongoDB loads entire documents into RAM—a 100KB document with 1KB of hot data wastes 99% of your cache. Separating hot/cold data means 100× more useful documents fit in memory.

**Incorrect: all data in one document**

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

**Correct: subset pattern**

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

Reference: [https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)

---

## 5. Schema Validation

**Impact: MEDIUM**

Schema validation catches bad data before it corrupts your database. Without validation, one malformed document can break your entire application—a string where a number is expected, a missing required field, an array that should be an object. MongoDB's JSON Schema validation runs on every insert and update, enforcing data contracts at the database level. You can choose warn mode during development (logs violations but allows writes) or error mode in production (rejects invalid documents). Validation doesn't replace application logic, but it's your last line of defense against data corruption.

### 5.1 Choose Validation Level and Action Appropriately

**Impact: MEDIUM (Enables safe schema migrations, prevents production outages during validation rollout)**

**MongoDB's validation levels and actions let you roll out schema validation safely.** Using the wrong settings can either block legitimate operations or silently allow invalid data. Choose based on your migration state and data quality requirements.

**Incorrect: strict validation on existing data**

```javascript
// Adding strict validation to collection with legacy data
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      required: ["email", "name"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" }
      }
    }
  },
  validationLevel: "strict",   // Validates ALL documents
  validationAction: "error"    // Rejects invalid
})
// Problem: 10,000 existing users without email field
// Result: All updates to those users fail!
// "Document failed validation" on every updateOne()
```

**Correct: gradual rollout with moderate level**

```javascript
// Step 1: Start with warn + moderate to discover issues
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: { required: ["email", "name"] } },
  validationLevel: "moderate",  // Skip existing non-matching docs
  validationAction: "warn"      // Log but allow
})

// Step 2: Find and fix non-compliant documents
db.users.find({ email: { $exists: false } })
// Fix: Add missing emails

// Step 3: Only then switch to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**Validation Levels:**

| Level | Behavior | Use When |

|-------|----------|----------|

| `strict` | Validate ALL inserts and updates | New collections, stable schemas |

| `moderate` | Only validate documents that already match | Adding validation to existing collections |

**Validation Actions:**

| Action | Behavior | Use When |

|--------|----------|----------|

| `error` | Reject invalid documents | Production, data integrity critical |

| `warn` | Allow but log warning | Discovery phase, monitoring |

| `errorAndLog` (v8.1+) | Reject AND log | Production with audit trail |

**Migration workflow—adding validation to existing collection:**

```javascript
// Step 1: Start with warn to discover violations
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      required: ["email", "name"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" },
        name: { bsonType: "string", minLength: 1 }
      }
    }
  },
  validationLevel: "moderate",  // Don't fail existing invalid docs
  validationAction: "warn"      // Log but allow
})

// Step 2: Check logs for validation warnings
db.adminCommand({ getLog: "global" }).log.filter(
  l => l.includes("Document validation")
)

// Step 3: Query to find non-compliant documents
db.users.find({
  $or: [
    { email: { $not: { $type: "string" } } },
    { email: { $not: { $regex: /@/ } } },
    { name: { $exists: false } }
  ]
})

// Step 4: Fix non-compliant data
db.users.updateMany(
  { email: { $not: { $regex: /@/ } } },
  { $set: { email: "invalid@fixme.com", needsReview: true } }
)

// Step 5: Tighten to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**Understanding `moderate` level:**

```javascript
// With validationLevel: "moderate"

// Document that DOESN'T match validation rules
{ _id: 1, email: "not-an-email", name: 123 }  // Pre-existing invalid doc

// Updates to non-matching documents SKIP validation
db.users.updateOne(
  { _id: 1 },
  { $set: { status: "active" } }
)
// SUCCESS - validation skipped because doc didn't match rules

// New inserts still validate
db.users.insertOne({ email: "invalid" })
// FAILS - new documents always validated

// If you update a matching document to become invalid
db.users.updateOne(
  { _id: 2 },  // Assume this doc currently matches rules
  { $set: { email: 123 } }  // Makes it invalid
)
// FAILS - matching documents are validated on update
```

**Error logging: MongoDB 8.1+**

```javascript
// Use errorAndLog for audit trails
db.runCommand({
  collMod: "users",
  validationAction: "errorAndLog"
})

// Failed validations are rejected AND logged
db.users.insertOne({ email: "bad" })
// Logs: { ... "attr": { "error": "Document failed validation" } ... }

// Query mongod logs for validation failures
db.adminCommand({ getLog: "global" }).log.filter(
  l => l.includes("validation") && l.includes("error")
)
```

**Bypassing validation: use sparingly**

```javascript
// Admin operations that need to bypass validation
db.users.insertOne(
  { _id: "system", internalFlag: true },  // Might not match user schema
  { bypassDocumentValidation: true }
)

// Bulk migration with bypass
db.users.bulkWrite(
  [{ insertOne: { document: { legacy: true } } }],
  { bypassDocumentValidation: true }
)

// WARNING: Requires appropriate privileges
// Only use for migrations or system documents
```

**Combining with schema versioning:**

```javascript
// Allow multiple schema versions during migration
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        schemaVersion: { enum: [1, 2] }  // Accept both versions
      },
      oneOf: [
        // Version 1 schema
        {
          properties: { schemaVersion: { const: 1 }, name: { bsonType: "string" } },
          required: ["name"]
        },
        // Version 2 schema
        {
          properties: {
            schemaVersion: { const: 2 },
            firstName: { bsonType: "string" },
            lastName: { bsonType: "string" }
          },
          required: ["firstName", "lastName"]
        }
      ]
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Both versions are valid
db.users.insertOne({ schemaVersion: 1, name: "Alice" })  // OK
db.users.insertOne({ schemaVersion: 2, firstName: "Bob", lastName: "Smith" })  // OK
```

**When NOT to use strict + error:**

- **During active migration**: Use moderate + warn until data is cleaned.

- **Legacy systems integration**: External data may not conform.

- **Feature flag rollouts**: New fields may be optional initially.

**Verify with:**

```javascript
// Check current validation settings
const info = db.getCollectionInfos({ name: "users" })[0]
console.log("Level:", info.options.validationLevel)
console.log("Action:", info.options.validationAction)
console.log("Validator:", JSON.stringify(info.options.validator, null, 2))

// Count documents that would fail current validation
// (Run this BEFORE switching to strict)
const validator = info.options.validator
db.users.countDocuments({
  $nor: [validator]  // Documents NOT matching validator
})
// If count > 0, fix data before switching to strict
```

Reference: [https://mongodb.com/docs/manual/core/schema-validation/specify-validation-level/](https://mongodb.com/docs/manual/core/schema-validation/specify-validation-level/)

### 5.2 Define Validation Rules with JSON Schema

**Impact: MEDIUM (Human-readable validation, catches 90% of data quality issues at insert time)**

**Use JSON Schema for document validation—it's readable, maintainable, and catches data quality issues before they corrupt your database.** JSON Schema provides clear syntax for types, required fields, patterns, and nested structures that both developers and tools can understand.

**Incorrect: no validation, data corruption**

```javascript
// No schema validation - anything goes
db.products.insertOne({ price: "free" })      // String instead of number
db.products.insertOne({ price: -100 })        // Negative price
db.products.insertOne({ name: "" })           // Empty name
db.products.insertOne({ category: "xyz123" }) // Invalid category

// Later in your application:
const total = products.reduce((sum, p) => sum + p.price, 0)
// NaN! Because "free" + 100 = NaN
// Bug discovered months later, data already corrupted
```

**Correct: JSON Schema catches errors at insert**

```javascript
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "price", "category"],
      properties: {
        name: { bsonType: "string", minLength: 1 },
        price: { bsonType: "double", minimum: 0 },
        category: { enum: ["electronics", "clothing", "food"] }
      }
    }
  }
})

db.products.insertOne({ price: "free" })
// Error: "price" must be double, got string
// Data quality enforced at database level!
```

**Basic JSON Schema structure:**

```javascript
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "Product Validation",
      description: "Enforces product data quality",
      required: ["name", "price", "category"],
      properties: {
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Product name, 1-200 characters"
        },
        price: {
          bsonType: "double",
          minimum: 0,
          description: "Price must be non-negative"
        },
        category: {
          enum: ["electronics", "clothing", "food", "other"],
          description: "Must be valid category"
        },
        sku: {
          bsonType: "string",
          pattern: "^[A-Z]{3}-[0-9]{6}$",
          description: "Format: ABC-123456"
        }
      }
    }
  }
})
```

**BSON types available:**

| bsonType | JavaScript Equivalent | Example |

|----------|----------------------|---------|

| `"string"` | String | `"hello"` |

| `"int"` | 32-bit integer | `42` |

| `"long"` | 64-bit integer | `NumberLong(42)` |

| `"double"` | Floating point | `3.14` |

| `"decimal"` | 128-bit decimal | `NumberDecimal("3.14")` |

| `"bool"` | Boolean | `true` |

| `"date"` | Date | `ISODate("2024-01-15")` |

| `"objectId"` | ObjectId | `ObjectId("...")` |

| `"array"` | Array | `[1, 2, 3]` |

| `"object"` | Embedded document | `{ a: 1 }` |

| `"null"` | Null | `null` |

**Validating nested documents:**

```javascript
{
  $jsonSchema: {
    properties: {
      address: {
        bsonType: "object",
        required: ["city", "country"],
        properties: {
          street: { bsonType: "string" },
          city: { bsonType: "string", minLength: 1 },
          country: {
            bsonType: "string",
            enum: ["US", "CA", "UK", "DE", "FR"]
          },
          zip: {
            bsonType: "string",
            pattern: "^[0-9]{5}(-[0-9]{4})?$"
          }
        },
        additionalProperties: false  // Reject unknown fields
      }
    }
  }
}
```

**Validating arrays:**

```javascript
{
  $jsonSchema: {
    properties: {
      tags: {
        bsonType: "array",
        minItems: 1,
        maxItems: 20,
        uniqueItems: true,
        items: {
          bsonType: "string",
          minLength: 2,
          maxLength: 30
        },
        description: "1-20 unique tags"
      },
      variants: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["size", "color"],
          properties: {
            size: { enum: ["XS", "S", "M", "L", "XL"] },
            color: { bsonType: "string" },
            stock: { bsonType: "int", minimum: 0 }
          }
        }
      }
    }
  }
}
```

**Conditional validation:**

```javascript
// Different rules based on document type
{
  $jsonSchema: {
    properties: {
      type: { enum: ["physical", "digital"] }
    },
    oneOf: [
      {
        properties: {
          type: { const: "physical" },
          weight: { bsonType: "double", minimum: 0 },
          dimensions: { bsonType: "object" }
        },
        required: ["weight", "dimensions"]
      },
      {
        properties: {
          type: { const: "digital" },
          downloadUrl: { bsonType: "string" },
          fileSize: { bsonType: "int" }
        },
        required: ["downloadUrl"]
      }
    ]
  }
}
```

**Combining with query operators:**

```javascript
// JSON Schema + MongoDB query operators
{
  validator: {
    $and: [
      { $jsonSchema: {
        required: ["price"],
        properties: {
          price: { bsonType: "double" }
        }
      }},
      // Query operator validation
      { price: { $gte: 0 } },
      { $expr: { $lte: ["$salePrice", "$price"] } }
    ]
  }
}
```

**Error messages:**

```javascript
// Insert invalid document
db.products.insertOne({ name: "", price: -5 })

// Error shows which validation failed:
// WriteError: Document failed validation
// - name: minLength 1, actual 0
// - price: minimum 0, actual -5
```

**When NOT to use JSON Schema:**

- **Polymorphic collections**: Event logs with varied structures may need looser validation.

- **Schema-less by design**: Some applications intentionally allow arbitrary fields.

- **Very complex cross-field logic**: Use query operators or application validation instead.

**Verify with:**

```javascript
// View existing validation rules
db.getCollectionInfos({ name: "products" })[0].options.validator

// Test validation without inserting
db.runCommand({
  insert: "products",
  documents: [{ name: "Test", price: -1 }],
  bypassDocumentValidation: false
})
// Returns error without modifying collection

// Find documents that would fail validation
// (useful when adding validation to existing collection)
db.products.find({
  $nor: [{
    $and: [
      { name: { $type: "string" } },
      { price: { $type: "number", $gte: 0 } }
    ]
  }]
})
```

Reference: [https://mongodb.com/docs/manual/core/schema-validation/specify-json-schema/](https://mongodb.com/docs/manual/core/schema-validation/specify-json-schema/)

---

## References

1. [https://mongodb.com/docs/manual/data-modeling/](https://mongodb.com/docs/manual/data-modeling/)
2. [https://mongodb.com/docs/manual/data-modeling/schema-design-process/](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)
3. [https://mongodb.com/docs/manual/data-modeling/design-antipatterns/](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)
4. [https://mongodb.com/docs/manual/data-modeling/concepts/embedding/](https://mongodb.com/docs/manual/data-modeling/concepts/embedding/)
5. [https://mongodb.com/docs/manual/data-modeling/concepts/referencing/](https://mongodb.com/docs/manual/data-modeling/concepts/referencing/)
6. [https://mongodb.com/docs/manual/data-modeling/concepts/data-model-tree/](https://mongodb.com/docs/manual/data-modeling/concepts/data-model-tree/)
7. [https://mongodb.com/docs/manual/data-modeling/design-patterns/](https://mongodb.com/docs/manual/data-modeling/design-patterns/)
8. [https://mongodb.com/blog/post/building-with-patterns-a-summary](https://mongodb.com/blog/post/building-with-patterns-a-summary)
9. [https://mongodb.com/docs/manual/core/schema-validation/](https://mongodb.com/docs/manual/core/schema-validation/)
10. [https://mongodb.com/docs/atlas/schema-suggestions/](https://mongodb.com/docs/atlas/schema-suggestions/)
