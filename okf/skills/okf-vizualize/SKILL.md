---
name: okf-visualize
description: Generates an optimized, clean interactive HTML graph visualization (viz.html) of the .okf bundle with proper spacing and layout.
---

# OKF Graph Visualization Skill (Optimized)

Use this skill when the user wants a clean, readable visual representation of the `.okf/` bundle.

## Execution Guidelines for the HTML/JS Generator:
1. **Layout Engine:** Use Cytoscape.js with a structured layout like `cose` (with high `nodeRepulsion`, `idealEdgeLength`, and `gravity`) or `dagre` (hierarchical top-to-bottom) so nodes do not overlap.
2. **Node Styling:** 
   - Increase node sizes and add padding so text labels fit comfortably inside or neatly underneath without overlapping.
   - Distinct colors by node `type` (e.g., architecture, database, ui, decision).
3. **Labels & Readability:** Ensure font sizes are legible, labels have a solid background or text outline/halo for high contrast against dark mode backgrounds, and edges have clear arrowheads.
4. **Interactive Controls:** Include zoom, pan, and a button to reset the layout.
5. **Output & Instruction:** Save as `viz.html` and instruct the user to run:
   ```bash
   open viz.html
