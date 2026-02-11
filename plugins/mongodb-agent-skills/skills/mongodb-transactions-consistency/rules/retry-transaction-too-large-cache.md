---
title: Treat TransactionTooLargeForCache as a Redesign Signal
impact: HIGH
impactDescription: "Avoids endless retries on non-transient oversized transactions"
tags: TransactionTooLargeForCache, retry, limits, design
---

## Treat TransactionTooLargeForCache as a Redesign Signal

Starting in MongoDB 6.2, the server does not retry transactions that fail with `TransactionTooLargeForCache`. This is typically a transaction-size or workload-shape issue, not a transient blip.

**Incorrect (blindly retrying same oversized transaction):**

```javascript
for (let i = 0; i < 5; i++) {
  try {
    await runHugeTransaction(session)
    break
  } catch (e) {
    if (e.codeName !== "TransactionTooLargeForCache") throw e
    // Wrong: exact same oversized workload retried repeatedly
  }
}
```

This wastes capacity and delays remediation.

**Correct (shrink batch size / split workflow):**

```javascript
for (const chunk of chunked(items, 200)) {
  await session.withTransaction(async () => {
    for (const item of chunk) {
      await orders.updateOne({ _id: item.id }, { $set: { status: "processed" } }, { session })
    }
    await jobAudit.insertOne({ chunkSize: chunk.length, at: new Date() }, { session })
  })
}
```

Reshape workload into smaller transactions with explicit batch boundaries.

**When NOT to use this pattern:**

- Tiny transactions already well under cache and memory pressure limits.
- Single-document writes that should not use transactions at all.

## Verify with

1. Measure number of ops and data touched per transaction.
2. Track error code incidence by transaction type.
3. Validate redesigned chunk size under production-like load.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
