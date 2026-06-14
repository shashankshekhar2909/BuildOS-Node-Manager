# Claude Developer Guidelines

This file serves as a reference for build commands, diagnostic procedures, and code style guidelines in **BuildOS Node Commander**.

---

## 🛠️ Build and Development Commands

### Common Tasks
*   **Install Dependencies**: `npm install`
*   **Run Development Server**: `npm run dev` (Runs TypeScript entry point directly inside `tsx`)
*   **Compile / Build System**: `npm run build`
    *   *Frontend*: Compiles Vite static files to `./dist/`
    *   *Backend*: Compiles `server.ts` using `esbuild --bundle ... --outfile=dist/server.cjs`
*   **Compile Server Standalone**: `node dist/server.cjs`
*   **Run Linter**: `npm run lint`

---

## 📋 Technology Integrations

| Feature | Technology Stack |
| :--- | :--- |
| **Framework** | React (v18+) with Vite, TypeScript |
| **Styling** | Tailwind CSS (Compiled via global custom mapping redirects) |
| **Icons** | `lucide-react` |
| **Animations** | `motion/react` |
| **Charts** | `recharts` / `d3` |
| **Backend** | Express with Node.js |
| **Database** | Google Firebase Firestore |
| **Authentication** | Firebase Authentication SSO |
| **SSH Handshakes** | `ssh2` Client Tunnel Streams |
| **AI Processing** | `@google/genai` TypeScript SDK (Client Proxy) |

---

## 🎨 Design System Code Styling

*   **Variables Overrides**: Do not modify basic theme rules within Vite configuration assets. All dark-to-light mode color overrides are compiled inside `/src/index.css`.
*   **Element Identifiers**: Assign clean, unique `id` attributes to actionable widgets and layout cards (e.g. `id="theme-toggle"`, `id="ssh-terminal-card"`, `id="add-host-modal-container"`) to guarantee crisp targeting during automated integration testing or theme styling.
*   **Class Names**: Prefer Tailwind standard utility classes. Maintain structural fluidity using maximum width caps (e.g., `w-full max-w-7xl mx-auto`) to guarantee premium presentation on ultra-wide monitors.
