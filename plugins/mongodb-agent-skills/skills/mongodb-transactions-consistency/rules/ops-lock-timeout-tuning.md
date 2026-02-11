---
title: Tune maxTransactionLockRequestTimeoutMillis for Contention Profiles
impact: HIGH
impactDescription: "Improves stability under lock contention by matching timeout policy to workload"
tags: locks, timeout, maxTransactionLockRequestTimeoutMillis, contention
---

## Tune maxTransactionLockRequestTimeoutMillis for Contention Profiles

Transactions may abort when lock acquisition exceeds `maxTransactionLockRequestTimeoutMillis`. Use this parameter intentionally for high-contention environments instead of relying on accidental defaults.

**Incorrect (ignore lock timeout behavior under contention):**

```javascript
// Heavy transactional workload with frequent lock conflicts
// No timeout strategy, repeated abort spikes in peak traffic
await session.withTransaction(async () => {
  await accounts.updateOne({ _id: from }, { $inc: { balance: -100 } }, { session })
  await accounts.updateOne({ _id: to }, { $inc: { balance: 100 } }, { session })
})
```

Without tuning and observability, contention can cause unpredictable abort storms.

**Correct (explicit timeout policy with monitored retry behavior):**

```javascript
// Administrative tuning (set at server/runtime scope as appropriate)
// db.adminCommand({ setParameter: 1, maxTransactionLockRequestTimeoutMillis: 20 })

await session.withTransaction(async () => {
  await accounts.updateOne({ _id: from }, { $inc: { balance: -100 } }, { session })
  await accounts.updateOne({ _id: to }, { $inc: { balance: 100 } }, { session })
}, {
  writeConcern: { w: "majority" }
})
```

Tune lock timeout together with retry strategy and SLA.

**When NOT to use this pattern:**

- Low-contention systems where default behavior is stable.
- Environments without observability to evaluate tuning impact.

## Verify with

1. Capture lock timeout abort rates before and after changes.
2. Correlate timeout settings with transaction latency and success rate.
3. Test under peak contention with realistic concurrency.

Reference: [maxTransactionLockRequestTimeoutMillis](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxTransactionLockRequestTimeoutMillis)
