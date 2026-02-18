---
title: Plan Production Index Builds with Modern Build Semantics
impact: HIGH
impactDescription: "Modern index builds are optimized and mostly non-blocking, but they still consume CPU, memory, and I/O"
tags: index, creation, production, locking, maintenance, monitoring
---

## Plan Production Index Builds with Modern Build Semantics

**Do not rely on the legacy `background` option.** Modern MongoDB uses optimized index builds and ignores `background` if provided. Builds take brief exclusive collection locks at start/end, and yield during most of the work.

**Incorrect (legacy assumptions and no operational plan):**

```javascript
// Legacy-style command. The background option is ignored in modern versions.
db.orders.createIndex({ customerId: 1 }, { background: true })

// No capacity check, no monitoring, no rollback plan.
```

**Correct (capacity-aware index build plan):**

```javascript
// 1) Create the index without legacy background options
// (MongoDB uses the modern optimized build path.)
db.orders.createIndex(
  { customerId: 1, createdAt: -1 },
  { name: "orders_customer_created_idx" }
)

// 2) Monitor ongoing builds
db.currentOp({ "command.createIndexes": { $exists: true } })
```

**Operational guidance:**

- Expect reduced write throughput during heavy builds on busy collections.
- Schedule large builds during lower-traffic windows.
- Monitor replication lag and resource pressure during build windows.
- For unique indexes, validate/clean duplicate data before build to avoid end-of-build failures.

**Replica-set behavior notes:**

```javascript
// Default commit quorum is voting data-bearing members.
// You can set commitQuorum explicitly for createIndexes when needed:
db.runCommand({
  createIndexes: "orders",
  indexes: [{ key: { customerId: 1 }, name: "orders_customer_idx" }],
  commitQuorum: "votingMembers"
})
```

**When to be extra careful:**

- Very large collections with sustained write load.
- Tight disk I/O or RAM headroom.
- Multi-index rollout on multiple critical collections at once.

## Verify with

```javascript
function monitorIndexBuilds() {
  const inprog = db.currentOp({ "command.createIndexes": { $exists: true } }).inprog

  if (!inprog.length) {
    print("No index builds in progress")
    return
  }

  inprog.forEach(op => {
    print(`ns: ${op.ns}`)
    print(`opid: ${op.opid}`)
    print(`secs_running: ${op.secs_running || 0}`)
    if (op.msg) print(`msg: ${op.msg}`)
  })
}
```

Reference: [Index Build Process](https://mongodb.com/docs/manual/core/index-creation/)
