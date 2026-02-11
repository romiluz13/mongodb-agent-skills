---
title: Choose withTransaction or Core API Deliberately
impact: MEDIUM
impactDescription: "Improves correctness and maintainability by matching API style to retry/control needs"
tags: withTransaction, core-api, drivers, design
---

## Choose withTransaction or Core API Deliberately

Use callback APIs (`withTransaction`) for most workloads because they simplify retry handling. Use Core API when you need explicit commit/retry orchestration and custom telemetry.

**Incorrect (reimplementing callback behavior poorly):**

```javascript
session.startTransaction()
try {
  await runBusinessOps(session)
  await session.commitTransaction()
} catch (e) {
  // Incomplete handling for transient and unknown commit cases
  await session.abortTransaction()
  throw e
}
```

This often misses edge-case retry labels.

**Correct (callback API by default):**

```javascript
await session.withTransaction(async () => {
  await runBusinessOps(session)
}, {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

Use Core API only when you intentionally need deeper control.

**When NOT to use this pattern:**

- Advanced platforms that centralize custom retry orchestration and auditing.

## Verify with

1. Inventory transaction code paths and classify callback vs core usage.
2. Ensure core API paths fully implement label-based retry semantics.
3. Keep one documented standard per service where possible.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
