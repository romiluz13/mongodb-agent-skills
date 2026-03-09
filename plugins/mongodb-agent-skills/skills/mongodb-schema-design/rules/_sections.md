# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Schema Anti-Patterns (antipattern)

**Impact:** CRITICAL
**Description:** These anti-patterns create avoidable scalability, performance, and maintenance problems: unbounded arrays, bloated documents, unnecessary collections, schema drift, excessive lookups, and index sprawl. Use this section to identify document-shape and access-pattern risks early, before they force costly migrations.

## 2. Schema Fundamentals (fundamental)

**Impact:** HIGH
**Description:** These fundamentals cover the document model, embed-vs-reference tradeoffs, schema validation, and the BSON document size limit. The central rule is still "data that is accessed together should be stored together", but every decision should be tied to actual access patterns and document growth behavior.

## 3. Relationship Patterns (relationship)

**Impact:** HIGH
**Description:** Relationship modeling in MongoDB is a series of tradeoffs between embedding and referencing. This section covers one-to-one, one-to-few, one-to-many, one-to-squillions, many-to-many, and tree patterns, with emphasis on growth bounds, query direction, and write/read locality.

## 4. Design Patterns (pattern)

**Impact:** MEDIUM
**Description:** These design patterns solve recurring MongoDB modeling problems: archive, attribute, manual bucket fallback, computed values, extended reference, outlier handling, polymorphism, schema versioning, subset, document versioning, and native time series collections. For time-bucketed workloads, start with time series collections and use manual buckets only when native time series behavior is not the right fit.

## 5. Schema Validation (validation)

**Impact:** MEDIUM
**Description:** Schema validation enforces data contracts at the database level. This section covers `$jsonSchema`, validation actions and levels, and safe rollout strategies. Use validation to prevent bad writes, but stage rollouts so production traffic is not surprised by new constraints.
