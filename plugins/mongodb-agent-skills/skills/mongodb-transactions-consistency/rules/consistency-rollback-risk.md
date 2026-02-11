---
title: Avoid Weak Concern Combinations for Critical Transactions
impact: HIGH
impactDescription: "Reduces post-failover rollback surprises in critical workflows"
tags: rollback, durability, writeConcern, readConcern
---

## Avoid Weak Concern Combinations for Critical Transactions

Weak concern choices (for example `w:1`) can acknowledge commits that later roll back after failover. For critical domains (payments, inventory, compliance), default to stronger concerns.

**Incorrect (critical flow with weak concern):**

```javascript
await session.withTransaction(async () => {
  await payments.insertOne({ _id: paymentId, status: "captured" }, { session })
  await balances.updateOne({ accountId }, { $inc: { amount: -100 } }, { session })
}, {
  readConcern: { level: "local" },
  writeConcern: { w: 1 }
})
```

This may look successful before replication catches up.

**Correct (critical flow with majority durability):**

```javascript
await session.withTransaction(async () => {
  await payments.insertOne({ _id: paymentId, status: "captured" }, { session })
  await balances.updateOne({ accountId }, { $inc: { amount: -100 } }, { session })
}, {
  readPreference: "primary",
  readConcern: { level: "majority" },
  writeConcern: { w: "majority", wtimeout: 5000 }
})
```

This narrows rollback exposure for acknowledged transactions.

**When NOT to use this pattern:**

- Non-critical ephemeral updates where rollback risk is acceptable.
- Short-lived experimentation datasets.

## Verify with

1. Classify workflows by financial or compliance criticality.
2. Audit concern levels in each class.
3. Run controlled failover drills and inspect post-failover state.

Reference: [Transactions and Write Concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-write-concern)
