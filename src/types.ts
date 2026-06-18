export type AuthType = 'password' | 'privateKey' | 'none';

export interface HostMachine {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKey?: string;
  isSimulated: boolean; // True to run a local virtual mock terminal inside the container
  proxmox?: boolean;   // True if host runs ProxMox — enables pct LXC management tab
  simulatedStats?: {
    cpu: number;
    ram: number; // in GB
    disk: number; // in %
    dockerContainersCount: number;
    openPorts: number[];
  };
}

export interface CommandTemplate {
  id: string;
  name: string;
  command: string;
  description: string;
}

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  modelName: string;
  customEndpoint?: string;
}

export interface AuthorizedUser {
  email: string;
  role: 'admin' | 'viewer';
  createdAt?: string;
}

export interface TerminalLog {
  id: string;
  userId?: string;
  hostId: string;
  hostName: string;
  timestamp: string;
  command: string;
  output: string;
  isError: boolean;
}

export interface ChatMessage {
  id: string;
  userId?: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isVoice?: boolean;
  actions?: AgentAction[];
}

export interface AgentAction {
  id: string;
  type: 'ssh_exec' | 'status_check' | 'port_scan' | 'docker_ps';
  hostId: string;
  hostName: string;
  command?: string;
  output?: string;
  status: 'pending' | 'success' | 'failed';
}

// ── Docker Project Migration ────────────────────────────────────────────────

export interface DockerProject {
  name: string;
  path: string;
  configFile: string;
  status: string;
}

export interface PortMapping {
  service: string;
  hostPort: number;
  containerPort: number;
  protocol: string;
  conflictOnTarget: boolean;
  newHostPort: number;
}

export interface MigrationPreflightResult {
  targetReachable: boolean;
  targetDockerVersion: string | null;
  targetComposeVersion: string | null;
  targetDiskFreeGB: number | null;
  destPathExists: boolean;
  portMappings: PortMapping[];
  namedVolumes: string[];
  error?: string;
}

export type MigrationPhase =
  | 'transferring'
  | 'starting'
  | 'verifying'
  | 'waiting_confirm'
  | 'stopping_source'
  | 'done'
  | 'error';

export interface MigJobState {
  phase: MigrationPhase;
  progress: number;
  totalFiles: number;
  transferredFiles: number;
  log: string[];
  error?: string;
  targetContainers?: Array<{ name: string; status: string; ports: string }>;
}
