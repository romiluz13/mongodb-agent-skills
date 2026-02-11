---
title: Use Transactions When You Need Multi-Document Atomicity
impact: CRITICAL
impactDescription: "Prevents unnecessary complexity and preserves correctness where single-document atomicity is insufficient"
tags: transaction, atomicity, session, correctness
---

## Use Transactions When You Need Multi-Document Atomicity

MongoDB guarantees atomicity at the single-document level. Use multi-document transactions only when one business action must update multiple documents or collections as a single all-or-nothing unit.

**Incorrect (using a transaction for single-document write):**

```javascript
const session = db.getMongo().startSession()
session.startTransaction()

session.getDatabase("app").orders.updateOne(
  { _id: orderId },
  { $set: { status: "paid" } }
)

session.commitTransaction()
session.endSession()
```

This adds transaction overhead without improving correctness because the write is already a single-document atomic operation.

**Correct (transaction for cross-collection invariant):**

```javascript
const session = db.getMongo().startSession()
session.startTransaction()

const sdb = session.getDatabase("app")

sdb.orders.updateOne(
  { _id: orderId, status: "pending" },
  { $set: { status: "paid" } }
)

sdb.inventory.updateOne(
  { sku: "A-100", qty: { $gte: 1 } },
  { $inc: { qty: -1 } }
)

sdb.ledger.insertOne({ orderId, event: "charge_captured", at: new Date() })

session.commitTransaction()
session.endSession()
```

This protects a cross-document business invariant (order status, inventory decrement, ledger entry) as one atomic unit.

**When NOT to use this pattern:**

- Single-document writes and updates.
- Pure read-only analytical workflows.
- Fire-and-forget logging that does not need atomic coupling.

## Verify with

1. List all writes in a business flow and verify whether they span documents/collections.
2. Confirm invariant failure impact if only a subset succeeds.
3. Measure transaction duration and abort rate before broad rollout.

Reference: [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
