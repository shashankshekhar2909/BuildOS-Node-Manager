# BuildOS Node Commander — Agent Guidelines

This file provides system design rules and operating instructions for Gemini-based, Antigravity, or other AI agents working on this project.

---

## 🤖 Persona & Tone
When communicating with the user or describing changes:
1.  **Professional Composer**: Maintain an objective, professional, and descriptive tone. Do not use self-praising or marketing jargon (such as "stellar", "jaw-dropping", "gorgeous", etc.).
2.  **No Margins Clutter / Infostation Tech Larping**: Do not populate the visual margins of cards or headers with unrequested telemetry logs, container ports (e.g., "PORT: 3000"), ping states, or fake terminal lines unless requested explicitly by the user.

---

## 💻 Tech Stack & Architecture Guidelines

### Core Rules
*   **Production Port Bindings**: The Node server MUST bind exclusively to host `0.0.0.0` and port `3000`. Do not modify or read the `PORT` environment variable during server booting.
*   **Full-Stack Command Proxying**: Treat client-side security as top priority. Any integration requiring credentials, SSH connections, or Gemini models MUST run behind server-side routing controllers (`/api/*`). Under no circumstance should sensitive credentials (private SSH keys, passwords, Gemini API keys) be exposed to client browser state.
*   **TypeScript Type safety**:
    *   Do not use standard object destructuring for typescript type imports. Use named relative imports at the top level.
    *   Always use standard enum declarations. Avoid using `const enum` declarations.
    *   Run `lint_applet` and `compile_applet` iteratively to capture compilation errors prior to presenting changes.

### UI Styling - Tailwind Dual Theme Mapping
*   In **Dark Mode** (default), the theme relies on Carbon Gray 100 base containers (`#161616`), `#202020` blocks, and deep `#393939` borders.
*   In **Light Mode** (active via `.light-mode` className injected into `html`), pixel colors redirect via `/src/index.css` overrides. High contrast margins, dark primary fonts (`#0f172a`), slate borders (`#cbd5e1`), and clean white grids (`#ffffff`) ensure accessible and legible reading.
*   When editing components, use standard tailwind hex-classes (e.g., `bg-[#161616]` or `bg-[#202020]`). Avoid introducing arbitrary raw inline hex codes that bypass the CSS redirect mappings unless absolutely required.

---

## 🔑 Dependency Checklist
*   **Icon Library**: Load icons strictly from `lucide-react`. Do not create raw SVG objects inside components.
*   **Motion Framework**: Load React animations exclusively from `motion/react`.
*   **AI SDK**: Use the updated `@google/genai` TypeScript SDK for modern Gemini capabilities. Rely on `process.env.GEMINI_API_KEY` in server configurations.
