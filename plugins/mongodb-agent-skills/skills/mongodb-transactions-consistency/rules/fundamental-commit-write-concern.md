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

Reference: [Transactions and Write Concern](https://www.mongodb.com/docs/manual/core/transactions.md#transactions-and-write-concern)

## Per-Operation writeConcern in Transactions (Causes Error)

Setting write concerns for individual write operations inside a transaction returns an error.

```javascript
// CRITICAL: Do NOT set writeConcern on individual operations inside a transaction
// MongoDB returns an error if you do this:

// ❌ WRONG — causes error:
await orders.updateOne(
  { _id: orderId },
  { $set: { status: "paid" } },
  { session, writeConcern: { w: "majority" } }  // ERROR: cannot set per-op wc in txn
)

// ✅ CORRECT — set writeConcern at the transaction level only:
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
}, {
  writeConcern: { w: "majority", wtimeout: 5000 }  // ← only here
})
```
