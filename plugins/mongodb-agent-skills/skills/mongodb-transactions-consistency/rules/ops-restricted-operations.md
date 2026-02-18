---
title: Avoid Unsupported or Restricted Operations in Transactions
impact: HIGH
impactDescription: "Prevents runtime failures from invalid transactional command usage"
tags: restrictions, operations, DDL, transaction
---

## Avoid Unsupported or Restricted Operations in Transactions

Not all commands and operations are valid inside transactions. Attempting unsupported operations causes runtime errors and aborts.

**Incorrect (running unsupported aggregation stage in transaction):**

```javascript
await session.withTransaction(async () => {
  await db.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session })

  // Unsupported in transactions: $out
  await db.collection("orders").aggregate([
    { $match: { status: "paid" } },
    { $out: "orders_archive" }
  ], { session }).toArray()
})
```

Unsupported stages/commands inside the transaction callback cause runtime failure and abort.

**Correct (separate transactional DML from operational commands):**

```javascript
await session.withTransaction(async () => {
  await db.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session })
  await db.collection("ledger").insertOne({ orderId: 1, event: "paid" }, { session })
})

// Execute restricted aggregation/admin operations outside transaction windows
await db.collection("orders").aggregate([
  { $match: { status: "paid" } },
  { $out: "orders_archive" }
]).toArray()
```

Keep transaction scope focused on supported document writes/reads.

**Conditional DDL caveat (`create` / `createIndexes`):**

`create` and `createIndexes` are not blanket-forbidden, but only allowed in specific transaction scenarios:

- Transaction is **not** a cross-shard write transaction
- Explicit create/index transaction uses `readConcern: "local"`
- Index target is a non-existing collection or a new empty collection created earlier in the same transaction

**When NOT to use this pattern:**

- None for production transaction code; restrictions always apply.

## Verify with

1. Audit commands executed inside transaction callbacks.
2. Compare against supported operations docs before deployment.
3. Add integration tests for command-level transaction failures.

Reference: [Operations in Transactions](https://www.mongodb.com/docs/manual/core/transactions-operations.md)
