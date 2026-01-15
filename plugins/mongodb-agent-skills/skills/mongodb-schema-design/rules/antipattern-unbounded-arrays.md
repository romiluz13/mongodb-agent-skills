---
title: Avoid Unbounded Arrays
impact: CRITICAL
impactDescription: Prevents 16MB document limit crash and memory exhaustion
tags: schema, arrays, anti-pattern, document-size, atlas-suggestion
---

## Avoid Unbounded Arrays

Never design schemas where arrays can grow indefinitely. Unbounded arrays cause documents to exceed the 16MB BSON limit, degrade write performance as documents grow, and force expensive document relocations.

**Incorrect (array grows forever):**

```javascript
// User document with unbounded activity log
{
  _id: "user123",
  name: "Alice",
  activityLog: [
    { action: "login", ts: ISODate("2024-01-01") },
    { action: "purchase", ts: ISODate("2024-01-02") },
    // ... grows to 100,000+ entries over time
  ]
}
```

**Correct (separate collection with reference):**

```javascript
// User document (bounded)
{ _id: "user123", name: "Alice" }

// Activity in separate collection
{ userId: "user123", action: "login", ts: ISODate("2024-01-01") }
{ userId: "user123", action: "purchase", ts: ISODate("2024-01-02") }
```

**Alternative (bucket pattern for time-series):**

```javascript
// Activity bucket - one document per user per day
{
  userId: "user123",
  date: ISODate("2024-01-01"),
  activities: [
    { action: "login", ts: ISODate("...") },
    { action: "purchase", ts: ISODate("...") }
  ],
  count: 2
}
```

Atlas Schema Suggestions flags this as: "Avoid unbounded arrays". If your array can grow beyond ~100 elements, redesign.

Reference: [Schema Design Anti-Patterns](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)
