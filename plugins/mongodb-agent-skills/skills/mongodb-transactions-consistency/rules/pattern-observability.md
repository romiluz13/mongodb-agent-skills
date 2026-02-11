---
title: Instrument Transaction Outcomes, Retries, and Abort Causes
impact: MEDIUM
impactDescription: "Makes correctness regressions visible before they become incidents"
tags: observability, metrics, retries, aborts
---

## Instrument Transaction Outcomes, Retries, and Abort Causes

Without transaction telemetry, teams miss contention spikes, retry storms, and commit uncertainty patterns until customer-facing incidents occur.

**Incorrect (no transaction-level metrics):**

```javascript
await session.withTransaction(async () => {
  await runBusinessOps(session)
})

// No tracking of retries, abort reasons, or unknown commit outcomes
```

Operational risk stays hidden.

**Correct (capture outcome and retry metrics):**

```javascript
const startedAt = Date.now()
let retries = 0

await session.withTransaction(async () => {
  await runBusinessOps(session)
}, {
  readPreference: "primary",
  writeConcern: { w: "majority" }
})

metrics.increment("tx.success")
metrics.observe("tx.duration_ms", Date.now() - startedAt)
metrics.observe("tx.retries", retries)
```

Pair app metrics with server-side diagnostics during incident review.

**When NOT to use this pattern:**

- Never in production transactional services.

## Verify with

1. Track `success`, `abort`, `retry`, and `unknown_commit_result` counters.
2. Correlate transaction latency with lock/contention metrics.
3. Build alert thresholds for retry spikes and abort-rate changes.

Reference: [Transactions Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
