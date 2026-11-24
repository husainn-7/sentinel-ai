
import { useState, useRef, useEffect } from 'react'

import {
  Brain,
  Activity,
  Shield,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Cpu,
  Clock,
  Sparkles,
  FileText,
  RotateCcw,
  Loader2,
  Lock,
  ArrowUpRight,
  Layers,
  Target,
  Info,
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

import './MLAnomalies.css'


// =========================================
// TYPE DEFINITIONS
// =========================================

type AnomalyWindow = {
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

type AnomalyAnalysis = {
  status: string
  model?: string
  window_seconds?: number
  total_windows: number
  ml_anomalies: number
  rule_alerts: number
  results: AnomalyWindow[]
}

type AnalysisResponse = {
  status: string
  analysis: AnomalyAnalysis
  ai_report: string | null
}

type FilterType =
  | 'all'
  | 'ml'
  | 'rules'
  | 'both'
  | 'normal'


// =========================================
// CONFIGURATION
// =========================================

const MAX_LOG_LENGTH = 100000

const MODEL_METRICS = [
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
    title: 'F1-score',
    value: '77.21%',
  },
  {
    title: 'False positive rate',
    value: '1.55%',
  },
]


// =========================================
// SYNTHETIC SAMPLE LOGS
// =========================================

const SAMPLE_LOGS = [

  // WINDOW 1 — Normal authentication

  'Nov 24 10:00:01 server sshd[1001]: Failed password for developer from 192.0.2.10 port 50100 ssh2',

  'Nov 24 10:00:05 server sshd[1002]: Accepted password for developer from 192.0.2.10 port 50101 ssh2',

  'Nov 24 10:00:10 server sshd[1003]: Accepted password for developer from 192.0.2.10 port 50102 ssh2',


  // WINDOW 2 — High-volume failures

  ...Array.from(
    { length: 30 },
    (_, index) =>
      `Nov 24 10:01:${String(index).padStart(2, '0')} server sshd[${2000 + index}]: Failed password for invalid user admin from 198.51.100.20 port ${51000 + index} ssh2`
  ),


  // WINDOW 3 — Rule-based detection

  ...Array.from(
    { length: 10 },
    (_, index) =>
      `Nov 24 10:02:${String(index * 3).padStart(2, '0')} server sshd[${3000 + index}]: Failed password for invalid user root from 203.0.113.30 port ${52000 + index} ssh2`
  ),

].join('\n')


// =========================================
// FORMATTING HELPERS
// =========================================

function formatScore(score: number) {

  return `${score >= 0 ? '+' : ''}${score.toFixed(6)}`

}


function formatWindowTime(value: string) {

  // The source logs do not provide a year.
  // Display the observed date and time only.

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


// =========================================
// DETECTION LABEL COMPONENT
// =========================================

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
        color,
        borderColor: `${color}40`,
        backgroundColor: `${color}12`,
      }}
    >

      <span
        className="ml-status-dot"
        style={{
          backgroundColor: color,
        }}
      />

      {label}

    </span>

  )

}


// =========================================
// MAIN COMPONENT
// =========================================

function MLAnomalies() {

  const [logs, setLogs] = useState('')

  const [includeAI, setIncludeAI] =
    useState(false)

  const [isAnalyzing, setIsAnalyzing] =
    useState(false)

  const [result, setResult] =
    useState<AnalysisResponse | null>(null)

  const [error, setError] = useState('')

  const [filter, setFilter] =
    useState<FilterType>('all')

  const [selectedWindow, setSelectedWindow] =
    useState<AnomalyWindow | null>(null)

  const abortRef =
    useRef<AbortController | null>(null)

  const resultRef =
    useRef<HTMLDivElement>(null)


  // =========================================
  // COMPONENT LIFECYCLE
  // =========================================

  useEffect(() => {

    return () => {
      abortRef.current?.abort()
    }

  }, [])


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

  async function analyzeAnomalies() {

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

    setError('')
    setResult(null)
    setSelectedWindow(null)
    setFilter('all')
    setIsAnalyzing(true)

    const controller = new AbortController()

    abortRef.current = controller

    try {

      const response = await fetch('/api/anomaly', {

        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          log_text: content,
          include_ai_report: includeAI,
        }),

        signal: controller.signal,

      })


      if (!response.ok) {

        if (response.status === 503) {

          throw new Error(
            'The trained anomaly detection model is unavailable.'
          )

        }

        throw new Error(
          `Anomaly analysis failed (${response.status}).`
        )

      }


      const data: AnalysisResponse =
        await response.json()

      setResult(data)

    } catch (exception) {

      if (controller.signal.aborted) {

        setError('Analysis cancelled.')

      } else {

        setError(
          exception instanceof Error
            ? exception.message
            : 'Unable to connect to Sentinel AI.'
        )

      }

    } finally {

      abortRef.current = null

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
    setSelectedWindow(null)
    setFilter('all')
    setError('')

  }


  function resetAnalysis() {

    if (isAnalyzing) return

    setLogs('')
    setResult(null)
    setSelectedWindow(null)
    setFilter('all')
    setError('')

  }


  function cancelAnalysis() {

    abortRef.current?.abort()

  }


  // =========================================
  // DERIVED ANALYSIS STATISTICS
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


  // =========================================
  // RESULT FILTERING
  // =========================================

  const filteredWindows = sortedWindows.filter(
    (item) => {

      switch (filter) {

        case 'ml':
          return item.ml_anomaly

        case 'rules':
          return item.rule_alert

        case 'both':
          return item.ml_anomaly &&
            item.rule_alert

        case 'normal':
          return !item.ml_anomaly &&
            !item.rule_alert

        default:
          return true

      }

    }
  )


  const filters: {
    label: string
    value: FilterType
  }[] = [

    {
      label: 'All windows',
      value: 'all',
    },
    {
      label: 'ML anomalies',
      value: 'ml',
    },
    {
      label: 'Rule alerts',
      value: 'rules',
    },
    {
      label: 'Both flagged',
      value: 'both',
    },
    {
      label: 'No alerts',
      value: 'normal',
    },

  ]


  // =========================================
  // CHART DATA
  // =========================================

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
          icon: Clock,
          color: '#eef0f6',
        },

        {
          title: 'ML anomalies',
          value: analysis.ml_anomalies,
          icon: Brain,
          color: '#c084fc',
        },

        {
          title: 'Rule-based alerts',
          value: analysis.rule_alerts,
          icon: ShieldAlert,
          color: '#fb923c',
        },

        {
          title: 'Flagged windows',
          value: flaggedWindows,
          icon: AlertTriangle,
          color: '#f87171',
        },

        {
          title: 'Both engines flagged',
          value: bothFlagged,
          icon: Layers,
          color: '#f87171',
        },

        {
          title: 'Windows without alerts',
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

          MACHINE LEARNING / BEHAVIOURAL INTELLIGENCE

        </div>

        <h1>
          Anomaly detection<span>.</span>
        </h1>

        <p>

          Identify unusual authentication behaviour
          using our trained Isolation Forest model
          and complementary security rules.

        </p>

        <div className="ml-engine-label">

          <Brain size={14} />

          Isolation Forest

          <span className="small-divider" />

          Hybrid detection

        </div>

      </section>


      {/* MODEL INFORMATION */}

      <section className="ml-model-panel">

        <div className="ml-model-header">

          <div className="ml-model-title">

            <div className="ml-model-icon">

              <Brain size={28} />

            </div>

            <div>

              <div className="eyebrow">
                MACHINE LEARNING ENGINE
              </div>

              <h2>Isolation Forest</h2>

              <p>

                Unsupervised anomaly detection

              </p>

            </div>

          </div>

          <div className="ml-model-status">

            <Cpu size={14} />

            Local trained model

          </div>

        </div>


        <div className="ml-model-metrics">

          {MODEL_METRICS.map((metric) => (

            <div
              className="ml-model-metric"
              key={metric.title}
            >

              <span>{metric.title}</span>

              <strong>{metric.value}</strong>

            </div>

          ))}

        </div>


        <div className="ml-model-note">

          <Info size={15} />

          Evaluated on 1,884 held-out synthetic
          authentication observations.
          These metrics do not establish
          real-world detection performance.

        </div>

      </section>


      {/* INVESTIGATION INPUT */}

      <section className="ml-input-panel">

        <div className="ml-panel-header">

          <div className="ml-panel-title">

            <div className="ml-panel-icon">

              <Activity size={21} />

            </div>

            <div>

              <h2>Behavioural investigation</h2>

              <p>

                Paste SSH authentication logs
                for machine learning analysis.

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

            analyzeAnomalies()

          }}
        >

          <textarea
            className="ml-textarea"
            value={logs}
            disabled={isAnalyzing}
            maxLength={MAX_LOG_LENGTH}
            aria-label="Authentication logs for anomaly detection"
            placeholder="Paste SSH authentication logs here..."
            spellCheck={false}
            onChange={(event) => {

              setLogs(event.target.value)
              setResult(null)
              setSelectedWindow(null)
              setFilter('all')
              setError('')

            }}
          />


          <div className="ml-character-count">

            {logs.length.toLocaleString()}

            {' / '}

            {MAX_LOG_LENGTH.toLocaleString()}

            {' '}characters

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
                disabled={isAnalyzing || !logs}
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

                  Detect anomalies

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

          <h2>Analysing authentication behaviour</h2>

          <p>

            {includeAI
              ? 'Running model inference and generating an AI assessment...'
              : 'Extracting features and running Isolation Forest inference...'}

          </p>

        </section>

      )}


      {/* EMPTY STATE */}

      {!result && !isAnalyzing && (

        <section className="ml-empty-state">

          <div className="ml-empty-icon">

            <Brain
              size={32}
              strokeWidth={1.5}
            />

          </div>

          <h2>No anomaly investigation yet</h2>

          <p>

            Submit authentication logs to analyse
            behavioural patterns, inspect model
            decision scores and compare detection engines.

          </p>

        </section>

      )}


      {/* INVALID INPUT STATE */}

      {result?.status === 'no_valid_windows' && (

        <section className="ml-result-card ml-no-events">

          <AlertCircle size={24} />

          <div>

            <h2>No valid authentication windows</h2>

            <p>

              Sentinel could not extract supported
              authentication observations from the
              submitted logs.

              Check the log format and try again.

            </p>

          </div>

        </section>

      )}


      {/* INVESTIGATION RESULTS */}

      {result &&
        analysis &&
        analysis.total_windows > 0 && (

        <div
          className="ml-results"
          ref={resultRef}
        >

          <div className="ml-results-header">

            <div>

              <div className="eyebrow">

                BEHAVIOURAL INVESTIGATION RESULTS

              </div>

              <h2>Machine learning assessment</h2>

            </div>

            <div className="ml-complete-label">

              <CheckCircle size={15} />

              Analysis complete

            </div>

          </div>


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

                <h2>Model decision scores</h2>

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

                <h2>Hybrid detection intelligence</h2>

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
              are complementary. Agreement does not
              prove an attack, and absence of alerts
              does not guarantee safety.

            </div>

          </section>


          {/* DETAILED OBSERVATIONS */}

          <section className="ml-result-card">

            <div className="ml-section-heading">

              <Target size={20} />

              <div>

                <h2>Authentication observations</h2>

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

                  <span>Isolation Forest decision score</span>

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

                  <h2>AI security assessment</h2>

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
          Synthetic training and evaluation data.
          Detection results require independent verification.

        </span>

      </footer>

    </div>

  )

}

export default MLAnomalies
