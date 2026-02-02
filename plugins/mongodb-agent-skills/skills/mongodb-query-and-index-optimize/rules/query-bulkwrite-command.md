---
title: Use bulkWrite for Cross-Collection Batch Operations
impact: HIGH
impactDescription: "Single atomic command for operations across multiple collections"
tags: bulkWrite, batch, cross-collection, MongoDB-8.0, atomic
---

## Use bulkWrite for Cross-Collection Batch Operations

**MongoDB 8.0 introduced the `bulkWrite` command**, which performs batch inserts, updates, and deletes across multiple collections in a single command. Unlike the collection method `collection.bulkWrite()`, this is a database-level command that works across collections atomically.

**Incorrect (multiple separate operations):**

```javascript
// Multiple operations across collections - not atomic
// If operation 2 fails, operation 1 already committed
await db.orders.insertOne({ orderId: "123", status: "pending" })
await db.inventory.updateOne(
  { productId: "abc" },
  { $inc: { quantity: -1 } }
)
await db.audit.insertOne({
  action: "order_created",
  orderId: "123",
  timestamp: new Date()
})
// Risk: Partial failure leaves inconsistent state
```

**Correct (single atomic bulkWrite command):**

```javascript
// MongoDB 8.0+ bulkWrite command - atomic across collections
db.adminCommand({
  bulkWrite: 1,
  ops: [
    {
      insert: 0,  // Index into nsInfo array
      document: { orderId: "123", status: "pending" }
    },
    {
      update: 1,
      filter: { productId: "abc" },
      updateMods: { $inc: { quantity: -1 } }
    },
    {
      insert: 2,
      document: {
        action: "order_created",
        orderId: "123",
        timestamp: new Date()
      }
    }
  ],
  nsInfo: [
    { ns: "mydb.orders" },
    { ns: "mydb.inventory" },
    { ns: "mydb.audit" }
  ],
  ordered: true  // Stop on first error (default)
})
```

**Unordered for parallel execution:**

```javascript
// Unordered execution - continues on errors, faster for independent ops
db.adminCommand({
  bulkWrite: 1,
  ops: [
    { insert: 0, document: { _id: 1, value: "a" } },
    { insert: 0, document: { _id: 2, value: "b" } },
    { insert: 1, document: { _id: 1, value: "c" } },
    { update: 1, filter: { _id: 2 }, updateMods: { $set: { value: "d" } } }
  ],
  nsInfo: [
    { ns: "mydb.collection1" },
    { ns: "mydb.collection2" }
  ],
  ordered: false  // Continue even if some ops fail
})
```

**Supported operations:**

```javascript
// Insert
{ insert: <nsIndex>, document: <document> }

// Update (single or multi)
{
  update: <nsIndex>,
  filter: <query>,
  updateMods: <update>,
  multi: false,       // Default: update one
  upsert: false       // Default: no upsert
}

// Delete (single or multi)
{
  delete: <nsIndex>,
  filter: <query>,
  multi: false        // Default: delete one
}
```

**When NOT to use this pattern:**

- **Single collection operations**: Use `collection.bulkWrite()` method instead - it's simpler.
- **Sharded clusters without transactions**: Cross-shard atomicity requires transactions.
- **Pre-MongoDB 8.0**: This command doesn't exist in earlier versions.
- **Need for result per operation**: Response is summarized, not per-document.

Reference: [bulkWrite Command](https://mongodb.com/docs/manual/reference/command/bulkWrite/)
