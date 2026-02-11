---
title: Keep Transactions Short and Within Lifetime Limits
impact: HIGH
impactDescription: "Reduces aborts, lock contention, and stale snapshot pressure"
tags: transactionLifetimeLimitSeconds, timeout, ops, production
---

## Keep Transactions Short and Within Lifetime Limits

Long-running transactions increase contention and abort risk. MongoDB enforces a transaction lifetime limit (`transactionLifetimeLimitSeconds`, default 60 seconds in many deployments).

**Incorrect (long transaction doing broad scan + many writes):**

```javascript
await session.withTransaction(async () => {
  const docs = await db.collection("events")
    .find({ createdAt: { $lt: cutoff } }, { session })
    .toArray()

  for (const d of docs) {
    await db.collection("archive").insertOne(d, { session })
    await db.collection("events").deleteOne({ _id: d._id }, { session })
  }
})
```

This can exceed lifetime limits and hold locks too long.

**Correct (chunked short transactions):**

```javascript
while (true) {
  const batch = await db.collection("events")
    .find({ createdAt: { $lt: cutoff } })
    .limit(200)
    .toArray()

  if (batch.length === 0) break

  await session.withTransaction(async () => {
    for (const d of batch) {
      await db.collection("archive").insertOne(d, { session })
      await db.collection("events").deleteOne({ _id: d._id }, { session })
    }
  })
}
```

Keep each transaction bounded by time and operation count.

**When NOT to use this pattern:**

- Tiny transactions that complete quickly and predictably.
- Single-document operations that do not need transactions.

## Verify with

1. Measure p95 and p99 transaction duration.
2. Track abort reasons and timeout-related errors.
3. Tune batch sizes so transactions stay comfortably below limits.

Reference: [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
