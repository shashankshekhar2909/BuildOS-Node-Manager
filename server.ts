import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Client } from "ssh2";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

dotenv.config();

// Initialize Firebase Web SDK on the server side
let firestoreDb: any = null;

const fbApiKey     = process.env.FIREBASE_API_KEY;
const fbProjectId  = process.env.FIREBASE_PROJECT_ID;
const fbAppId      = process.env.FIREBASE_APP_ID;
const fbAuthDomain = process.env.FIREBASE_AUTH_DOMAIN;
const fbDbId       = process.env.FIREBASE_DATABASE_ID;
const fbBucket     = process.env.FIREBASE_STORAGE_BUCKET;
const fbSenderId   = process.env.FIREBASE_MESSAGING_SENDER_ID;

// Fallback: load from firebase-applet-config.json if env vars not set
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const fileConfig = fs.existsSync(firebaseConfigPath)
  ? JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"))
  : null;

const firebaseConfig = {
  apiKey:            fbApiKey     || fileConfig?.apiKey,
  projectId:         fbProjectId  || fileConfig?.projectId,
  appId:             fbAppId      || fileConfig?.appId,
  authDomain:        fbAuthDomain || fileConfig?.authDomain,
  storageBucket:     fbBucket     || fileConfig?.storageBucket,
  messagingSenderId: fbSenderId   || fileConfig?.messagingSenderId,
};
const firestoreDatabaseId = fbDbId || fileConfig?.firestoreDatabaseId;

if (firebaseConfig.projectId && firebaseConfig.apiKey) {
  try {
    const fbApp = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(fbApp, firestoreDatabaseId);
    console.log("[Firebase Server] Firestore connected:", firestoreDatabaseId || '(default)');
  } catch (err) {
    console.error("[Firebase Server] Connection failed:", err);
  }
} else {
  console.warn("[Firebase Server] Firebase config missing — set FIREBASE_* env vars or provide firebase-applet-config.json");
}

// Secure AES-256-CBC Encryption Engine
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "buildos-node-commander-secure-salting-2026";
const KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `ENC:${iv.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText: string | undefined): string {
  if (!encryptedText) return "";
  if (!encryptedText.startsWith("ENC:")) {
    return encryptedText; // Support plaintext / backward compatibility / mock keys
  }
  try {
    const parts = encryptedText.substring(4).split(":");
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    return encryptedText;
  }
}

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

app.use(express.json());

// Demo/sandbox mode — set DEMO_MODE=true to block all real SSH execution (for public demos)
const DEMO_MODE = process.env.DEMO_MODE === 'true';
if (DEMO_MODE) {
  console.log('[DEMO MODE] Real SSH execution disabled. All commands are simulated.');
}

// File-based persistence paths
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const HOSTS_FILE = path.join(DATA_DIR, "hosts.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

// Define types locally for server file to avoid import issues
interface HostMachine {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey' | 'none';
  password?: string;
  privateKey?: string;
  isSimulated: boolean;
  simulatedStats?: {
    cpu: number;
    ram: number;
    disk: number;
    dockerContainersCount: number;
    openPorts: number[];
  };
}

interface LLMConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'custom' | 'groq';
  apiKey: string;
  modelName: string;
  customEndpoint?: string;
}

interface TerminalLog {
  id: string;
  hostId: string;
  hostName: string;
  timestamp: string;
  command: string;
  output: string;
  isError: boolean;
}

// Initial default hosts if file doesn't exist
const initialHosts: HostMachine[] = [
  {
    id: "host-sim1",
    name: "Production Gateway (Simulated)",
    ip: "10.0.0.15",
    port: 22,
    username: "sysadmin",
    authType: "password",
    password: "••••••••",
    isSimulated: true,
    simulatedStats: {
      cpu: 42,
      ram: 6.2,
      disk: 64,
      dockerContainersCount: 4,
      openPorts: [22, 80, 443, 5432]
    }
  },
  {
    id: "host-sim2",
    name: "Staging Docker Host (Simulated)",
    ip: "192.168.1.50",
    port: 2222,
    username: "deployer",
    authType: "none",
    isSimulated: true,
    simulatedStats: {
      cpu: 18,
      ram: 3.1,
      disk: 28,
      dockerContainersCount: 7,
      openPorts: [22, 3000, 8000, 8080]
    }
  },
  {
    id: "host-sim3",
    name: "Internal DB Server (Simulated)",
    ip: "10.0.2.11",
    port: 22,
    username: "dbadmin",
    authType: "privateKey",
    privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nMOCKKEY...\n-----END OPENSSH PRIVATE KEY-----",
    isSimulated: true,
    simulatedStats: {
      cpu: 74,
      ram: 14.8,
      disk: 88,
      dockerContainersCount: 1,
      openPorts: [22, 5432, 6379]
    }
  }
];

// Read/write helpers
const readHosts = (): HostMachine[] => {
  if (!fs.existsSync(HOSTS_FILE)) {
    fs.writeFileSync(HOSTS_FILE, JSON.stringify(initialHosts, null, 2));
    return initialHosts;
  }
  try {
    const rawHosts: HostMachine[] = JSON.parse(fs.readFileSync(HOSTS_FILE, "utf-8"));
    return rawHosts;
  } catch (e) {
    return initialHosts;
  }
};

const writeHosts = (hosts: HostMachine[]) => {
  const encHosts = hosts.map(h => {
    const copy = { ...h };
    if (copy.password && !copy.password.startsWith("ENC:") && copy.password !== "••••••••••••") {
      copy.password = encrypt(copy.password);
    }
    if (copy.privateKey && !copy.privateKey.startsWith("ENC:") && copy.privateKey !== "••••••••••••") {
      copy.privateKey = encrypt(copy.privateKey);
    }
    return copy;
  });
  fs.writeFileSync(HOSTS_FILE, JSON.stringify(encHosts, null, 2));
};

const readConfig = (): LLMConfig => {
  const defaultConfig: LLMConfig = {
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY || "",
    modelName: "gemini-2.0-flash"
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    if (raw.apiKey && raw.apiKey.startsWith("ENC:")) {
      raw.apiKey = decrypt(raw.apiKey);
    }
    return raw;
  } catch (e) {
    return defaultConfig;
  }
};

const writeConfig = (config: LLMConfig) => {
  const encConfig = { ...config };
  if (encConfig.apiKey && !encConfig.apiKey.startsWith("ENC:") && encConfig.apiKey !== "••••••••••••") {
    encConfig.apiKey = encrypt(encConfig.apiKey);
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(encConfig, null, 2));
};

const getActiveConfig = async (): Promise<LLMConfig> => {
  const localConfig = readConfig();
  if (firestoreDb) {
    try {
      const configDocRef = doc(firestoreDb, "systemConfig", "llm");
      const docSnap = await getDoc(configDocRef);
      if (docSnap.exists()) {
        const dbConfig = docSnap.data() as any;
        const merged: LLMConfig = {
          ...localConfig,
          provider: dbConfig.provider || localConfig.provider,
          modelName: dbConfig.modelName || localConfig.modelName,
          customEndpoint: dbConfig.customEndpoint !== undefined ? dbConfig.customEndpoint : localConfig.customEndpoint,
          apiKey: dbConfig.apiKey || localConfig.apiKey
        };
        if (merged.apiKey && merged.apiKey.startsWith("ENC:")) {
          merged.apiKey = decrypt(merged.apiKey);
        }
        return merged;
      }
    } catch (error) {
      console.error("[Firebase Server] Failed to fetch config from Firestore, using local/env config:", error);
    }
  }
  return localConfig;
};

const readLogs = (): TerminalLog[] => {
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(LOGS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
};

const writeLogs = (logs: TerminalLog[]) => {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(-200), null, 2)); // keep last 200 logs
};

const addTerminalLog = (hostId: string, hostName: string, command: string, output: string, isError: boolean) => {
  const logs = readLogs();
  const newLog: TerminalLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    hostId,
    hostName,
    timestamp: new Date().toISOString(),
    command,
    output,
    isError
  };
  logs.unshift(newLog);
  writeLogs(logs);
  return newLog;
};

// Simulated SSH shell command execution router
function executeSimulatedCommand(host: HostMachine, command: string): string {
  const cmd = command.trim().toLowerCase();

  // dynamic update slightly for lifelike metrics
  const hStats = host.simulatedStats || { cpu: 20, ram: 4, disk: 30, dockerContainersCount: 2, openPorts: [22] };
  hStats.cpu = Math.min(100, Math.max(5, Math.floor(hStats.cpu + (Math.random() * 10 - 5))));
  if (Math.random() > 0.8) {
    hStats.ram = Math.min(32, Math.max(1, +(hStats.ram + (Math.random() * 0.4 - 0.2)).toFixed(1)));
  }

  // Handle common shell commands
  if (cmd === "docker ps" || cmd === "docker container ls") {
    if (host.id === "host-sim1") {
      return `CONTAINER ID   IMAGE                  COMMAND                  CREATED         STATUS         PORTS                              NAMES
a8e52a51f0b4   nginx:alpine           "/docker-entrypoint.…"   3 days ago      Up 3 hours     0.0.0.0:80->80/tcp, :::80->80/tcp   web-nginx
f2d1847c211a   redis:7-alpine         "docker-entrypoint.s…"   3 days ago      Up 3 hours     0.0.0.0:6379->6379/tcp             cache-redis
b1248a3910fc   node:20-alpine         "docker-entrypoint.s…"   10 hours ago    Up 10 hours    0.0.0.0:3000->3000/tcp             api-service
ee71c1b12bba   moby/ssh-agent:latest  "/entrypoint.sh"         2 hours ago     Up 2 hours     0.0.0.0:2222->22/tcp               ssh-bastion`;
    } else if (host.id === "host-sim2") {
      return `CONTAINER ID   IMAGE                  COMMAND                  CREATED         STATUS         PORTS                              NAMES
c018247ca881   mysql:8.0              "docker-entrypoint.s…"   5 days ago      Up 4 days      0.0.0.0:3306->3306/tcp             mysql-db
ef2b1e19d08e   rabbitmq:management    "docker-entrypoint.s…"   12 hours ago    Up 12 hours    0.0.0.0:5672->5672/tcp, :::15672   queue-rmq
88a291f82b88   grafana/grafana:latest "/run.sh"                6 hours ago     Up 6 hours     0.0.0.0:8080->3000/tcp             observability-dashboard
41bcada8319f   prom/prometheus        "/bin/prometheus --c…"   6 hours ago     Up 6 hours     0.0.0.0:9090->9090/tcp             prometheus-metrics`;
    } else {
      return `CONTAINER ID   IMAGE                  COMMAND                  CREATED         STATUS         PORTS                              NAMES
d8118fa19fe4   postgres:16-alpine     "docker-entrypoint.s…"   2 weeks ago     Up 5 days      0.0.0.0:5432->5432/tcp             postgresql-primary`;
    }
  }

  if (cmd.includes("docker ps -a")) {
    return executeSimulatedCommand(host, "docker ps") + `\nc8172bc9168f   python:3.10-slim       "python -m http.serv…"   4 days ago      Exited (0) 2 days ago                                     static-uploader`;
  }

  if (cmd === "free -m" || cmd === "free -h" || cmd === "free") {
    const totalRam = host.id === "host-sim3" ? 16384 : host.id === "host-sim1" ? 8192 : 4096;
    const usedRam = Math.floor(totalRam * (hStats.ram / (totalRam / 1024)));
    const freeRam = totalRam - usedRam - 450;
    return `               total        used        free      shared  buff/cache   available
Mem:            ${totalRam}        ${usedRam}        ${freeRam}         120         450        ${freeRam + 200}
Swap:           2048         142        1906`;
  }

  if (cmd === "df -h" || cmd === "df") {
    return `Filesystem      Size  Used Avail Use% Mounted on
udev            7.8G     0  7.8G   0% /dev
tmpfs           1.6G  1.2M  1.6G   1% /run
/dev/sda1        80G   ${Math.floor(80 * hStats.disk / 100)}G   ${80 - Math.floor(80 * hStats.disk / 100)}G  ${hStats.disk}% /
tmpfs           7.9G     0  7.9G   0% /dev/shm
/dev/sdb1       250G  110G  140G  44% /mnt/data`;
  }

  if (cmd === "uptime") {
    const loadAvg = (hStats.cpu / 100).toFixed(2);
    return ` 15:47:32 up 5 days,  4:21,  2 users,  load average: ${loadAvg}, ${(hStats.cpu / 90).toFixed(2)}, ${(hStats.cpu / 95).toFixed(2)}`;
  }

  if (cmd === "ss -tuln" || cmd === "netstat -tuln" || cmd === "netstat -an | grep listen") {
    return `Netid State      Recv-Q Send-Q   Local Address:Port   Peer Address:Port
tcp   LISTEN     0      128            0.0.0.0:22          0.0.0.0:*
` + hStats.openPorts.filter(p => p !== 22).map(p => `tcp   LISTEN     0      128            0.0.0.0:${p}         0.0.0.0:*`).join("\n");
  }

  if (cmd === "uname -a") {
    return `Linux ${host.name.toLowerCase().replace(/[^a-z0-9]/g, "-")} 5.15.0-101-generic #111-Ubuntu SMP Tue Mar 5 20:16:58 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux`;
  }

  if (cmd.includes("nmap")) {
    return `Starting Nmap 7.80 ( https://nmap.org ) at ${new Date().toISOString()}
Nmap scan report for localhost (127.0.0.1)
Host is up (0.00012s latency).
Not shown: 996 closed ports
PORT     STATE SERVICE
22/tcp   open  ssh
` + hStats.openPorts.filter(p => p !== 22).map(p => `${p}/tcp   open  unknown`).join("\n") + `\n\nNmap done: 1 IP address (1 host up) scanned in 0.24 seconds`;
  }

  if (cmd === "whoami") {
    return host.username;
  }

  if (cmd === "hostname") {
    return host.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  }

  if (cmd === "ls -la" || cmd === "ls") {
    return `total 24
drwxr-xr-x 4 ${host.username} ${host.username} 4096 Jun 10 12:00 .
drwxr-xr-x 3 root     root     4096 Jun  1 09:00 ..
-rw-r--r-- 1 ${host.username} ${host.username}  220 Jun  1 09:00 .bash_logout
-rw-r--r-- 1 ${host.username} ${host.username} 3771 Jun  1 09:00 .bashrc
drwx------ 2 ${host.username} ${host.username} 4096 Jun 10 12:01 .ssh
drwxr-xr-x 2 ${host.username} ${host.username} 4096 Jun 12 14:15 projects`;
  }

  // If a custom or unknown command
  return `[${host.username}@${host.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}:~]$ ${command}
bash: command run successfully (Simulated Shell Execution output bypass wrapper)
Execution trace: logged execution status at ${new Date().toLocaleTimeString()}
System context status: CPU ${hStats.cpu}%, Memory ${hStats.ram}GB, Storage occupancy ${hStats.disk}%`;
}

// Real SSH executor using ssh2
function executeRealSSH(host: HostMachine, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let stdout = "";
        let stderr = "";
        stream.on("close", (code) => {
          conn.end();
          if (code !== 0 && stderr) {
            reject(new Error(`Exit Code ${code}: ${stderr.trim()}`));
          } else {
            resolve(stdout || stderr || `Command exited with status code ${code}`);
          }
        }).on("data", (data: Buffer) => {
          stdout += data.toString();
        }).stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      });
    }).on("error", (err) => {
      reject(err);
    }).connect({
      host: host.ip,
      port: host.port || 22,
      username: host.username,
      password: host.authType === "password" ? decrypt(host.password) : undefined,
      privateKey: host.authType === "privateKey" ? decrypt(host.privateKey) : undefined,
      readyTimeout: 12000
    });
  });
}

// Global host execution router
async function runCommandOnHost(host: HostMachine, command: string): Promise<{ output: string, isError: boolean }> {
  if (host.isSimulated || DEMO_MODE) {
    try {
      const output = executeSimulatedCommand(host, command);
      addTerminalLog(host.id, host.name, command, output, false);
      return { output, isError: false };
    } catch (e: any) {
      const errorMsg = e.message || String(e);
      addTerminalLog(host.id, host.name, command, errorMsg, true);
      return { output: errorMsg, isError: true };
    }
  } else {
    try {
      const output = await executeRealSSH(host, command);
      addTerminalLog(host.id, host.name, command, output, false);
      return { output, isError: false };
    } catch (e: any) {
      const errorMsg = e.message || String(e);
      addTerminalLog(host.id, host.name, command, errorMsg, true);
      return { output: errorMsg, isError: true };
    }
  }
}

// Diagnostics Helper for Containers, Services & Metrics (Real + Simulated)
async function fetchHostDiagnostics(host: HostMachine) {
  if (host.isSimulated) {
    const cpu = Math.floor(Math.random() * 40 + 10);
    const ramTotal = host.id === "host-sim3" ? 16 : host.id === "host-sim2" ? 8 : 4;
    const ramUsed = +(ramTotal * (0.3 + Math.random() * 0.2)).toFixed(1);
    const ramPercent = Math.round((ramUsed / ramTotal) * 100);
    const disk = host.simulatedStats?.disk || 35;

    const docker = host.id === "host-sim1" ? [
      { id: "a8e52a51f0b4", name: "web-nginx", image: "nginx:alpine", status: "Up 3 hours", ports: "0.0.0.0:80->80/tcp" },
      { id: "f2d1847c211a", name: "cache-redis", image: "redis:7-alpine", status: "Up 3 hours", ports: "0.0.0.0:6379->6379/tcp" },
      { id: "b1248a3910fc", name: "api-service", image: "node:20-alpine", status: "Up 10 hours", ports: "0.0.0.0:3000->3000/tcp" },
      { id: "ee71c1b12bba", name: "ssh-bastion", image: "moby/ssh-agent:latest", status: "Up 2 hours", ports: "0.0.0.0:2222->22/tcp" }
    ] : host.id === "host-sim2" ? [
      { id: "c018247ca881", name: "mysql-db", image: "mysql:8.0", status: "Up 4 days", ports: "0.0.0.0:3306->3306/tcp" },
      { id: "ef2b1e19d08e", name: "queue-rmq", image: "rabbitmq:management", status: "Up 12 hours", ports: "0.0.0.0:5672->5672/tcp" },
      { id: "88a291f82b88", name: "observability-dashboard", image: "grafana/grafana:latest", status: "Up 6 hours", ports: "0.0.0.0:8080->3000/tcp" },
      { id: "41bcada8319f", name: "prometheus-metrics", image: "prom/prometheus", status: "Up 6 hours", ports: "0.0.0.0:9090->9090/tcp" }
    ] : [
      { id: "d8118fa19fe4", name: "postgresql-primary", image: "postgres:16-alpine", status: "Up 5 days", ports: "0.0.0.0:5432->5432/tcp" }
    ];

    const services = [
      { name: "nginx.service", status: "active", description: "High-performance HTTP Server" },
      { name: "ssh.service", status: "active", description: "OpenSSH Server Daemon" },
      { name: "docker.service", status: "active", description: "Docker Container Engine" },
      { name: "postgresql.service", status: host.id === "host-sim3" ? "active" : "inactive", description: "PostgreSQL Relational DB" },
      { name: "systemd-resolved.service", status: "active", description: "Network Name Resolution" },
      { name: "cron.service", status: "active", description: "Regular background program scheduler" },
      { name: "ufw.service", status: "active", description: "Uncomplicated Firewall" }
    ];

    return {
      cpu,
      ram: { used: ramUsed, total: ramTotal, percent: ramPercent },
      disk,
      uptime: "5 days, 4:21",
      docker,
      services
    };
  } else {
    let cpu = 15;
    let ram = { used: 1.1, total: 4.0, percent: 27 };
    let disk = 40;
    let uptime = "uptime unknown";
    let dockerArr: any[] = [];
    let servicesArr: any[] = [];

    // 1. Get Uptime & Load
    try {
      const res = await runCommandOnHost(host, "uptime");
      uptime = res.output.trim();
      const loadMatch = res.output.match(/load average:\s*([0-9.]+)/i);
      if (loadMatch) {
        cpu = Math.round(parseFloat(loadMatch[1]) * 100);
        cpu = Math.min(100, Math.max(1, cpu));
      }
    } catch (_) {}

    // 2. Get Free RAM
    try {
      const res = await runCommandOnHost(host, "free -m");
      const lines = res.output.split("\n");
      const memLine = lines.find(l => l.startsWith("Mem:"));
      if (memLine) {
        const parts = memLine.split(/\s+/);
        const total = Math.round((parseInt(parts[1]) / 1024) * 10) / 10;
        const used = Math.round((parseInt(parts[2]) / 1024) * 10) / 10;
        const percent = Math.round((parseInt(parts[2]) / parseInt(parts[1])) * 100);
        ram = { used, total, percent };
      }
    } catch (_) {}

    // 3. Get Disk usage
    try {
      const res = await runCommandOnHost(host, "df -h /");
      const lines = res.output.split("\n");
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        const diskIdx = parts.findIndex(p => p.includes("%"));
        if (diskIdx !== -1) {
          disk = parseInt(parts[diskIdx].replace("%", ""));
        }
      }
    } catch (_) {}

    // 4. Get Docker containers
    try {
      const res = await runCommandOnHost(host, "docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'");
      if (!res.isError && res.output.trim()) {
        const rows = res.output.trim().split("\n");
        dockerArr = rows.map(r => {
          const [id, name, image, status, ports] = r.split("|");
          return { id, name, image, status, ports: ports || "N/A" };
        }).filter(c => c.id);
      }
    } catch (_) {}

    // 5. Get systemd services (top active ones)
    try {
      const res = await runCommandOnHost(host, "systemctl list-units --type=service --all --no-pager --limit 30");
      if (!res.isError && res.output.trim()) {
        const lines = res.output.trim().split("\n");
        lines.forEach(l => {
          if (l.includes(".service")) {
            const parts = l.trim().split(/\s+/);
            const name = parts[0];
            const loadState = parts[1];
            const activeState = parts[2];
            const subState = parts[3];
            const description = parts.slice(4).join(" ");
            
            if (name && (name.includes("nginx") || name.includes("ssh") || name.includes("docker") || name.includes("postgresql") || name.includes("systemd") || name.includes("networking") || name.includes("cron"))) {
              servicesArr.push({
                name,
                status: activeState === "active" ? "active" : "inactive",
                description: description || `${loadState} - ${subState}`
              });
            }
          }
        });
      }
    } catch (_) {}

    if (servicesArr.length === 0) {
      servicesArr = [
        { name: "sshd.service", status: "active", description: "OpenSSH Server Daemon" },
        { name: "networking.service", status: "active", description: "Network Interface Manager" },
        { name: "systemd-journald.service", status: "active", description: "Journal Service" },
        { name: "docker.service", status: "inactive", description: "Docker Application Container Engine" }
      ];
    }

    return {
      cpu,
      ram,
      disk,
      uptime,
      docker: dockerArr,
      services: servicesArr
    };
  }
}

// API Routes

// Host administration
app.get("/api/hosts", (req, res) => {
  const hosts = readHosts();
  const maskedHosts = hosts.map(h => ({
    ...h,
    password: h.password ? "••••••••••••" : "",
    privateKey: h.privateKey ? "••••••••••••" : ""
  }));
  res.json(maskedHosts);
});

app.post("/api/hosts", (req, res) => {
  const hosts = readHosts();
  const newHost: HostMachine = {
    ...req.body,
    id: `host-${Date.now()}`,
    port: Number(req.body.port) || 22,
    isSimulated: DEMO_MODE ? true : !!req.body.isSimulated,
    // Strip credentials in demo mode so they're never stored
    ...(DEMO_MODE ? { password: undefined, privateKey: undefined } : {})
  };

  if (newHost.isSimulated && !newHost.simulatedStats) {
    newHost.simulatedStats = {
      cpu: Math.floor(Math.random() * 40 + 10),
      ram: +(Math.random() * 6 + 2).toFixed(1),
      disk: Math.floor(Math.random() * 50 + 20),
      dockerContainersCount: Math.floor(Math.random() * 5 + 1),
      openPorts: [22, 80, 5432]
    };
  }

  hosts.push(newHost);
  writeHosts(hosts);
  res.json({
    ...newHost,
    password: newHost.password ? "••••••••••••" : "",
    privateKey: newHost.privateKey ? "••••••••••••" : ""
  });
});

app.put("/api/hosts/:id", (req, res) => {
  const hosts = readHosts();
  const idx = hosts.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Host not found" });

  const updatedHost = { ...req.body };
  if (updatedHost.password === "••••••••••••") {
    updatedHost.password = hosts[idx].password;
  }
  if (updatedHost.privateKey === "••••••••••••") {
    updatedHost.privateKey = hosts[idx].privateKey;
  }

  hosts[idx] = {
    ...hosts[idx],
    ...updatedHost,
    id: req.params.id,
    port: Number(updatedHost.port) || 22
  };
  writeHosts(hosts);
  res.json({
    ...hosts[idx],
    password: hosts[idx].password ? "••••••••••••" : "",
    privateKey: hosts[idx].privateKey ? "••••••••••••" : ""
  });
});

app.delete("/api/hosts/:id", (req, res) => {
  let hosts = readHosts();
  hosts = hosts.filter(h => h.id !== req.params.id);
  writeHosts(hosts);
  res.json({ success: true });
});

// GET/POST detailed diagnostics for a specific host (metrics, dockers, services)
// POST body may include full host object (for Firestore-managed hosts not in local JSON)
app.post("/api/hosts/:id/details", async (req, res) => {
  try {
    const host = req.body?.host || readHosts().find(h => h.id === req.params.id);
    if (!host) {
      return res.status(404).json({ error: "Host not found" });
    }
    const diagnostics = await fetchHostDiagnostics(host);
    res.json(diagnostics);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve host details" });
  }
});

app.get("/api/hosts/:id/details", async (req, res) => {
  try {
    const host = readHosts().find(h => h.id === req.params.id);
    if (!host) {
      return res.status(404).json({ error: "Host not found" });
    }
    const diagnostics = await fetchHostDiagnostics(host);
    res.json(diagnostics);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve host details" });
  }
});

// POST trigger Action on simulated or real Docker container
app.post("/api/hosts/:id/docker/action", async (req, res) => {
  const { containerId, containerName, actionName, host: bodyHost } = req.body;
  try {
    const host = bodyHost || readHosts().find(h => h.id === req.params.id);
    if (!host) {
      return res.status(404).json({ error: "Host not found" });
    }

    const command = `docker ${actionName} ${containerId}`;
    let output = "";
    if (host.isSimulated) {
      output = `Container '${containerName || containerId}' received action: ${actionName} successfully. Status refreshed.`;
      addTerminalLog(host.id, host.name, command, output, false);
    } else {
      const execResult = await runCommandOnHost(host, command);
      output = execResult.output;
      if (execResult.isError) {
        throw new Error(execResult.output);
      }
    }
    res.json({ success: true, command, output });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Docker action failed" });
  }
});

// POST trigger Action on simulated or real systemd Service
app.post("/api/hosts/:id/services/action", async (req, res) => {
  const { serviceName, actionName, host: bodyHost } = req.body;
  try {
    const host = bodyHost || readHosts().find(h => h.id === req.params.id);
    if (!host) {
      return res.status(404).json({ error: "Host not found" });
    }

    const command = `sudo systemctl ${actionName} ${serviceName}`;
    let output = "";
    if (host.isSimulated) {
      output = `Service '${serviceName}' received action: ${actionName} successfully. Service running states updated.`;
      addTerminalLog(host.id, host.name, command, output, false);
    } else {
      const execResult = await runCommandOnHost(host, command);
      output = execResult.output;
      if (execResult.isError) {
        throw new Error(execResult.output);
      }
    }
    res.json({ success: true, command, output });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Service action failed" });
  }
});

// ── ProxMox LXC Management ──────────────────────────────────────────────────

// List all LXC containers on a ProxMox host
app.post("/api/hosts/:id/pct/list", async (req, res) => {
  const host = req.body?.host || readHosts().find((h: any) => h.id === req.params.id);
  if (!host) return res.status(404).json({ error: "Host not found" });
  try {
    const result = await runCommandOnHost(host, "pct list 2>/dev/null || echo 'pct_not_found'");
    if (result.output.includes("pct_not_found") || result.isError) {
      return res.status(400).json({ error: "pct command not available on this host" });
    }
    const lines = result.output.trim().split("\n").slice(1); // skip header
    const containers = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        ctid: parts[0] || "",
        status: parts[1] || "unknown",
        name: parts[3] || parts[2] || `CT ${parts[0]}`
      };
    }).filter(c => c.ctid && /^\d+$/.test(c.ctid));
    res.json({ containers });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// List Docker containers inside a specific LXC container
app.post("/api/hosts/:id/pct/:ctid/docker", async (req, res) => {
  const host = req.body?.host || readHosts().find((h: any) => h.id === req.params.id);
  if (!host) return res.status(404).json({ error: "Host not found" });
  const { ctid } = req.params;
  try {
    const result = await runCommandOnHost(
      host,
      `pct exec ${ctid} -- docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' 2>/dev/null`
    );
    if (result.isError || !result.output.trim()) {
      return res.json({ containers: [] });
    }
    const containers = result.output.trim().split("\n")
      .filter(line => line.includes("|"))
      .map(line => {
        const [id, name, image, status, ports] = line.split("|");
        return { id: id?.trim(), name: name?.trim(), image: image?.trim(), status: status?.trim(), ports: ports?.trim() || "" };
      });
    res.json({ containers });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Perform Docker action inside an LXC container via pct exec
app.post("/api/hosts/:id/pct/:ctid/docker/action", async (req, res) => {
  const host = req.body?.host || readHosts().find((h: any) => h.id === req.params.id);
  if (!host) return res.status(404).json({ error: "Host not found" });
  const { ctid } = req.params;
  const { containerId, containerName, actionName } = req.body;
  try {
    const command = `pct exec ${ctid} -- docker ${actionName} ${containerId}`;
    const result = await runCommandOnHost(host, command);
    if (result.isError) throw new Error(result.output);
    res.json({ success: true, command, output: result.output });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start / stop / restart an LXC container on ProxMox
app.post("/api/hosts/:id/pct/:ctid/action", async (req, res) => {
  const host = req.body?.host || readHosts().find((h: any) => h.id === req.params.id);
  if (!host) return res.status(404).json({ error: "Host not found" });
  const { ctid } = req.params;
  const { actionName } = req.body; // start | stop | restart
  const allowed = ["start", "stop", "restart", "shutdown"];
  if (!allowed.includes(actionName)) return res.status(400).json({ error: "Invalid action" });
  try {
    const command = `pct ${actionName} ${ctid}`;
    const result = await runCommandOnHost(host, command);
    if (result.isError) throw new Error(result.output);
    res.json({ success: true, command, output: result.output });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Server status — exposes demo mode flag to frontend
app.get("/api/status", (_req, res) => {
  res.json({ demoMode: DEMO_MODE, version: "1.6.5" });
});

// Logs API
app.get("/api/terminal-logs", (req, res) => {
  res.json(readLogs());
});

// Config API
app.get("/api/config", async (req, res) => {
  const config = await getActiveConfig();
  res.json({
    ...config,
    apiKey: config.apiKey ? "••••••••••••" : ""
  });
});

app.post("/api/config", async (req, res) => {
  const updated = { ...req.body };
  const current = await getActiveConfig();
  if (updated.apiKey === "••••••••••••") {
    updated.apiKey = current.apiKey;
  }
  writeConfig(updated);

  // Sync to Firestore durably
  if (firestoreDb) {
    try {
      const configDocRef = doc(firestoreDb, "systemConfig", "llm");
      const firestoreData = { ...updated };
      // Encrypt the apiKey if it's set and not already encrypted
      if (firestoreData.apiKey && !firestoreData.apiKey.startsWith("ENC:")) {
        firestoreData.apiKey = encrypt(firestoreData.apiKey);
      }
      await setDoc(configDocRef, firestoreData);
      console.log("[Firebase Server] Custom LLM config successfully mirrored to Firestore.");
    } catch (err) {
      console.error("[Firebase Server] Failed core replication of user credentials configuration to Firestore:", err);
    }
  }

  res.json({
    ...updated,
    apiKey: updated.apiKey ? "••••••••••••" : ""
  });
});

// Secure encryption utility API called by frontend client before writing to Firestore
app.post("/api/security/encrypt", (req, res) => {
  const { value } = req.body;
  if (!value) {
    return res.json({ encrypted: "" });
  }
  if (value.startsWith("ENC:")) {
    return res.json({ encrypted: value });
  }
  res.json({ encrypted: encrypt(value) });
});

// Direct execution api
app.post("/api/ssh/execute", async (req, res) => {
  const { hostId, host: clientHost, command } = req.body;
  let host = clientHost;
  if (!host) {
    host = readHosts().find(h => h.id === hostId);
  } else {
    // If the credentials was sent as masked bullets, restore from our local store if available
    if (host.password === "••••••••••••" || host.privateKey === "••••••••••••") {
      const dbHost = readHosts().find(h => h.id === host.id);
      if (dbHost) {
        if (host.password === "••••••••••••") {
          host.password = dbHost.password;
        }
        if (host.privateKey === "••••••••••••") {
          host.privateKey = dbHost.privateKey;
        }
      }
    }
  }

  if (!host) {
    return res.status(404).json({ error: "Host not found" });
  }

  // Demo mode: treat all hosts as simulated
  if (DEMO_MODE) host = { ...host, isSimulated: true };
  const result = await runCommandOnHost(host, command);
  res.json(result);
});

// Formatting helper for LLM/Gemini API errors to avoid verbose or JSON-like dump leakage in UI
function formatLLMError(error: any): string {
  if (!error) return "An unknown error occurred inside the agent.";
  const errMsg = error.message || String(error);
  
  if (typeof errMsg === "string") {
    // Detect standard API key expired or invalid
    if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("api_key") || errMsg.toLowerCase().includes("invalid_argument")) {
      if (errMsg.toLowerCase().includes("expired")) {
        return "⚠️ Gemini API key has expired. Please renew your API key in the SYSTEM_CONFIG dashboard tab.";
      }
      if (errMsg.toLowerCase().includes("invalid") || errMsg.toLowerCase().includes("not found")) {
        return "⚠️ Invalid Gemini API key. Please check your credentials in the SYSTEM_CONFIG dashboard tab.";
      }
    }
    
    // Attempt parsing in case of JSON stringified error inside the message
    const match = errMsg.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.error && typeof parsed.error.message === "string") {
          return `⚠️ Agent Dispatch Error: ${parsed.error.message}`;
        }
        if (typeof parsed.message === "string") {
          return `⚠️ Agent Dispatch Error: ${parsed.message}`;
        }
      } catch {
        // Fall back to original clean message
      }
    }
  }
  return `⚠️ Agent Dispatch Error: ${errMsg}`;
}

// Independent LLM Agent Chat Logic (Multi-step reasoning engine)
app.post("/api/agent/chat", async (req, res) => {
  try {
    const { message, chatHistory = [], activeHostId, hosts: clientHosts, modelMode, currentUserRole, selectedHostIds } = req.body;
    // In demo mode: force all hosts to simulated, strip credentials so LLM never sees real IPs/passwords
    const rawHosts = clientHosts || readHosts();
    const hosts = DEMO_MODE
      ? rawHosts.map((h: any) => ({ ...h, isSimulated: true, password: undefined, privateKey: undefined }))
      : rawHosts;
    const config = await getActiveConfig();

    // Setup contextual instruction
    const hostMetadata = hosts.map(h => ({
      id: h.id,
      name: h.name,
      ip: h.ip,
      username: h.username,
      port: h.port,
      isSimulated: h.isSimulated,
      stats: h.isSimulated ? h.simulatedStats : "Requires execution of df/free/uptime/docker commands to fetch real stats"
    }));

    // Find custom named targets
    const selectedHostObjects = (selectedHostIds || []).map((id: string) => hosts.find(h => h.id === id)).filter(Boolean);
    const selectedHostNames = selectedHostObjects.map((h: any) => h.name).join(", ") || "None requested explicitly";

    const systemInstruction = `You are an AI SSH Hosting Agent. You operate servers for the user.
Your interface supports voice (TTS reads your reply text) and standard text. Keep your text friendly, objective, scannable, and helpful.

Available Hosts:
${JSON.stringify(hostMetadata, null, 2)}

Active Host Selected in UI: ${activeHostId || "None"}
Explicitly Targeted/Selected Systems for this Chat Session: ${selectedHostNames} (Total: ${selectedHostObjects.length})

To perform your job, you can execute SSH shell commands on any of the registered hosts above!
You operates in a Reasoning & Action (ReAct) cycle. 

If you need to query or verify stats, read files, or check running docker containers, you must output a special JSON action.
The server will capture this action, run the command on the target host (real SSH or simulated), and feed the output back to you so you can decide your next action or reply.

If multiple systems are targeted, you should formulate consecutive 'ssh_exec' instructions to gather information across all of them (one after another) before presenting your final comparative analysis reply!

Your responses MUST be valid JSON matching EXACTLY one of these two schemas:

1) To execute an SSH command:
{
  "thoughts": "Your internal reasoning — translate the user's question into which shell command answers it.",
  "action": "ssh_exec",
  "hostId": "The ID of the host machine to execute on",
  "command": "A valid POSIX bash command to run via SSH (e.g. 'lsblk', 'df -h', 'free -h', 'docker ps', 'ss -tuln', 'uname -a'). This field MUST contain executable bash code only — NEVER natural language, questions, or English sentences."
}

2) To provide your final answer (once all data is gathered, or no command is needed):
{
  "thoughts": "Your internal reasoning summarising findings.",
  "action": "reply",
  "text": "Your final response to the user. Use markdown. Be concise and informative."
}

CRITICAL RULES:
- The "command" field must ALWAYS be a runnable bash command. Translate any natural-language question into the appropriate shell command (e.g. 'How many disks?' → 'lsblk -d -o NAME,SIZE,TYPE', 'What is the OS?' → 'uname -a && cat /etc/os-release').
- ONLY output the raw JSON object — no markdown fences, no extra text.
- Always target the activeHostSelected in UI unless the user specifies a different host.`;

    const executionActions: any[] = [];
    let currentPrompt = `User Query: "${message}"\nChat History:\n${JSON.stringify(chatHistory)}`;
    let loopCount = 0;
    const maxLoops = 4;
    let finalAnswer = "I encountered an issue executing agent instructions.";

    while (loopCount < maxLoops) {
      loopCount++;
      let rawLLMText = "";

      // Provider Branching
      if (config.provider === "gemini") {
        // Use standard official GoogleGenAI package
        const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("No Gemini API Key configured in Dashboard settings or environment.");
        }
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } }
        });
        
        let modelToUse = "gemini-2.0-flash";
        if (modelMode === "pro") {
          modelToUse = "gemini-2.5-pro-preview-06-05";
        } else if (modelMode === "lite") {
          modelToUse = "gemini-2.0-flash-lite";
        } else if (modelMode === "flash") {
          modelToUse = "gemini-2.0-flash";
        } else {
          modelToUse = config.modelName || "gemini-2.0-flash";
        }

        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: currentPrompt,
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        });
        rawLLMText = response.text || "";
      } else if (config.provider === "groq") {
        // Groq API integration
        const apiKey = config.apiKey || process.env.GROQ_API_KEY;
        if (!apiKey) {
          throw new Error("No Groq API Key configured in Dashboard settings or environment (GROQ_API_KEY).");
        }
        const endpoint = "https://api.groq.com/openai/v1";
        const modelName = config.modelName || "llama-3.3-70b-versatile";

        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              ...chatHistory.map((h: any) => ({
                role: h.sender === "user" ? "user" : "assistant",
                content: typeof h.text === "string" ? h.text : JSON.stringify(h)
              })),
              { role: "user", content: currentPrompt }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const terr = await response.text();
          throw new Error(`Groq API provider error (${response.status}): ${terr}`);
        }
        const resJson = await response.json();
        rawLLMText = resJson.choices?.[0]?.message?.content || "";
      } else {
        // Custom API / OpenAI Compatible fallback
        const apiKey = config.apiKey;
        const endpoint = config.customEndpoint || "https://api.openai.com/v1";
        const modelName = config.modelName || "gpt-4o-mini";

        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              ...chatHistory.map((h: any) => ({
                role: h.sender === "user" ? "user" : "assistant",
                content: typeof h.text === "string" ? h.text : JSON.stringify(h)
              })),
              { role: "user", content: currentPrompt }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const terr = await response.text();
          throw new Error(`LLM provider error (${response.status}): ${terr}`);
        }
        const resJson = await response.json();
        rawLLMText = resJson.choices?.[0]?.message?.content || "";
      }

      // Parse the LLM action response
      let parsedResponse: any;
      try {
        const cleanJson = rawLLMText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
        parsedResponse = JSON.parse(cleanJson);
      } catch (pe) {
        console.error("JSON parse failure in LLM output:", rawLLMText);
        // Attempt a regex extractor fallback
        const match = rawLLMText.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsedResponse = JSON.parse(match[0]);
          } catch (pe2) {
            parsedResponse = { action: "reply", text: rawLLMText };
          }
        } else {
          parsedResponse = { action: "reply", text: rawLLMText };
        }
      }

      // Process Action
      if (parsedResponse.action === "ssh_exec") {
        const actionHostId = parsedResponse.hostId;
        const actionCmd = parsedResponse.command;
        const targetHost = hosts.find(h => h.id === actionHostId);

        if (!targetHost) {
          currentPrompt += `\n[Tool Notice: Host with ID "${actionHostId}" not found. Select a valid registered host ID.]`;
          continue;
        }

        // Viewer Security blockade interceptor
        if (currentUserRole === "viewer") {
          const skipMsg = `[Viewer Security Block] Command execution is disabled in Read-Only Viewer sessions (Cmd: "${actionCmd}").`;
          const actionStepId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          executionActions.push({
            id: actionStepId,
            type: "ssh_exec",
            hostId: actionHostId,
            hostName: targetHost.name,
            command: actionCmd,
            status: "failed",
            output: skipMsg
          });

          // Feed blockade feedback back to ReAct loop so agent can frame its response text
          currentPrompt += `\n${skipMsg}\n\nWhat is your next action?`;
          continue;
        }

        // Record visual timeline step
        const actionStepId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        executionActions.push({
          id: actionStepId,
          type: "ssh_exec",
          hostId: actionHostId,
          hostName: targetHost.name,
          command: actionCmd,
          status: "pending"
        });

        // Guard: reject natural-language accidentally passed as command
        const nlPattern = /^(how|what|why|where|when|does|can|is|are|show|tell|list|find|get|check|count|give|describe|explain)\s/i;
        if (nlPattern.test(actionCmd.trim()) || actionCmd.trim().endsWith('?')) {
          currentPrompt += `\n[Tool Error: "${actionCmd}" is natural language, not a valid bash command. Translate the user's question into a real shell command (e.g. 'lsblk -d', 'df -h', 'free -h') and try again.]\n\nWhat is your next action?`;
          continue;
        }

        // Run command on host
        const cmdResult = await runCommandOnHost(targetHost, actionCmd);

        // Update step status
        const idx = executionActions.findIndex(a => a.id === actionStepId);
        if (idx !== -1) {
          executionActions[idx].status = cmdResult.isError ? "failed" : "success";
          executionActions[idx].output = cmdResult.output;
        }

        // Feed stats output back to the LLM
        currentPrompt += `\n[Executed "${actionCmd}" on "${targetHost.name}" (${targetHost.ip})]:\n${cmdResult.output}\n\nWhat is your next action?`;
      } else {
        // Action is "reply"
        finalAnswer = parsedResponse.text || parsedResponse.reply || "No response provided.";
        break;
      }
    }

    res.json({
      text: finalAnswer,
      actions: executionActions
    });

  } catch (error: any) {
    console.error("Error in AI Agent Loop:", error);
    res.status(500).json({
      error: formatLLMError(error)
    });
  }
});

// Transcription Endpoint for Speech to Text
app.post("/api/transcribe", async (req, res) => {
  const { audio } = req.body;
  if (!audio) {
    return res.status(400).json({ error: "Missing audio payload data" });
  }
  const config = await getActiveConfig();
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "No Gemini API Key configured on server" });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          inlineData: {
            data: audio,
            mimeType: "audio/webm"
          }
        },
        "Transcribe this short audio voice exactly as spoken into clean text. Return ONLY the final output without any dialog, commentary, preamble or quotes. If silent or empty, return single blank."
      ]
    });

    res.json({ text: response.text || "" });
  } catch (e: any) {
    console.error("Transcription error:", e);
    res.status(500).json({ error: formatLLMError(e) });
  }
});

// Diagnostic Intelligence Report Generator
app.post("/api/analyze-diagnostics", async (req, res) => {
  const { host, logs = [] } = req.body;
  if (!host) {
    return res.status(400).json({ error: "No host machine details provided" });
  }
  const config = await getActiveConfig();
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "No Gemini API Key configured on server" });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const prompt = `Analyze this remote server machine configuration and context to provide a professional, highly intelligent system diagnostic review. Included is the host's details, virtual specs, and recent terminal logs.

Host Machine Details:
${JSON.stringify(host, null, 2)}

Recent Audit logs:
${JSON.stringify(logs.slice(0, 10), null, 2)}

Provide your response in a supportive, markdown-formatted report with:
1) **System Summary**: Interpretation of active spec resources (CPU, RAM, Storage).
2) **Vulnerabilities / Security Audits**: Any warnings based on ports (e.g. 5432, 22 open) or plain password SSH usage.
3) **Docker Recommendation**: Advice regarding containers status, performance tuning, and suggestions.
Keep the advice highly practical, brief, action-oriented, and perfectly styled inside system engineering terminology. Minimize filler text.`;

    const response = await ai.models.generateContent({
      model: config.modelName || "gemini-2.0-flash",
      contents: prompt
    });

    res.json({ text: response.text || "Failed to generate diagnostic evaluation" });
  } catch (e: any) {
    console.error("Diagnostic intelligence analysis failed:", e);
    res.status(500).json({ error: formatLLMError(e) });
  }
});

// Outbound Integrations - WhatsApp webhook endpoint simulator
// This can accept webhook requests from Twilio or real WhatsApp providers.
app.post("/api/webhook/whatsapp", async (req, res) => {
  const { Body, From, message: directMessage } = req.body;
  const incomingMessage = Body || directMessage || "";
  const senderNumber = From || "WhatsAppUser";

  console.log(`[WhatsApp Webhook] Incoming query from ${senderNumber}: "${incomingMessage}"`);

  // Default to Gemini backend loop to solve the request
  const hosts = readHosts();
  const config = await getActiveConfig();

  const hostMetadata = hosts.map(h => ({
    id: h.id,
    name: h.name,
    ip: h.ip,
    username: h.username,
    isSimulated: h.isSimulated,
    stats: h.isSimulated ? h.simulatedStats : "Real host offline metadata"
  }));

  const systemInstruction = `You are a WhatsApp Connected SSH Agent. Keep response super concise, brief, and WhatsApp-friendly (emojis, lists, brief highlights).
Available Hosts: ${JSON.stringify(hostMetadata)}`;

  try {
    let finalAnswer = "";
    if (config.provider === "gemini") {
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No Gemini Key");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Translate requested instruction into brief advice or run actions: "${incomingMessage}"`,
        config: { systemInstruction }
      });
      finalAnswer = response.text || "No response text found.";
    } else {
      finalAnswer = `[WhatsApp Remote Agent] I am configured to work, currently connected with provider ${config.provider}. Ready to coordinate commands.`;
    }

    // Expose webhook format
    res.type("text/xml").send(`<Response><Message>${finalAnswer}</Message></Response>`);
  } catch (e: any) {
    res.type("text/xml").send(`<Response><Message>SSH Agent Error: ${formatLLMError(e)}</Message></Response>`);
  }
});

// ── Docker Project Migration ────────────────────────────────────────────────

interface TransferFile { relativePath: string; data: Buffer; }

const TAR_EXCLUDES = ['.git', 'node_modules', '__pycache__', '.next', 'dist', 'build', '.cache', '.terraform', 'vendor', '*.log']
  .map(d => `--exclude='${d}'`).join(' ');

// Try `docker compose` first; fall back to `sudo docker compose` for non-root users
async function dockerCompose(host: HostMachine, args: string, cwd?: string): Promise<string> {
  const cd = cwd ? `cd "${cwd}" && ` : '';
  return executeRealSSH(host,
    `${cd}(docker compose ${args} 2>&1) || (sudo docker compose ${args} 2>&1)`
  );
}

interface MigJobState {
  phase: string;
  progress: number;
  totalFiles: number;
  transferredFiles: number;
  log: string[];
  error?: string;
  targetContainers?: Array<{ name: string; status: string; ports: string }>;
  // stored for rollback
  _targetHost?: HostMachine;
  _finalPath?: string;
  _sourcePath?: string;
  _sourceHost?: HostMachine;
}

const migrationJobs = new Map<string, MigJobState>();

function createSftpSession(host: HostMachine): Promise<{ sftp: any; conn: Client }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err: any, sftp: any) => {
        if (err) { conn.end(); return reject(err); }
        resolve({ sftp, conn });
      });
    }).on('error', reject).connect({
      host: host.ip,
      port: host.port || 22,
      username: host.username,
      password: host.authType === 'password' ? decrypt(host.password) : undefined,
      privateKey: host.authType === 'privateKey' ? decrypt(host.privateKey) : undefined,
      readyTimeout: 15000
    });
  });
}

function sftpReadFile(sftp: any, p: string): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    const s = sftp.createReadStream(p);
    s.on('data', (c: Buffer) => chunks.push(c));
    s.on('end', () => res(Buffer.concat(chunks)));
    s.on('error', rej);
  });
}

function sftpWriteFile(sftp: any, p: string, data: Buffer): Promise<void> {
  return new Promise((res, rej) => {
    const s = sftp.createWriteStream(p);
    s.on('close', res);
    s.on('error', rej);
    s.end(data);
  });
}

function sftpMkdir(sftp: any, p: string): Promise<void> {
  return new Promise(res => sftp.mkdir(p, () => res()));
}

async function sftpMkdirp(sftp: any, remotePath: string): Promise<void> {
  const parts = remotePath.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    await sftpMkdir(sftp, cur);
  }
}

function ts(): string {
  return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

function tlog(job: MigJobState, msg: string) {
  job.log.push(`[${ts()}] ${msg}`);
}

async function patchDockerfilesOnTarget(host: HostMachine, projectPath: string, job: MigJobState): Promise<void> {
  const pyScript = [
    'import sys, re',
    'patched = []',
    'for path in sys.argv[1:]:',
    '    try:',
    '        content = open(path).read()',
    '        lines = content.split("\\n")',
    '        for i, line in enumerate(lines):',
    '            m = re.match(r"^USER\\s+(\\S+)", line.strip())',
    '            if m:',
    '                uname = m.group(1)',
    '                if uname in ("root", "0"): break',
    '                pre = "\\n".join(lines[:i])',
    '                if "useradd" not in pre and "adduser" not in pre:',
    '                    lines[i:i] = [',
    '                        "RUN (useradd --create-home --shell /bin/bash " + uname + " 2>/dev/null || adduser -S " + uname + " 2>/dev/null) || true",',
    '                        "RUN chown -R " + uname + " /app 2>/dev/null || true",',
    '                    ]',
    '                    open(path, "w").write("\\n".join(lines))',
    '                    patched.append(path)',
    '                break',
    '    except Exception as e: print("skip " + path + ": " + str(e))',
    'print("Patched: " + ", ".join(patched) if patched else "No Dockerfile patches needed")',
  ].join('\n');

  const scriptPath = `/tmp/buildos_dfpatch_${Date.now()}.py`;
  const { sftp, conn } = await createSftpSession(host);
  await sftpWriteFile(sftp, scriptPath, Buffer.from(pyScript, 'utf-8'));
  conn.end();

  const out = await executeRealSSH(host,
    `DFS=$(find "${projectPath}" -name "Dockerfile" -type f 2>/dev/null | tr '\\n' ' '); ` +
    `[ -n "$DFS" ] && python3 ${scriptPath} $DFS 2>/dev/null || echo "python3 unavailable, skipping Dockerfile patch"; ` +
    `rm -f ${scriptPath}`
  ).catch(() => '');
  if (out.trim()) tlog(job, `Dockerfile check: ${out.trim()}`);
}

async function transferViaZip(
  sourceHost: HostMachine,
  targetHost: HostMachine,
  sourcePath: string,
  destPath: string,
  finalDirName: string,
  overrideFiles: TransferFile[],
  job: MigJobState
): Promise<string> {
  const tmpId = `buildos_${Date.now()}`;
  const srcParent = sourcePath.split('/').slice(0, -1).join('/') || '/';
  const srcFolder = sourcePath.split('/').pop()!;
  const tarName = `${tmpId}.tar.gz`;
  const srcTar = `/tmp/${tarName}`;
  const dstTar = `/tmp/${tarName}`;
  const finalPath = `${destPath}/${finalDirName}`;

  // 1. Create tar.gz on source (excludes dev/build dirs)
  const t0 = Date.now();
  tlog(job, `Archiving ${srcFolder} on source...`);
  await executeRealSSH(sourceHost,
    `tar czf "${srcTar}" ${TAR_EXCLUDES} -C "${srcParent}" "${srcFolder}" 2>&1`
  );

  const sizeOut = await executeRealSSH(sourceHost,
    `stat -c%s "${srcTar}" 2>/dev/null || wc -c < "${srcTar}"`
  ).catch(() => '0');
  const sizeBytes = parseInt(sizeOut.trim().split(/\s/)[0]) || 0;
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
  tlog(job, `Archive ready: ${sizeMB}MB (${((Date.now() - t0) / 1000).toFixed(1)}s) — downloading...`);
  job.progress = 22;

  // 2. SFTP download single archive
  const t1 = Date.now();
  const { sftp: srcSftp, conn: srcConn } = await createSftpSession(sourceHost);
  const tarBuffer = await sftpReadFile(srcSftp, srcTar);
  srcConn.end();
  await executeRealSSH(sourceHost, `rm -f "${srcTar}"`).catch(() => {});
  tlog(job, `Downloaded ${(tarBuffer.length / 1024 / 1024).toFixed(1)}MB in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  job.progress = 55;

  // 3. SFTP upload to target
  const t2 = Date.now();
  tlog(job, `Uploading archive to ${targetHost.name}...`);
  const { sftp: dstSftp, conn: dstConn } = await createSftpSession(targetHost);
  await sftpMkdirp(dstSftp, destPath);
  await sftpWriteFile(dstSftp, dstTar, tarBuffer);
  dstConn.end();
  tlog(job, `Upload complete in ${((Date.now() - t2) / 1000).toFixed(1)}s — extracting...`);
  job.progress = 75;

  // 4. Extract on target; rename if projectName differs from source folder name
  const t3 = Date.now();
  if (finalDirName !== srcFolder) {
    await executeRealSSH(targetHost,
      `cd "${destPath}" && tar xzf "${dstTar}" && mv "${srcFolder}" "${finalDirName}" && rm -f "${dstTar}"`
    );
  } else {
    await executeRealSSH(targetHost,
      `cd "${destPath}" && tar xzf "${dstTar}" && rm -f "${dstTar}"`
    );
  }
  tlog(job, `Extracted to ${finalPath} in ${((Date.now() - t3) / 1000).toFixed(1)}s`);
  tlog(job, `Total transfer: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  job.progress = 82;

  // 5. Write port-remap override files after extraction
  if (overrideFiles.length > 0) {
    const { sftp: ovSftp, conn: ovConn } = await createSftpSession(targetHost);
    for (const f of overrideFiles) {
      await sftpWriteFile(ovSftp, `${finalPath}/${f.relativePath}`, f.data);
    }
    ovConn.end();
    tlog(job, `Written ${overrideFiles.length} override file(s)`);
  }

  return finalPath;
}

function parseComposePortsAndVolumes(composeYml: string): {
  portMappings: Array<{ service: string; hostPort: number; containerPort: number; protocol: string }>;
  namedVolumes: string[];
} {
  const portMappings: Array<{ service: string; hostPort: number; containerPort: number; protocol: string }> = [];
  const namedVolumes: string[] = [];

  // Named volumes: top-level `volumes:` block keys (0-indent)
  const topLevelVolumesMatch = composeYml.match(/^volumes:\s*\n((?:[ \t]+\S[^\n]*\n?)*)/m);
  if (topLevelVolumesMatch) {
    const block = topLevelVolumesMatch[1];
    for (const line of block.split('\n')) {
      const m = line.match(/^[ \t]{2}([\w][\w.-]*)[ \t]*:/);
      if (m) namedVolumes.push(m[1]);
    }
  }

  // Port mappings: parse service blocks
  let currentService = '';
  let inPorts = false;
  let portsIndent = 0;
  for (const line of composeYml.split('\n')) {
    const svcMatch = line.match(/^  ([\w][\w.-]*):\s*$/);
    if (svcMatch) { currentService = svcMatch[1]; inPorts = false; continue; }
    if (/^ {4}ports:\s*$/.test(line)) { inPorts = true; portsIndent = 6; continue; }
    if (inPorts) {
      const portLine = line.match(/^[ \t]{4,8}-\s+['"]?(.+?)['"]?\s*$/);
      if (portLine) {
        const raw = portLine[1];
        // Handle ip:host:container or host:container or just container
        const parts = raw.replace(/['"/]/g, '').split(':');
        let hostPort = 0, containerPort = 0, protocol = 'tcp';
        if (parts.length >= 2) {
          const last = parts[parts.length - 1];
          const protoSplit = last.split('/');
          containerPort = parseInt(protoSplit[0]);
          protocol = protoSplit[1] || 'tcp';
          hostPort = parseInt(parts[parts.length - 2]);
        } else {
          containerPort = parseInt(parts[0]);
          hostPort = containerPort;
        }
        if (hostPort > 0 && containerPort > 0 && currentService) {
          portMappings.push({ service: currentService, hostPort, containerPort, protocol });
        }
      } else if (!/^\s*$/.test(line) && !/^[ \t]{6,}-/.test(line)) {
        inPorts = false;
      }
    }
  }
  return { portMappings, namedVolumes };
}

// Discover docker-compose projects on a host
app.post('/api/migration/discover', async (req, res) => {
  const { host } = req.body as { host: HostMachine };
  if (!host || host.proxmox) return res.status(400).json({ error: 'Invalid or Proxmox host' });
  if (host.isSimulated) return res.json({ projects: [] });

  try {
    // Try docker compose ls (v2) first
    let projects: any[] = [];
    const lsResult = await executeRealSSH(host,
      "(docker compose ls --format json 2>/dev/null || sudo docker compose ls --format json 2>/dev/null) || echo '__FALLBACK__'"
    );
    const raw = lsResult.trim();
    if (!raw.includes('__FALLBACK__') && raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        projects = parsed.map((p: any) => {
          const configFile = (p.ConfigFiles || '').split(',')[0].trim();
          const path = configFile.replace(/\/(docker-compose\.ya?ml)$/, '');
          return { name: p.Name || 'unknown', path, configFile, status: p.Status || 'unknown' };
        });
      } catch {}
    }

    if (projects.length === 0) {
      // Fallback: search common locations
      const findResult = await executeRealSSH(host,
        "find /opt /home /srv /root /var/www /app -maxdepth 5 -name 'docker-compose.yml' -o -name 'docker-compose.yaml' 2>/dev/null | head -20"
      );
      if (findResult.trim()) {
        projects = findResult.trim().split('\n').filter(Boolean).map(configFile => {
          const path = configFile.replace(/\/(docker-compose\.ya?ml)$/, '');
          const name = path.split('/').pop() || 'unknown';
          return { name, path, configFile, status: 'found' };
        });
      }
    }

    res.json({ projects });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Preflight check: verify target + parse ports/volumes from source compose file
app.post('/api/migration/preflight', async (req, res) => {
  const { sourceHost, targetHost, sourcePath, destPath, projectName } = req.body as {
    sourceHost: HostMachine; targetHost: HostMachine; sourcePath: string; destPath: string; projectName?: string;
  };
  if (!sourceHost || !targetHost || !sourcePath) return res.status(400).json({ error: 'Missing required fields' });
  if (sourceHost.proxmox || targetHost.proxmox) return res.status(400).json({ error: 'Proxmox hosts not supported' });

  const result: any = {
    targetReachable: false,
    targetDockerVersion: null,
    targetComposeVersion: null,
    targetDiskFreeGB: null,
    destPathExists: false,
    portMappings: [],
    namedVolumes: [],
  };

  // 1. Target reachability + docker
  try {
    const dv = await executeRealSSH(targetHost, 'docker --version 2>&1');
    result.targetReachable = true;
    result.targetDockerVersion = dv.trim().split('\n')[0];
  } catch (e: any) {
    result.error = `Cannot reach target: ${e.message}`;
    return res.json(result);
  }

  try {
    const cv = await executeRealSSH(targetHost, 'docker compose version 2>/dev/null || docker-compose --version 2>/dev/null');
    result.targetComposeVersion = cv.trim().split('\n')[0];
  } catch {}

  // 2. Disk space on target
  try {
    const df = await executeRealSSH(targetHost, "df -BG / --output=avail 2>/dev/null | tail -1 || df -g / 2>/dev/null | tail -1 | awk '{print $4}'");
    result.targetDiskFreeGB = parseInt(df.replace(/[^0-9]/g, '')) || null;
  } catch {}

  // 3. Check if final project path already exists on target
  try {
    const finalDirName = projectName || sourcePath.split('/').pop() || 'migrated-project';
    const finalPath = `${destPath}/${finalDirName}`;
    const chk = await executeRealSSH(targetHost, `test -d "${finalPath}" && echo exists || echo notfound`);
    result.destPathExists = chk.trim() === 'exists';
  } catch {}

  // 4. In-use ports on target
  const targetUsedPorts = new Set<number>();
  try {
    const portsOut = await executeRealSSH(targetHost,
      "ss -tlnp 2>/dev/null | awk 'NR>1{print $4}' | grep -oE '[0-9]+$' | sort -un"
    );
    portsOut.split('\n').forEach(p => { const n = parseInt(p.trim()); if (n > 0) targetUsedPorts.add(n); });
  } catch {}

  // 5. Parse compose file from source
  try {
    const { sftp, conn } = await createSftpSession(sourceHost);
    let composeContent: string | null = null;
    for (const fname of ['docker-compose.yml', 'docker-compose.yaml']) {
      try {
        const buf = await sftpReadFile(sftp, `${sourcePath}/${fname}`);
        composeContent = buf.toString('utf-8');
        break;
      } catch {}
    }
    conn.end();

    if (composeContent) {
      const { portMappings, namedVolumes } = parseComposePortsAndVolumes(composeContent);
      result.namedVolumes = namedVolumes;
      result.portMappings = portMappings.map(pm => ({
        ...pm,
        conflictOnTarget: targetUsedPorts.has(pm.hostPort),
        newHostPort: pm.hostPort,
      }));
    }
  } catch {}

  res.json(result);
});

// Start migration job (async — poll /api/migration/job/:jobId)
app.post('/api/migration/start', async (req, res) => {
  const { sourceHost, targetHost, sourcePath, destPath, projectName, portOverrides } = req.body as {
    sourceHost: HostMachine; targetHost: HostMachine;
    sourcePath: string; destPath: string;
    projectName: string;
    portOverrides: Array<{ service: string; hostPort: number; containerPort: number; newHostPort: number }>;
  };

  if (!sourceHost || !targetHost || !sourcePath || !destPath) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (sourceHost.proxmox || targetHost.proxmox) {
    return res.status(400).json({ error: 'Proxmox hosts not supported' });
  }

  const jobId = `mig-${Date.now()}`;
  const job: MigJobState = {
    phase: 'transferring', progress: 0,
    totalFiles: 0, transferredFiles: 0,
    log: ['Migration job created'],
    targetContainers: [],
    _targetHost: targetHost,
    _sourceHost: sourceHost,
    _sourcePath: sourcePath,
  };
  migrationJobs.set(jobId, job);

  const finalDirName = projectName || sourcePath.split('/').pop() || 'migrated-project';
  const finalPath = `${destPath}/${finalDirName}`;

  // Run async — do not await
  (async () => {
    // Track rollback state
    let extractedPath: string | null = null;
    let composeStarted = false;

    const rollbackTarget = async (reason: string) => {
      tlog(job, `--- ROLLBACK: ${reason} ---`);
      if (composeStarted && extractedPath) {
        tlog(job, 'Stopping containers on target...');
        await dockerCompose(targetHost, 'down', extractedPath).catch(() => {});
      }
      if (extractedPath) {
        tlog(job, `Removing ${extractedPath} from target...`);
        await executeRealSSH(targetHost, `rm -rf "${extractedPath}" 2>/dev/null || true`).catch(() => {});
        extractedPath = null;
        tlog(job, 'Target clean. Source still running — nothing lost.');
      }
    };

    try {
      // ── Phase 1: Build override files ──────────────────────────────────────
      const overrideFiles: TransferFile[] = [];
      const remapped = (portOverrides || []).filter(po => po.newHostPort !== po.hostPort);
      if (remapped.length > 0) {
        const svcMap: Record<string, string[]> = {};
        remapped.forEach(po => {
          if (!svcMap[po.service]) svcMap[po.service] = [];
          svcMap[po.service].push(`"${po.newHostPort}:${po.containerPort}"`);
        });
        let overrideYml = 'services:\n';
        for (const [svc, ports] of Object.entries(svcMap)) {
          overrideYml += `  ${svc}:\n    ports:\n`;
          ports.forEach(p => { overrideYml += `      - ${p}\n`; });
        }
        overrideFiles.push({ relativePath: 'docker-compose.override.yml', data: Buffer.from(overrideYml, 'utf-8') });
        tlog(job, `Port override prepared (${remapped.length} remapped services)`);
      }

      // ── Phase 2: Tar → transfer → extract ─────────────────────────────────
      job.phase = 'transferring';
      tlog(job, `Source: ${sourceHost.name} [${sourceHost.ip}] ${sourcePath}`);
      tlog(job, `Target: ${targetHost.name} [${targetHost.ip}] → ${destPath}/${finalDirName}`);
      const resolvedFinalPath = await transferViaZip(
        sourceHost, targetHost, sourcePath, destPath, finalDirName, overrideFiles, job
      );
      extractedPath = resolvedFinalPath;
      job._finalPath = resolvedFinalPath;
      tlog(job, `Files live at: ${targetHost.username}@${targetHost.ip}:${resolvedFinalPath}`);
      tlog(job, 'Transfer complete');

      // ── Phase 2.5: Patch Dockerfiles missing USER definitions ─────────────
      tlog(job, 'Scanning Dockerfiles for USER compatibility...');
      await patchDockerfilesOnTarget(targetHost, resolvedFinalPath, job);

      // ── Phase 3: docker compose up on target ───────────────────────────────
      job.phase = 'starting';
      tlog(job, 'Pulling images on target...');
      try {
        await dockerCompose(targetHost, 'pull 2>&1 | tail -5', resolvedFinalPath);
        tlog(job, 'Images ready');
      } catch (e: any) {
        tlog(job, `Pull note: ${e.message.split('\n')[0]} (continuing)`);
      }

      const t4 = Date.now();
      tlog(job, 'Running docker compose up -d...');
      await dockerCompose(targetHost, 'up -d', resolvedFinalPath);
      composeStarted = true;
      tlog(job, `Compose up in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
      job.progress = 90;

      // ── Phase 4: Verify — wait up to 90s for all containers healthy ────────
      job.phase = 'verifying';
      tlog(job, 'Waiting for containers to be healthy...');
      let allUp = false;
      for (let attempt = 0; attempt < 18; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const psOut = await dockerCompose(targetHost,
            `ps --format '{{.Name}}|{{.Status}}|{{.Ports}}'`, resolvedFinalPath
          );
          const containers = psOut.trim().split('\n').filter(Boolean).map(line => {
            const [name, status, ports] = line.split('|');
            return { name: (name || '').trim(), status: (status || '').trim(), ports: (ports || '').trim() };
          }).filter(c => c.name);
          job.targetContainers = containers;
          allUp = containers.length > 0 &&
            containers.every(c => c.status.toLowerCase().includes('up') || c.status.toLowerCase().includes('running'));
          if (allUp) break;
        } catch {}
      }

      if (!allUp) {
        // Containers didn't come up — rollback target, source still safe
        await rollbackTarget('containers not healthy after 90s');
        throw new Error('Containers failed to start on target within 90s. Target cleaned up. Source still running.');
      }

      tlog(job, `${job.targetContainers?.length || 0} containers healthy on target`);
      job.progress = 100;
      job.phase = 'waiting_confirm';
      tlog(job, 'Source still running. Confirm stop to complete migration.');

    } catch (e: any) {
      // Only rollback if we haven't already rolled back inside the catch
      if (extractedPath) {
        await rollbackTarget(e.message);
      }
      job.phase = 'error';
      job.error = e.message;
      job.log.push(`ERROR: ${e.message}`);
    }
  })();

  res.json({ jobId, finalPath });
});

// Poll migration job status
app.get('/api/migration/job/:jobId', (req, res) => {
  const job = migrationJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Manual rollback — stop target containers + rm extracted folder (source stays running)
app.post('/api/migration/rollback/:jobId', async (req, res) => {
  const job = migrationJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const targetHost = job._targetHost;
  const finalPath = job._finalPath;
  if (!targetHost || !finalPath) return res.status(400).json({ error: 'No rollback target recorded' });

  job.phase = 'error';
  job.log.push('--- MANUAL ROLLBACK ---');
  try {
    await dockerCompose(targetHost, 'down', finalPath).catch(() => {});
    job.log.push('Containers stopped on target');
    await executeRealSSH(targetHost, `rm -rf "${finalPath}"`);
    job.log.push(`Removed ${finalPath} from target`);
    job._finalPath = undefined;
    job.error = 'Rolled back by user. Source is still running.';
    res.json({ success: true });
  } catch (e: any) {
    job.log.push(`Rollback error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// Stop source containers (called after user confirms target is healthy)
app.post('/api/migration/stop-source', async (req, res) => {
  const { sourceHost, sourcePath, jobId } = req.body as {
    sourceHost: HostMachine; sourcePath: string; jobId?: string;
  };
  if (!sourceHost || !sourcePath) return res.status(400).json({ error: 'Missing sourceHost or sourcePath' });
  if (sourceHost.proxmox) return res.status(400).json({ error: 'Proxmox not supported' });

  const job = jobId ? migrationJobs.get(jobId) : undefined;
  if (job) { job.phase = 'stopping_source'; job.log.push('Stopping source containers...'); }

  try {
    const cmd = [
      `cd "${sourcePath}"`,
      `(docker compose down --remove-orphans --timeout 30 2>&1`,
      `|| sudo docker compose down --remove-orphans --timeout 30 2>&1`,
      `|| docker-compose down --remove-orphans --timeout 30 2>&1`,
      `|| true)`,
    ].join(' ');
    const out = await executeRealSSH(sourceHost, cmd);
    if (job) { job.phase = 'done'; job.log.push('Source stopped. Migration complete.'); }
    res.json({ success: true, output: out });
  } catch (e: any) {
    const msg = e.message || String(e);
    if (job) job.log.push(`Stop source error: ${msg}`);
    // SSH connect/auth failure — surface full message
    res.status(500).json({ error: msg });
  }
});

// Configure Vite or Static production assets
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrades for live audio
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
    if (pathname === "/api/live-agent") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle live agents
  wss.on("connection", async (clientWs) => {
    console.log("[LiveAgent WS] Client voice session initiated");
    const config = await getActiveConfig();
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({ error: "No Gemini API key found on the server. Please check config." }));
      clientWs.close();
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    try {
      const session = await ai.live.connect({
        model: "gemini-2.0-flash-live-001",
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: "You are an expert real-time AI system administrator named BuildOS. You respond directly, concisely, and with precise remote server commands. Focus on speed and accuracy. Your output is rendered to voice in real-time."
        },
        callbacks: {
          onmessage: (msg: any) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              clientWs.send(JSON.stringify({ audio: audioData }));
            }
            if (msg.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            console.log("[LiveAgent WS] Gemini session ended");
            try { clientWs.close(); } catch (e) {}
          },
          onerror: (err: any) => {
            console.error("[LiveAgent WS] Gemini error:", err);
            clientWs.send(JSON.stringify({ error: String(err) }));
          }
        }
      });

      clientWs.on("message", (msg) => {
        try {
          const payload = JSON.parse(msg.toString());
          if (payload.audio) {
            session.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" }
            });
          }
        } catch (e) {
          console.error("[LiveAgent WS] Failed parsing client voice packet:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("[LiveAgent WS] Client voice socket closed");
        try { session.close(); } catch (e) {}
      });

    } catch (e: any) {
      console.error("[LiveAgent WS] Gemini connection error:", e);
      clientWs.send(JSON.stringify({ error: `Connection handshake failed: ${e.message}` }));
      clientWs.close();
    }
  });

  if (process.env.NODE_ENV !== "production") {
    // Development Mode loaders
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production build direct static serves
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SSH Agent Portal] Running and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
