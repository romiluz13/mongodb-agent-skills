---
title: Structure compound Clauses for Relevance and Filtering
impact: CRITICAL
impactDescription: Avoids unnecessary scoring work and post-search filtering
tags: compound, must, should, filter, relevance
---

## Structure compound Clauses for Relevance and Filtering

**Impact: CRITICAL (poor clause structure hurts relevance and latency)**

Put scoring criteria in `must` and `should`; put non-scoring filters in `filter`. Avoid pushing core filtering to a post-`$search` `$match` stage.

**Incorrect (post-search match and scoring filters mixed):**

```javascript
db.jobs.aggregate([
  { $search: { text: { query: "mongodb engineer", path: "title" } } },
  { $match: { location: "remote", level: "senior" } }
])
```

**Correct (single search stage with compound):**

```javascript
db.jobs.aggregate([
  {
    $search: {
      compound: {
        must: [
          { text: { query: "mongodb engineer", path: "title" } }
        ],
        filter: [
          { equals: { path: "location", value: "remote" } },
          { equals: { path: "level", value: "senior" } }
        ],
        should: [
          { text: { query: "atlas", path: "skills" } }
        ]
      }
    }
  }
])
```

**How to verify:**

- Query uses `compound.filter` for non-scoring constraints.
- Relevance ranking still reflects `must/should` intent.

**When NOT to use this pattern:**

- Single simple operator query with no filters or ranking preferences.

Reference: [compound Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/compound.md)
Reference: [Query Reference](https://www.mongodb.com/docs/atlas/atlas-search/query-ref.md)
