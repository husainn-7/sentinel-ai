
const API_BASE = "/api/system";

// =========================================
// APPLICATION INFORMATION
// =========================================

export interface ApplicationInformation {
  name: string;
  version: string;
  development_mode: boolean;
  deployment: string;
}

// =========================================
// SYSTEM ENVIRONMENT
// =========================================

export interface SystemInformation {
  operating_system: string;
  os_release: string;
  architecture: string;
  python_version: string;
  sqlite_version: string;
  fastapi_version: string | null;
  scikit_learn_version: string | null;
  ollama_client_version: string | null;
  python_bits: number;
}

// =========================================
// BACKEND STATUS
// =========================================

export interface BackendStatus {
  status: string;
  available: boolean;
}

// =========================================
// OLLAMA DIAGNOSTICS
// =========================================

export interface OllamaStatus {
  status: string;
  connected: boolean;
  configured_model: string;
  model_available: boolean;
  available_models: string[];
  latency_ms: number | null;
  message: string | null;
}

// =========================================
// MACHINE LEARNING DIAGNOSTICS
// =========================================

export interface MLModelStatus {
  status: string;
  model_name: string;
  filename: string;
  available: boolean;
  size_bytes: number;
  window_seconds: number;
  feature_count: number;
  features: string[];
  message: string | null;
}

// =========================================
// DATABASE DIAGNOSTICS
// =========================================

export interface DatabaseStatus {
  status: string;
  available: boolean;
  integrity: string | null;
  schema_version: number | null;
  sqlite_version: string;
  size_bytes: number;
  tables: string[];
  message: string | null;
}

// =========================================
// PRIVACY INFORMATION
// =========================================

export interface PrivacyInformation {
  local_processing: boolean;
  external_ai_api_required: boolean;
  database_encrypted: boolean;
  conversation_storage_default: boolean;
  investigation_storage_default: boolean;
  storage_mode: string;
  message: string;
}

// =========================================
// COMPLETE DIAGNOSTICS
// =========================================

export interface SystemDiagnostics {
  status: string;
  checked_at: string;
  application: ApplicationInformation;
  system: SystemInformation;

  services: {
    backend: BackendStatus;
    ollama: OllamaStatus;
    machine_learning: MLModelStatus;
    database: DatabaseStatus;
  };

  privacy: PrivacyInformation;
  diagnostics_duration_ms: number;
}

// =========================================
// API ERROR HANDLING
// =========================================

export class SystemAPIError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "SystemAPIError";
    this.status = status;
  }
}

// =========================================
// GENERIC API REQUEST
// =========================================

async function request<T>(
  endpoint: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    let message =
      `System request failed (${response.status}).`;

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Preserve the default error message.
    }

    throw new SystemAPIError(
      message,
      response.status
    );
  }

  return (await response.json()) as T;
}

// =========================================
// COMPLETE SYSTEM DIAGNOSTICS
// =========================================

export function getSystemDiagnostics(
  signal?: AbortSignal
): Promise<SystemDiagnostics> {
  return request<SystemDiagnostics>(
    "/diagnostics",
    signal
  );
}

// =========================================
// APPLICATION INFORMATION
// =========================================

export function getApplicationInformation(
  signal?: AbortSignal
): Promise<ApplicationInformation> {
  return request<ApplicationInformation>(
    "/application",
    signal
  );
}

// =========================================
// SYSTEM ENVIRONMENT
// =========================================

export function getSystemInformation(
  signal?: AbortSignal
): Promise<SystemInformation> {
  return request<SystemInformation>(
    "/environment",
    signal
  );
}

// =========================================
// OLLAMA STATUS
// =========================================

export function getOllamaStatus(
  signal?: AbortSignal
): Promise<OllamaStatus> {
  return request<OllamaStatus>(
    "/ollama",
    signal
  );
}

// =========================================
// MACHINE LEARNING STATUS
// =========================================

export function getMLModelStatus(
  signal?: AbortSignal
): Promise<MLModelStatus> {
  return request<MLModelStatus>(
    "/model",
    signal
  );
}

// =========================================
// DATABASE STATUS
// =========================================

export function getDatabaseStatus(
  signal?: AbortSignal
): Promise<DatabaseStatus> {
  return request<DatabaseStatus>(
    "/database",
    signal
  );
}

// =========================================
// PRIVACY INFORMATION
// =========================================

export function getPrivacyInformation(
  signal?: AbortSignal
): Promise<PrivacyInformation> {
  return request<PrivacyInformation>(
    "/privacy",
    signal
  );
}

// =========================================
// FORMATTING UTILITIES
// =========================================

export function formatBytes(
  bytes: number
): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unavailable";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KiB",
    "MiB",
    "GiB",
    "TiB",
  ];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function formatLatency(
  milliseconds: number | null
): string {
  if (
    milliseconds === null ||
    !Number.isFinite(milliseconds) ||
    milliseconds < 0
  ) {
    return "Unavailable";
  }

  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }

  return `${milliseconds.toFixed(2)} ms`;
}

export function formatTimestamp(
  timestamp: string
): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString();
}
