---
title: Use Hidden Indexes to Test Removals Safely
impact: HIGH
impactDescription: "Lets you validate index removal without affecting production traffic"
tags: index, hidden, maintenance, performance, rollback
---

## Use Hidden Indexes to Test Removals Safely

**Hidden indexes let you validate index removal without dropping them.** You can hide an index, monitor performance, and unhide it instantly if queries regress.

**Incorrect (drop index immediately):**

```javascript
// Dropping blindly can break critical queries

db.orders.dropIndex("status_1_createdAt_-1")
```

**Correct (hide, observe, then drop):**

```javascript
// Hide the index first

db.orders.hideIndex("status_1_createdAt_-1")

// If performance regresses, unhide

db.orders.unhideIndex("status_1_createdAt_-1")
```

**When NOT to use this pattern:**

- **You need to reduce storage immediately**: Hidden indexes still consume disk.
- **You are confident and have load-tested**: Dropping may be fine.

**Important caveats:**

- Hiding/unhiding resets that index's `$indexStats` counters.
- You cannot `hint()` a hidden index.
- Hidden indexes still enforce their behavior (for example `unique` and TTL effects continue).

## Verify with

```javascript
// Check hidden flag in index definitions

db.orders.getIndexes()
```

Reference: [Hidden Indexes](https://mongodb.com/docs/manual/core/index-hidden/)
