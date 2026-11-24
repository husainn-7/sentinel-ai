
import { useState, useRef, useEffect } from 'react'

import {
  Shield,
  ShieldAlert,
  Brain,
  Cpu,
  Activity,
  FileText,
  Sparkles,
  RotateCcw,
  ArrowUpRight,
  AlertCircle,
  Loader2,
  CheckCircle,
  Layers,
  Target,
  Info,
  Lock,
  Database,
} from 'lucide-react'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type {
  InvestigationStorageMetadata,
} from '../services/history'

import './MLAnomalies.css'


// =========================================
// TYPES
// =========================================

interface AnomalyWindow {

  ip_address: string
  window_start: string

  failed_attempts: number
  successful_attempts: number
  total_attempts: number

  unique_usernames: number
  failure_rate: number

  ml_anomaly: boolean
  decision_score: number
  rule_alert: boolean

  assessment: string

}


interface AnomalyAnalysis {

  status?: string

  model?: string

  window_seconds?: number

  total_windows: number

  ml_anomalies: number

  rule_alerts: number

  results: AnomalyWindow[]

}


interface AnalysisResponse
  extends InvestigationStorageMetadata {

  status: string

  analysis: AnomalyAnalysis

  ai_report: string | null

}


type ResultFilter =
  | 'all'
  | 'ml'
  | 'rules'
  | 'both'
  | 'normal'


// =========================================
// CONFIGURATION
// =========================================

const MAX_LOG_LENGTH = 100000

const MAX_TITLE_LENGTH = 120


const SAMPLE_LOGS = [

  'Nov 24 10:00:05 server sshd[1001]: Accepted password for developer from 192.0.2.10 port 50101 ssh2',

  'Nov 24 10:00:15 server sshd[1002]: Failed password for developer from 192.0.2.10 port 50102 ssh2',

  'Nov 24 10:00:25 server sshd[1003]: Accepted password for developer from 192.0.2.10 port 50103 ssh2',

  ...Array.from(
    { length: 30 },
    (_, index) =>
      `Nov 24 10:01:${String(index).padStart(2, '0')} server sshd[${2000 + index}]: Failed password for invalid user admin from 198.51.100.20 port ${50200 + index} ssh2`
  ),

  ...Array.from(
    { length: 10 },
    (_, index) =>
      `Nov 24 10:02:${String(index * 3).padStart(2, '0')} server sshd[${3000 + index}]: Failed password for root from 203.0.113.30 port ${50300 + index} ssh2`
  ),

].join('\n')


const filters: {
  value: ResultFilter
  label: string
}[] = [

  {
    value: 'all',
    label: 'All windows',
  },

  {
    value: 'ml',
    label: 'ML anomalies',
  },

  {
    value: 'rules',
    label: 'Rule alerts',
  },

  {
    value: 'both',
    label: 'Both flagged',
  },

  {
    value: 'normal',
    label: 'No alerts',
  },

]


const modelMetrics = [

  {
    title: 'Accuracy',
    value: '95.49%',
  },

  {
    title: 'Precision',
    value: '84.71%',
  },

  {
    title: 'Recall',
    value: '70.94%',
  },

  {
    title: 'F1 score',
    value: '77.21%',
  },

  {
    title: 'False positive rate',
    value: '1.55%',
  },

]


// =========================================
// FORMATTING HELPERS
// =========================================

function formatScore(score: number) {

  return score.toFixed(6)

}


function formatWindowTime(value: string) {

  return value
    .replace(/^\d{4}-/, '')
    .replace('T', ' ')

}


function getDetectionColor(
  mlAnomaly: boolean,
  ruleAlert: boolean
) {

  if (mlAnomaly && ruleAlert) {

    return '#f87171'

  }

  if (mlAnomaly) {

    return '#c084fc'

  }

  if (ruleAlert) {

    return '#fb923c'

  }

  return '#4ade80'

}


function getDetectionLabel(
  mlAnomaly: boolean,
  ruleAlert: boolean
) {

  if (mlAnomaly && ruleAlert) {

    return 'Both engines flagged'

  }

  if (mlAnomaly) {

    return 'ML anomaly only'

  }

  if (ruleAlert) {

    return 'Rule alert only'

  }

  return 'No alerts'

}


function DetectionLabel({
  label,
  color,
}: {
  label: string
  color: string
}) {

  return (

    <span
      className="ml-detection-label"
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

      {label}

    </span>

  )

}


// =========================================
// MACHINE LEARNING COMPONENT
// =========================================

function MLAnomalies() {

  const [logs, setLogs] =
    useState('')

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

  const [filter, setFilter] =
    useState<ResultFilter>('all')

  const [selectedWindow, setSelectedWindow] =
    useState<AnomalyWindow | null>(null)


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
    setFilter('all')
    setSelectedWindow(null)
    setIsAnalyzing(true)

    const controller = new AbortController()

    abortRef.current = controller

    try {

      const response = await fetch(
        '/api/anomaly',
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
          response.status === 503

            ? 'The machine learning service is currently unavailable. Check the backend and trained model.'

            : `Anomaly analysis failed (${response.status}).`

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
        (
          !data.history_saved ||
          !data.investigation_id
        ) &&
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
    setFilter('all')
    setSelectedWindow(null)

  }


  function resetAnalysis() {

    if (isAnalyzing) return

    setLogs('')
    setResult(null)
    setError('')
    setTitle('')
    setSaveHistory(false)
    setFilter('all')
    setSelectedWindow(null)

  }


  function cancelAnalysis() {

    abortRef.current?.abort()

  }


  // =========================================
  // ANALYSIS STATISTICS
  // =========================================

  const analysis = result?.analysis

  const windows = analysis?.results ?? []


  const sortedWindows = [...windows].sort(

    (a, b) =>
      a.decision_score - b.decision_score

  )


  const bothFlagged = windows.filter(

    (item) =>
      item.ml_anomaly && item.rule_alert

  ).length


  const mlOnly = windows.filter(

    (item) =>
      item.ml_anomaly && !item.rule_alert

  ).length


  const ruleOnly = windows.filter(

    (item) =>
      !item.ml_anomaly && item.rule_alert

  ).length


  const normalWindows = windows.filter(

    (item) =>
      !item.ml_anomaly && !item.rule_alert

  ).length


  const flaggedWindows = windows.filter(

    (item) =>
      item.ml_anomaly || item.rule_alert

  ).length


  const filteredWindows = sortedWindows.filter(

    (item) => {

      switch (filter) {

        case 'ml':
          return item.ml_anomaly

        case 'rules':
          return item.rule_alert

        case 'both':
          return item.ml_anomaly && item.rule_alert

        case 'normal':
          return !item.ml_anomaly && !item.rule_alert

        default:
          return true

      }

    }

  )


  const chartData = sortedWindows
    .slice(0, 20)
    .map((item, index) => ({

      name: `W${index + 1}`,

      ip: item.ip_address,

      window: formatWindowTime(
        item.window_start
      ),

      score: item.decision_score,

      color: item.ml_anomaly
        ? '#f87171'
        : '#4ade80',

    }))


  const metrics = analysis

    ? [

        {
          title: 'Analysed windows',
          value: analysis.total_windows,
          icon: Activity,
          color: '#eef0f6',
        },

        {
          title: 'ML anomalies',
          value: analysis.ml_anomalies,
          icon: Brain,
          color: '#c084fc',
        },

        {
          title: 'Rule alerts',
          value: analysis.rule_alerts,
          icon: ShieldAlert,
          color: '#fb923c',
        },

        {
          title: 'Flagged windows',
          value: flaggedWindows,
          icon: Target,
          color: '#f87171',
        },

        {
          title: 'Both engines flagged',
          value: bothFlagged,
          icon: Layers,
          color: '#f87171',
        },

        {
          title: 'No alerts',
          value: normalWindows,
          icon: CheckCircle,
          color: '#4ade80',
        },

      ]

    : []


  // =========================================
  // USER INTERFACE
  // =========================================

  return (

    <div className="ml-workspace">


      {/* PAGE HEADER */}

      <section className="ml-heading">

        <div className="eyebrow">

          THREAT INTELLIGENCE / BEHAVIOURAL ANALYSIS

        </div>

        <h1>

          ML anomalies<span>.</span>

        </h1>

        <p>

          Discover unusual authentication behaviour
          using machine learning and complementary
          rule-based security detection.

        </p>

        <div className="ml-engine-label">

          <Brain size={14} />

          Isolation Forest

          <span className="small-divider" />

          Hybrid anomaly detection

        </div>

      </section>


      {/* MODEL INFORMATION */}

      <section className="ml-model-panel">

        <div className="ml-section-heading">

          <Cpu size={22} />

          <div>

            <div className="eyebrow">

              MACHINE LEARNING ENGINE

            </div>

            <h2>

              Isolation Forest

            </h2>

            <p>

              Unsupervised behavioural anomaly detection
              with 200 estimators and five authentication features.

            </p>

          </div>

        </div>


        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(110px, 1fr))',
            gap: '12px',
            marginTop: '18px',
          }}
        >

          {modelMetrics.map((metric) => (

            <div
              key={metric.title}
              style={{
                background: '#0d1017',
                border: '1px solid #252933',
                borderRadius: '9px',
                padding: '14px',
              }}
            >

              <div
                style={{
                  color: '#9299aa',
                  fontSize: '11px',
                  marginBottom: '8px',
                }}
              >

                {metric.title}

              </div>

              <strong
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#b9c9ff',
                }}
              >

                {metric.value}

              </strong>

            </div>

          ))}

        </div>


        <div className="ml-advisory-note">

          <Info size={15} />

          Performance measured on held-out synthetic
          evaluation data. These metrics do not guarantee
          equivalent performance on real-world traffic.

        </div>

      </section>


      {/* INVESTIGATION INPUT */}

      <section className="ml-input-panel">

        <div className="ml-panel-header">

          <div className="ml-panel-title">

            <div className="ml-panel-icon">

              <Brain size={21} />

            </div>

            <div>

              <h2>

                Behavioural investigation

              </h2>

              <p>

                Paste Linux SSH authentication logs.

              </p>

            </div>

          </div>

          <button
            type="button"
            className="ml-secondary-button"
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
            className="ml-textarea"
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
              setFilter('all')
              setSelectedWindow(null)

            }}
          />


          <div className="ml-character-count">

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
              className="ml-ai-option"
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
                  htmlFor="ml-investigation-title"
                  style={{
                    fontSize: '12px',
                    color: '#b0b7c6',
                    fontWeight: 500,
                  }}
                >

                  Investigation title (optional)

                </label>

                <input
                  id="ml-investigation-title"
                  type="text"
                  value={title}
                  disabled={isAnalyzing}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="e.g. Unusual SSH authentication behaviour"
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
                    style={{
                      flexShrink: 0,
                    }}
                  />

                  <span>

                    Behavioural features, IP addresses,
                    detection results and optional AI
                    reports will be stored locally in
                    unencrypted SQLite.

                    Findings may contain sensitive
                    information.

                  </span>

                </div>

              </div>

            )}

          </div>


          <div className="ml-input-footer">

            <label className="ml-ai-option">

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


            <div className="ml-actions">

              <button
                type="button"
                className="ml-secondary-button"
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
                  className="ml-secondary-button"
                  onClick={cancelAnalysis}
                >

                  Cancel

                </button>

              ) : (

                <button
                  type="submit"
                  className="ml-primary-button"
                  disabled={!logs.trim()}
                >

                  <Brain size={17} />

                  Analyse anomalies

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
          className="ml-error"
          role="alert"
        >

          <AlertCircle size={18} />

          <span>{error}</span>

        </div>

      )}


      {/* LOADING STATE */}

      {isAnalyzing && (

        <section
          className="ml-loading-panel"
          role="status"
        >

          <Loader2
            size={30}
            className="ml-spinner"
          />

          <h2>

            Analysing authentication behaviour

          </h2>

          <p>

            {includeAI

              ? 'Extracting features, evaluating anomalies and generating an AI report...'

              : 'Extracting behavioural features and running Isolation Forest inference...'

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


      {/* INITIAL EMPTY STATE */}

      {!result && !isAnalyzing && (

        <section className="ml-empty-state">

          <div className="ml-empty-icon">

            <Brain
              size={32}
              strokeWidth={1.5}
            />

          </div>

          <h2>

            No behavioural investigations yet

          </h2>

          <p>

            Submit authentication logs to discover
            unusual behaviour, model decision scores
            and hybrid detection findings.

          </p>

        </section>

      )}


      {/* INVALID LOG RESULTS */}

      {result &&
        analysis &&
        windows.length === 0 && (

        <section className="ml-result-card ml-no-events">

          <AlertCircle size={24} />

          <div>

            <h2>

              No valid authentication windows

            </h2>

            <p>

              Sentinel could not extract supported
              behavioural features from the submitted
              authentication logs.

              Check the log format and try again.

            </p>

            {result.storage_warning && (

              <p style={{
                color: '#fbbf24',
              }}>

                {result.storage_warning}

              </p>

            )}

          </div>

        </section>

      )}


      {/* =====================================
          ANALYSIS RESULTS
          ===================================== */}

      {analysis &&
        result &&
        windows.length > 0 && (

        <div
          className="ml-results"
          ref={resultRef}
        >

          <div className="ml-results-header">

            <div>

              <div className="eyebrow">

                BEHAVIOURAL INVESTIGATION RESULTS

              </div>

              <h2>

                Machine learning assessment

              </h2>

            </div>

            <div className="ml-complete-label">

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
                style={{
                  flexShrink: 0,
                }}
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

                  Machine learning investigation
                  results are stored in the local
                  SQLite database.

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


          {/* STORAGE FAILURE WARNING */}

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
                style={{
                  flexShrink: 0,
                }}
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


          {/* TEMPORARY INVESTIGATION NOTICE */}

          {result.history_saved !== true &&
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


          {/* INFERENCE INFORMATION */}

          <section className="ml-inference-panel">

            <div className="ml-inference-icon">

              <Cpu size={25} />

            </div>

            <div>

              <h2>

                {analysis.model ?? 'Isolation Forest'}

              </h2>

              <p>

                {analysis.window_seconds ?? 60}-second
                fixed authentication windows ·
                Five extracted behavioural features

              </p>

            </div>

            <DetectionLabel
              label="Inference complete"
              color="#4ade80"
            />

          </section>


          {/* STATISTIC CARDS */}

          <section className="ml-metric-grid">

            {metrics.map((metric) => (

              <article
                className="ml-metric-card"
                key={metric.title}
              >

                <div className="ml-metric-header">

                  <span>{metric.title}</span>

                  <metric.icon
                    size={18}
                    strokeWidth={1.7}
                    color={metric.color}
                  />

                </div>

                <div
                  className="ml-metric-value"
                  style={{
                    color: metric.color,
                  }}
                >

                  {metric.value.toLocaleString()}

                </div>

              </article>

            ))}

          </section>


          {/* MODEL DECISION SCORES */}

          <section className="ml-result-card">

            <div className="ml-section-heading">

              <Activity size={20} />

              <div>

                <h2>

                  Model decision scores

                </h2>

                <p>

                  Up to 20 authentication windows,
                  ranked from lowest to highest
                  Isolation Forest decision score.

                </p>

              </div>

            </div>


            <div className="ml-chart-legend">

              <span>

                <i style={{
                  background: '#f87171',
                }} />

                ML anomaly

              </span>

              <span>

                <i style={{
                  background: '#4ade80',
                }} />

                ML normal

              </span>

              <span>

                <i style={{
                  background: '#9299aa',
                }} />

                Decision boundary

              </span>

            </div>


            <div className="ml-chart-container">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={chartData}
                  barCategoryGap="30%"
                >

                  <CartesianGrid
                    stroke="#252933"
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: '#9299aa',
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: '#9299aa',
                      fontSize: 11,
                    }}
                    tickFormatter={(value) =>
                      Number(value).toFixed(3)
                    }
                  />

                  <Tooltip
                    cursor={{
                      fill: '#ffffff05',
                    }}
                    content={({ active, payload }) => {

                      if (
                        !active ||
                        !payload?.length
                      ) {

                        return null

                      }

                      const item =
                        payload[0].payload as
                          typeof chartData[number]

                      return (

                        <div className="ml-chart-tooltip">

                          <strong>

                            {item.ip}

                          </strong>

                          <span>

                            {item.window}

                          </span>

                          <div>

                            Decision score:

                            {' '}

                            <b style={{
                              color: item.color,
                            }}>

                              {formatScore(item.score)}

                            </b>

                          </div>

                        </div>

                      )

                    }}
                  />


                  <ReferenceLine
                    y={0}
                    stroke="#9299aa"
                    strokeDasharray="5 5"
                  />


                  <Bar
                    dataKey="score"
                    radius={[3, 3, 3, 3]}
                    maxBarSize={65}
                  >

                    {chartData.map((item) => (

                      <Cell
                        key={item.name}
                        fill={item.color}
                      />

                    ))}

                  </Bar>

                </BarChart>

              </ResponsiveContainer>

            </div>


            <div className="ml-chart-note">

              <Info size={15} />

              Negative decision scores indicate
              model-classified anomalies.

              Non-negative scores indicate
              model-classified normal observations.

              Scores are not probabilities
              or confidence percentages.

            </div>

          </section>


          {/* HYBRID DETECTION */}

          <section className="ml-result-card">

            <div className="ml-section-heading">

              <Layers size={20} />

              <div>

                <h2>

                  Hybrid detection intelligence

                </h2>

                <p>

                  Compare agreement and disagreement
                  between machine learning and
                  rule-based detection.

                </p>

              </div>

            </div>


            <div className="ml-hybrid-grid">

              {[

                {
                  title: 'Both engines flagged',
                  count: bothFlagged,
                  color: '#f87171',
                  icon: ShieldAlert,
                  description:
                    'Both detection engines flagged the same window.',
                },

                {
                  title: 'ML anomaly only',
                  count: mlOnly,
                  color: '#c084fc',
                  icon: Brain,
                  description:
                    'The model flagged a window without a rule alert.',
                },

                {
                  title: 'Rule alert only',
                  count: ruleOnly,
                  color: '#fb923c',
                  icon: Shield,
                  description:
                    'Configured rules flagged a model-normal window.',
                },

                {
                  title: 'No alerts',
                  count: normalWindows,
                  color: '#4ade80',
                  icon: CheckCircle,
                  description:
                    'Neither engine flagged the observation.',
                },

              ].map((item) => (

                <article
                  className="ml-hybrid-card"
                  key={item.title}
                >

                  <div className="ml-hybrid-header">

                    <item.icon
                      size={18}
                      color={item.color}
                    />

                    <span>{item.title}</span>

                  </div>

                  <strong style={{
                    color: item.color,
                  }}>

                    {item.count}

                  </strong>

                  <p>{item.description}</p>

                </article>

              ))}

            </div>


            <div className="ml-hybrid-note">

              <Info size={15} />

              Machine learning and security rules
              are complementary.

              Agreement does not prove an attack,
              and absence of alerts does not guarantee
              safety.

            </div>

          </section>


          {/* DETAILED OBSERVATIONS */}

          <section className="ml-result-card">

            <div className="ml-section-heading">

              <Target size={20} />

              <div>

                <h2>

                  Authentication observations

                </h2>

                <p>

                  Inspect individual windows,
                  compare detection results and
                  explore extracted behavioural features.

                </p>

              </div>

            </div>


            {/* RESULT FILTERS */}

            <div className="ml-filters">

              {filters.map((item) => (

                <button
                  type="button"
                  key={item.value}
                  className={`ml-filter-button ${
                    filter === item.value
                      ? 'active'
                      : ''
                  }`}
                  aria-pressed={
                    filter === item.value
                  }
                  onClick={() => {

                    setFilter(item.value)
                    setSelectedWindow(null)

                  }}
                >

                  {item.label}

                </button>

              ))}

            </div>


            <div className="ml-result-count">

              Showing {filteredWindows.length}

              {' of '}

              {windows.length} windows

            </div>


            {filteredWindows.length === 0 ? (

              <div className="ml-no-findings">

                <Info size={17} />

                No observations match this filter.

              </div>

            ) : (

              <div className="ml-table-wrapper">

                <table className="ml-table">

                  <thead>

                    <tr>

                      <th>IP address</th>

                      <th>Window</th>

                      <th>Failed</th>

                      <th>Successful</th>

                      <th>Decision score</th>

                      <th>ML result</th>

                      <th>Rule result</th>

                      <th>Details</th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredWindows.map((item) => (

                      <tr
                        key={`${item.ip_address}-${item.window_start}`}
                        className={
                          selectedWindow === item
                            ? 'selected'
                            : ''
                        }
                      >

                        <td className="ml-ip-address">

                          {item.ip_address}

                        </td>


                        <td className="ml-window-time">

                          {formatWindowTime(
                            item.window_start
                          )}

                        </td>


                        <td className="ml-failed-value">

                          {item.failed_attempts}

                        </td>


                        <td className="ml-success-value">

                          {item.successful_attempts}

                        </td>


                        <td>

                          <span
                            className="ml-score-value"
                            style={{
                              color: item.ml_anomaly
                                ? '#f87171'
                                : '#4ade80',
                            }}
                          >

                            {formatScore(
                              item.decision_score
                            )}

                          </span>

                        </td>


                        <td>

                          <DetectionLabel
                            label={
                              item.ml_anomaly
                                ? 'Anomaly'
                                : 'Normal'
                            }
                            color={
                              item.ml_anomaly
                                ? '#f87171'
                                : '#4ade80'
                            }
                          />

                        </td>


                        <td>

                          <DetectionLabel
                            label={
                              item.rule_alert
                                ? 'Alert'
                                : 'No alert'
                            }
                            color={
                              item.rule_alert
                                ? '#fb923c'
                                : '#9299aa'
                            }
                          />

                        </td>


                        <td>

                          <button
                            type="button"
                            className="ml-details-button"
                            aria-pressed={
                              selectedWindow === item
                            }
                            onClick={() =>
                              setSelectedWindow(
                                selectedWindow === item
                                  ? null
                                  : item
                              )
                            }
                          >

                            {selectedWindow === item

                              ? 'Close'

                              : 'Inspect'}

                            <ArrowUpRight size={12} />

                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}


            {/* INDIVIDUAL FEATURE INSPECTOR */}

            {selectedWindow && (

              <div className="ml-feature-inspector">

                <div className="ml-inspector-header">

                  <div>

                    <div className="eyebrow">

                      FEATURE INSPECTOR

                    </div>

                    <h3>

                      {selectedWindow.ip_address}

                    </h3>

                    <p>

                      Window beginning:

                      {' '}

                      {formatWindowTime(
                        selectedWindow.window_start
                      )}

                    </p>

                  </div>

                  <DetectionLabel
                    label={getDetectionLabel(
                      selectedWindow.ml_anomaly,
                      selectedWindow.rule_alert
                    )}
                    color={getDetectionColor(
                      selectedWindow.ml_anomaly,
                      selectedWindow.rule_alert
                    )}
                  />

                </div>


                <div className="ml-feature-grid">

                  {[

                    {
                      name: 'Failed attempts',
                      value:
                        selectedWindow.failed_attempts,
                    },

                    {
                      name: 'Successful attempts',
                      value:
                        selectedWindow.successful_attempts,
                    },

                    {
                      name: 'Total attempts',
                      value:
                        selectedWindow.total_attempts,
                    },

                    {
                      name: 'Unique usernames',
                      value:
                        selectedWindow.unique_usernames,
                    },

                    {
                      name: 'Failure rate',
                      value:
                        `${(
                          selectedWindow.failure_rate * 100
                        ).toFixed(1)}%`,
                    },

                  ].map((feature) => (

                    <div
                      className="ml-feature-item"
                      key={feature.name}
                    >

                      <span>{feature.name}</span>

                      <strong>{feature.value}</strong>

                    </div>

                  ))}

                </div>


                <div className="ml-inspector-assessment">

                  <Brain size={18} />

                  <div>

                    <strong>

                      Engine assessment

                    </strong>

                    <p>

                      {selectedWindow.assessment}

                    </p>

                  </div>

                </div>


                <div className="ml-inspector-score">

                  <span>

                    Isolation Forest decision score

                  </span>

                  <strong
                    style={{
                      color: selectedWindow.ml_anomaly
                        ? '#f87171'
                        : '#4ade80',
                    }}
                  >

                    {formatScore(
                      selectedWindow.decision_score
                    )}

                  </strong>

                </div>

              </div>

            )}

          </section>


          {/* AI SECURITY ASSESSMENT */}

          {result.ai_report && (

            <section className="ml-result-card">

              <div className="ml-section-heading">

                <Sparkles size={20} />

                <div>

                  <h2>

                    AI security assessment

                  </h2>

                  <p>

                    Generated by local Llama 3.2

                  </p>

                </div>

              </div>


              <div className="markdown-content ml-ai-report">

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


              <div className="ml-advisory-note">

                <AlertCircle size={15} />

                AI-generated advice may contain errors.

                The numerical findings and detection
                classifications above come directly
                from the Python analysis engine.

              </div>

            </section>

          )}


          {result.status ===
            'analysis_completed_ai_unavailable' && (

            <div className="ml-advisory-note">

              <AlertCircle size={17} />

              Machine learning analysis completed,
              but the AI report could not be generated.

            </div>

          )}


          {result.status === 'success' &&
            !result.ai_report && (

            <div className="ml-advisory-note">

              <Sparkles size={17} />

              No AI report generated.

              Enable AI reporting for
              additional security advice.

            </div>

          )}

        </div>

      )}


      {/* PRIVACY AND LIMITATIONS */}

      <footer className="ml-footer">

        <Lock size={14} />

        <span>

          Local model inference.
          Investigation storage is optional.
          Synthetic training and evaluation data.
          Detection results require independent verification.

        </span>

      </footer>

    </div>

  )

}

export default MLAnomalies
