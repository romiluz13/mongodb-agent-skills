# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Schema Anti-Patterns (antipattern)

**Impact:** CRITICAL
**Description:** Anti-patterns that cause unbounded document growth, memory pressure, and cascading performance issues. These are flagged by Atlas Schema Suggestions and are the #1 cause of MongoDB production incidents.

## 2. Schema Fundamentals (fundamental)

**Impact:** HIGH
**Description:** Core data modeling decisions that determine long-term application performance. Wrong fundamentals require schema migrations to fix—get them right from the start.

## 3. Design Patterns (pattern)

**Impact:** MEDIUM
**Description:** Proven patterns for specific use cases like time-series data, frequently-accessed relationships, and large datasets. Apply when the use case matches.
