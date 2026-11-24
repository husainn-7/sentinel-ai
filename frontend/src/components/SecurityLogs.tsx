
import { useState, useRef, useEffect } from 'react'

import {
  Shield,
  ShieldAlert,
  Terminal,
  FileText,
  Sparkles,
  RotateCcw,
  ArrowUpRight,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Activity,
  Globe,
  Clock,
  Users,
  Lock,
  Database,
} from 'lucide-react'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type {
  InvestigationStorageMetadata,
} from '../services/history'

import './SecurityLogs.css'


// =========================================
// TYPES
// =========================================

interface LogSummary {
  total_events: number
  unique_ips: number
  failed_logins: number
  successful_logins: number
  suspicious_ips: string[]
  rapid_failure_alerts: number
}

interface IPAnalysis {
  ip_address: string
  failed_attempts: number
  successful_attempts: number
  total_attempts: number
  usernames: string[]
  risk_level: string
  possible_brute_force: boolean
}

interface TimeWindowAlert {
  ip_address: string
  failed_attempts: number
  duration_seconds: number
  window_seconds: number
  alert: string
}

interface LogAnalysis {
  overall_risk: string
  summary: LogSummary
  ip_analysis: IPAnalysis[]
  time_window_alerts: TimeWindowAlert[]
}

interface AnalysisResponse
  extends InvestigationStorageMetadata {

  status: string
  analysis: LogAnalysis
  ai_report: string | null

}


// =========================================
// CONFIGURATION
// =========================================

const MAX_LOG_LENGTH = 100000

const MAX_TITLE_LENGTH = 120

const SAMPLE_LOGS = [

  ...Array.from(
    { length: 12 },
    (_, index) =>
      `Nov 24 10:00:${String(index * 2).padStart(2, '0')} server sshd[${1000 + index}]: Failed password for invalid user admin from 192.0.2.10 port ${50100 + index} ssh2`
  ),

  ...Array.from(
    { length: 6 },
    (_, index) =>
      `Nov 24 10:01:${String(index * 3).padStart(2, '0')} server sshd[${2000 + index}]: Failed password for root from 198.51.100.20 port ${50200 + index} ssh2`
  ),

  ...Array.from(
    { length: 3 },
    (_, index) =>
      `Nov 24 10:02:${String(index * 5).padStart(2, '0')} server sshd[${3000 + index}]: Accepted password for developer from 203.0.113.30 port ${50300 + index} ssh2`
  ),

].join('\n')


// =========================================
// RISK CLASSIFICATION
// =========================================

function getRiskColor(level: string) {

  switch (level.toLowerCase()) {

    case 'critical':
      return '#f87171'

    case 'high':
      return '#fb923c'

    case 'medium':
      return '#facc15'

    case 'low':
      return '#4ade80'

    default:
      return '#9299aa'

  }

}


function RiskLabel({
  level,
}: {
  level: string
}) {

  const color = getRiskColor(level)

  return (

    <span
      className="logs-risk-label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        color,
        border: `1px solid ${color}40`,
        backgroundColor: `${color}12`,
      }}
    >

      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />

      {level}

    </span>

  )

}


// =========================================
// SECURITY LOG COMPONENT
// =========================================

function SecurityLogs() {

  const [logs, setLogs] = useState('')

  const [includeAI, setIncludeAI] =
    useState(false)

  const [saveHistory, setSaveHistory] =
    useState(false)

  const [title, setTitle] =
    useState('')

  const [isAnalyzing, setIsAnalyzing] =
    useState(false)

  const [result, setResult] =
    useState<AnalysisResponse | null>(null)

  const [error, setError] =
    useState('')

  const abortRef =
    useRef<AbortController | null>(null)

  const resultRef =
    useRef<HTMLDivElement>(null)


  // =========================================
  // REQUEST CLEANUP
  // =========================================

  useEffect(() => {

    return () => {

      abortRef.current?.abort()

    }

  }, [])


  // =========================================
  // SCROLL TO RESULTS
  // =========================================

  useEffect(() => {

    if (result) {

      resultRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })

    }

  }, [result])


  // =========================================
  // BACKEND COMMUNICATION
  // =========================================

  async function analyzeLogs() {

    const content = logs.trim()

    if (
      !content ||
      isAnalyzing ||
      abortRef.current
    ) {

      return

    }

    if (content.length > MAX_LOG_LENGTH) {

      setError(
        'Log content must not exceed 100,000 characters.'
      )

      return

    }

    if (title.trim().length > MAX_TITLE_LENGTH) {

      setError(
        'Investigation title must not exceed 120 characters.'
      )

      return

    }

    const shouldSave = saveHistory

    setError('')
    setResult(null)
    setIsAnalyzing(true)

    const controller = new AbortController()

    abortRef.current = controller

    try {

      const response = await fetch(
        '/api/logs',
        {

          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({

            log_text: content,

            include_ai_report: includeAI,

            save_history: shouldSave,

            title:
              shouldSave && title.trim()
                ? title.trim()
                : null,

          }),

          signal: controller.signal,

        }
      )

      if (!response.ok) {

        let detail =
          `Log analysis failed (${response.status}).`

        try {

          const body = await response.json()

          if (typeof body.detail === 'string') {

            detail = body.detail

          }

        } catch {

          // Preserve fallback error.

        }

        throw new Error(detail)

      }

      const data: AnalysisResponse =
        await response.json()

      if (
        shouldSave &&
        !data.history_saved &&
        !data.storage_warning
      ) {

        data.storage_warning =
          'Analysis completed, but saving was not confirmed.'

      }

      if (!controller.signal.aborted) {

        setResult(data)

      }

    } catch (exception) {

      if (controller.signal.aborted) {

        setError(

          shouldSave

            ? 'Analysis cancelled. Saving was not confirmed. Check History before retrying.'

            : 'Analysis cancelled.'

        )

      } else {

        setError(

          exception instanceof Error

            ? exception.message

            : 'Unable to connect to Sentinel AI.'

        )

      }

    } finally {

      if (abortRef.current === controller) {

        abortRef.current = null

      }

      setIsAnalyzing(false)

    }

  }


  // =========================================
  // USER CONTROLS
  // =========================================

  function loadSample() {

    if (isAnalyzing) return

    setLogs(SAMPLE_LOGS)
    setResult(null)
    setError('')
    setTitle('')

  }


  function resetAnalysis() {

    if (isAnalyzing) return

    setLogs('')
    setResult(null)
    setError('')
    setTitle('')
    setSaveHistory(false)

  }


  function cancelAnalysis() {

    abortRef.current?.abort()

  }


  // =========================================
  // ANALYSIS STATISTICS
  // =========================================

  const analysis = result?.analysis

  const summary = analysis?.summary

  const sortedIPs = analysis

    ? [...analysis.ip_analysis].sort(
        (a, b) =>
          b.failed_attempts - a.failed_attempts
      )

    : []


  const chartData = sortedIPs.slice(0, 10).map(

    (item) => ({

      ip: item.ip_address,

      Failed: item.failed_attempts,

      Successful: item.successful_attempts,

    })

  )


  const metrics = summary

    ? [

        {
          title: 'Total events',
          value: summary.total_events,
          icon: Activity,
          color: '#eef0f6',
        },

        {
          title: 'Failed logins',
          value: summary.failed_logins,
          icon: ShieldAlert,
          color: '#f87171',
        },

        {
          title: 'Successful logins',
          value: summary.successful_logins,
          icon: CheckCircle,
          color: '#4ade80',
        },

        {
          title: 'Unique IP addresses',
          value: summary.unique_ips,
          icon: Globe,
          color: '#b9c9ff',
        },

        {
          title: 'Suspicious IPs',
          value: summary.suspicious_ips.length,
          icon: AlertTriangle,
          color: '#fb923c',
        },

        {
          title: 'Rapid-failure alerts',
          value: summary.rapid_failure_alerts,
          icon: Clock,
          color: '#f87171',
        },

      ]

    : []


  // =========================================
  // USER INTERFACE
  // =========================================

  return (

    <div className="logs-workspace">


      {/* PAGE HEADER */}

      <section className="logs-heading">

        <div className="eyebrow">

          THREAT INTELLIGENCE / AUTHENTICATION SECURITY

        </div>

        <h1>
          Security logs<span>.</span>
        </h1>

        <p>

          Investigate SSH authentication events,
          identify suspicious IP addresses and
          detect potential brute-force activity.

        </p>

        <div className="logs-engine-label">

          <Shield size={14} />

          Rule-based detection

          <span className="small-divider" />

          Sliding-window analysis

        </div>

      </section>


      {/* LOG INVESTIGATION INPUT */}

      <section className="logs-input-panel">

        <div className="logs-panel-header">

          <div className="logs-panel-title">

            <div className="logs-panel-icon">
              <Terminal size={21} />
            </div>

            <div>

              <h2>Log investigation</h2>

              <p>
                Paste Linux SSH authentication logs.
              </p>

            </div>

          </div>

          <button
            type="button"
            className="logs-secondary-button"
            onClick={loadSample}
            disabled={isAnalyzing}
          >

            <FileText size={15} />

            Load sample

          </button>

        </div>


        <form
          onSubmit={(event) => {

            event.preventDefault()

            void analyzeLogs()

          }}
        >

          <textarea
            className="logs-textarea"
            value={logs}
            disabled={isAnalyzing}
            maxLength={MAX_LOG_LENGTH}
            aria-label="SSH authentication logs"
            placeholder="Paste SSH authentication logs here..."
            spellCheck={false}
            onChange={(event) => {

              setLogs(event.target.value)
              setResult(null)
              setError('')

            }}
          />


          <div className="logs-character-count">

            {logs.length.toLocaleString()}

            {' / '}

            {MAX_LOG_LENGTH.toLocaleString()}

            {' '}characters

          </div>


          {/* PERSISTENT INVESTIGATION CONTROLS */}

          <div
            style={{
              margin: '16px 0',
              padding: '16px',
              border: '1px solid #303541',
              borderRadius: '10px',
              background: '#0d1017',
            }}
          >

            <label
              className="logs-ai-option"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >

              <input
                type="checkbox"
                checked={saveHistory}
                disabled={isAnalyzing}
                onChange={(event) => {

                  setSaveHistory(
                    event.target.checked
                  )

                  if (!event.target.checked) {

                    setTitle('')

                  }

                }}
              />

              <Database size={17} />

              <div>

                <strong>
                  Save investigation
                </strong>

                <span>
                  Optional · Local SQLite storage
                </span>

              </div>

            </label>


            {saveHistory && (

              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >

                <label
                  htmlFor="logs-investigation-title"
                  style={{
                    fontSize: '12px',
                    color: '#b0b7c6',
                    fontWeight: 500,
                  }}
                >

                  Investigation title (optional)

                </label>

                <input
                  id="logs-investigation-title"
                  type="text"
                  value={title}
                  disabled={isAnalyzing}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="e.g. SSH authentication incident"
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#090b10',
                    border: '1px solid #303541',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '11px',
                    color: '#9299aa',
                  }}
                >

                  <span>
                    Leave blank to use the default title.
                  </span>

                  <span>
                    {title.length}/{MAX_TITLE_LENGTH}
                  </span>

                </div>


                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginTop: '6px',
                    fontSize: '11px',
                    lineHeight: '1.6',
                    color: '#9299aa',
                  }}
                >

                  <Lock
                    size={14}
                    style={{ flexShrink: 0 }}
                  />

                  <span>

                    Structured findings and optional
                    AI reports will be stored locally
                    in unencrypted SQLite. Findings
                    may contain sensitive IP addresses
                    and usernames.

                  </span>

                </div>

              </div>

            )}

          </div>


          <div className="logs-input-footer">

            <label className="logs-ai-option">

              <input
                type="checkbox"
                checked={includeAI}
                disabled={isAnalyzing}
                onChange={(event) =>
                  setIncludeAI(event.target.checked)
                }
              />

              <Sparkles size={16} />

              <div>

                <strong>
                  Include AI-generated report
                </strong>

                <span>
                  Optional · Additional processing time
                </span>

              </div>

            </label>


            <div className="logs-actions">

              <button
                type="button"
                className="logs-secondary-button"
                onClick={resetAnalysis}
                disabled={
                  isAnalyzing ||
                  (
                    !logs &&
                    !title &&
                    !saveHistory
                  )
                }
              >

                <RotateCcw size={15} />

                Reset

              </button>


              {isAnalyzing ? (

                <button
                  type="button"
                  className="logs-secondary-button"
                  onClick={cancelAnalysis}
                >

                  Cancel

                </button>

              ) : (

                <button
                  type="submit"
                  className="logs-primary-button"
                  disabled={!logs.trim()}
                >

                  <Activity size={17} />

                  Analyse logs

                  <ArrowUpRight size={14} />

                </button>

              )}

            </div>

          </div>

        </form>

      </section>


      {/* ERROR STATE */}

      {error && (

        <div
          className="logs-error"
          role="alert"
        >

          <AlertCircle size={18} />

          <span>{error}</span>

        </div>

      )}


      {/* LOADING STATE */}

      {isAnalyzing && (

        <section
          className="logs-loading-panel"
          role="status"
        >

          <Loader2
            size={30}
            className="logs-spinner"
          />

          <h2>
            Investigating authentication events
          </h2>

          <p>

            {includeAI

              ? 'Analysing logs and generating an AI report...'

              : 'Evaluating authentication activity...'

            }

          </p>

          {saveHistory && (

            <p>

              Completed results will be submitted
              to local history.

            </p>

          )}

        </section>

      )}


      {/* EMPTY STATE */}

      {!result && !isAnalyzing && (

        <section className="logs-empty-state">

          <div className="logs-empty-icon">

            <Terminal size={32} strokeWidth={1.5} />

          </div>

          <h2>No investigation results yet</h2>

          <p>

            Submit authentication logs to view event
            statistics, IP intelligence and security alerts.

          </p>

        </section>

      )}


      {/* INVALID LOG RESULTS */}

      {result?.status === 'no_valid_events' && (

        <section className="logs-result-card logs-no-events">

          <AlertCircle size={24} />

          <div>

            <h2>No valid authentication events</h2>

            <p>

              Sentinel could not identify supported SSH
              authentication events in the submitted content.
              Check the log format and try again.

            </p>

            {result.storage_warning && (

              <p style={{ color: '#fbbf24' }}>

                {result.storage_warning}

              </p>

            )}

          </div>

        </section>

      )}


      {/* ANALYSIS RESULTS */}

      {analysis &&
        summary &&
        summary.total_events > 0 &&
        result && (

        <div
          className="logs-results"
          ref={resultRef}
        >

          <div className="logs-results-header">

            <div>

              <div className="eyebrow">

                INVESTIGATION RESULTS

              </div>

              <h2>Authentication assessment</h2>

            </div>

            <div className="logs-complete-label">

              <CheckCircle size={15} />

              Analysis complete

            </div>

          </div>


          {/* STORAGE CONFIRMATION */}

          {result.history_saved &&
            result.investigation_id && (

            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                background: 'rgba(74, 222, 128, 0.06)',
                border: '1px solid rgba(74, 222, 128, 0.22)',
                borderRadius: '10px',
                color: '#4ade80',
              }}
            >

              <CheckCircle
                size={19}
                style={{ flexShrink: 0 }}
              />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  minWidth: 0,
                }}
              >

                <strong
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >

                  Saved to local history

                </strong>

                <span
                  style={{
                    fontSize: '12px',
                    color: '#9299aa',
                    lineHeight: '1.6',
                  }}
                >

                  Authentication investigation results
                  are stored in the local SQLite database.

                </span>

                <span
                  style={{
                    fontSize: '10px',
                    color: '#737b8c',
                    overflowWrap: 'anywhere',
                  }}
                >

                  ID: {result.investigation_id}

                </span>

              </div>

            </div>

          )}


          {/* STORAGE WARNING */}

          {result.storage_warning && (

            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                background: 'rgba(245, 158, 11, 0.07)',
                border: '1px solid rgba(245, 158, 11, 0.22)',
                borderRadius: '10px',
                color: '#fbbf24',
              }}
            >

              <AlertCircle
                size={18}
                style={{ flexShrink: 0 }}
              />

              <div>

                <strong
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >

                  Storage warning

                </strong>

                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '12px',
                    lineHeight: '1.6',
                  }}
                >

                  {result.storage_warning}

                </p>

              </div>

            </div>

          )}


          {/* TEMPORARY INVESTIGATION */}

          {result.history_saved === undefined &&
            !result.storage_warning && (

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '12px 14px',
                background: '#10131b',
                border: '1px solid #252933',
                borderRadius: '9px',
                color: '#9299aa',
                fontSize: '12px',
              }}
            >

              <Shield size={15} />

              Temporary investigation · Not saved to history

            </div>

          )}


          {/* OVERALL RISK */}

          <section className="logs-overall-risk">

            <div className="logs-overall-icon">

              <ShieldAlert
                size={28}
                color={getRiskColor(
                  analysis.overall_risk
                )}
              />

            </div>

            <div>

              <div className="eyebrow">

                OVERALL RISK CLASSIFICATION

              </div>

              <h2>

                {analysis.overall_risk} risk

              </h2>

              <p>

                Based on authentication patterns
                and configured detection rules.

              </p>

            </div>

            <RiskLabel
              level={analysis.overall_risk}
            />

          </section>


          {/* STATISTIC CARDS */}

          <section className="logs-metric-grid">

            {metrics.map((metric) => (

              <article
                key={metric.title}
                className="logs-metric-card"
              >

                <div className="logs-metric-header">

                  <span>{metric.title}</span>

                  <metric.icon
                    size={18}
                    color={metric.color}
                    strokeWidth={1.7}
                  />

                </div>

                <div
                  className="logs-metric-value"
                  style={{ color: metric.color }}
                >

                  {metric.value.toLocaleString()}

                </div>

              </article>

            ))}

          </section>


          {/* AUTHENTICATION CHART */}

          <section className="logs-result-card">

            <div className="logs-section-heading">

              <Activity size={20} />

              <div>

                <h2>Authentication activity</h2>

                <p>

                  Failed and successful logins by IP address.
                  Showing up to 10 IPs ranked by failed attempts.

                </p>

              </div>

            </div>


            <div className="logs-chart-legend">

              <span>

                <i style={{ background: '#f87171' }} />

                Failed logins

              </span>

              <span>

                <i style={{ background: '#4ade80' }} />

                Successful logins

              </span>

            </div>


            <div className="logs-chart-container">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={chartData}
                  barGap={6}
                  barCategoryGap="25%"
                >

                  <CartesianGrid
                    stroke="#252933"
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="ip"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: '#9299aa',
                      fontSize: 10,
                    }}
                  />

                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: '#9299aa',
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    cursor={{
                      fill: '#ffffff05',
                    }}
                    contentStyle={{
                      background: '#171b24',
                      border: '1px solid #303541',
                      borderRadius: '9px',
                      color: '#eef0f6',
                    }}
                    labelStyle={{
                      color: '#eef0f6',
                    }}
                  />

                  <Bar
                    dataKey="Failed"
                    fill="#f87171"
                    radius={[4, 4, 0, 0]}
                  />

                  <Bar
                    dataKey="Successful"
                    fill="#4ade80"
                    radius={[4, 4, 0, 0]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          </section>


          {/* IP INTELLIGENCE TABLE */}

          <section className="logs-result-card">

            <div className="logs-section-heading">

              <Globe size={20} />

              <div>

                <h2>IP intelligence</h2>

                <p>

                  Authentication statistics and risk
                  classifications for observed IP addresses.

                </p>

              </div>

            </div>


            <div className="logs-table-wrapper">

              <table className="logs-table">

                <thead>

                  <tr>

                    <th>IP address</th>

                    <th>Failed</th>

                    <th>Successful</th>

                    <th>Total</th>

                    <th>Usernames</th>

                    <th>Risk</th>

                    <th>Brute-force flag</th>

                  </tr>

                </thead>


                <tbody>

                  {sortedIPs.map((item) => (

                    <tr key={item.ip_address}>

                      <td className="logs-ip-address">

                        {item.ip_address}

                      </td>

                      <td className="logs-failed-value">

                        {item.failed_attempts}

                      </td>

                      <td className="logs-success-value">

                        {item.successful_attempts}

                      </td>

                      <td>

                        {item.total_attempts}

                      </td>

                      <td>

                        <div className="logs-usernames">

                          <Users size={13} />

                          {item.usernames.join(', ') || '—'}

                        </div>

                      </td>

                      <td>

                        <RiskLabel
                          level={item.risk_level}
                        />

                      </td>

                      <td>

                        {item.possible_brute_force ? (

                          <span className="logs-threat-flag">

                            <AlertTriangle size={13} />

                            Possible

                          </span>

                        ) : (

                          <span className="logs-neutral-text">

                            Not flagged

                          </span>

                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </section>


          {/* RAPID FAILURE ALERTS */}

          <section className="logs-result-card">

            <div className="logs-section-heading">

              <Clock size={20} />

              <div>

                <h2>Rapid-failure alerts</h2>

                <p>

                  Sliding-window detection of repeated
                  authentication failures.

                </p>

              </div>

            </div>


            {analysis.time_window_alerts.length === 0 ? (

              <div className="logs-no-findings">

                <CheckCircle size={17} />

                No configured rapid-failure
                thresholds were triggered.

              </div>

            ) : (

              <div className="logs-alert-list">

                {analysis.time_window_alerts.map(
                  (alert, index) => (

                    <article
                      key={`${alert.ip_address}-${index}`}
                      className="logs-alert-card"
                    >

                      <div className="logs-alert-header">

                        <div>

                          <AlertTriangle size={18} />

                          <strong>

                            {alert.alert}

                          </strong>

                        </div>

                        <span>

                          {alert.ip_address}

                        </span>

                      </div>


                      <div className="logs-alert-metrics">

                        <div>

                          <span>Failed attempts</span>

                          <strong>

                            {alert.failed_attempts}

                          </strong>

                        </div>

                        <div>

                          <span>Observed duration</span>

                          <strong>

                            {alert.duration_seconds}s

                          </strong>

                        </div>

                        <div>

                          <span>Detection window</span>

                          <strong>

                            {alert.window_seconds}s

                          </strong>

                        </div>

                      </div>

                    </article>

                  )
                )}

              </div>

            )}

          </section>


          {/* AI SECURITY REPORT */}

          {result.ai_report && (

            <section className="logs-result-card">

              <div className="logs-section-heading">

                <Sparkles size={20} />

                <div>

                  <h2>AI security assessment</h2>

                  <p>

                    Generated by local Llama 3.2

                  </p>

                </div>

              </div>

              <div className="markdown-content logs-ai-report">

                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{

                    img({ alt }) {

                      return (

                        <span>

                          [Image omitted: {alt || 'external image'}]

                        </span>

                      )

                    },

                    a({ children }) {

                      return <span>{children}</span>

                    },

                  }}
                >

                  {result.ai_report}

                </ReactMarkdown>

              </div>


              <div className="logs-advisory-note">

                <AlertCircle size={15} />

                AI-generated advice may contain errors.
                Verify recommendations independently.

              </div>

            </section>

          )}


          {result.status ===
            'analysis_completed_ai_unavailable' && (

            <div className="logs-advisory-note">

              <AlertCircle size={17} />

              Log analysis completed successfully,
              but the AI report could not be generated.

            </div>

          )}


          {result.status === 'success' &&
            !result.ai_report && (

            <div className="logs-advisory-note">

              <Sparkles size={17} />

              No AI report generated.
              Enable AI reporting for an additional assessment.

            </div>

          )}

        </div>

      )}


      {/* PRIVACY AND LIMITATIONS */}

      <footer className="logs-footer">

        <Lock size={14} />

        <span>

          Local processing. Investigation storage is optional.
          Detection alerts indicate suspicious patterns,
          not confirmed compromises.

        </span>

      </footer>

    </div>

  )

}

export default SecurityLogs
