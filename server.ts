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

dotenv.config();

// Secure AES-256-CBC Encryption Engine
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "hermes-node-commander-secure-salting-2026";
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

app.use(express.json());

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
    modelName: "gemini-3.5-flash"
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
  if (host.isSimulated) {
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
    isSimulated: !!req.body.isSimulated
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

// GET detailed diagnostics for a specific host (metrics, dockers, services)
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
  const { containerId, containerName, actionName } = req.body;
  try {
    const host = readHosts().find(h => h.id === req.params.id);
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
  const { serviceName, actionName } = req.body;
  try {
    const host = readHosts().find(h => h.id === req.params.id);
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

// Logs API
app.get("/api/terminal-logs", (req, res) => {
  res.json(readLogs());
});

// Config API
app.get("/api/config", (req, res) => {
  const config = readConfig();
  res.json({
    ...config,
    apiKey: config.apiKey ? "••••••••••••" : ""
  });
});

app.post("/api/config", (req, res) => {
  const updated = { ...req.body };
  const current = readConfig();
  if (updated.apiKey === "••••••••••••") {
    updated.apiKey = current.apiKey;
  }
  writeConfig(updated);
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
  const result = await runCommandOnHost(host, command);
  res.json(result);
});

// Independent LLM Agent Chat Logic (Multi-step reasoning engine)
app.post("/api/agent/chat", async (req, res) => {
  const { message, chatHistory = [], activeHostId, hosts: clientHosts, modelMode, currentUserRole } = req.body;
  const hosts = clientHosts || readHosts();
  const config = readConfig();

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

  const systemInstruction = `You are an AI SSH Hosting Agent. You operate servers for the user.
Your interface supports voice (TTS reads your reply text) and standard text. Keep your text friendly, objective, scannable, and helpful.

Available Hosts:
${JSON.stringify(hostMetadata, null, 2)}

Active Host Selected in UI: ${activeHostId || "None"}

To perform your job, you can execute SSH shell commands on any of the registered hosts above!
You operates in a Reasoning & Action (ReAct) cycle. 

If you need to query or verify stats, read files, or check running docker containers, you must output a special JSON action.
The server will capture this action, run the command on the target host (real SSH or simulated), and feed the output back to you so you can decide your next action or reply.

Format your responses MUST be valid JSON matching EXACTLY one of these two schemas:

1) To execute an SSH command:
{
  "thoughts": "Write your internal reasoning here explaining why you need this data.",
  "action": "ssh_exec",
  "hostId": "The ID of the host machine to execute on",
  "command": "The shell command to run (e.g., 'docker ps', 'uptime', 'free -h', 'df -h', 'ss -tuln', or normal commands)"
}

2) To provide your final answer to the user (once you have gathered all required stats or if no command is needed):
{
  "thoughts": "Write your internal reasoning planning this summary.",
  "action": "reply",
  "text": "Your final detailed human response here. Use markdown formatting. List docker counts, port states, stats, etc."
}

CRITICAL: ONLY respond with the raw JSON object itself in your text response. Do not surround it with markdown codeblocks or other formatting. Under any circumstances, your entire output must be parseable JSON. Always prioritize the activeHostSelected in UI unless the user specifies a different machine name/IP.`;

  const executionActions: any[] = [];
  let currentPrompt = `User Query: "${message}"\nChat History:\n${JSON.stringify(chatHistory)}`;
  let loopCount = 0;
  const maxLoops = 4;
  let finalAnswer = "I encountered an issue executing agent instructions.";

  try {
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
        
        let modelToUse = "gemini-3.5-flash";
        if (modelMode === "pro") {
          modelToUse = "gemini-3.1-pro-preview";
        } else if (modelMode === "lite") {
          modelToUse = "gemini-3.1-flash-lite";
        } else if (modelMode === "flash") {
          modelToUse = "gemini-3.5-flash";
        } else {
          modelToUse = config.modelName || "gemini-3.5-flash";
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
      error: error.message || "An exception occurred inside the server Agent ReAct processing controller."
    });
  }
});

// Transcription Endpoint for Speech to Text
app.post("/api/transcribe", async (req, res) => {
  const { audio } = req.body;
  if (!audio) {
    return res.status(400).json({ error: "Missing audio payload data" });
  }
  const config = readConfig();
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
      model: "gemini-3.5-flash",
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
    res.status(500).json({ error: e.message || "Failed to transcribe audio stream" });
  }
});

// Diagnostic Intelligence Report Generator
app.post("/api/analyze-diagnostics", async (req, res) => {
  const { host, logs = [] } = req.body;
  if (!host) {
    return res.status(400).json({ error: "No host machine details provided" });
  }
  const config = readConfig();
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
      model: config.modelName || "gemini-3.5-flash",
      contents: prompt
    });

    res.json({ text: response.text || "Failed to generate diagnostic evaluation" });
  } catch (e: any) {
    console.error("Diagnostic intelligence analysis failed:", e);
    res.status(500).json({ error: e.message || "Diagnostic evaluation exception" });
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
  const config = readConfig();

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
        model: "gemini-3.5-flash",
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
    res.type("text/xml").send(`<Response><Message>SSH Agent Error: ${e.message}</Message></Response>`);
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
    const config = readConfig();
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
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: "You are an expert real-time AI system administrator named Hermes. You respond directly, concisely, and with precise remote server commands. Focus on speed and accuracy. Your output is rendered to voice in real-time."
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
