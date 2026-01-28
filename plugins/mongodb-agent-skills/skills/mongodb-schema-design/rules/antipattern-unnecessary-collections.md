---
title: Reduce Unnecessary Collections
impact: CRITICAL
impactDescription: "5-10× faster reads by eliminating joins, single query returns complete data"
tags: schema, collections, anti-pattern, embedding, normalization, atlas-suggestion
---

## Reduce Unnecessary Collections

**Too many collections is the most common mistake when migrating from SQL.** Each additional collection requires a separate query or $lookup, adding network round-trips and query planning overhead. MongoDB's document model lets you embed related data and return complete objects in a single read—use it.

**Incorrect (SQL-style normalization):**

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

**Correct (embedded document model):**

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

**Alternative (hybrid for reusable entities):**

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

---

## Before You Implement

**I recommend embedding related data, but please verify your current collection usage first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Count total collections | Too many collections = SQL-style thinking | List collections in database |
| Identify $lookup patterns | Collections always joined should be embedded | Profile aggregation queries |
| Check collection access patterns | Collections queried together should be merged | Analyze query logs |
| Review data relationships | 1:1 and 1:few relationships should embed | Examine foreign key fields |

**Verification query:**
```javascript
// Count collections and identify potential merge candidates
db.adminCommand({ listDatabases: 1 }).databases.forEach(d => {
  const colls = db.getSiblingDB(d.name).getCollectionNames()
  print(`${d.name}: ${colls.length} collections`)
  colls.forEach(c => print(`  - ${c}`))
})

// Find collections with foreign key patterns (candidates for embedding)
db.collection.aggregate([
  { $project: { fields: { $objectToArray: "$$ROOT" } } },
  { $unwind: "$fields" },
  { $match: { "fields.k": { $regex: /Id$/ } } },
  { $group: { _id: "$fields.k", count: { $sum: 1 } } }
])
```

**Interpretation:**
- Good result (< 10 collections for simple app): Collection count is appropriate
- Warning (10-20 collections): Review for embedding opportunities
- Bad result (> 20 collections for simple app): Likely over-normalized, plan consolidation

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__list-collections` - Count and list all collections
- `mcp__mongodb__collection-schema` - Identify foreign key fields indicating references
- `mcp__mongodb__aggregate` - Analyze $lookup usage patterns

**Just ask:** "Can you analyze my database structure and identify which collections should be merged or embedded?"

---

Reference: [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
