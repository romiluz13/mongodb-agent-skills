# Sections

This file defines the section ordering, impact levels, and prefixes for `mongodb-search`.

---

## 1. Deployment Modes and Release Gates (deploy)

**Impact:** CRITICAL
**Description:** Route guidance by deployment track (Atlas, local Atlas, self-managed Community), then enforce GA/Preview/Public Preview gates before giving implementation advice.

## 2. Index Architecture and Mappings (index)

**Impact:** CRITICAL
**Description:** Prevent index bloat and incorrect mapping choices by using static mappings where possible, targeted dynamic scopes, and facet/analyzer/synonym guardrails.

## 3. Query Composition and Relevance (query)

**Impact:** CRITICAL
**Description:** Build stable `$search` and `$searchMeta` pipelines using correct operator selection, `compound` clause semantics, score controls, and output-shaping options.

## 4. Hybrid and Vector Interop (hybrid)

**Impact:** HIGH
**Description:** Coordinate lexical and semantic pipelines safely by enforcing prefilter routing, fusion-stage version gates, and strategy selection constraints.

## 5. Operations and Troubleshooting (ops)

**Impact:** HIGH
**Description:** Resolve Search incidents quickly with alert runbooks, status triage, explain-based diagnostics, and safe reindex rollouts.

## 6. Skill Boundary Rules (boundary)

**Impact:** MEDIUM
**Description:** Keep this skill focused on search engine semantics; hand off provider/model and RAG semantics to `mongodb-ai`.
