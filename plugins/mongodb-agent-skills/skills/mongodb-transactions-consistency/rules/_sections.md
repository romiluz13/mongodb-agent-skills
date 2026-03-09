# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Transaction Fundamentals (fundamental)

**Impact:** CRITICAL
**Description:** Transactions are required when a business invariant spans multiple documents, collections, or shards. MongoDB single-document writes are already atomic, so overusing transactions adds complexity and latency without correctness benefit. Every operation in a transaction must run on the same logical session and transaction scope.

## 2. Consistency Semantics (consistency)

**Impact:** HIGH
**Description:** Read concern and write concern choices define visibility and durability guarantees. `snapshot` reads provide a stable view but have explicit requirements, while majority concerns are essential for causal consistency guarantees. Incorrect concern combinations can pass tests but fail under failover or rollback scenarios.

## 3. Retry and Error Handling (retry)

**Impact:** CRITICAL
**Description:** Transaction correctness depends on handling retry labels and commit uncertainty. `TransientTransactionError` requires retrying the full transaction body, while `UnknownTransactionCommitResult` requires retrying commit until terminal outcome. Application logic must remain idempotent under repeated execution.

## 4. Operational Constraints (ops)

**Impact:** HIGH
**Description:** Production transaction behavior is constrained by runtime limits, lock acquisition windows, and operation restrictions. Long transactions increase contention and risk aborts. Sharded transactions require additional care for latency and failure domains.

## 5. Implementation Patterns (pattern)

**Impact:** MEDIUM
**Description:** The callback API simplifies retries for most applications, while the core API is better when you need explicit retry control and custom telemetry. Robust implementations instrument retries, commit outcomes, and abort causes to avoid hidden correctness regressions.
