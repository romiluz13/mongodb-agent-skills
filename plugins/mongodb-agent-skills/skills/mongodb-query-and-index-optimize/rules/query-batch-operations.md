---
title: Batch Operations to Avoid N+1 Queries
impact: HIGH
impactDescription: "101 round trips → 2 round trips—50× faster by eliminating N+1 query pattern"
tags: query, n-plus-one, batch, in-operator, lookup, performance, round-trips
---

## Batch Operations to Avoid N+1 Queries

**Never query inside a loop—the N+1 pattern is the most common cause of slow APIs.** One query returns N items, then N follow-up queries fetch related data. With 100ms network latency, 100 items = 10+ seconds. Batch with `$in` or `$lookup` to reduce N+1 queries to 1-2 queries regardless of N.

**Incorrect (N+1 queries—linear scaling horror):**

```javascript
// "Get pending orders with customer details"
const orders = await db.orders.find({ status: "pending" }).toArray()

// N+1 anti-pattern: loop queries
for (const order of orders) {
  // Each iteration = 1 database round trip
  order.customer = await db.customers.findOne({ _id: order.customerId })
}

// Cost breakdown for 100 orders:
// - Initial query: 1 round trip, 5ms
// - Customer lookups: 100 round trips, 5ms each = 500ms
// - Total: 101 round trips, ~505ms minimum
//
// At scale:
// - 1,000 orders = 1,001 queries = 5+ seconds
// - 10,000 orders = 10,001 queries = 50+ seconds
//
// With network latency (cloud/microservices):
// - 100ms latency × 100 queries = 10 SECONDS just waiting for network

// Even worse: nested N+1
for (const order of orders) {
  order.customer = await db.customers.findOne({ _id: order.customerId })
  order.items = await db.items.find({ orderId: order._id }).toArray()
  for (const item of order.items) {
    item.product = await db.products.findOne({ _id: item.productId })
  }
}
// 100 orders × 3 items each = 100 + 100 + 300 = 500+ queries
```

**Correct (batch with $in—constant round trips):**

```javascript
// Get orders
const orders = await db.orders.find({ status: "pending" }).toArray()

// Collect all customer IDs (deduplicated)
const customerIds = [...new Set(orders.map(o => o.customerId))]

// Single batch query for ALL customers
const customers = await db.customers.find({
  _id: { $in: customerIds }
}).toArray()

// Build lookup map for O(1) access
const customerMap = new Map(
  customers.map(c => [c._id.toString(), c])
)

// Attach customers to orders (in-memory, no DB)
orders.forEach(o => {
  o.customer = customerMap.get(o.customerId.toString())
})

// Cost: 2 round trips total, regardless of order count
// 100 orders = 2 queries = 10ms
// 10,000 orders = 2 queries = ~50ms (larger payload)
```

**Correct ($lookup—single aggregation):**

```javascript
// All in one database operation
const ordersWithCustomers = await db.orders.aggregate([
  { $match: { status: "pending" } },
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",  // Must be indexed!
      as: "customer"
    }
  },
  { $unwind: "$customer" }  // Convert array to single object
]).toArray()

// Cost: 1 round trip, database handles join internally
// IMPORTANT: Ensure index on customers._id (it's _id, so automatic)
// For non-_id joins: db.customers.createIndex({ externalId: 1 })
```

**Batch operations for writes:**

```javascript
// BAD: Insert one at a time
const users = generateUsers(1000)
for (const user of users) {
  await db.users.insertOne(user)  // 1000 round trips
}
// Time: 1000 × 5ms = 5 seconds

// GOOD: Batch insert
await db.users.insertMany(users)  // 1 round trip
// Time: ~50ms (includes bulk write overhead)

// BAD: Update one at a time
const ids = getIdsToUpdate()
for (const id of ids) {
  await db.items.updateOne(
    { _id: id },
    { $set: { processed: true } }
  )
}

// GOOD: Batch update with $in
await db.items.updateMany(
  { _id: { $in: ids } },
  { $set: { processed: true } }
)

// GOOD: bulkWrite for heterogeneous operations
await db.items.bulkWrite([
  { updateOne: { filter: { _id: id1 }, update: { $set: { status: "a" } } } },
  { updateOne: { filter: { _id: id2 }, update: { $set: { status: "b" } } } },
  { deleteOne: { filter: { _id: id3 } } },
  { insertOne: { document: newDoc } }
])
// Multiple different operations in 1 round trip
```

**Complex example—dashboard with multiple relations:**

```javascript
// Dashboard needs: orders, customers, products, and shipping info
// N+1 approach would be 400+ queries for 100 orders

// Optimized batch approach:
async function getDashboardData(userId) {
  // Query 1: Get orders
  const orders = await db.orders
    .find({ userId, status: { $in: ["pending", "processing"] } })
    .toArray()

  // Collect all IDs upfront
  const customerIds = [...new Set(orders.map(o => o.customerId))]
  const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))]
  const shippingIds = orders.filter(o => o.shippingId).map(o => o.shippingId)

  // Queries 2-4: Batch fetch all related data in parallel
  const [customers, products, shipments] = await Promise.all([
    db.customers.find({ _id: { $in: customerIds } }).toArray(),
    db.products.find({ _id: { $in: productIds } }).toArray(),
    db.shipments.find({ _id: { $in: shippingIds } }).toArray()
  ])

  // Build lookup maps
  const customerMap = new Map(customers.map(c => [c._id.toString(), c]))
  const productMap = new Map(products.map(p => [p._id.toString(), p]))
  const shipmentMap = new Map(shipments.map(s => [s._id.toString(), s]))

  // Assemble in memory
  return orders.map(order => ({
    ...order,
    customer: customerMap.get(order.customerId.toString()),
    shipment: order.shippingId ? shipmentMap.get(order.shippingId.toString()) : null,
    items: order.items.map(item => ({
      ...item,
      product: productMap.get(item.productId.toString())
    }))
  }))
}

// Total: 4 queries (1 + 3 parallel) instead of 400+
// Time: ~20ms instead of 2+ seconds
```

**When N+1 is acceptable:**

- **N is always small**: Max 5-10 items, overhead is minimal.
- **Lazy loading UI**: User clicks to expand details, single lookup is fine.
- **Caching layer**: Related data is cached, no DB hit anyway.
- **Different databases**: Can't $lookup across MongoDB instances, must query separately.

## Verify with

```javascript
// Detect N+1 patterns in slow query log
db.setProfilingLevel(1, { slowms: 50 })

// Find repeated similar queries (N+1 signature)
db.system.profile.aggregate([
  { $match: { op: "query" } },
  { $group: {
    _id: {
      ns: "$ns",
      queryShape: { $objectToArray: "$command.filter" }
    },
    count: { $sum: 1 },
    avgMs: { $avg: "$millis" }
  }},
  { $match: { count: { $gt: 10 } } },  // Same query 10+ times
  { $sort: { count: -1 } }
])
// High count + similar query shape = likely N+1
```

Reference: [Query Optimization](https://mongodb.com/docs/manual/core/query-optimization/)
