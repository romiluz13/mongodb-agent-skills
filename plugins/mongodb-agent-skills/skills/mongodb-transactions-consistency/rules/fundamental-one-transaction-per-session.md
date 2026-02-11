---
title: Run One Active Transaction Per Session
impact: CRITICAL
impactDescription: "Prevents session state corruption and undefined retry behavior"
tags: session, concurrency, transaction, reliability
---

## Run One Active Transaction Per Session

A session supports one active transaction at a time. Do not run concurrent operations that reuse the same session while a transaction is in progress.

**Incorrect (parallel writes on one session):**

```javascript
const session = client.startSession()
session.startTransaction()

await Promise.all([
  dbA.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session }),
  dbA.collection("ledger").insertOne({ orderId: 1, event: "paid" }, { session })
])

await session.commitTransaction()
```

Parallel use increases risk of transaction state errors and hard-to-debug behavior.

**Correct (serialize operations in one transaction):**

```javascript
const session = client.startSession()
session.startTransaction()

await dbA.collection("orders").updateOne(
  { _id: 1 },
  { $set: { status: "paid" } },
  { session }
)

await dbA.collection("ledger").insertOne(
  { orderId: 1, event: "paid", at: new Date() },
  { session }
)

await session.commitTransaction()
```

Use a separate session if you truly need parallel independent work.

**When NOT to use this pattern:**

- Independent operations that should run concurrently outside transaction scope.
- Read-only operations that are intentionally outside the transaction.

## Verify with

1. Ensure no `Promise.all` or equivalent fan-out uses the same transactional session.
2. Add tests for concurrency paths to confirm only one active transaction per session.
3. Track transaction abort/error metrics after concurrency changes.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
