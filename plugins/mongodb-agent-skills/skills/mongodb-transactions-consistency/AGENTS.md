# MongoDB Transactions & Consistency

**Version 1.0.0**
MongoDB
February 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or reviewing MongoDB schemas, queries, AI/search workflows, and transaction consistency patterns. Humans may also
> find it useful, but guidance here is optimized for automation and
> consistency by AI-assisted workflows.

---

## Abstract

MongoDB transaction correctness and consistency guidance for AI agents and developers. Contains 20 rules across 5 categories: Transaction Fundamentals (CRITICAL), Consistency Semantics (HIGH), Retry and Error Handling (CRITICAL), Operational Constraints (HIGH), and Implementation Patterns (MEDIUM). Covers ACID guarantees, session propagation, readConcern/writeConcern trade-offs, causal consistency, commit uncertainty, transient retries, transaction runtime and lock limits, sharded transaction caveats, and idempotent application patterns. This skill avoids overlap with schema and query/index performance skills by focusing on multi-document correctness and failure-safe execution.

---

## Table of Contents

1. [Transaction Fundamentals](#1-transaction-fundamentals) — **CRITICAL**
   - 1.1 [Pass the Same Session to Every Transaction Operation](#11-pass-the-same-session-to-every-transaction-operation)
   - 1.2 [Run One Active Transaction Per Session](#12-run-one-active-transaction-per-session)
   - 1.3 [Set Transaction Write Concern Intentionally](#13-set-transaction-write-concern-intentionally)
   - 1.4 [Use Primary Read Preference for Transactions](#14-use-primary-read-preference-for-transactions)
   - 1.5 [Use Transactions When You Need Multi-Document Atomicity](#15-use-transactions-when-you-need-multi-document-atomicity)
2. [Consistency Semantics](#2-consistency-semantics) — **HIGH**
   - 2.1 [Avoid Weak Concern Combinations for Critical Transactions](#21-avoid-weak-concern-combinations-for-critical-transactions)
   - 2.2 [Choose Read Concern by Business Guarantee, Not Habit](#22-choose-read-concern-by-business-guarantee-not-habit)
   - 2.3 [Pair Majority Read and Write Concerns for Causal Consistency](#23-pair-majority-read-and-write-concerns-for-causal-consistency)
   - 2.4 [Understand Snapshot Read Concern Requirements](#24-understand-snapshot-read-concern-requirements)
3. [Retry and Error Handling](#3-retry-and-error-handling) — **CRITICAL**
   - 3.1 [Handle Duplicate-Key Upsert Retry Behavior in MongoDB 8.1+](#31-handle-duplicate-key-upsert-retry-behavior-in-mongodb-81)
   - 3.2 [Retry Commit on UnknownTransactionCommitResult](#32-retry-commit-on-unknowntransactioncommitresult)
   - 3.3 [Retry the Entire Transaction on TransientTransactionError](#33-retry-the-entire-transaction-on-transienttransactionerror)
   - 3.4 [Treat TransactionTooLargeForCache as a Redesign Signal](#34-treat-transactiontoolargeforcache-as-a-redesign-signal)
4. [Operational Constraints](#4-operational-constraints) — **HIGH**
   - 4.1 [Apply Sharded-Cluster Transaction Caveats Explicitly](#41-apply-sharded-cluster-transaction-caveats-explicitly)
   - 4.2 [Avoid Unsupported or Restricted Operations in Transactions](#42-avoid-unsupported-or-restricted-operations-in-transactions)
   - 4.3 [Keep Transactions Short and Within Lifetime Limits](#43-keep-transactions-short-and-within-lifetime-limits)
   - 4.4 [Tune maxTransactionLockRequestTimeoutMillis for Contention Profiles](#44-tune-maxtransactionlockrequesttimeoutmillis-for-contention-profiles)
5. [Implementation Patterns](#5-implementation-patterns) — **MEDIUM**
   - 5.1 [Choose withTransaction or Core API Deliberately](#51-choose-withtransaction-or-core-api-deliberately)
   - 5.2 [Instrument Transaction Outcomes, Retries, and Abort Causes](#52-instrument-transaction-outcomes-retries-and-abort-causes)
   - 5.3 [Make Transaction Bodies Idempotent Under Retries](#53-make-transaction-bodies-idempotent-under-retries)

---

## 1. Transaction Fundamentals

**Impact: CRITICAL**

Transactions are required when a business invariant spans multiple documents, collections, or shards. MongoDB single-document writes are already atomic, so overusing transactions adds complexity and latency without correctness benefit. Every operation in a transaction must run on the same logical session and transaction scope.

### 1.1 Pass the Same Session to Every Transaction Operation

**Impact: CRITICAL (Avoids accidental out-of-transaction writes and partial consistency)**

When using drivers, every read/write in a transaction must receive the same session. Missing the session on one operation can silently execute work outside the transaction boundary.

**Incorrect: one operation missing session**

```javascript
const session = client.startSession()
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })

  // Missing { session } means this write is outside the transaction.
  await ledger.insertOne({ orderId, event: "paid" })
})
```

This can commit one write and lose the other under errors.

**Correct: propagate session everywhere**

```javascript
const session = client.startSession()
await session.withTransaction(async () => {
  await orders.updateOne(
    { _id: orderId },
    { $set: { status: "paid" } },
    { session }
  )

  await ledger.insertOne(
    { orderId, event: "paid", at: new Date() },
    { session }
  )
})
```

Every operation participates in the same transactional outcome.

**When NOT to use this pattern:**

- Non-transactional, independent operations.

- Separate workflows that intentionally should not be rolled back together.

1. Code-review every operation inside transaction scope for session propagation.

2. Add tests that force abort paths and verify no side effects persist.

3. Enable command logging in lower environments and check session IDs.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 1.2 Run One Active Transaction Per Session

**Impact: CRITICAL (Prevents session state corruption and undefined retry behavior)**

A session supports one active transaction at a time. Do not run concurrent operations that reuse the same session while a transaction is in progress.

**Incorrect: parallel writes on one session**

```javascript
const session = client.startSession()
session.startTransaction()

await Promise.all([
  dbA.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session }),
  dbA.collection("ledger").insertOne({ orderId: 1, event: "paid" }, { session })
])

await session.commitTransaction()
```

Parallel use increases risk of transaction state errors and hard-to-debug behavior.

**Correct: serialize operations in one transaction**

```javascript
const session = client.startSession()
session.startTransaction()

await dbA.collection("orders").updateOne(
  { _id: 1 },
  { $set: { status: "paid" } },
  { session }
)

await dbA.collection("ledger").insertOne(
  { orderId: 1, event: "paid", at: new Date() },
  { session }
)

await session.commitTransaction()
```

Use a separate session if you truly need parallel independent work.

**When NOT to use this pattern:**

- Independent operations that should run concurrently outside transaction scope.

- Read-only operations that are intentionally outside the transaction.

1. Ensure no `Promise.all` or equivalent fan-out uses the same transactional session.

2. Add tests for concurrency paths to confirm only one active transaction per session.

3. Track transaction abort/error metrics after concurrency changes.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 1.3 Set Transaction Write Concern Intentionally

**Impact: CRITICAL (Protects critical commits from weak durability guarantees)**

Transaction commit durability depends on write concern. For critical business workflows, use `majority` to reduce rollback exposure during failover.

**Incorrect: implicit weak durability for critical payment flow**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
  await ledger.insertOne({ orderId, event: "paid" }, { session })
})
```

If defaults are weaker than expected, durability semantics may not match business requirements.

**Correct: explicit majority durability**

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

1. Review transaction options in code and driver defaults.

2. Validate business critical paths use explicit write concern.

3. Run failover tests and confirm post-failover data state.

Reference: [https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-write-concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-write-concern)

### 1.4 Use Primary Read Preference for Transactions

**Impact: CRITICAL (Keeps transactional reads and writes on the authoritative node)**

Transactions use transaction-level read preference. Use `primary` for transactional workflows to keep reads and writes aligned with authoritative state.

**Incorrect: secondary read preference in transaction options**

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

Secondary preference can violate assumptions for read-your-write workflows inside transaction logic.

**Correct: primary read preference**

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

1. Check transaction options defaults in your driver code.

2. Confirm integration tests pass under failover with primary-only transaction reads.

3. Validate no service overrides transaction read preference unexpectedly.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 1.5 Use Transactions When You Need Multi-Document Atomicity

**Impact: CRITICAL (Prevents unnecessary complexity and preserves correctness where single-document atomicity is insufficient)**

MongoDB guarantees atomicity at the single-document level. Use multi-document transactions only when one business action must update multiple documents or collections as a single all-or-nothing unit.

**Incorrect: using a transaction for single-document write**

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

**Correct: transaction for cross-collection invariant**

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

1. List all writes in a business flow and verify whether they span documents/collections.

2. Confirm invariant failure impact if only a subset succeeds.

3. Measure transaction duration and abort rate before broad rollout.

Reference: [https://www.mongodb.com/docs/manual/core/transactions/](https://www.mongodb.com/docs/manual/core/transactions/)

---

## 2. Consistency Semantics

**Impact: HIGH**

Read concern and write concern choices define visibility and durability guarantees. `snapshot` reads provide a stable view but have explicit requirements, while majority concerns are essential for causal consistency guarantees. Incorrect concern combinations can pass tests but fail under failover or rollback scenarios.

### 2.1 Avoid Weak Concern Combinations for Critical Transactions

**Impact: HIGH (Reduces post-failover rollback surprises in critical workflows)**

Weak concern choices (for example `w:1`) can acknowledge commits that later roll back after failover. For critical domains (payments, inventory, compliance), default to stronger concerns.

**Incorrect: critical flow with weak concern**

```javascript
await session.withTransaction(async () => {
  await payments.insertOne({ _id: paymentId, status: "captured" }, { session })
  await balances.updateOne({ accountId }, { $inc: { amount: -100 } }, { session })
}, {
  readConcern: { level: "local" },
  writeConcern: { w: 1 }
})
```

This may look successful before replication catches up.

**Correct: critical flow with majority durability**

```javascript
await session.withTransaction(async () => {
  await payments.insertOne({ _id: paymentId, status: "captured" }, { session })
  await balances.updateOne({ accountId }, { $inc: { amount: -100 } }, { session })
}, {
  readPreference: "primary",
  readConcern: { level: "majority" },
  writeConcern: { w: "majority", wtimeout: 5000 }
})
```

This narrows rollback exposure for acknowledged transactions.

**When NOT to use this pattern:**

- Non-critical ephemeral updates where rollback risk is acceptable.

- Short-lived experimentation datasets.

1. Classify workflows by financial or compliance criticality.

2. Audit concern levels in each class.

3. Run controlled failover drills and inspect post-failover state.

Reference: [https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-write-concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-write-concern)

### 2.2 Choose Read Concern by Business Guarantee, Not Habit

**Impact: HIGH (Aligns read visibility guarantees with workflow correctness)**

Transaction read concern changes what data can be observed. Select `local`, `majority`, or `snapshot` based on required semantics, not copy-paste defaults.

**Incorrect: using snapshot everywhere without requirement**

```javascript
await session.withTransaction(async () => {
  // simple status read and update
}, {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

Using stronger concerns than needed increases cost and latency without value.

**Correct: choose concern intentionally**

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

1. Document required read visibility for each transaction workflow.

2. Confirm options in code match that requirement.

3. Load-test with target concerns and validate SLA impact.

Reference: [https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-read-concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-read-concern)

### 2.3 Pair Majority Read and Write Concerns for Causal Consistency

**Impact: HIGH (Preserves read-your-writes and monotonic guarantees across sessions)**

Causal consistency guarantees rely on majority semantics. For workflows requiring monotonic reads and read-your-writes across requests, pair majority read and write concerns.

**Incorrect: mixed concerns for causally-sensitive workflow**

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

**Correct: majority pairing for causal guarantees**

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

1. Identify workflows that require causal ordering guarantees.

2. Confirm both read and write concern settings in those code paths.

3. Test under primary failover and validate invariant preservation.

Reference: [https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)

### 2.4 Understand Snapshot Read Concern Requirements

**Impact: HIGH (Prevents false assumptions about snapshot visibility guarantees)**

`snapshot` read concern gives a point-in-time view in transactions, but guarantees are tied to deployment and write concern behavior. Do not assume snapshot means globally durable visibility by itself.

**Incorrect: assuming snapshot alone guarantees fully durable global view**

```javascript
await session.withTransaction(async () => {
  // business-critical reconciliation
}, {
  readConcern: { level: "snapshot" }
})
```

This omits explicit durability intent and can mislead reviewers.

**Correct: snapshot with explicit durability and primary preference**

```javascript
await session.withTransaction(async () => {
  const totals = await orders.aggregate([
    { $match: { accountId } },
    { $group: { _id: null, amount: { $sum: "$amount" } } }
  ], { session }).toArray()

  await accountSnapshots.updateOne(
    { accountId },
    { $set: { amount: totals[0]?.amount || 0, capturedAt: new Date() } },
    { upsert: true, session }
  )
}, {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

This makes consistency and durability assumptions explicit.

**When NOT to use this pattern:**

- Flows that only need local transactional reads.

- Low-value operations where majority durability is not required.

1. Confirm whether point-in-time visibility is truly required.

2. Ensure write concern and failover behavior match recovery requirements.

3. Validate behavior in replica set failover tests.

Reference: [https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-read-concern](https://www.mongodb.com/docs/manual/core/transactions/#transactions-and-read-concern)

---

## 3. Retry and Error Handling

**Impact: CRITICAL**

Transaction correctness depends on handling retry labels and commit uncertainty. `TransientTransactionError` requires retrying the full transaction body, while `UnknownTransactionCommitResult` requires retrying commit until terminal outcome. Application logic must remain idempotent under repeated execution.

### 3.1 Handle Duplicate-Key Upsert Retry Behavior in MongoDB 8.1+

**Impact: HIGH (Prevents incorrect assumptions about automatic retry behavior)**

Starting in **MongoDB 8.1**, if an `upsert` inside a multi-document transaction encounters a duplicate-key error, the upsert is not automatically retried. Treat this as an explicit conflict path.

**Incorrect: assuming automatic retry will resolve duplicate key**

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

**Correct: explicit duplicate-key conflict handling**

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

1. Load-test conflicting upserts under transaction scope.

2. Confirm duplicate-key path is handled explicitly in app logic.

3. Verify no retry assumption remains in error handling code.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 3.2 Retry Commit on UnknownTransactionCommitResult

**Impact: CRITICAL (Prevents double-processing and unresolved transaction outcomes)**

`UnknownTransactionCommitResult` means the client does not know whether commit succeeded. Retry commit until terminal outcome instead of rerunning the full transaction body blindly.

**Incorrect: rerunning body immediately after unknown commit result**

```javascript
try {
  await session.commitTransaction()
} catch (e) {
  if (e.errorLabels?.includes("UnknownTransactionCommitResult")) {
    // Wrong: rerunning body can duplicate side effects
    await runBusinessWorkflowAgain(session)
  }
}
```

This can produce duplicate business events.

**Correct: retry commit command**

```javascript
let committed = false
while (!committed) {
  try {
    await session.commitTransaction()
    committed = true
  } catch (e) {
    if (!e.errorLabels?.includes("UnknownTransactionCommitResult")) {
      throw e
    }
  }
}
```

Retrying commit resolves uncertainty without re-executing the transaction body.

**When NOT to use this pattern:**

- Workflows where transaction body is provably idempotent and designed for full replay.

- Systems that rely exclusively on driver-managed callback API behavior.

1. Simulate network faults during commit and verify commit-only retry loop.

2. Confirm no duplicate outbox/ledger side effects appear.

3. Track unknown-commit incidents in telemetry.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 3.3 Retry the Entire Transaction on TransientTransactionError

**Impact: CRITICAL (Prevents partial business outcomes when transient failures occur)**

`TransientTransactionError` means the transaction can be retried safely as a unit. Retrying just one failed statement is incorrect because prior statements in that attempt may have been rolled back.

**Incorrect: retrying only one failed statement**

```javascript
try {
  await session.startTransaction()
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
  await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } }, { session })
  await session.commitTransaction()
} catch (e) {
  if (e.errorLabels?.includes("TransientTransactionError")) {
    // Wrong: only retrying one statement
    await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } }, { session })
  }
}
```

This can break invariants because transaction scope was lost.

**Correct: retry full callback with withTransaction**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })
  await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } }, { session })
  await ledger.insertOne({ orderId, event: "paid" }, { session })
}, {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" }
})
```

Driver callback APIs handle full-transaction retries correctly.

**When NOT to use this pattern:**

- Non-transactional workflows.

- Manual core API implementations where you intentionally own full retry control.

1. Inject transient errors in tests and verify full callback reruns.

2. Confirm no partial side effects escape on retry paths.

3. Monitor retry frequency to detect lock/contention hotspots.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 3.4 Treat TransactionTooLargeForCache as a Redesign Signal

**Impact: HIGH (Avoids endless retries on non-transient oversized transactions)**

Starting in MongoDB 6.2, the server does not retry transactions that fail with `TransactionTooLargeForCache`. This is typically a transaction-size or workload-shape issue, not a transient blip.

**Incorrect: blindly retrying same oversized transaction**

```javascript
for (let i = 0; i < 5; i++) {
  try {
    await runHugeTransaction(session)
    break
  } catch (e) {
    if (e.codeName !== "TransactionTooLargeForCache") throw e
    // Wrong: exact same oversized workload retried repeatedly
  }
}
```

This wastes capacity and delays remediation.

**Correct: shrink batch size / split workflow**

```javascript
for (const chunk of chunked(items, 200)) {
  await session.withTransaction(async () => {
    for (const item of chunk) {
      await orders.updateOne({ _id: item.id }, { $set: { status: "processed" } }, { session })
    }
    await jobAudit.insertOne({ chunkSize: chunk.length, at: new Date() }, { session })
  })
}
```

Reshape workload into smaller transactions with explicit batch boundaries.

**When NOT to use this pattern:**

- Tiny transactions already well under cache and memory pressure limits.

- Single-document writes that should not use transactions at all.

1. Measure number of ops and data touched per transaction.

2. Track error code incidence by transaction type.

3. Validate redesigned chunk size under production-like load.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

---

## 4. Operational Constraints

**Impact: HIGH**

Production transaction behavior is constrained by runtime limits, lock acquisition windows, and operation restrictions. Long transactions increase contention and risk aborts. Sharded transactions require additional care for latency and failure domains.

### 4.1 Apply Sharded-Cluster Transaction Caveats Explicitly

**Impact: HIGH (Avoids hidden latency and failure-domain risks in distributed transactions)**

Transactions that span shards involve distributed coordination and can increase latency and failure sensitivity. Keep shard-spanning transaction scope tight.

**Incorrect: broad cross-shard transaction with unbounded scope**

```javascript
await session.withTransaction(async () => {
  // Potentially touches many shard key ranges
  await orders.updateMany({ region: { $in: regions } }, { $set: { archived: true } }, { session })
  await invoices.updateMany({ region: { $in: regions } }, { $set: { archived: true } }, { session })
  await shipments.updateMany({ region: { $in: regions } }, { $set: { archived: true } }, { session })
})
```

Large distributed transactions can amplify lock and commit coordination costs.

**Correct: minimize shard fan-out and transaction scope**

```javascript
for (const region of regions) {
  await session.withTransaction(async () => {
    await orders.updateMany({ region }, { $set: { archived: true } }, { session })
    await invoices.updateMany({ region }, { $set: { archived: true } }, { session })
  }, {
    readPreference: "primary",
    writeConcern: { w: "majority" }
  })
}
```

Constrain each transaction to narrower shard-key scope where possible.

**When NOT to use this pattern:**

- Single-shard transactions with predictable, bounded scope.

- Non-critical batch changes that can be non-transactional.

1. Profile transaction latency by shard fan-out width.

2. Confirm shard key filters are as selective as possible.

3. Measure abort rates and lock wait under peak distributed load.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-production-consideration/](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

### 4.2 Avoid Unsupported or Restricted Operations in Transactions

**Impact: HIGH (Prevents runtime failures from invalid transactional command usage)**

Not all commands and operations are valid inside transactions. Attempting unsupported operations causes runtime errors and aborts.

**Incorrect: running unsupported admin-style operation in transaction**

```javascript
await session.withTransaction(async () => {
  await db.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session })

  // Unsupported/restricted in transaction scope
  await db.command({ createIndexes: "orders", indexes: [{ key: { status: 1 }, name: "status_1" }] })
})
```

Mixing operational DDL-style work into a transaction is unsafe.

**Correct: separate transactional DML from operational commands**

```javascript
await session.withTransaction(async () => {
  await db.collection("orders").updateOne({ _id: 1 }, { $set: { status: "paid" } }, { session })
  await db.collection("ledger").insertOne({ orderId: 1, event: "paid" }, { session })
})

// Execute index/admin operations outside transaction windows
await db.command({ createIndexes: "orders", indexes: [{ key: { status: 1 }, name: "status_1" }] })
```

Keep transaction scope focused on supported document writes/reads.

**When NOT to use this pattern:**

- None for production transaction code; restrictions always apply.

1. Audit commands executed inside transaction callbacks.

2. Compare against supported operations docs before deployment.

3. Add integration tests for command-level transaction failures.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-operations/](https://www.mongodb.com/docs/manual/core/transactions-operations/)

### 4.3 Keep Transactions Short and Within Lifetime Limits

**Impact: HIGH (Reduces aborts, lock contention, and stale snapshot pressure)**

Long-running transactions increase contention and abort risk. MongoDB enforces a transaction lifetime limit (`transactionLifetimeLimitSeconds`, default 60 seconds in many deployments).

**Incorrect: long transaction doing broad scan + many writes**

```javascript
await session.withTransaction(async () => {
  const docs = await db.collection("events")
    .find({ createdAt: { $lt: cutoff } }, { session })
    .toArray()

  for (const d of docs) {
    await db.collection("archive").insertOne(d, { session })
    await db.collection("events").deleteOne({ _id: d._id }, { session })
  }
})
```

This can exceed lifetime limits and hold locks too long.

**Correct: chunked short transactions**

```javascript
while (true) {
  const batch = await db.collection("events")
    .find({ createdAt: { $lt: cutoff } })
    .limit(200)
    .toArray()

  if (batch.length === 0) break

  await session.withTransaction(async () => {
    for (const d of batch) {
      await db.collection("archive").insertOne(d, { session })
      await db.collection("events").deleteOne({ _id: d._id }, { session })
    }
  })
}
```

Keep each transaction bounded by time and operation count.

**When NOT to use this pattern:**

- Tiny transactions that complete quickly and predictably.

- Single-document operations that do not need transactions.

1. Measure p95 and p99 transaction duration.

2. Track abort reasons and timeout-related errors.

3. Tune batch sizes so transactions stay comfortably below limits.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-production-consideration/](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

### 4.4 Tune maxTransactionLockRequestTimeoutMillis for Contention Profiles

**Impact: HIGH (Improves stability under lock contention by matching timeout policy to workload)**

Transactions may abort when lock acquisition exceeds `maxTransactionLockRequestTimeoutMillis`. Use this parameter intentionally for high-contention environments instead of relying on accidental defaults.

**Incorrect: ignore lock timeout behavior under contention**

```javascript
// Heavy transactional workload with frequent lock conflicts
// No timeout strategy, repeated abort spikes in peak traffic
await session.withTransaction(async () => {
  await accounts.updateOne({ _id: from }, { $inc: { balance: -100 } }, { session })
  await accounts.updateOne({ _id: to }, { $inc: { balance: 100 } }, { session })
})
```

Without tuning and observability, contention can cause unpredictable abort storms.

**Correct: explicit timeout policy with monitored retry behavior**

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

1. Capture lock timeout abort rates before and after changes.

2. Correlate timeout settings with transaction latency and success rate.

3. Test under peak contention with realistic concurrency.

Reference: [https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxTransactionLockRequestTimeoutMillis](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxTransactionLockRequestTimeoutMillis)

---

## 5. Implementation Patterns

**Impact: MEDIUM**

The callback API simplifies retries for most applications, while the core API is better when you need explicit retry control and custom telemetry. Robust implementations instrument retries, commit outcomes, and abort causes to avoid hidden correctness regressions.

### 5.1 Choose withTransaction or Core API Deliberately

**Impact: MEDIUM (Improves correctness and maintainability by matching API style to retry/control needs)**

Use callback APIs (`withTransaction`) for most workloads because they simplify retry handling. Use Core API when you need explicit commit/retry orchestration and custom telemetry.

**Incorrect: reimplementing callback behavior poorly**

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

**Correct: callback API by default**

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

1. Inventory transaction code paths and classify callback vs core usage.

2. Ensure core API paths fully implement label-based retry semantics.

3. Keep one documented standard per service where possible.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

### 5.2 Instrument Transaction Outcomes, Retries, and Abort Causes

**Impact: MEDIUM (Makes correctness regressions visible before they become incidents)**

Without transaction telemetry, teams miss contention spikes, retry storms, and commit uncertainty patterns until customer-facing incidents occur.

**Incorrect: no transaction-level metrics**

```javascript
await session.withTransaction(async () => {
  await runBusinessOps(session)
})

// No tracking of retries, abort reasons, or unknown commit outcomes
```

Operational risk stays hidden.

**Correct: capture outcome and retry metrics**

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

1. Track `success`, `abort`, `retry`, and `unknown_commit_result` counters.

2. Correlate transaction latency with lock/contention metrics.

3. Build alert thresholds for retry spikes and abort-rate changes.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-production-consideration/](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

### 5.3 Make Transaction Bodies Idempotent Under Retries

**Impact: MEDIUM (Prevents duplicate side effects when transactions retry)**

Retryable transaction flows can execute business logic more than once. Design transaction bodies so re-execution does not create duplicate external side effects.

**Incorrect: non-idempotent side effect in transaction body**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })

  // Non-idempotent write: duplicate events if callback retries
  await outbox.insertOne({ type: "send-email", orderId }, { session })
})
```

A retry can enqueue the same action multiple times.

**Correct: idempotency key / unique constraint pattern**

```javascript
await session.withTransaction(async () => {
  await orders.updateOne({ _id: orderId }, { $set: { status: "paid" } }, { session })

  await outbox.updateOne(
    { key: `order-paid:${orderId}` },
    {
      $setOnInsert: {
        key: `order-paid:${orderId}`,
        type: "send-email",
        orderId,
        createdAt: new Date()
      }
    },
    { upsert: true, session }
  )
})
```

Idempotent keys keep retries safe.

**When NOT to use this pattern:**

- Transaction bodies with strictly internal deterministic updates and no external fan-out.

1. Force transient retry scenarios in tests.

2. Confirm outbox/event tables do not duplicate for same business key.

3. Ensure unique indexes enforce idempotency keys.

Reference: [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

---

## References

1. [https://www.mongodb.com/docs/manual/core/transactions/](https://www.mongodb.com/docs/manual/core/transactions/)
2. [https://www.mongodb.com/docs/manual/core/transactions-in-applications/](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
3. [https://www.mongodb.com/docs/manual/core/transactions-production-consideration/](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
4. [https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
5. [https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxTransactionLockRequestTimeoutMillis](https://www.mongodb.com/docs/manual/reference/parameters/#mongodb-parameter-param.maxTransactionLockRequestTimeoutMillis)
6. [https://www.mongodb.com/docs/manual/release-notes/8.2-changelog/](https://www.mongodb.com/docs/manual/release-notes/8.2-changelog/)
