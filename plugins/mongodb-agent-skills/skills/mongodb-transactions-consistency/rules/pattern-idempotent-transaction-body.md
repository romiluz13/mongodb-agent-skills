---
title: Make Transaction Bodies Idempotent Under Retries
impact: MEDIUM
impactDescription: "Prevents duplicate side effects when transactions retry"
tags: idempotency, retry, outbox, transaction
---

## Make Transaction Bodies Idempotent Under Retries

Retryable transaction flows can execute business logic more than once. Design transaction bodies so re-execution does not create duplicate external side effects.

**Incorrect (non-idempotent side effect in transaction body):**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })

  // Non-idempotent write: duplicate events if callback retries
  await outbox.insertOne({ type: "send-email", orderId }, { session })
})
```

A retry can enqueue the same action multiple times.

**Correct (idempotency key / unique constraint pattern):**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })

  await outbox.updateOne(
    { key: `order-paid:${orderId}` },
    {
      $setOnInsert: {
        key: `order-paid:${orderId}`,
        type: "send-email",
        orderId,
        createdAt: new Date()
      }
    },
    { upsert: true, session }
  )
})
```

Idempotent keys keep retries safe.

**When NOT to use this pattern:**

- Transaction bodies with strictly internal deterministic updates and no external fan-out.

## Verify with

1. Force transient retry scenarios in tests.
2. Confirm outbox/event tables do not duplicate for same business key.
3. Ensure unique indexes enforce idempotency keys.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
