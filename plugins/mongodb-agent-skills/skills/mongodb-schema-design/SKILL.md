---
name: mongodb-schema-design
description: MongoDB schema design patterns and anti-patterns. Use when designing data models, reviewing schemas, migrating from SQL, or troubleshooting performance issues caused by schema problems. Triggers on "design schema", "embed vs reference", "MongoDB data model", "schema review", "unbounded arrays".
license: Apache-2.0
metadata:
  author: mongodb
  version: "1.0.0"
---

# MongoDB Schema Design

Data modeling patterns and anti-patterns for MongoDB, maintained by MongoDB. Contains 12 rules across 3 categories, prioritized by impact. Bad schema is the root cause of most MongoDB performance and cost issues—queries and indexes cannot fix a fundamentally wrong model.

## When to Apply

Reference these guidelines when:
- Designing a new MongoDB schema
- Migrating from SQL to MongoDB
- Reviewing existing data models
- Troubleshooting slow queries or growing document sizes
- Deciding between embedding and referencing
- Seeing Atlas schema suggestions or Performance Advisor warnings

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Schema Anti-Patterns | CRITICAL | `antipattern-` |
| 2 | Schema Fundamentals | HIGH | `fundamental-` |
| 3 | Design Patterns | MEDIUM | `pattern-` |

## Quick Reference

### 1. Schema Anti-Patterns (CRITICAL)

- `antipattern-unbounded-arrays` - Never allow arrays to grow without limit
- `antipattern-bloated-documents` - Keep documents under 16KB for working set
- `antipattern-massive-arrays` - Arrays over 1000 elements hurt performance
- `antipattern-unnecessary-collections` - Fewer collections, more embedding
- `antipattern-excessive-lookups` - Reduce $lookup by denormalizing

### 2. Schema Fundamentals (HIGH)

- `fundamental-embed-vs-reference` - Decision framework for relationships
- `fundamental-data-together` - Data accessed together stored together
- `fundamental-document-model` - Embrace documents, avoid SQL patterns
- `fundamental-schema-validation` - Enforce structure with JSON Schema

### 3. Design Patterns (MEDIUM)

- `pattern-bucket` - Group time-series or IoT data into buckets
- `pattern-extended-reference` - Cache frequently-accessed related data
- `pattern-subset` - Store hot data in main doc, cold data elsewhere

## Key Principle

> **"Data that is accessed together should be stored together."**

This is MongoDB's core philosophy. Embedding related data eliminates joins, reduces round trips, and enables atomic updates. Reference only when you must.

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/antipattern-unbounded-arrays.md
rules/fundamental-embed-vs-reference.md
rules/_sections.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Performance impact and metrics

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
