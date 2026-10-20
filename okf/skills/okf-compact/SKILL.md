---
name: okf-compact
description: Compacts, prunes, and summarizes the .okf knowledge bundle, archiving outdated concepts and condensing the decision log.
---

# OKF Compact & Gardening Skill

Use this skill when the `.okf/` bundle is getting too large, full of obsolete concepts, or when the decision log (`log.md`) needs summarization.

## Execution Tasks:
1. **Audit Bundle & Index:** Review `./.okf/index.md` and check all concept files in `./.okf/concepts/` to identify stale, redundant, or deprecated information.
2. **Archive or Prune:** Move outdated or superseded concepts into a `./.okf/archive/` folder, or update their frontmatter to `status: deprecated`.
3. **Condense Log (`log.md`):** Summarize older, granular entries in `./.okf/log.md` into higher-level milestone blocks or quarterly summaries, keeping recent daily entries intact.
4. **Update Index:** Regenerate `./.okf/index.md` to reflect only the active, streamlined concepts, ensuring a clean and lightweight context for future sessions.
5. **Validate:** Run a quick check to ensure all remaining Markdown links are valid and the bundle structure adheres to OKF v0.2.
