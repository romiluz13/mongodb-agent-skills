---
title: Retry Commit on UnknownTransactionCommitResult
impact: CRITICAL
impactDescription: "Prevents double-processing and unresolved transaction outcomes"
tags: commit, UnknownTransactionCommitResult, retry, reliability
---

## Retry Commit on UnknownTransactionCommitResult

`UnknownTransactionCommitResult` means the client does not know whether commit succeeded. Retry commit until terminal outcome instead of rerunning the full transaction body blindly.

**Incorrect (rerunning body immediately after unknown commit result):**

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

**Correct (retry commit command):**

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

## Verify with

1. Simulate network faults during commit and verify commit-only retry loop.
2. Confirm no duplicate outbox/ledger side effects appear.
3. Track unknown-commit incidents in telemetry.

Reference: [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
