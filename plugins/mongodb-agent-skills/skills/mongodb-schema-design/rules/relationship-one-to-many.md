---
title: Model One-to-Many Relationships with References
impact: HIGH
impactDescription: "Handles unbounded growth, prevents 16MB crashes, enables independent queries"
tags: schema, relationships, one-to-many, referencing, scalability
---

## Model One-to-Many Relationships with References

**Use references when the "many" side is unbounded or frequently accessed independently.** Store the parent's ID in each child document. This pattern prevents documents from exceeding 16MB and allows efficient queries from either direction.

**Incorrect (embedding unbounded arrays):**

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

**Correct (reference in child documents):**

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

**Alternative (hybrid with subset):**

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

---

## ⚠️ Before You Implement

**I recommend references for one-to-many, but please verify your setup first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Reference field indexed | Queries from child to parent need index | Check child collection indexes |
| Cardinality is unbounded | Only use references if truly unbounded | Check max children per parent |
| Query direction | If mostly parent→children, consider embedding | Review query patterns |
| Orphan prevention | No foreign keys - orphans can accumulate | Check for orphaned references |

**Verification query:**
```javascript
// Check for missing indexes on reference fields
db.childCollection.getIndexes()
// Look for index on parent_id or similar reference field

// Check cardinality distribution
db.childCollection.aggregate([
  { $group: { _id: "$parent_id", count: { $sum: 1 } } },
  { $group: {
      _id: null,
      avgChildren: { $avg: "$count" },
      maxChildren: { $max: "$count" },
      parentCount: { $sum: 1 }
  }}
])

// Check for orphaned references
db.childCollection.aggregate([
  { $lookup: {
      from: "parentCollection",
      localField: "parent_id",
      foreignField: "_id",
      as: "parent"
  }},
  { $match: { parent: { $size: 0 } } },
  { $count: "orphanedChildren" }
])
```

**Interpretation:**
- ✅ Index exists, no orphans, unbounded growth: References are appropriate
- ⚠️ No index on reference field: Add index before proceeding
- 🔴 Max children <50: Consider embedding instead of references

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Verify index on reference field
- `mcp__mongodb__aggregate` - Check cardinality and orphan count
- `mcp__mongodb__collection-schema` - Confirm reference field structure
- `mcp__mongodb__explain` - Test query performance with references

**Just ask:** "Can you check if my one-to-many reference pattern is set up correctly?"

---

Reference: [Model One-to-Many Relationships with Document References](https://mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/)
