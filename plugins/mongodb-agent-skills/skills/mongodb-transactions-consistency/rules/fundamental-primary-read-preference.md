---
title: Use Primary Read Preference for Transactions
impact: CRITICAL
impactDescription: "Keeps transactional reads and writes on the authoritative node"
tags: readPreference, primary, transaction, consistency
---

## Use Primary Read Preference for Transactions

Transactions that contain read operations must use read preference `primary`. This is a hard requirement, not a recommendation: all operations in a given transaction must route to the same member.

**Incorrect (secondary read preference in transaction options):**

```javascript
const txOptions = {
  readPreference: "secondary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
}

await session.withTransaction(async () => {
  // transactional operations
}, txOptions)
```

MongoDB rejects transactions with read operations that do not use `primary` read preference.

**Correct (primary read preference):**

```javascript
const txOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
}

await session.withTransaction(async () => {
  // transactional operations
}, txOptions)
```

This keeps transaction behavior predictable under failover and replication lag.

**When NOT to use this pattern:**

- Non-transactional read-heavy workloads where stale reads are acceptable.
- Background analytics detached from write-path correctness.

## Verify with

1. Check transaction options defaults in your driver code.
2. Confirm integration tests pass under failover with primary-only transaction reads.
3. Validate no service overrides transaction read preference unexpectedly.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications.md)
