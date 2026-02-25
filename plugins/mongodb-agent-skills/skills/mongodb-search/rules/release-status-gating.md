---
title: Gate Guidance by GA vs Preview Status
impact: CRITICAL
impactDescription: Prevents shipping unstable or unavailable features
tags: release-gates, changelog, ga, preview
---

## Gate Guidance by GA vs Preview Status

**Impact: CRITICAL (release-stage mistakes create production regressions)**

For release-sensitive capabilities, mark each recommendation as GA, Preview, or Public Preview and cite current changelog pages.

**Incorrect (status-blind guidance):**

```text
"Use this feature in production everywhere"  // no version or status check
```

**Correct (release-gated guidance):**

```text
1) Check Atlas Search changelog and Atlas Vector Search changelog.
2) Record date and status (GA/Preview/Public Preview).
3) Add version and deployment prerequisites to the recommendation.
```

**How to verify:**

- Every release-sensitive rule includes a status label and source URL.
- The rule names a minimum server version when required.

**When NOT to use this pattern:**

- The rule is timeless and not tied to feature rollout stage.

Reference: [Atlas Search Changelog](https://www.mongodb.com/docs/atlas/atlas-search/changelog.md)
Reference: [Atlas Vector Search Changelog](https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog.md)
Reference: [Preview Features](https://www.mongodb.com/docs/preview-features.md)
