---
title: Enforce Community Search Prerequisites and Authentication
impact: CRITICAL
impactDescription: Prevents non-functional or insecure self-managed Search setups
tags: community, keyfile, searchCoordinator, authentication
---

## Enforce Community Search Prerequisites and Authentication

**Impact: CRITICAL (missing prerequisites block Search entirely)**

**Current MongoDB docs cover Community Search on MongoDB Community Edition 8.2.0 or higher.**
Verify: `db.version()` returns 8.2.0 or higher before using this workflow, and do not assume the same self-managed Search path exists on older community releases unless the docs for that release line say so.

Community/self-managed Search always requires a replica set and a user with the `searchCoordinator` role for `mongot` authentication. The authentication wiring differs by deployment path:

- Manual Community path: follow keyfile-authenticated replica set setup.
- Kubernetes Operator path: follow MongoDBSearch CR + operator-managed wiring, and still create the sync-source user with `searchCoordinator`.

**Incorrect (missing auth role and deployment-path validation):**

```yaml
# WRONG: no searchCoordinator user and no explicit deployment path selected
replication:
  replSetName: rs0
security:
  authorization: disabled
```

**Correct (prereq-aligned setup):**

```javascript
// Create user for mongot authentication.
use admin
db.createUser({
  user: "mongotUser",
  pwd: passwordPrompt(),
  roles: [{ role: "searchCoordinator", db: "admin" }]
})
```

```text
Manual Community path:
- Configure keyfile-authenticated replica set, then connect mongot.

Kubernetes Operator path:
- Configure MongoDBSearch resource + source credentials.
- Ensure sync-source user has searchCoordinator role.
```

**How to verify:**

- Replica set is initiated and user with `searchCoordinator` exists.
- If manual path: keyfile auth is enabled.
- If Operator path: MongoDBSearch resource is running and connected.
- Configured sync-source user exists with `searchCoordinator` role.

**When NOT to use this pattern:**

- Atlas-managed deployments (these prerequisites are managed by Atlas).

Reference: [Deploy a Replica Set with Keyfile Authentication for mongot](https://www.mongodb.com/docs/manual/core/search-in-community/deploy-rs-keyfile-mongot.md)
Reference: [Connect to MongoDB Search Community](https://www.mongodb.com/docs/manual/core/search-in-community/connect-to-search.md)
Reference: [Deploy MongoDB Search and Vector Search in Kubernetes](https://www.mongodb.com/docs/kubernetes/current/fts-vs-deployment.md)
