---
title: Choose Read Concern by Business Guarantee, Not Habit
impact: HIGH
impactDescription: "Aligns read visibility guarantees with workflow correctness"
tags: readConcern, local, majority, snapshot, consistency
---

## Choose Read Concern by Business Guarantee, Not Habit

Transaction read concern changes what data can be observed. Select `local`, `majority`, or `snapshot` based on required semantics, not copy-paste defaults.

**Incorrect (using snapshot everywhere without requirement):**

```javascript
await session.withTransaction(async () => {
  // simple status read and update
}, {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

Using stronger concerns than needed increases cost and latency without value.

**Correct (choose concern intentionally):**

```javascript
// Example: choose majority when you need majority-committed visibility
await session.withTransaction(async () => {
  const order = await orders.findOne({ _id: orderId }, { session })
  if (!order) throw new Error("missing order")
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
}, {
  readPreference: "primary",
  readConcern: { level: "majority" },
  writeConcern: { w: "majority" }
})
```

Match guarantee strength to business correctness needs.

**When NOT to use this pattern:**

- One-off scripts where strict semantics are irrelevant.
- Non-transactional reads with independent stale-read tolerance.

## Verify with

1. Document required read visibility for each transaction workflow.
2. Confirm options in code match that requirement.
3. Load-test with target concerns and validate SLA impact.

Reference: [Transactions and Read Concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-read-concern)
