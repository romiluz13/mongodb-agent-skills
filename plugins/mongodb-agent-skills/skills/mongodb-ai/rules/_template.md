---
title: Rule Title Here
impact: CRITICAL|HIGH|MEDIUM
impactDescription: Brief description of measurable impact
tags: tag1, tag2, tag3
---

## Rule Title Here

Brief explanation of why this rule matters and what problem it solves.

**Incorrect (description of the problem):**

```javascript
// Bad code example using MongoDB Shell syntax
db.collection.aggregate([{ $vectorSearch: ... }])
```

**Correct (description of the solution):**

```javascript
// Good code example using MongoDB Shell syntax
db.collection.aggregate([{ $vectorSearch: ... }])
```

Optional additional context, variations, or edge cases.

**When NOT to use this pattern:**

- Exception scenario 1 where this rule doesn't apply
- Exception scenario 2 where the trade-off isn't worth it

Reference: [MongoDB Documentation](https://mongodb.com/docs/atlas/atlas-vector-search/)
