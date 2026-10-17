---
name: okf-update
description: Updates the concepts and decision log of the OKF bundle (.okf/) based on changes and discussions from the current session.
---

# OKF Session Update Skill

Use this skill when completing a task or before ending the development session to persist acquired knowledge.

## Execution Tasks:
1. **Review Session:** Identify which technical decisions, design choices, or gotchas were discussed and implemented during the current session.
2. **Update Concepts:** Modify or create files in `./.okf/concepts/` that reflect architectural or business logic changes made to the code.
3. **Log Decisions:** Add a new entry at the top of `./.okf/log.md` following reverse chronological order (with today's date and the motivations/trade-offs of the change).
4. **Sync Index:** Update `./.okf/index.md` if new concepts were added, ensuring Markdown link integrity.
5. **Integrity Validation:** Verify that the YAML frontmatter of all modified files contains the `type` field and that no API keys, passwords, or sensitive data are exposed in the documentation.
