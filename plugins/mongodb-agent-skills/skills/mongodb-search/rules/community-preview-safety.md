---
title: Apply Community Search Preview Safety Controls
impact: CRITICAL
impactDescription: Avoids treating preview self-managed Search as production-equivalent
tags: community, preview, production-safety, mongot
---

## Apply Community Search Preview Safety Controls

**Impact: CRITICAL (misclassifying preview systems can cause outages)**

Self-managed Community Search guidance is release-sensitive. Before treating it as a production-ready path, confirm the current release status and the exact versioned Community Search docs for the deployment you are targeting.

If the current release-status source marks the feature Preview or Public Preview, keep the recommendation evaluation-focused and require staging validation before production.

**Incorrect (status-blind production recommendation):**

```text
"Recommend Community Search for strict-SLA production without checking current release status or versioned docs."
```

**Correct (release-status-gated recommendation):**

```text
- Check the current release-status source and Community Search docs for the target version.
- Record whether the feature is GA, Preview, or Public Preview.
- If it is Preview/Public Preview, require staging/perf validation and explicit risk acceptance before production.
```

**How to verify:**

- Guidance includes a current status label and source URL.
- Production recommendations include exact version/deployment prerequisites.

**When NOT to use this pattern:**

- The user is only running local experimentation and accepts preview limitations.

Reference: [Preview Features](https://www.mongodb.com/docs/preview-features.md)
Reference: [Connect to MongoDB Search Community](https://www.mongodb.com/docs/manual/core/search-in-community/connect-to-search.md)
