---
title: Set Transaction Write Concern Intentionally
impact: CRITICAL
impactDescription: "Protects critical commits from weak durability guarantees"
tags: writeConcern, majority, durability, transaction
---

## Set Transaction Write Concern Intentionally

Transaction commit durability depends on write concern. For critical business workflows, use `majority` to reduce rollback exposure during failover.

**Incorrect (implicit weak durability for critical payment flow):**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
  await ledger.insertOne({ orderId, event: "paid" }, { session })
})
```

If defaults are weaker than expected, durability semantics may not match business requirements.

**Correct (explicit majority durability):**

```javascript
await session.withTransaction(
  async () => {
    await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
    await ledger.insertOne({ orderId, event: "paid", at: new Date() }, { session })
  },
  {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority", wtimeout: 5000 }
  }
)
```

This makes durability intent explicit and reviewable.

**When NOT to use this pattern:**

- Low-value ephemeral workflows where majority durability is unnecessary.
- Temporary migration scripts where rollback tolerance is acceptable.

## Verify with

1. Review transaction options in code and driver defaults.
2. Validate business critical paths use explicit write concern.
3. Run failover tests and confirm post-failover data state.

Reference: [Transactions and Write Concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-write-concern)
