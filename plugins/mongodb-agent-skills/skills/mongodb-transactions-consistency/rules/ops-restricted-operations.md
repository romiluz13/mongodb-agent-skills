---
title: Avoid Unsupported or Restricted Operations in Transactions
impact: HIGH
impactDescription: "Prevents runtime failures from invalid transactional command usage"
tags: restrictions, operations, DDL, transaction
---

## Avoid Unsupported or Restricted Operations in Transactions

Not all commands and operations are valid inside transactions. Attempting unsupported operations causes runtime errors and aborts.

**Incorrect (running unsupported admin-style operation in transaction):**

```javascript
await session.withTransaction(async () => {
  await db.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session })

  // Unsupported/restricted in transaction scope
  await db.command({ createIndexes: "orders", indexes: [{ key: { status: 1 }, name: "status_1" }] })
})
```

Mixing operational DDL-style work into a transaction is unsafe.

**Correct (separate transactional DML from operational commands):**

```javascript
await session.withTransaction(async () => {
  await db.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session })
  await db.collection("ledger").insertOne({ orderId: 1, event: "paid" }, { session })
})

// Execute index/admin operations outside transaction windows
await db.command({ createIndexes: "orders", indexes: [{ key: { status: 1 }, name: "status_1" }] })
```

Keep transaction scope focused on supported document writes/reads.

**When NOT to use this pattern:**

- None for production transaction code; restrictions always apply.

## Verify with

1. Audit commands executed inside transaction callbacks.
2. Compare against supported operations docs before deployment.
3. Add integration tests for command-level transaction failures.

Reference: [Operations in Transactions](https://www.mongodb.com/docs/manual/core/transactions-operations/)
