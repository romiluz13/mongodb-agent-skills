---
title: Batch Operations to Avoid N+1 Queries
impact: HIGH
impactDescription: N round trips reduced to 1-2
tags: query, n-plus-one, batch, in-operator, lookup, performance
---

## Batch Operations to Avoid N+1 Queries

Never query in a loop. The N+1 pattern (1 query + N follow-up queries) creates N unnecessary round trips. Use $in or $lookup to batch operations.

**Incorrect (N+1 queries):**

```javascript
// Get orders, then fetch customer for each
const orders = await db.orders.find({ status: "pending" }).toArray()

// N+1 problem: 1 query + 100 queries
for (const order of orders) {
  order.customer = await db.customers.findOne({ _id: order.customerId })
}
// 100 orders = 101 database round trips
// At 5ms per query = 500ms total
```

**Correct (batch with $in):**

```javascript
// Get orders
const orders = await db.orders.find({ status: "pending" }).toArray()

// Batch fetch all customers in one query
const customerIds = orders.map(o => o.customerId)
const customers = await db.customers.find({
  _id: { $in: customerIds }
}).toArray()

// Build lookup map
const customerMap = new Map(customers.map(c => [c._id.toString(), c]))

// Attach to orders
orders.forEach(o => {
  o.customer = customerMap.get(o.customerId.toString())
})
// 100 orders = 2 database round trips = 10ms total
```

**Correct (single query with $lookup):**

```javascript
// All in one aggregation
const ordersWithCustomers = await db.orders.aggregate([
  { $match: { status: "pending" } },
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
    }
  },
  { $unwind: "$customer" }
]).toArray()
// 1 round trip, database handles join
```

**Batch inserts:**

```javascript
// Bad: Insert one at a time
for (const doc of documents) {
  await db.items.insertOne(doc)  // N round trips
}

// Good: Batch insert
await db.items.insertMany(documents)  // 1 round trip
```

**Batch updates:**

```javascript
// Bad: Update one at a time
for (const id of ids) {
  await db.items.updateOne({ _id: id }, { $set: { processed: true } })
}

// Good: Batch update
await db.items.updateMany(
  { _id: { $in: ids } },
  { $set: { processed: true } }
)
```

Reference: [Query Optimization](https://mongodb.com/docs/manual/core/query-optimization/)
