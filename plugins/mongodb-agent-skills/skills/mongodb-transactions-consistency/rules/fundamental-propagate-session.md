---
title: Pass the Same Session to Every Transaction Operation
impact: CRITICAL
impactDescription: "Avoids accidental out-of-transaction writes and partial consistency"
tags: session, transaction, drivers, correctness
---

## Pass the Same Session to Every Transaction Operation

When using drivers, every read/write in a transaction must receive the same session. Missing the session on one operation can silently execute work outside the transaction boundary.

**Incorrect (one operation missing session):**

```javascript
const session = client.startSession()
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })

  // Missing { session } means this write is outside the transaction.
  await ledger.insertOne({ orderId, event: "paid" })
})
```

This can commit one write and lose the other under errors.

**Correct (propagate session everywhere):**

```javascript
const session = client.startSession()
await session.withTransaction(async () => {
  await orders.updateOne(
    { _id: orderId },
    { $set: { status: "paid" } },
    { session }
  )

  await ledger.insertOne(
    { orderId, event: "paid", at: new Date() },
    { session }
  )
})
```

Every operation participates in the same transactional outcome.

**When NOT to use this pattern:**

- Non-transactional, independent operations.
- Separate workflows that intentionally should not be rolled back together.

## Verify with

1. Code-review every operation inside transaction scope for session propagation.
2. Add tests that force abort paths and verify no side effects persist.
3. Enable command logging in lower environments and check session IDs.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
