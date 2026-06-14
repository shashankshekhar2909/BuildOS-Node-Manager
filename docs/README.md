# BuildOS Node Commander — Documentation Center

Welcome to the **BuildOS Node Commander** documentation folder! This center has been structured so that any developer or agent can immediately understand the architecture, completed implementations, and subsequent project directions.

The documentation suite is split into three files:
1. [**Architecture & Tech Stack**](./ARCHITECTURE.md): Highlights the backend design, storage engines, Voice Gateway layer, and interactive client console modules.
2. [**Completed Milestones**](./COMPLETED_WORK.md): Details the complete roadmap of all implemented features, layout adjustments, and modern enhancements up to v1.5.0 stable.
3. [**Future Plans & Roadmap**](./FUTURE_PLANS.md): Provides a clear operational strategy for the next phases of development.

---

## 🚀 Quick Repository Overview

*   **Entry Point Code**: `/server.ts` imports Express, hosts RPC-like commands, manages WebSocket bindings, verifies Firebase auth tokens, and handles live SSH connection threads.
*   **Front End Application**: `/src/App.tsx` organizes the high-level React dashboard wrapper, authenticates Google Users, maintains local telemetry caches, and triggers state synchronization with Firestore.
*   **Interactive Node Telemetry**: `/src/components/NodeMonitor.tsx` renders real-time performance graphs using D3/Recharts and triggers direct container / daemon service restart actions.
*   **Speech-to-Text Voice System**: `/src/components/VoiceAgent.tsx` processes live browser audio buffers, proxies requests stream-by-stream, and asks Gemini models to translate natural language speech commands into production-grade SSH expressions.
*   **System Layout Styles**: `/src/index.css` compiles global theme tokens, scrollbar utilities, font maps (using **IBM Plex Sans** / **IBM Plex Mono**), and includes contrast-optimized color map redirections for the dual theme toggle system.

---

## 🎨 Theme Support Highlights

The application contains an adaptive **Light / Dark Mode Engine** managed client-side in `/src/App.tsx` and compiled gracefully in `/src/index.css`:
*   **Dark Mode (Default)**: Leverages Carbon Gray 100 deep borders with high-contrast emerald and cobalt active feedback bars.
*   **Light Mode**: Redirects pixel maps dynamically to clean slate whites, enhanced legible blues for metadata elements, and deeper forest greens to avoid light contrast strain.
