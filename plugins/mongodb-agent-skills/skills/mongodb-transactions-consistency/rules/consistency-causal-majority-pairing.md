---
title: Pair Majority Read and Write Concerns for Causal Consistency
impact: HIGH
impactDescription: "Preserves read-your-writes and monotonic guarantees across sessions"
tags: causal-consistency, majority, readConcern, writeConcern
---

## Pair Majority Read and Write Concerns for Causal Consistency

Causal consistency guarantees rely on majority semantics. For workflows requiring monotonic reads and read-your-writes across requests, pair majority read and write concerns.

**Incorrect (mixed concerns for causally-sensitive workflow):**

```javascript
await session.withTransaction(async () => {
  await profiles.updateOne({ _id: userId }, { $set: { tier: "gold" } }, { session })
  const p = await profiles.findOne({ _id: userId }, { session })
}, {
  readConcern: { level: "local" },
  writeConcern: { w: 1 }
})
```

This can break causal assumptions across failover windows.

**Correct (majority pairing for causal guarantees):**

```javascript
await session.withTransaction(async () => {
  await profiles.updateOne(
    { _id: userId },
    { $set: { tier: "gold", updatedAt: new Date() } },
    { session }
  )

  const profile = await profiles.findOne({ _id: userId }, { session })
  if (!profile) throw new Error("profile missing")
}, {
  readPreference: "primary",
  readConcern: { level: "majority" },
  writeConcern: { w: "majority" }
})
```

This better aligns behavior with causal consistency expectations.

**When NOT to use this pattern:**

- Eventual-consistency flows where temporary staleness is acceptable.
- Non-critical telemetry pipelines.

## Verify with

1. Identify workflows that require causal ordering guarantees.
2. Confirm both read and write concern settings in those code paths.
3. Test under primary failover and validate invariant preservation.

Reference: [Read Isolation, Consistency, and Recency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
