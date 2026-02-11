---
title: Retry the Entire Transaction on TransientTransactionError
impact: CRITICAL
impactDescription: "Prevents partial business outcomes when transient failures occur"
tags: retry, TransientTransactionError, resilience, transaction
---

## Retry the Entire Transaction on TransientTransactionError

`TransientTransactionError` means the transaction can be retried safely as a unit. Retrying just one failed statement is incorrect because prior statements in that attempt may have been rolled back.

**Incorrect (retrying only one failed statement):**

```javascript
try {
  await session.startTransaction()
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
  await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } }, { session })
  await session.commitTransaction()
} catch (e) {
  if (e.errorLabels?.includes("TransientTransactionError")) {
    // Wrong: only retrying one statement
    await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } }, { session })
  }
}
```

This can break invariants because transaction scope was lost.

**Correct (retry full callback with withTransaction):**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
  await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } }, { session })
  await ledger.insertOne({ orderId, event: "paid" }, { session })
}, {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

Driver callback APIs handle full-transaction retries correctly.

**When NOT to use this pattern:**

- Non-transactional workflows.
- Manual core API implementations where you intentionally own full retry control.

## Verify with

1. Inject transient errors in tests and verify full callback reruns.
2. Confirm no partial side effects escape on retry paths.
3. Monitor retry frequency to detect lock/contention hotspots.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
