---
title: Respond to Search Max Fields Indexed Guardrail
impact: CRITICAL
impactDescription: Avoids severe performance regressions from over-indexing fields
tags: alerts, metrics, field-limits, dynamic-mapping
---

## Respond to Search Max Fields Indexed Guardrail

**Impact: CRITICAL (high indexed-field counts can degrade performance and stability)**

If `Atlas Search: Max Number of Fields Indexed` fires (default > 1000), treat it as an index design issue, not just an alert threshold issue.

**Incorrect (silencing alert only):**

```text
"Increase the alert threshold and keep current dynamic mapping."
```

**Correct (reduce indexed field surface area):**

```text
1) Audit current mappings and dynamic scopes.
2) Convert stable fields to static mappings.
3) Split broad use cases into separate indexes.
4) Re-check Search Max Fields Indexed after rollout.
```

**How to verify:**

- Alert clears due to reduced field counts, not only threshold changes.
- Search latency and index build behavior improve or remain stable.

**When NOT to use this pattern:**

- None. Field-count alerts always require root-cause analysis.

Reference: [Atlas Search Changelog](https://www.mongodb.com/docs/atlas/atlas-search/changelog.md)
Reference: [Atlas Alert Conditions](https://www.mongodb.com/docs/atlas/reference/alert-conditions.md)
Reference: [Review Atlas Search Metrics](https://www.mongodb.com/docs/atlas/review-atlas-search-metrics.md)
