---
title: Use Alert and Metrics Runbooks for Search Operations
impact: HIGH
impactDescription: Cuts mean time to mitigation for common Search incidents
tags: operations, alerts, metrics, runbook
---

## Use Alert and Metrics Runbooks for Search Operations

**Impact: HIGH (ad hoc incident handling increases outage time)**

Build a Search runbook that maps each major alert to immediate remediation actions and metric checks.

**Incorrect (alert-only response):**

```text
"Alert fired, wait and see."
```

**Correct (structured runbook response):**

```text
Example mapping:
- Max Fields Indexed -> reduce dynamic scope, split indexes.
- Max nGram Fields Indexed -> reduce nGram/autocomplete surface.
- Mongot stopped replication -> reduce disk pressure, scale search nodes.
- Search process out of memory -> scale resources, simplify index/query shape.
```

**How to verify:**

- Each alert condition has an owner and first-response action.
- Metrics dashboard includes Search Max Fields and Search Max nGram Fields.

**When NOT to use this pattern:**

- Never. Production Search operations always require a runbook.

Reference: [Atlas Alert Conditions](https://www.mongodb.com/docs/atlas/reference/alert-conditions.md)
Reference: [Fix Atlas Search Issues](https://www.mongodb.com/docs/atlas/reference/alert-resolutions/atlas-search-alerts.md)
Reference: [Review Atlas Search Metrics](https://www.mongodb.com/docs/atlas/review-atlas-search-metrics.md)
