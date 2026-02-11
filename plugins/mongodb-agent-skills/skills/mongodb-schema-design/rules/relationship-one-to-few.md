---
title: Model One-to-Few Relationships with Embedded Arrays
impact: HIGH
impactDescription: "Single query for bounded arrays, no $lookup overhead"
tags: schema, relationships, one-to-few, embedding, arrays
---

## Model One-to-Few Relationships with Embedded Arrays

**Embed bounded, small arrays directly in the parent document.** When a parent entity has a small, predictable number of children that are always accessed together, embed them as an array. This eliminates $lookup operations and keeps related data atomic.

**Incorrect (separate collection for few items):**

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

**Correct (embedded array):**

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

**Alternative ($slice for bounded recent items):**

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

## Verify with

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

Reference: [Model One-to-Many Relationships with Embedded Documents](https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/)
