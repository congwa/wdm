// ============================================================
// Windsurf Data Manager — TypeScript Types
// ============================================================

// --- Dashboard ---
export interface DiskCategory {
  name: string
  size: number
  color: string
}

export interface ProjectIndex {
  name: string
  fileCount: number
  commitCount: number
  size: number
}

export interface ActivityItem {
  id: string
  type: 'scan' | 'clean' | 'install' | 'chat' | 'index'
  title: string
  time: string
}

// --- Embedding Database ---
export interface IndexedFile {
  absolutePath: string
  lastAccessTime: string
  corpusName: string
  corpusRelativePath: string
}

export interface IndexedCommit {
  repoName: string
  hexsha: string
  message: string
}

export interface ContextItem {
  id: number
  nodeUri: string
  nodeName: string
  codeContextType: string
  versionedFileId: number
}

export interface EmbeddingStats {
  fileCount: number
  versionedFileCount: number
  contextItemCount: number
  snippetCount: number
  embeddingCount: number
  commitCount: number
  commitIntentCount: number
  dbSize: number
  freePages: number
  totalPages: number
}

// --- Code Tracker ---
export interface TrackedVersion {
  hash: string
  date: string
  files: string[]
  size: number
}

export interface TrackedProject {
  name: string
  source: 'legacy' | 'windsurf'
  versions: TrackedVersion[]
  totalSize: number
}

export interface SensitiveFile {
  path: string
  project: string
  type: 'env' | 'credential' | 'key' | 'token'
}

// --- Chat History (legacy) ---
export interface ChatSession {
  id: string
  project: string
  filePath: string
  size: number
  lastModified: string
  encrypted: boolean
}

export interface ParsedChatContent {
  relatedFiles: string[]
  codeSnippets: { code: string; file?: string }[]
  rawStrings: string[]
}

// --- Cascade API (encrypted chat via gRPC) ---
export interface LanguageServerInfo {
  port: number
  csrf_token: string
  pid: number
  workspace_id: string
}

export interface CascadeSummary {
  cascade_id: string
  summary: string
  step_count: number
  created_time: string
  last_modified_time: string
  status: string
  errored: boolean
  model: string
  workspace_names: string[]
  referenced_files: string[]
}

export interface CascadeStep {
  step_type: string
  status: string
  created_at: string
  content: string
  tool_name: string | null
  file_uri: string | null
  command: string | null
}

export interface CascadeDetail {
  cascade_id: string
  trajectory_id: string
  steps: CascadeStep[]
  raw_size: number
}

// --- Account ---
export interface PlanInfo {
  name: string
  startTimestamp: number
  endTimestamp: number
  usage: {
    messages: number
    usedMessages: number
    flowActions: number
    usedFlowActions: number
    flexCredits: number
    usedFlexCredits: number
  }
}

export interface ModelInfo {
  name: string
  id: string
  provider: string
  tokenizer: string
}

export interface IdentityInfo {
  machineId: string
  deviceId: string
  installationId: string
  firstSession: string
  lastSession: string
}

// --- Extensions ---
export interface ExtensionInfo {
  id: string
  version: string
  publisher: string
  source: 'gallery' | 'vsix'
  installedAt: number
  size: number
  disabled: boolean
  path: string
}

// --- Workspaces ---
export interface WorkspaceInfo {
  id: string
  folderUri: string
  folderName: string
  profile: string
  pathExists: boolean
  stateKeys: string[]
}

// --- Privacy ---
export interface RiskItem {
  id: string
  level: 'high' | 'medium' | 'low'
  title: string
  location: string
  preview?: string
  actions: ('mask' | 'delete' | 'view')[]
}

// --- Cleanup ---
export interface CleanupItem {
  key: string
  label: string
  size: number
  riskLevel: 'safe' | 'warning' | 'danger'
  description: string
}

export interface CleaningStep {
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  freedSize?: number
  error?: string
}
