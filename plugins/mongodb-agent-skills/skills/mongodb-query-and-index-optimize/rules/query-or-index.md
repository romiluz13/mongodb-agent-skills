---
title: Index $or Clauses for Index-Based Plans
impact: HIGH
impactDescription: "When all $or clauses are index-supported, MongoDB can merge index scans instead of scanning the full collection"
tags: query, or, index, logical-operator, collscan, performance
---

## Index $or Clauses for Index-Based Plans

**For `$or` queries, each clause should be index-supported if you want an index-based `$or` plan.** If one clause is not supportable by an index, the optimizer can fall back to a broader scan strategy.

**Incorrect (missing index support on one clause):**

```javascript
// Indexed: status, category
// Missing index for priority range
db.tasks.find({
  $or: [
    { status: "urgent" },
    { category: "critical" },
    { priority: { $gte: 9 } }
  ]
})
```

**Correct (index support for each clause):**

```javascript
db.tasks.createIndex({ status: 1 })
db.tasks.createIndex({ category: 1 })
db.tasks.createIndex({ priority: 1 })

// Now each clause can be index-supported
db.tasks.find({
  $or: [
    { status: "urgent" },
    { category: "critical" },
    { priority: { $gte: 9 } }
  ]
})
```

**Operator caveats:**

- If `$or` includes `$text`, all clauses must be index-supported.
- `$or` with `$near`/`$nearSphere` cannot include additional clauses.
- For equality checks on the same field, prefer `$in` over `$or`.

**Partial index caveat:**

- `$or` queries can use partial indexes, but only when the clause predicate is compatible with the partial filter expression.

## Verify with

```javascript
function checkOrPlan(collection, query) {
  const exp = db[collection].find(query).explain("executionStats")
  const plan = JSON.stringify(exp.queryPlanner.winningPlan)

  print(`usesCOLLSCAN: ${plan.includes('COLLSCAN')}`)
  print(`docsExamined: ${exp.executionStats.totalDocsExamined}`)
  print(`nReturned: ${exp.executionStats.nReturned}`)
}
```

Reference: [$or Query Operator](https://mongodb.com/docs/manual/reference/operator/query/or/)
