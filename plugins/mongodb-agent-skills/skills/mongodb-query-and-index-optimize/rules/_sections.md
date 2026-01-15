# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Index Strategies (index)

**Impact:** CRITICAL
**Description:** Proper indexing is the foundation of MongoDB performance. Without indexes, every query scans the entire collection. Index strategy determines whether queries run in milliseconds or minutes.

## 2. Query Patterns (query)

**Impact:** HIGH
**Description:** How you write queries affects whether indexes can be used effectively. Certain patterns force collection scans even when indexes exist. Optimized query patterns maximize index efficiency.

## 3. Aggregation Optimization (agg)

**Impact:** HIGH
**Description:** Aggregation pipelines process data in stages. Stage order and design determine whether MongoDB can use indexes and how much data flows through the pipeline. Early filtering is critical.
