---
name: okf
description: Manages and consumes the official Google Cloud Open Knowledge Format (OKF v0.2) in ./.okf
---

# Open Knowledge Format (OKF v0.2) - Official Skill

This skill defines the canonical rules of the Google Cloud specification (`GoogleCloudPlatform/open-knowledge-format`) for structuring, reading, and updating project knowledge in `./.okf`.

## 1. Structure Principles
- **Bundle Directory:** All knowledge resides in a root directory `./.okf/`.
- **Identity via Path:** The relative file path serves as the unique identifier for the concept (e.g., `.okf/concepts/architecture.md` represents the `concepts/architecture` concept).
- **Reserved Files:**
  - `index.md`: Mandatory at the root of the bundle. Must contain `okf_version: "0.2"` in the YAML frontmatter and list the concepts to enable *progressive disclosure*.
  - `log.md`: Chronological changelog in ISO format (`YYYY-MM-DD`), recording design decisions and trade-offs.

## 2. YAML Frontmatter Schema (v0.2)
Every concept in `./.okf/concepts/` must start with a strict YAML block containing the mandatory `type` field:

```yaml
---
type: architecture # (e.g., architecture, service, policy, decision, runbook)
title: "Descriptive Title"
description: "Brief summary of the concept."
status: active # (active, deprecated, draft)
verified:
  - by: "Staff Engineer"
    at: "2026-10-16"
sources:
  - uri: "git://commit-hash"
    credibility: high
stale_after: "2027-04-16"
---
