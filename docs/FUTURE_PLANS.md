# BuildOS Node Commander — Future Plans & Roadmap

This file provides architectural plans and recommended project steps for developers or AI agents taking over BuildOS Node Commander.

---

## ✅ Completed Style Milestones

### IBM Carbon Design System Alignment (v1.6.5)
- **Unified Block Navigation Bar**: Completely converted the primary dashboard routing into a zero-radius, border-connected IBM Carbon horizontal bar (`bg-[#1a1a1a]/60 font-mono text-[11px] uppercase`) containing fine `border-r border-[#393939]` separators.
- **Contrast Base Refinements**: Integrated clean hover highlights (`hover:bg-[#202020]`), permanent bottom blue-accent tracking lines (`border-b-[#0f62fe]`), and unified layout margins for enterprise-tier visualization.

---

## 🔮 Recommended Next-Phase Features

Here are four major focus directions that can expand BuildOS Node Commander's operational value:

### 1. Persistent Storage of Historic Telemetry
*   **Goal**: Move performance snapshots from ephemeral React component state to Google Firestore database records.
*   **Implementation Strategy**:
    *   Form a server cron process or a task queue system that logs host machine CPU/RAM percentages every 15 minutes.
    *   Retain a rolling window of the past 7 days of performance statistics inside a sub-collection named `metrics`.
    *   Extend `/src/components/NodeMonitor.tsx` to display daily, weekly, or monthly performance analysis graphs instead of only immediate real-time stats.

### 2. Multi-Host Command Orchestration & Script Library
*   **Goal**: Run critical scripts across multiple remote nodes in parallel.
*   **Implementation Strategy**:
    *   Add a **Script Store Manager** collection in Firestore to write and preserve reusable command snippets (e.g. `System Clean (Log rotation)`, `Docker Prune`, `UFW Firewall Lockdown`).
    *   Implement checkbox selection in the main dashboard grid, allowing admins to highlight 3-4 machines at once, and dispatch a script to all of them with a consolidated output panel.

### 3. Native Slack / Discord Alerting Webhooks
*   **Goal**: Alert administrators of node service failures, container exits, or excessive RAM load.
*   **Implementation Strategy**:
    *   Add a notification setting pane to the configuration drawer where users store Discord or Slack webhook URLs.
    *   Create a background monitor loop running in the Express server that validates ping states every 60 seconds.
    *   Format a message payload containing diagnostic outputs whenever a container status changes from `Up` to `Exited`.

### 4. Direct SFTP File Explorer Interface
*   **Goal**: Visually explore remote system directories and download log files.
*   **Implementation Strategy**:
    *   Use the existing `ssh2` client SFTP APIs on the node server to list distant file system trees.
    *   Render a bento-style nested file navigation panel next to the interactive SSH console.
    *   Authorize operators to read, edit, or pull files (such as Nginx configuration files or log files) directly using the client interface.
