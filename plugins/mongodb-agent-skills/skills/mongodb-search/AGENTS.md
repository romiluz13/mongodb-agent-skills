# MongoDB Search Best Practices

**Version 1.0.1**
MongoDB
February 2026

## Abstract

MongoDB Search engine guidance for Atlas and self-managed deployments. Contains 24 rules across 6 categories: deployment/release gates, mapping guardrails, query composition, hybrid orchestration, operations, and cross-skill boundaries.

## Rule Index

1. Deployment Modes and Release Gates
   - deploy-track-detection
   - release-status-gating
   - community-preview-safety
   - community-prereqs-mongot-auth
   - community-mongot-health-check
2. Index Architecture and Mappings
   - index-static-vs-dynamic-mappings
   - index-fields-limit-guardrail
   - index-ngram-limit-guardrail
   - index-analyzer-selection
   - index-synonyms-lifecycle
   - index-facet-field-typing
3. Query Composition and Relevance
   - query-compound-structure
   - query-operator-selection
   - query-score-tuning
   - query-return-shape
   - query-facet-pipelines
4. Hybrid and Vector Interop
   - hybrid-lexical-prefilter-routing
   - hybrid-fusion-stage-gates
   - hybrid-strategy-selection
5. Operations and Troubleshooting
   - ops-alerts-and-metrics-runbook
   - ops-index-build-failure-triage
   - ops-log-driven-debugging
   - ops-reindex-change-management
6. Skill Boundary Rules
   - boundary-handoff-to-mongodb-ai

## Maintainer Notes

- Treat official MongoDB docs as canonical.
- Treat changelog entries as release gate truth.
- Keep this skill focused on search engine semantics and operations.
- Route model/provider semantics to `mongodb-ai`.
