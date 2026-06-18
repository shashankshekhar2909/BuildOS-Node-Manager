# BuildOS Node Commander

BuildOS Node Commander is a highly professional, full-stack administration dashboard designed to manage, monitor, and orchestrate remote server hosts via secure SSH tunnels. Featuring integrated Docker container controllers, systemd service governors, real-time D3 Recharts performance trackers, and an AI-powered conversational speech translator powered by Google Gemini, Node Commander delivers modern, responsive, server-management workflows with elegant styling and layout precision.

---

## ✨ Features Highlight

*   **⚡ Modern Dual-Theme Core**: Integrated single-tap switch supporting sleek Carbon Gray Dark Slate and clean contrast-optimized Light Slate Mode (responsive to high ambient brightness).
*   **📊 D3 Performance Visualizers**: Live real-time area charts tracking CPU, Memory, and Disk utilization stats on interactive server loops.
*   **🎙️ Speak-to-Command Voice Engine**: Translates live microphone recordings or natural language input into safe, production-grade bash directives using Gemini-3.5-Flash.
*   **🐳 Docker & Systemd Governor**: Automatic container/service detection with instant Admin state commands (Start, Stop, Restart).
*   **📦 Live Docker Project Migration**: Move a running docker-compose stack from one SSH node to another — zero-downtime, transactional, with automatic rollback. Single tar.gz transfer, port-conflict remapping, named-volume warnings, Dockerfile user-compatibility patches, and a DNS summary card on completion. Source is never stopped until you explicitly confirm.
*   **🔒 Multi-User Secure Firebase SSO**: Complete authentication gateway dividing operator scopes cleanly between Admin and Read-Only Views.
*   **🐳 Simulated Laboratory Nodes**: Test administrative commands safely in standard sandboxed clusters inside the app.

---

## 🛠️ Technology Stack

*   **Frontend**: React (v18+), Vite, Tailwind CSS, Lucide icons, Motion (Framer Motion).
*   **Charts**: Recharts, D3.
*   **Backend**: Express Server, WebSockets (`ws`), SSH2 client streams.
*   **Database & Auth**: Google Firestore & Firebase Authentication SSO.
*   **AI Engine**: Google `@google/genai` model processing APIs.

---

## 📁 Repository Directory Map

*   `server.ts` : Unified full-stack API server, SSH connection controller, and socket dispatcher.
*   `src/index.css` : Compiles dark/light redirection overrides and global typography settings (**IBM Plex Sans** / **IBM Plex Mono**).
*   `src/App.tsx` : Grid arrangement layout, Google Sign-In state controller, and socket pipeline.
*   `src/components/` : Modular panels hosting specific layout tasks:
    *   `NodeMonitor.tsx`: Renders performance metrics, Docker lists, Systemd status lists.
    *   `VoiceAgent.tsx`: Captures microphone micro-buffers and hooks up conversational AI.
    *   `SSHConsole.tsx`: High-contrast server shell command interface.
    *   `WhatsAppPreview.tsx`: Twilio webhook simulator panel.
    *   `LLMConfigPanel.tsx`: Remote execution parameters.
    *   `AddHostModal.tsx`: Server initialization drawer.
    *   `UserManagementPanel.tsx`: Admin-level permissions coordinator.
    *   `MigrateProjectModal.tsx`: 7-step Docker project live migration wizard (discover → configure → preflight → volumes_warn → migrating → confirm_stop → done).
*   `docs/` : System architectural plans, completed milestones, technical diagrams, and prospective roadmap files.

---

## 🚀 Setting Up the Application

### 1. Configure Firebase
The app requires a Firebase project for auth (Google SSO) and Firestore (host/config storage).

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Google sign-in provider
3. Enable **Firestore Database** — note the database ID (default is `(default)`)
4. Go to Project Settings → Your apps → Web app → copy the config
5. Copy the example config and fill in your values:

```bash
cp firebase-applet-config.example.json firebase-applet-config.json
```

```json
{
  "projectId": "your-firebase-project-id",
  "appId": "1:000000000000:web:your-app-id",
  "apiKey": "AIzaSy-your-firebase-web-api-key",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "your-firestore-database-id",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "000000000000"
}
```

> **Security:** `firebase-applet-config.json` is gitignored. Never commit it. The Web API key is safe for client-side use only if Firestore rules and Auth are properly configured.

### 2. Configure the Environment
Copy `.env.example` to `.env` and fill out necessary key configuration lines:
```env
# Google Gemini Processing Key
GEMINI_API_KEY=your-gemini-api-key

# Production host details (optional, binds to port 3000 automatically)
NODE_ENV=production
```

### 4. Run Locally in Development
To load hot-reloading development servers:
```bash
# Install NPM modules
npm install

# Start development systems (Binds to http://localhost:3000)
npm run dev
```

### 5. Production Compilation & Launch
To compile standard static packages and bundle backend modules into a single self-contained executable file:
```bash
# Build system components
npm run build

# Boot consolidated script (launches dist/server.cjs)
npm run start
```
