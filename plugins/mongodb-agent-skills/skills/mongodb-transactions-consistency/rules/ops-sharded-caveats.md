---
title: Apply Sharded-Cluster Transaction Caveats Explicitly
impact: HIGH
impactDescription: "Avoids hidden latency and failure-domain risks in distributed transactions"
tags: sharding, distributed-transactions, two-phase-commit, ops
---

## Apply Sharded-Cluster Transaction Caveats Explicitly

Transactions that span shards involve distributed coordination and can increase latency and failure sensitivity. Keep shard-spanning transaction scope tight.

**Incorrect (broad cross-shard transaction with unbounded scope):**

```javascript
await session.withTransaction(async () => {
  // Potentially touches many shard key ranges
  await orders.updateMany({ region: { $in: regions } }, { $set: { archived: true } }, { session })
  await invoices.updateMany({ region: { $in: regions } }, { $set: { archived: true } }, { session })
  await shipments.updateMany({ region: { $in: regions } }, { $set: { archived: true } }, { session })
})
```

Large distributed transactions can amplify lock and commit coordination costs.

**Correct (minimize shard fan-out and transaction scope):**

```javascript
for (const region of regions) {
  await session.withTransaction(async () => {
    await orders.updateMany({ region }, { $set: { archived: true } }, { session })
    await invoices.updateMany({ region }, { $set: { archived: true } }, { session })
  }, {
    readPreference: "primary",
    writeConcern: { w: "majority" }
  })
}
```

Constrain each transaction to narrower shard-key scope where possible.

**When NOT to use this pattern:**

- Single-shard transactions with predictable, bounded scope.
- Non-critical batch changes that can be non-transactional.

## Verify with

1. Profile transaction latency by shard fan-out width.
2. Confirm shard key filters are as selective as possible.
3. Measure abort rates and lock wait under peak distributed load.

Reference: [Transactions Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
