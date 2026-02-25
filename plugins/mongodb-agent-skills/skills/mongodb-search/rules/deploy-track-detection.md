---
title: Detect Deployment Track Before Recommending Syntax
impact: CRITICAL
impactDescription: Prevents invalid commands across Atlas, local Atlas, and self-managed Search tracks
tags: deployment, atlas, community, local, routing
---

## Detect Deployment Track Before Recommending Syntax

**Impact: CRITICAL (cross-track syntax mistakes can fully break implementation)**

Search syntax and operations differ by deployment track. Always detect and state the deployment track first: Atlas cloud, local Atlas deployment, manual self-managed Community, or Kubernetes Operator-managed self-managed Search.

**Incorrect (assuming Atlas by default):**

```javascript
// WRONG: this advice assumes Atlas with no environment validation
db.movies.createSearchIndex("default", {
  mappings: { dynamic: true }
})
```

**Correct (deployment-first routing):**

```javascript
// 1) Confirm track: atlas-cloud | atlas-local | community-manual | k8s-operator-self-managed
// 2) Confirm MongoDB version
// 3) Pick docs and syntax for that track only
const context = {
  track: "k8s-operator-self-managed",
  mongodbVersion: "8.2"
}

if (context.track === "community-manual") {
  // Use manual Community prereqs (replica set + keyfile path + searchCoordinator user).
}

if (context.track === "k8s-operator-self-managed") {
  // Route to Kubernetes Operator Search deployment docs and CR settings.
}
```

**How to verify:**

- Require deployment track and MongoDB version before giving final commands.
- Confirm the selected track against official compatibility docs.

**When NOT to use this pattern:**

- The environment is already pinned in the task and verified in the same session.

Reference: [Atlas Search Deployment Options](https://www.mongodb.com/docs/atlas/atlas-search/about/deployment-options.md)
Reference: [Atlas Search Compatibility and Limitations](https://www.mongodb.com/docs/atlas/atlas-search/about/feature-compatibility.md)
Reference: [Install MongoDB Community Edition](https://www.mongodb.com/docs/manual/administration/install-community.md)
Reference: [Deploy MongoDB Search and Vector Search in Kubernetes](https://www.mongodb.com/docs/kubernetes/current/fts-vs-deployment.md)
