---
title: Handle Duplicate-Key Upsert Retry Behavior in MongoDB 8.1+
impact: HIGH
impactDescription: "Prevents incorrect assumptions about automatic retry behavior"
tags: upsert, duplicate-key, retry, MongoDB-8.1
---

## Handle Duplicate-Key Upsert Retry Behavior in MongoDB 8.1+

Starting in **MongoDB 8.1**, if an `upsert` inside a multi-document transaction encounters a duplicate-key error, the upsert is not automatically retried. Treat this as an explicit conflict path.

**Incorrect (assuming automatic retry will resolve duplicate key):**

```javascript
await session.withTransaction(async () => {
  await users.updateOne(
    { email: "a@company.com" },
    { $set: { name: "A" } },
    { upsert: true, session }
  )
  // Assumes duplicate-key upsert conflict auto-retries
})
```

This can fail unexpectedly under contention.

**Correct (explicit duplicate-key conflict handling):**

```javascript
await session.withTransaction(async () => {
  try {
    await users.updateOne(
      { email: "a@company.com" },
      { $set: { name: "A" } },
      { upsert: true, session }
    )
  } catch (e) {
    if (e.code === 11000) {
      await users.updateOne(
        { email: "a@company.com" },
        { $set: { name: "A" } },
        { session }
      )
      return
    }
    throw e
  }
})
```

Handle duplicate-key as a deterministic contention path.

**When NOT to use this pattern:**

- Workloads where unique-key contention cannot occur by design.
- Non-upsert transaction operations.

## Verify with

1. Load-test conflicting upserts under transaction scope.
2. Confirm duplicate-key path is handled explicitly in app logic.
3. Verify no retry assumption remains in error handling code.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
