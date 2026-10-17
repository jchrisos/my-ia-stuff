---
name: okf-init
description: Initializes the Open Knowledge Format (OKF v0.2) bundle in an existing project by analyzing the codebase and Git history.
---

# OKF Bootstrap & Initialization Skill

Use this skill when the user wants to create the `./.okf/` bundle for the first time in a repository.

## Execution Tasks:
1. **Create Structure:** Create the `./.okf/` directory and the `./.okf/concepts/` subdirectory.
2. **Architecture Analysis:** Inspect project configuration files (e.g., `go.mod`, `package.json`, `pom.xml`), folder structure, and main source code to understand layers and technologies used.
3. **Git History Backfill:** Scan the recent `git log` to identify major refactorings and past structural decisions.
4. **Generate Base Files:**
   - **`./.okf/index.md`**: Create the root file with frontmatter containing `okf_version: "0.2"` and list links to the discovered concepts.
   - **`./.okf/log.md`**: Create the chronological changelog registering the retroactive history mapped from Git.
   - **`./.okf/concepts/*.md`**: Create modular files (e.g., `architecture.md`, `storage.md`) following the official OKF v0.2 schema (with the mandatory `type` field in the YAML frontmatter).
5. **Security Check:** Ensure no real credentials or sensitive data are included in the generated files.
