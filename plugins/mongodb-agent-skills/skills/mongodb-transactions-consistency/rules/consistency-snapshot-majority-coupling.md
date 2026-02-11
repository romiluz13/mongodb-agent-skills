---
title: Understand Snapshot Read Concern Requirements
impact: HIGH
impactDescription: "Prevents false assumptions about snapshot visibility guarantees"
tags: snapshot, readConcern, majority, transaction
---

## Understand Snapshot Read Concern Requirements

`snapshot` read concern gives a point-in-time view in transactions, but guarantees are tied to deployment and write concern behavior. Do not assume snapshot means globally durable visibility by itself.

**Incorrect (assuming snapshot alone guarantees fully durable global view):**

```javascript
await session.withTransaction(async () => {
  // business-critical reconciliation
}, {
  readConcern: { level: "snapshot" }
})
```

This omits explicit durability intent and can mislead reviewers.

**Correct (snapshot with explicit durability and primary preference):**

```javascript
await session.withTransaction(async () => {
  const totals = await orders.aggregate([
    { $match: { accountId } },
    { $group: { _id: null, amount: { $sum: "$amount" } } }
  ], { session }).toArray()

  await accountSnapshots.updateOne(
    { accountId },
    { $set: { amount: totals[0]?.amount || 0, capturedAt: new Date() } },
    { upsert: true, session }
  )
}, {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

This makes consistency and durability assumptions explicit.

**When NOT to use this pattern:**

- Flows that only need local transactional reads.
- Low-value operations where majority durability is not required.

## Verify with

1. Confirm whether point-in-time visibility is truly required.
2. Ensure write concern and failover behavior match recovery requirements.
3. Validate behavior in replica set failover tests.

Reference: [Transactions and Read Concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-read-concern)
