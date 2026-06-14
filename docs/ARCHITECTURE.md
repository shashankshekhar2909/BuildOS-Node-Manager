# BuildOS Node Commander — Architecture & Tech Stack

This document describes the core structural components and system dependencies utilized to power the full-stack **BuildOS Node Commander** application.

---

## 🛠️ Complete Backend Technology Stack

The backend is built as a unified full-stack application running on Node.js. It features a blended design with secure server-side proxying and real-time socket communication.

### 1. Server Framework & Asset Bundler
*   **Express**: Serves as the main REST API server hosting admin router paths and RPC controllers. In production mode, Express delivers compile builds cleanly from `./dist/index.html`.
*   **Vite**: Configured as integrated middleware to handle hot module assets development in local environments.
*   **Esbuild**: Bundles the entire server.ts file and standard relative module imports into a single, light production package (`dist/server.cjs`). This prevents filesystem path resolution discrepancies on container deployment runtimes.

### 2. Remote Command Tunnel Execution
*   **SSH2 (`ssh2` npm module)**: Implements native secure shell client handshakes to connect direct cryptographic TCP streams to genuine Linux host nodes on administrative commands.
*   **Encrypted Credential Processing**: Host credential keys and access details are dynamically stored in the persistent database and evaluated safely inside private server memory, never exposed to browser memory.

### 3. Real-Time Sockets Broker
*   **WS (`ws` WebSocket Server)**: Hosts full duplex streams between client browser devices and local/remote shells to forward continuous multi-user log streams and real-time audio chunk transfers.

### 4. AI-Powered Orchestration Core
*   **Google Gemini SDK (`@google/genai`)**: Intercepts speech-to-text text transcripts and system parameters to map user intent (e.g. "Is my web service running on Host B?") into clean executable standard bash directives (e.g. `systemctl status nginx.service`).
*   **Gemini Diagnostics and Log Analysis**: Processes command execution stack outputs to troubleshoot error logs and recommend container mitigation steps immediately.

### 5. Durable Cloud Storage & Authentication
*   **Google Firebase Authentication**: Provides secure, single-sign-on client integrations via Google OAuth. The backend validates bearer header ID tokens on each critical admin operation.
*   **Firebase Firestore (Durable DB)**: Serves as the primary system of record.
    *   **Hosts Collection**: Manages connection details (IP, username, passwords, ports, simulated states).
    *   **Audit Logging Journal**: Captures and synchronizes terminal transactions, remote SSH operations, and diagnostic histories securely.
    *   **LLM Model Configurations**: Stores custom API flags and instructions.

---

## 🔁 Real-Time Data Pipelines

```
                             [ Google OAuth Auth State ]
                                         │
[ React SPA Front-End ] ──(Firebase Auth SSO)──> [ Firebase Firestore DB ]
   │                                                    │
   ├──(REST API /api/*)──> [ Express Server API ] ──────┘
   │                         ├── Uses Google Gemini for diagnostic analysis
   │                         └── Leverages SSH2 to command remote host machines
   │
   └──(WebSockets WS://)─> [ WS Sockets Gateway ]
                             ├── Multiplexes command logs
                             └── Forwards live stdout/stderr streams
```

---

## 🧭 Navigational Page Architecture

The user interface transitioned in v1.7.0 to a persistent sidebar-docked dashboard architecture (IBM Carbon Command Rail):

1. **Global Persisted Layout Frame**: The header and its multi-mode theme components stay mounted constantly.
2. **Left-Docked Sidebar Command Rail**: Features modern enterprise grouped navigation tabs with automatic state preservation for ongoing telemetry monitoring and SSH console audits:
    * **Fleet Registry**
        * **Fleet Clusters**: High-level, cluster-wide hardware capacity and system averages panel.
        * **Hardware DNA (Node Details)**: Complete comprehensive node inspection, simulating hardware specification DNA, local interfaces bandwidth, telemetry overrides, and maintenance triggers.
    * **Operations**
        * **Diagnostics Lab**: Fine-grained node monitoring, Systemd controller, Docker daemon toggle dashboard, and active security logs.
        * **SMS Webhook Sim**: Webhook simulation logs and Twilio previews.
    * **Cognitive Matrix**
        * **AI Cognitive Chat**: A dedicated separate chat page built around conversation engines and real-time terminal auditing commands.
    * **Governance**
        * **System Config**: LLM model configurations and fine-tuning parameters.
        * **Operators**: Granular operator roles and firebase security user configurations.

---

## 🔌 Webhook and Twilio Gateways
*   **Twilio WhatsApp Interface Preview**: Emulates standard Twilio-compliant messaging receiver APIs. Host machine queries can be intercepted directly in the cloud in subsequent deployments using these webhook entry controllers.

