---
title: Apply Community Search Preview Safety Controls
impact: CRITICAL
impactDescription: Avoids treating preview self-managed Search as production-equivalent
tags: community, preview, production-safety, mongot
---

## Apply Community Search Preview Safety Controls

**Impact: CRITICAL (misclassifying preview systems can cause outages)**

MongoDB Search and Vector Search in MongoDB Community are preview features. Treat them as evaluation tracks unless the user explicitly accepts preview risk.

**Incorrect (production recommendation without caveat):**

```text
"Run business-critical workloads on Community Search without additional risk controls."
```

**Correct (preview-safe recommendation):**

```text
- Label Community Search as Preview.
- Recommend staging/perf testing before production.
- For strict production SLAs, recommend Atlas Search or a fully supported path.
```

**How to verify:**

- Guidance includes explicit Preview label.
- Production path includes risk acceptance or managed alternative.

**When NOT to use this pattern:**

- The user is only running local experimentation and accepts preview limitations.

Reference: [Install MongoDB Community Edition](https://www.mongodb.com/docs/manual/administration/install-community.md)
Reference: [Install MongoDB Search and MongoDB Vector Search (Community)](https://www.mongodb.com/docs/manual/administration/install-community.md#install-mongodb-search-and-mongodb-vector-search)
