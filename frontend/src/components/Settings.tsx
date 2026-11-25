
import { useEffect, useState } from "react";
import "./Settings.css";

import {
  Settings as SettingsIcon,
  Activity,
  Server,
  Brain,
  Database,
  Shield,
  Monitor,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Cpu,
  Lock,
  Info,
} from "lucide-react";

import {
  getSystemDiagnostics,
  formatBytes,
  formatLatency,
  formatTimestamp,
} from "../services/system";

import type {
  SystemDiagnostics,
} from "../services/system";


// =========================================
// HELPER COMPONENTS
// =========================================

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const healthy =
    status === "healthy" ||
    status === "available";

  const degraded = status === "degraded";

  return (
    <span
      className={`settings-status-badge ${
        healthy
          ? "settings-status-healthy"
          : degraded
          ? "settings-status-degraded"
          : "settings-status-unavailable"
      }`}
    >
      <span className="settings-status-dot" />

      {status.charAt(0).toUpperCase() +
        status.slice(1)}
    </span>
  );
}


function InformationRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="settings-information-row">
      <span>{label}</span>

      <strong>
        {value === null ? "Unavailable" : value}
      </strong>
    </div>
  );
}


function BooleanValue({
  value,
  trueLabel = "Enabled",
  falseLabel = "Disabled",
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <span className="settings-boolean-value">
      {value ? trueLabel : falseLabel}
    </span>
  );
}


// =========================================
// MAIN SETTINGS COMPONENT
// =========================================

export default function Settings() {
  const [diagnostics, setDiagnostics] =
    useState<SystemDiagnostics | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshVersion, setRefreshVersion] =
    useState(0);


  // =========================================
  // LOAD SYSTEM DIAGNOSTICS
  // =========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadDiagnostics() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getSystemDiagnostics(
          controller.signal
        );

        if (!controller.signal.aborted) {
          setDiagnostics(result);
        }

      } catch (exception) {
        if (!controller.signal.aborted) {
          setError(
            exception instanceof Error
              ? exception.message
              : "Unable to retrieve system diagnostics."
          );
        }

      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDiagnostics();

    return () => {
      controller.abort();
    };

  }, [refreshVersion]);


  // =========================================
  // REFRESH SYSTEM STATUS
  // =========================================

  function refreshDiagnostics() {
    if (isLoading) {
      return;
    }

    setRefreshVersion(
      previous => previous + 1
    );
  }


  const services = diagnostics?.services;

  const healthyServices = services
    ? [
        services.backend.status === "healthy",
        services.ollama.status === "healthy",
        services.machine_learning.available,
        services.database.status === "healthy",
      ].filter(Boolean).length
    : 0;


  // =========================================
  // SETTINGS INTERFACE
  // =========================================

  return (
    <div className="settings-workspace">

      {/* PAGE HEADER */}

      <div className="settings-heading">

        <div>
          <div className="settings-eyebrow">
            <SettingsIcon size={14} />

            SYSTEM MANAGEMENT
          </div>

          <h1>Settings</h1>

          <p>
            Monitor system health, local AI services,
            machine learning models and data storage.
          </p>
        </div>

        <button
          type="button"
          className="settings-refresh-button"
          onClick={refreshDiagnostics}
          disabled={isLoading}
        >
          <RefreshCw
            size={16}
            className={
              isLoading
                ? "settings-spinning"
                : ""
            }
          />

          {isLoading
            ? "Checking system..."
            : "Refresh diagnostics"}
        </button>

      </div>


      {/* ERROR MESSAGE */}

      {error && (
        <div
          className="settings-error"
          role="alert"
        >
          <AlertCircle size={20} />

          <div>
            <strong>
              System diagnostics unavailable
            </strong>

            <p>{error}</p>

            <p>
              {diagnostics
                ? "Previously retrieved information is displayed below and may be outdated."
                : "Ensure the Sentinel AI backend is running."}
            </p>
          </div>
        </div>
      )}


      {/* INITIAL LOADING STATE */}

      {isLoading && !diagnostics && (
        <div className="settings-loading">
          <Loader2
            size={30}
            className="settings-spinning"
          />

          <h3>Checking Sentinel AI services</h3>

          <p>
            Retrieving application, model and
            database information.
          </p>
        </div>
      )}


      {diagnostics && services && (
        <>

          {/* SYSTEM OVERVIEW */}

          <section
            className="settings-overview"
            aria-busy={isLoading}
          >
            <div className="settings-overview-main">

              <div
                className={`settings-health-icon ${
                  error || isLoading
                    ? "settings-health-warning"
                    : diagnostics.status === "healthy"
                    ? "settings-health-good"
                    : "settings-health-warning"
                }`}
              >
                {diagnostics.status === "healthy" &&
                 !error &&
                 !isLoading
                  ? <CheckCircle size={30} />
                  : <AlertCircle size={30} />}
              </div>

              <div>
                <span className="settings-overview-label">
                  OVERALL SYSTEM STATUS
                </span>

                <h2>
                  {isLoading
                    ? "Refreshing diagnostics"
                    : error
                    ? "Diagnostics outdated"
                    : diagnostics.status === "healthy"
                    ? "All services operational"
                    : "Some services require attention"}
                </h2>

                <p>
                  {healthyServices} of 4 services
                  passed the latest availability checks.
                </p>
              </div>

            </div>

            <div className="settings-overview-meta">

              <InformationRow
                label="Last checked"
                value={formatTimestamp(
                  diagnostics.checked_at
                )}
              />

              <InformationRow
                label="Diagnostic duration"
                value={formatLatency(
                  diagnostics.diagnostics_duration_ms
                )}
              />

            </div>
          </section>


          {/* SERVICE STATUS CARDS */}

          <div className="settings-section-heading">
            <Activity size={19} />

            <h2>Service health</h2>
          </div>

          <div className="settings-service-grid">

            {/* BACKEND */}

            <div className="settings-service-card">

              <div className="settings-card-header">

                <div className="settings-card-icon">
                  <Server size={22} />
                </div>

                <StatusBadge
                  status={services.backend.status}
                />

              </div>

              <h3>FastAPI backend</h3>

              <p>Core application and REST API</p>

              <div className="settings-card-details">

                <InformationRow
                  label="Framework"
                  value="FastAPI"
                />

                <InformationRow
                  label="Version"
                  value={
                    diagnostics.system.fastapi_version
                  }
                />

                <InformationRow
                  label="Availability"
                  value={
                    services.backend.available
                      ? "Operational"
                      : "Unavailable"
                  }
                />

              </div>

            </div>


            {/* OLLAMA */}

            <div className="settings-service-card">

              <div className="settings-card-header">

                <div className="settings-card-icon">
                  <Brain size={22} />
                </div>

                <StatusBadge
                  status={services.ollama.status}
                />

              </div>

              <h3>Local AI service</h3>

              <p>Ollama language model runtime</p>

              <div className="settings-card-details">

                <InformationRow
                  label="Connection"
                  value={
                    services.ollama.connected
                      ? "Connected"
                      : "Disconnected"
                  }
                />

                <InformationRow
                  label="Configured model"
                  value={
                    services.ollama.configured_model
                  }
                />

                <InformationRow
                  label="Model installed"
                  value={
                    services.ollama.model_available
                      ? "Yes"
                      : "No"
                  }
                />

                <InformationRow
                  label="Response latency"
                  value={formatLatency(
                    services.ollama.latency_ms
                  )}
                />

              </div>

              {services.ollama.message && (
                <div className="settings-card-note">
                  {services.ollama.message}
                </div>
              )}

            </div>


            {/* MACHINE LEARNING */}

            <div className="settings-service-card">

              <div className="settings-card-header">

                <div className="settings-card-icon">
                  <Cpu size={22} />
                </div>

                <StatusBadge
                  status={
                    services.machine_learning.status
                  }
                />

              </div>

              <h3>Machine learning engine</h3>

              <p>Authentication anomaly detection</p>

              <div className="settings-card-details">

                <InformationRow
                  label="Algorithm"
                  value={
                    services.machine_learning.model_name
                  }
                />

                <InformationRow
                  label="Model size"
                  value={formatBytes(
                    services.machine_learning.size_bytes
                  )}
                />

                <InformationRow
                  label="Feature count"
                  value={
                    services.machine_learning.feature_count
                  }
                />

                <InformationRow
                  label="Analysis window"
                  value={
                    `${services.machine_learning.window_seconds} seconds`
                  }
                />

              </div>

              <div className="settings-card-note">
                Checks model file availability,
                not inference correctness.
              </div>

            </div>


            {/* DATABASE */}

            <div className="settings-service-card">

              <div className="settings-card-header">

                <div className="settings-card-icon">
                  <Database size={22} />
                </div>

                <StatusBadge
                  status={services.database.status}
                />

              </div>

              <h3>Persistent storage</h3>

              <p>Local SQLite intelligence database</p>

              <div className="settings-card-details">

                <InformationRow
                  label="Database size"
                  value={formatBytes(
                    services.database.size_bytes
                  )}
                />

                <InformationRow
                  label="Integrity"
                  value={
                    services.database.integrity === "ok"
                      ? "Passed"
                      : services.database.integrity
                  }
                />

                <InformationRow
                  label="Schema version"
                  value={
                    services.database.schema_version
                  }
                />

                <InformationRow
                  label="Database tables"
                  value={
                    services.database.tables.length
                  }
                />

              </div>

              {services.database.message && (
                <div className="settings-card-note">
                  {services.database.message}
                </div>
              )}

            </div>

          </div>


          {/* INSTALLED AI MODELS */}

          <div className="settings-section-heading">
            <Brain size={19} />

            <h2>Installed AI models</h2>
          </div>

          <section className="settings-panel">

            <div className="settings-panel-heading">

              <div>
                <h3>Ollama model library</h3>

                <p>
                  Language models reported by the
                  local Ollama service.
                </p>
              </div>

              <span className="settings-count-label">
                {services.ollama.available_models.length}
                {" models"}
              </span>

            </div>

            {services.ollama.available_models.length > 0
              ? (
                <div className="settings-model-list">

                  {services.ollama.available_models.map(
                    (model, index) => (

                    <div
                      className="settings-model-item"
                      key={`${model}-${index}`}
                    >
                      <Brain size={20} />

                      <div className="settings-model-name">
                        <strong>{model}</strong>

                        <span>Local language model</span>
                      </div>

                      {model ===
                        services.ollama.configured_model
                        ? (
                          <span className="settings-active-model">
                            Configured
                          </span>
                        )
                        : (
                          <span className="settings-installed-model">
                            Installed
                          </span>
                        )}
                    </div>

                  ))}

                </div>
              )
              : (
                <div className="settings-empty">
                  No installed models reported.
                  Check the Ollama connection.
                </div>
              )}

          </section>


          {/* ML FEATURE INFORMATION */}

          <section className="settings-panel">

            <div className="settings-panel-heading">
              <div>
                <h3>ML model configuration</h3>

                <p>
                  Authentication features used by
                  the anomaly detection engine.
                </p>
              </div>
            </div>

            <InformationRow
              label="Model file"
              value={
                services.machine_learning.filename
              }
            />

            <div className="settings-feature-list">

              {services.machine_learning.features.map(
                feature => (
                  <span
                    key={feature}
                    className="settings-feature-tag"
                  >
                    {feature.replace(/_/g, " ")}
                  </span>
                )
              )}

            </div>

          </section>


          {/* SYSTEM INFORMATION */}

          <div className="settings-section-heading">
            <Monitor size={19} />

            <h2>System information</h2>
          </div>

          <div className="settings-information-grid">

            <section className="settings-panel">

              <div className="settings-panel-heading">
                <div>
                  <h3>Application</h3>

                  <p>Sentinel AI configuration</p>
                </div>
              </div>

              <InformationRow
                label="Application"
                value={
                  diagnostics.application.name
                }
              />

              <InformationRow
                label="Version"
                value={
                  diagnostics.application.version
                }
              />

              <InformationRow
                label="Deployment"
                value={
                  diagnostics.application.deployment
                }
              />

              <InformationRow
                label="Development mode"
                value={
                  diagnostics.application.development_mode
                    ? "Enabled"
                    : "Disabled"
                }
              />

            </section>

            <section className="settings-panel">

              <div className="settings-panel-heading">
                <div>
                  <h3>Runtime environment</h3>

                  <p>Local system specifications</p>
                </div>
              </div>

              <InformationRow
                label="Operating system"
                value={
                  `${diagnostics.system.operating_system} ${diagnostics.system.os_release}`
                }
              />

              <InformationRow
                label="Architecture"
                value={
                  diagnostics.system.architecture
                }
              />

              <InformationRow
                label="Python"
                value={
                  diagnostics.system.python_version
                }
              />

              <InformationRow
                label="Python architecture"
                value={
                  `${diagnostics.system.python_bits}-bit`
                }
              />

              <InformationRow
                label="SQLite"
                value={
                  diagnostics.system.sqlite_version
                }
              />

              <InformationRow
                label="Scikit-learn"
                value={
                  diagnostics.system.scikit_learn_version
                }
              />

              <InformationRow
                label="Ollama client"
                value={
                  diagnostics.system.ollama_client_version
                }
              />

            </section>

          </div>


          {/* DATABASE STRUCTURE */}

          <section className="settings-panel">

            <div className="settings-panel-heading">
              <div>
                <h3>Database structure</h3>

                <p>
                  Available persistent storage tables.
                </p>
              </div>
            </div>

            <div className="settings-table-list">

              {services.database.tables.map(table => (
                <div
                  className="settings-table-item"
                  key={table}
                >
                  <Database size={17} />

                  <span>{table}</span>
                </div>
              ))}

              {services.database.tables.length === 0 && (
                <div className="settings-empty">
                  No database tables reported.
                </div>
              )}

            </div>

          </section>


          {/* PRIVACY SETTINGS */}

          <div className="settings-section-heading">
            <Shield size={19} />

            <h2>Privacy and data storage</h2>
          </div>

          <section className="settings-panel">

            <div className="settings-panel-heading">

              <div>
                <h3>Privacy configuration</h3>

                <p>
                  Current storage defaults and
                  local processing information.
                </p>
              </div>

              <Lock size={22} />

            </div>

            <div className="settings-privacy-row">
              <div>
                <strong>Local processing</strong>

                <p>
                  Analysis and AI generation are
                  designed to run locally.
                </p>
              </div>

              <BooleanValue
                value={
                  diagnostics.privacy.local_processing
                }
              />
            </div>

            <div className="settings-privacy-row">
              <div>
                <strong>External AI API</strong>

                <p>
                  No paid external AI API is required.
                </p>
              </div>

              <BooleanValue
                value={
                  diagnostics.privacy.external_ai_api_required
                }
                trueLabel="Required"
                falseLabel="Not required"
              />
            </div>

            <div className="settings-privacy-row">
              <div>
                <strong>Conversation storage default</strong>

                <p>
                  New conversations require opt-in
                  to persistent storage.
                </p>
              </div>

              <BooleanValue
                value={
                  diagnostics.privacy.conversation_storage_default
                }
              />
            </div>

            <div className="settings-privacy-row">
              <div>
                <strong>Investigation storage default</strong>

                <p>
                  Saving investigation results
                  requires explicit selection.
                </p>
              </div>

              <BooleanValue
                value={
                  diagnostics.privacy.investigation_storage_default
                }
              />
            </div>

            <div className="settings-privacy-row">
              <div>
                <strong>Storage mode</strong>

                <p>
                  Persistent storage policy.
                </p>
              </div>

              <span className="settings-boolean-value">
                {diagnostics.privacy.storage_mode}
              </span>
            </div>

            <div className="settings-privacy-row">
              <div>
                <strong>Database encryption</strong>

                <p>
                  Encryption at rest for saved records.
                </p>
              </div>

              <BooleanValue
                value={
                  diagnostics.privacy.database_encrypted
                }
                trueLabel="Encrypted"
                falseLabel="Not encrypted"
              />
            </div>

            {!diagnostics.privacy.database_encrypted && (
              <div className="settings-privacy-warning">

                <AlertCircle size={20} />

                <div>
                  <strong>
                    Local storage security notice
                  </strong>

                  <p>
                    {diagnostics.privacy.message}
                  </p>

                  <p>
                    Anyone with sufficient access to
                    the database file may be able to
                    read saved records. Deleting records
                    is not guaranteed to securely erase
                    their underlying data.
                  </p>
                </div>

              </div>
            )}

          </section>


          {/* FOOTER */}

          <div className="settings-footer">
            <Info size={17} />

            <p>
              Diagnostics verify service availability
              and configuration. They do not guarantee
              successful AI generation, model inference
              or complete system security.
              Privacy preferences shown here are
              informational. Storage can be selected
              within the Assistant and investigation
              workspaces.
            </p>
          </div>

        </>
      )}

    </div>
  );
}
