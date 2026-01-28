---
title: Model Tree and Hierarchical Data
impact: HIGH
impactDescription: "Choose pattern based on query type—10-100× performance difference for tree operations"
tags: schema, relationships, tree, hierarchy, parent-child, categories
---

## Model Tree and Hierarchical Data

**Hierarchical data requires choosing a tree pattern based on your primary operations.** MongoDB offers five patterns for trees—each optimizes different queries. Pick wrong and your category lookups become O(n) instead of O(1).

**Incorrect (recursive queries for breadcrumbs):**

```javascript
// Using only parent references for breadcrumb navigation
{ _id: "MongoDB", parent: "Databases" }
{ _id: "Databases", parent: "Programming" }
{ _id: "Programming", parent: null }

// Building breadcrumb requires recursive queries
async function getBreadcrumb(categoryId) {
  const crumbs = []
  let current = await db.categories.findOne({ _id: categoryId })
  while (current && current.parent) {
    current = await db.categories.findOne({ _id: current.parent })
    crumbs.unshift(current)  // N queries for N-level hierarchy!
  }
  return crumbs
}
// 5-level deep category = 5 database round-trips per page view
```

**Correct (materialized path for breadcrumbs):**

```javascript
// Store full path for O(1) ancestor queries
{ _id: "MongoDB", path: ",Programming,Databases,MongoDB,", depth: 3 }

// Single query returns all ancestors
const category = db.categories.findOne({ _id: "MongoDB" })
const ancestors = category.path.split(",").filter(Boolean)
db.categories.find({ _id: { $in: ancestors } }).sort({ depth: 1 })
// 1 query regardless of depth!
```

**Common hierarchical data:**
- Category trees (Electronics > Computers > Laptops)
- Organizational charts
- File/folder structures
- Comment threads
- Geographic hierarchies

### Pattern 1: Parent References

**Best for:** Finding parent, updating parent

```javascript
// Each node stores its parent's ID
{ _id: "MongoDB", parent: "Databases" }
{ _id: "Databases", parent: "Programming" }
{ _id: "Programming", parent: null }

// Index for efficient parent lookups
db.categories.createIndex({ parent: 1 })

// Find immediate children
db.categories.find({ parent: "Databases" })

// Find parent
db.categories.findOne({ _id: node.parent })

// Con: Finding all descendants requires recursive queries
```

### Pattern 2: Child References

**Best for:** Finding children, graph-like structures

```javascript
// Each node stores array of child IDs
{ _id: "Databases", children: ["MongoDB", "PostgreSQL", "MySQL"] }
{ _id: "MongoDB", children: ["Atlas", "Compass", "Shell"] }

// Find immediate children (embedded in document)
db.categories.findOne({ _id: "Databases" }).children

// Con: Finding all ancestors requires recursive queries
// Con: Array updates on every child add/remove
```

### Pattern 3: Array of Ancestors

**Best for:** Finding ancestors, breadcrumb navigation

```javascript
// Each node stores path from root
{ _id: "MongoDB", ancestors: ["Programming", "Databases"] }
{ _id: "Atlas", ancestors: ["Programming", "Databases", "MongoDB"] }

// Index for efficient ancestor queries
db.categories.createIndex({ ancestors: 1 })

// Find all ancestors (single query)
db.categories.findOne({ _id: "MongoDB" }).ancestors

// Find all descendants of "Databases"
db.categories.find({ ancestors: "Databases" })

// Build breadcrumb
db.categories.find({ _id: { $in: node.ancestors } })
```

### Pattern 4: Materialized Paths

**Best for:** Finding subtrees, regex-based queries, sorting

```javascript
// Each node stores full path as string
{ _id: "MongoDB", path: ",Programming,Databases,MongoDB," }
{ _id: "Atlas", path: ",Programming,Databases,MongoDB,Atlas," }

// Index for path prefix queries
db.categories.createIndex({ path: 1 })

// Find all descendants (regex prefix match)
db.categories.find({ path: /^,Programming,Databases,MongoDB,/ })

// Find all ancestors (single query)
const pathParts = node.path.split(",").filter(Boolean)
db.categories.find({ _id: { $in: pathParts } })

// Sort by path for hierarchy display
db.categories.find({}).sort({ path: 1 })
```

### Pattern 5: Nested Sets

**Best for:** Fast subtree queries, rarely-changing trees

```javascript
// Each node stores left/right boundaries
{ _id: "Databases", left: 2, right: 7 }
{ _id: "MongoDB", left: 3, right: 4 }
{ _id: "PostgreSQL", left: 5, right: 6 }

// Find all descendants (single range query)
db.categories.find({
  left: { $gt: parent.left },
  right: { $lt: parent.right }
})

// Con: Insert/move requires updating many documents
// Best for read-heavy, rarely-modified hierarchies
```

### Pattern Comparison

| Pattern | Find Parent | Find Children | Find All Descendants | Find All Ancestors | Insert |
|---------|-------------|---------------|---------------------|-------------------|--------|
| Parent References | O(1) | O(1) | O(depth) recursive | O(depth) recursive | O(1) |
| Child References | O(n) | O(1) | O(depth) recursive | O(depth) recursive | O(1) |
| Array of Ancestors | O(1) | O(1) | O(1) indexed | O(1) | O(depth) |
| Materialized Paths | O(1) | O(1) regex | O(1) regex | O(1) | O(depth) |
| Nested Sets | O(1) | O(1) | O(1) range | O(1) range | O(n) |

**Recommended patterns by use case:**

| Use Case | Best Pattern | Why |
|----------|--------------|-----|
| Category breadcrumbs | Array of Ancestors | Fast ancestor lookup |
| File browser | Parent References | Simple, fast child listing |
| Org chart reporting | Materialized Paths | Subtree queries + sorting |
| Static taxonomy | Nested Sets | Fastest reads, rare changes |
| Comment threads | Parent References | Comments change frequently |

**Example: E-commerce category tree**

```javascript
// Using Materialized Paths for category navigation
{
  _id: "laptop-gaming",
  name: "Gaming Laptops",
  path: ",electronics,computers,laptops,laptop-gaming,",
  parent: "laptops",
  depth: 4,
  productCount: 234  // Denormalized for display
}

// Create indexes
db.categories.createIndex({ path: 1 })
db.categories.createIndex({ parent: 1 })

// Get full category tree under "computers"
db.categories.find({ path: /^,electronics,computers,/ }).sort({ path: 1 })

// Get breadcrumb for product page
const category = db.categories.findOne({ _id: "laptop-gaming" })
const breadcrumb = category.path.split(",").filter(Boolean)
db.categories.find({ _id: { $in: breadcrumb } }).sort({ depth: 1 })
```

**When NOT to use tree patterns:**

- **Graph-like data**: If nodes can have multiple parents, use graph database or $graphLookup.
- **Flat structure**: If depth is always 1-2, simple parent reference is sufficient.
- **Extremely deep trees**: 100+ levels may need specialized approaches.

**Verify with:**

```javascript
// Check tree consistency (no orphans)
db.categories.aggregate([
  { $match: { parent: { $ne: null } } },
  { $lookup: {
    from: "categories",
    localField: "parent",
    foreignField: "_id",
    as: "parentDoc"
  }},
  { $match: { parentDoc: { $size: 0 } } },
  { $count: "orphanedNodes" }
])

// Check path consistency (materialized paths)
db.categories.find({
  $expr: {
    $ne: [
      { $size: { $split: ["$path", ","] } },
      { $add: ["$depth", 2] }  // +2 for leading/trailing commas
    ]
  }
})
```

---

## ⚠️ Before You Implement

**I recommend a tree pattern, but please verify your hierarchy characteristics first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Primary query type | Different patterns optimize different queries | Identify most frequent tree operation |
| Tree depth | Very deep trees need different strategies | Measure max depth |
| Update frequency | Nested sets fail with frequent changes | Count tree modifications |
| Existing tree fields | May already have parent/path/ancestors | Check current schema |

**Verification query:**
```javascript
// Analyze existing tree structure
db.collection.aggregate([
  // Check for existing tree fields
  { $project: {
      hasParent: { $cond: [{ $ifNull: ["$parent", false] }, 1, 0] },
      hasPath: { $cond: [{ $ifNull: ["$path", false] }, 1, 0] },
      hasAncestors: { $cond: [{ $ifNull: ["$ancestors", false] }, 1, 0] },
      hasChildren: { $cond: [{ $ifNull: ["$children", false] }, 1, 0] },
      depth: { $ifNull: ["$depth", { $size: { $ifNull: ["$ancestors", []] } }] }
  }},
  { $group: {
      _id: null,
      withParent: { $sum: "$hasParent" },
      withPath: { $sum: "$hasPath" },
      withAncestors: { $sum: "$hasAncestors" },
      withChildren: { $sum: "$hasChildren" },
      maxDepth: { $max: "$depth" },
      avgDepth: { $avg: "$depth" }
  }}
])

// Check for orphaned nodes (parent reference doesn't exist)
db.collection.aggregate([
  { $match: { parent: { $ne: null } } },
  { $lookup: {
      from: "collection",
      localField: "parent",
      foreignField: "_id",
      as: "parentDoc"
  }},
  { $match: { parentDoc: { $size: 0 } } },
  { $count: "orphanedNodes" }
])
```

**Interpretation:**
- ✅ Existing parent field, depth <10: Parent references may suffice
- ⚠️ Frequent breadcrumb queries, depth >5: Add ancestors array or materialized path
- 🔴 Orphaned nodes found: Fix data integrity before adding tree indexes

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-schema` - Detect existing tree structure fields
- `mcp__mongodb__aggregate` - Measure tree depth and check for orphans
- `mcp__mongodb__collection-indexes` - Verify indexes support tree queries
- `mcp__mongodb__find` - Sample nodes to understand current structure

**Just ask:** "Can you analyze my hierarchy and recommend the best tree pattern?"

---

Reference: [Model Tree Structures](https://mongodb.com/docs/manual/applications/data-models-tree-structures/)
