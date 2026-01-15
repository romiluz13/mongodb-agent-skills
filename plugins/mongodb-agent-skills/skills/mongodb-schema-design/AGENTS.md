# MongoDB Schema Design Best Practices

> MongoDB schema design patterns and anti-patterns for AI agents and developers. Contains 12 rules across 3 categories.

**Version:** 1.0.0
**Organization:** MongoDB
**Date:** January 2025

## When to Apply

Use this skill when:
- Designing a new MongoDB schema or data model
- Reviewing existing schema for anti-patterns
- Deciding between embedding vs referencing
- Optimizing document structure for query patterns
- Migrating from SQL to MongoDB

## Quick Reference

| Category | Impact | Rules |
|----------|--------|-------|
| Schema Anti-Patterns | CRITICAL | 1.1-1.5 |
| Schema Fundamentals | HIGH | 2.1-2.4 |
| Design Patterns | MEDIUM | 3.1-3.3 |

---

## 1. Schema Anti-Patterns

**Impact:** CRITICAL
**Description:** Anti-patterns that cause unbounded document growth, memory pressure, and cascading performance issues. These are flagged by Atlas Schema Suggestions and are the #1 cause of MongoDB production incidents.

### 1.1 Avoid Unbounded Arrays

Never design schemas where arrays can grow indefinitely. Unbounded arrays cause documents to exceed the 16MB BSON limit, degrade write performance as documents grow, and force expensive document relocations.

**Incorrect (array grows forever):**

```javascript
// User document with unbounded activity log
{
  _id: "user123",
  name: "Alice",
  activityLog: [
    { action: "login", ts: ISODate("2024-01-01") },
    { action: "purchase", ts: ISODate("2024-01-02") },
    // ... grows to 100,000+ entries over time
  ]
}
```

**Correct (separate collection with reference):**

```javascript
// User document (bounded)
{ _id: "user123", name: "Alice" }

// Activity in separate collection
{ userId: "user123", action: "login", ts: ISODate("2024-01-01") }
{ userId: "user123", action: "purchase", ts: ISODate("2024-01-02") }
```

**Alternative (bucket pattern for time-series):**

```javascript
// Activity bucket - one document per user per day
{
  userId: "user123",
  date: ISODate("2024-01-01"),
  activities: [
    { action: "login", ts: ISODate("...") },
    { action: "purchase", ts: ISODate("...") }
  ],
  count: 2
}
```

Atlas Schema Suggestions flags this as: "Avoid unbounded arrays". If your array can grow beyond ~100 elements, redesign.

Reference: [Schema Design Anti-Patterns](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)

---

### 1.2 Avoid Bloated Documents

Keep frequently-accessed documents small. Large documents waste RAM because MongoDB loads entire documents into memory, even when queries only need a few fields. Bloated documents reduce working set efficiency and increase I/O.

**Incorrect (everything in one document):**

```javascript
// Product with full history and all images embedded
{
  _id: "prod123",
  name: "Laptop",
  price: 999,
  description: "...", // 5KB text
  fullSpecs: {...},   // 10KB nested object
  images: [...],      // 500KB of base64 encoded images
  reviews: [...],     // 100KB of user reviews
  priceHistory: [...] // 50KB of historical prices
}
// Total: ~665KB per product
```

**Correct (hot data only in main document):**

```javascript
// Product - hot data only (~500 bytes)
{
  _id: "prod123",
  name: "Laptop",
  price: 999,
  thumbnail: "https://cdn.example.com/prod123.jpg",
  avgRating: 4.5,
  reviewCount: 127
}

// Separate collections for cold data
// products_details: { productId, description, fullSpecs }
// products_images: { productId, images: [...] }
// products_reviews: { productId, reviews: [...] }
```

**Rule of thumb:** If your working set documents are over 16KB, split them. Aim for documents under 4KB for frequently-queried collections.

Atlas Schema Suggestions flags this as: "Reduce large documents". A 100× smaller document means 100× more documents fit in RAM.

Reference: [Schema Design Anti-Patterns](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)

---

### 1.3 Limit Array Size

Arrays over 1,000 elements cause severe performance issues. Every array modification requires rewriting the entire array. Multikey indexes on large arrays consume excessive memory and slow down writes.

**Incorrect (large arrays):**

```javascript
// Blog post with all comments embedded
{
  _id: "post123",
  title: "Popular Post",
  comments: [
    // 5,000 comments, each ~500 bytes
    // Total array: 2.5MB, rewritten on every new comment
  ]
}

// Adding a comment rewrites 2.5MB
db.posts.updateOne(
  { _id: "post123" },
  { $push: { comments: newComment } }
)
```

**Correct (bounded array + overflow collection):**

```javascript
// Post with only recent comments (max 20)
{
  _id: "post123",
  title: "Popular Post",
  recentComments: [/* last 20 comments */],
  commentCount: 5000
}

// All comments in separate collection
{ postId: "post123", author: "...", text: "...", ts: ISODate("...") }

// Add comment: update counter + push with $slice
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: { recentComments: { $each: [newComment], $slice: -20 } },
    $inc: { commentCount: 1 }
  }
)
// Also insert into comments collection
db.comments.insertOne({ postId: "post123", ...newComment })
```

**Thresholds:**
- <100 elements: Safe to embed
- 100-1000 elements: Consider carefully, use $slice
- >1000 elements: Always separate collection

Reference: [Building with Patterns - Subset Pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)

---

### 1.4 Reduce Unnecessary Collections

Too many collections indicate over-normalization. Each additional collection requires a separate query or $lookup, adding latency and complexity. Embed when data is accessed together.

**Incorrect (SQL-style normalization):**

```javascript
// 5 collections for one order
// orders: { _id, customerId, date, status }
// order_items: { orderId, productId, quantity, price }
// products: { _id, name, sku }
// customers: { _id, name, email }
// addresses: { customerId, street, city }

// Displaying one order requires 5 queries or complex $lookup
db.orders.aggregate([
  { $match: { _id: orderId } },
  { $lookup: { from: "order_items", ... } },
  { $lookup: { from: "products", ... } },
  { $lookup: { from: "customers", ... } },
  { $lookup: { from: "addresses", ... } }
])
```

**Correct (embedded document model):**

```javascript
// Single document contains everything needed
{
  _id: "order123",
  date: ISODate("2024-01-15"),
  status: "shipped",
  customer: {
    name: "Alice Smith",
    email: "alice@example.com"
  },
  shippingAddress: {
    street: "123 Main St",
    city: "Boston"
  },
  items: [
    { sku: "LAPTOP-01", name: "Laptop", quantity: 1, price: 999 },
    { sku: "MOUSE-02", name: "Mouse", quantity: 2, price: 29 }
  ],
  total: 1057
}

// One query returns complete order
db.orders.findOne({ _id: "order123" })
```

**When to use separate collections:**
- Data changes independently at different rates
- Data is accessed separately most of the time
- Arrays would grow unbounded
- Document would exceed 16MB

Atlas Schema Suggestions flags this as: "Reduce number of collections".

Reference: [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)

---

### 1.5 Reduce Excessive $lookup Usage

Frequent $lookup operations indicate a schema that should be denormalized. Each $lookup is a separate query that cannot be fully optimized. If you're always joining the same data, embed it.

**Incorrect (constant $lookup for common operations):**

```javascript
// Every product page requires this $lookup
db.products.aggregate([
  { $match: { _id: productId } },
  { $lookup: {
      from: "categories",
      localField: "categoryId",
      foreignField: "_id",
      as: "category"
  }},
  { $lookup: {
      from: "brands",
      localField: "brandId",
      foreignField: "_id",
      as: "brand"
  }}
])
// 3 collection scans for every product view
```

**Correct (denormalize frequently-joined data):**

```javascript
// Embed data that's always displayed with product
{
  _id: "prod123",
  name: "Laptop Pro",
  price: 1299,
  category: {
    _id: "cat-electronics",
    name: "Electronics",
    path: "Electronics > Computers > Laptops"
  },
  brand: {
    _id: "brand-acme",
    name: "Acme Corp",
    logo: "https://cdn.example.com/acme.png"
  }
}

// Single query, no $lookup needed
db.products.findOne({ _id: "prod123" })
```

**Managing denormalized data:**

```javascript
// When category name changes, update all products
db.products.updateMany(
  { "category._id": "cat-electronics" },
  { $set: { "category.name": "Consumer Electronics" } }
)
```

**Use $lookup only for:**
- Rarely-needed data (avoid embedding)
- Data that changes frequently and independently
- Analytics queries, not real-time operations

Atlas Schema Suggestions flags this as: "Reduce $lookup operations".

Reference: [Schema Design Anti-Patterns](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)

---

## 2. Schema Fundamentals

**Impact:** HIGH
**Description:** Core data modeling decisions that determine long-term application performance. Wrong fundamentals require schema migrations to fix—get them right from the start.

### 2.1 Embed vs Reference Decision Framework

Choose embedding or referencing based on access patterns, not entity relationships. This decision affects every query your application makes.

**Embed when:**
- Data is always accessed together (1:1 or 1:few)
- Child data doesn't make sense without parent
- Updates to both happen atomically
- Child array is bounded (<100 elements typical)

**Reference when:**
- Data is accessed independently
- Many-to-many relationships
- Child data is large (>16KB) or unbounded
- Different update frequencies

**Incorrect (reference when should embed):**

```javascript
// Separate user and profile - always accessed together
// users: { _id, email }
// profiles: { userId, name, avatar, bio }

// Every user fetch requires two queries
const user = await db.users.findOne({ _id: userId })
const profile = await db.profiles.findOne({ userId })
```

**Correct (embed 1:1 data):**

```javascript
// User with embedded profile
{
  _id: "user123",
  email: "alice@example.com",
  profile: {
    name: "Alice Smith",
    avatar: "https://...",
    bio: "Developer"
  }
}

// Single query returns everything
const user = await db.users.findOne({ _id: userId })
```

**Decision Matrix:**

| Relationship | Read Pattern | Write Pattern | Decision |
|--------------|--------------|---------------|----------|
| 1:1 | Always together | Together | Embed |
| 1:few | Usually together | Together | Embed |
| 1:many | Usually together | Separate | Embed (bounded) |
| 1:many | Separately | Separate | Reference |
| many:many | Any | Any | Reference |

Reference: [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)

---

### 2.2 Store Data That's Accessed Together

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

Reference: [Data Modeling Introduction](https://mongodb.com/docs/manual/data-modeling/)

---

### 2.3 Embrace the Document Model

Don't recreate SQL tables in MongoDB. The document model exists to avoid joins, not to store flat rows with foreign keys. Think in documents, not tables.

**Incorrect (SQL patterns in MongoDB):**

```javascript
// SQL-style: flat documents with IDs everywhere
// customers: { _id, name, email }
// addresses: { _id, customerId, type, street, city, zip }
// phones: { _id, customerId, type, number }
// preferences: { _id, customerId, key, value }

// To load a customer profile: 4 queries + application joins
```

**Correct (rich document model):**

```javascript
// Customer document contains everything about the customer
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

// Single query loads complete customer
db.customers.findOne({ _id: "cust123" })
```

**Benefits of document model:**

- **Atomicity**: Update entire customer in one operation
- **Performance**: No joins, single disk read
- **Simplicity**: Application code mirrors data structure
- **Flexibility**: Schema can vary per document

**When migrating from SQL:**

1. Don't convert tables 1:1 to collections
2. Identify which tables are always joined
3. Denormalize those joins into documents
4. Keep separate only what's accessed separately

Reference: [Schema Design Process](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)

---

### 2.4 Use Schema Validation

Enforce document structure with MongoDB's built-in JSON Schema validation. Catch invalid data before it corrupts your database, not after.

**Incorrect (no validation):**

```javascript
// Any document can be inserted
db.users.insertOne({ email: "not-an-email", age: "twenty" })
// Invalid data now in production
```

**Correct (schema validation):**

```javascript
// Create collection with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        },
        status: {
          enum: ["active", "inactive", "pending"]
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Invalid inserts now fail
db.users.insertOne({ email: "not-an-email" })
// Error: Document failed validation
```

**Validation levels:**

- `strict`: Validate all inserts and updates (default)
- `moderate`: Only validate documents that already match schema

**Validation actions:**

- `error`: Reject invalid documents (default)
- `warn`: Allow but log warning

Reference: [Schema Validation](https://mongodb.com/docs/manual/core/schema-validation/)

---

## 3. Design Patterns

**Impact:** MEDIUM
**Description:** Proven patterns for specific use cases like time-series data, frequently-accessed relationships, and large datasets. Apply when the use case matches.

### 3.1 Use Bucket Pattern for Time-Series Data

Group time-series data into buckets instead of one document per event. Reduces document count, index size, and query overhead for time-based data like metrics, logs, or IoT readings.

**Incorrect (one document per event):**

```javascript
// Sensor readings: 1 document per reading
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:00"), value: 22.5 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:01"), value: 22.6 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:02"), value: 22.5 }
// 86,400 documents per sensor per day
// 31M documents per sensor per year
```

**Correct (bucket pattern - group by time):**

```javascript
// One document per sensor per hour
{
  sensorId: "temp-01",
  bucket: ISODate("2024-01-15T10:00:00"), // hour bucket
  readings: [
    { ts: ISODate("2024-01-15T10:00:00"), value: 22.5 },
    { ts: ISODate("2024-01-15T10:00:01"), value: 22.6 },
    { ts: ISODate("2024-01-15T10:00:02"), value: 22.5 }
    // ... up to 3,600 readings per hour
  ],
  count: 3600,
  sum: 81234.5,
  min: 21.2,
  max: 24.8
}
// 24 documents per sensor per day
// 8,760 documents per sensor per year (3,600× fewer)
```

**Benefits:**
- Fewer documents = smaller indexes
- Pre-computed aggregates (sum, min, max)
- Efficient range queries on buckets
- Bounded array size

**Alternative: Use MongoDB Time Series Collections** (5.0+):

```javascript
db.createCollection("sensor_data", {
  timeseries: {
    timeField: "ts",
    metaField: "sensorId",
    granularity: "seconds"
  }
})
```

Reference: [Building with Patterns - Bucket Pattern](https://mongodb.com/blog/post/building-with-patterns-the-bucket-pattern)

---

### 3.2 Use Extended Reference Pattern

Copy frequently-accessed fields from referenced documents into the parent. Eliminates $lookup for common queries while keeping the full data normalized.

**Incorrect (always $lookup for display data):**

```javascript
// Order references customer by ID only
{
  _id: "order123",
  customerId: "cust456", // Just an ID
  items: [...],
  total: 299.99
}

// Every order display requires $lookup
db.orders.aggregate([
  { $match: { _id: "order123" } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  }}
])
```

**Correct (extended reference):**

```javascript
// Order contains frequently-needed customer fields
{
  _id: "order123",
  customer: {
    _id: "cust456",         // Reference for full lookup when needed
    name: "Alice Smith",    // Cached for display
    email: "alice@ex.com"   // Cached for notifications
  },
  items: [...],
  total: 299.99
}

// Display order without $lookup
db.orders.findOne({ _id: "order123" })

// Full customer data still available when needed
db.customers.findOne({ _id: order.customer._id })
```

**What to cache:**

- Fields displayed in lists (name, avatar, title)
- Fields used for sorting/filtering
- Slowly-changing data (name vs real-time balance)

**What NOT to cache:**

- Frequently-changing data (balance, inventory)
- Sensitive data in non-sensitive collections
- Large fields (bio, description)

Reference: [Building with Patterns - Extended Reference](https://mongodb.com/blog/post/building-with-patterns-the-extended-reference-pattern)

---

### 3.3 Use Subset Pattern for Hot/Cold Data

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

Reference: [Building with Patterns - Subset Pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)

---

## References

- [MongoDB Data Modeling](https://mongodb.com/docs/manual/data-modeling/)
- [Schema Design Process](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)
- [Schema Design Anti-Patterns](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)
- [Building with Patterns Series](https://mongodb.com/blog/post/building-with-patterns-a-summary)
- [Schema Validation](https://mongodb.com/docs/manual/core/schema-validation/)
- [Atlas Schema Suggestions](https://mongodb.com/docs/atlas/schema-suggestions/)
