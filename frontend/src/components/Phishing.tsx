
import { useState, useRef, useEffect } from 'react'

import {
  Shield,
  Mail,
  FileText,
  Sparkles,
  RotateCcw,
  Scan,
  ArrowUpRight,
  AlertCircle,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Link,
  Lock,
  Database,
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type {
  InvestigationStorageMetadata,
} from '../services/history'

import './Phishing.css'


// =========================================
// TYPES
// =========================================

interface URLAnalysis {
  url: string
  indicators: string[]
  indicator_count: number
}

interface PhishingAnalysis {
  risk_score: number
  risk_level: string
  keyword_indicators: Record<string, string[]>
  url_analysis: URLAnalysis[]
}

interface AnalysisResponse
  extends InvestigationStorageMetadata {

  status: string
  analysis: PhishingAnalysis
  ai_report: string | null

}


// =========================================
// CONFIGURATION
// =========================================

const MAX_EMAIL_LENGTH = 20000

const MAX_TITLE_LENGTH = 120

const SAMPLE_EMAIL = `Subject: URGENT - Account Verification Required

Dear Customer,

Your account has been suspended due to unusual activity.

Verify your password immediately at:

http://192.0.2.50/verify-account

Failure to act immediately may result in permanent account suspension.

Security Department`


// =========================================
// RISK COLOUR
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


// =========================================
// RISK GAUGE
// =========================================

function RiskGauge({
  score,
  level,
}: {
  score: number
  level: string
}) {

  const color = getRiskColor(level)

  const value = Math.max(
    0,
    Math.min(100, score)
  )

  return (

    <div className="risk-gauge">

      <svg
        viewBox="0 0 240 145"
        width="100%"
        style={{ maxWidth: 280 }}
        role="img"
        aria-label={`Risk score ${score} out of 100`}
      >

        <path
          d="M25 120 A95 95 0 0 1 215 120"
          fill="none"
          stroke="#252933"
          strokeWidth="15"
          strokeLinecap="round"
        />

        <path
          d="M25 120 A95 95 0 0 1 215 120"
          fill="none"
          stroke={color}
          strokeWidth="15"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${value} 100`}
          opacity={value === 0 ? 0 : 1}
        />

        <text
          x="120"
          y="98"
          textAnchor="middle"
          fontSize="38"
          fontWeight="600"
          fill={color}
        >
          {score}
        </text>

        <text
          x="120"
          y="120"
          textAnchor="middle"
          fontSize="12"
          fill="#9299aa"
        >
          OUT OF 100
        </text>

      </svg>

      <div
        className="risk-level-badge"
        style={{
          color,
          borderColor: `${color}40`,
          backgroundColor: `${color}12`,
        }}
      >

        <span
          className="risk-status-dot"
          style={{ backgroundColor: color }}
        />

        {level} risk

      </div>

    </div>

  )
}


// =========================================
// PHISHING ANALYSIS COMPONENT
// =========================================

function Phishing() {

  const [email, setEmail] = useState('')

  const [includeAI, setIncludeAI] =
    useState(false)

  const [saveHistory, setSaveHistory] =
    useState(false)

  const [title, setTitle] = useState('')

  const [isAnalyzing, setIsAnalyzing] =
    useState(false)

  const [result, setResult] =
    useState<AnalysisResponse | null>(null)

  const [error, setError] = useState('')

  const abortRef =
    useRef<AbortController | null>(null)

  const resultRef =
    useRef<HTMLDivElement>(null)


  // =========================================
  // CLEAN UP ACTIVE REQUEST
  // =========================================

  useEffect(() => {

    return () => {
      abortRef.current?.abort()
    }

  }, [])


  // =========================================
  // SCROLL TO ANALYSIS RESULTS
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

  async function analyzeEmail() {

    const content = email.trim()

    if (
      !content ||
      isAnalyzing ||
      abortRef.current
    ) {
      return
    }

    if (content.length > MAX_EMAIL_LENGTH) {

      setError(
        'Email content must not exceed 20,000 characters.'
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
        '/api/phishing',
        {

          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({

            email_text: content,

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
          `Analysis request failed (${response.status}).`

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

  function resetAnalysis() {

    if (isAnalyzing) {
      return
    }

    setEmail('')
    setTitle('')
    setResult(null)
    setError('')
    setSaveHistory(false)

  }


  function loadSample() {

    if (isAnalyzing) {
      return
    }

    setEmail(SAMPLE_EMAIL)
    setResult(null)
    setError('')
    setTitle('')

  }


  function cancelAnalysis() {

    abortRef.current?.abort()

  }


  // =========================================
  // ANALYSIS STATISTICS
  // =========================================

  const analysis = result?.analysis

  const keywordGroups = analysis

    ? Object.entries(
        analysis.keyword_indicators
      ).filter(
        ([, indicators]) =>
          indicators.length > 0
      )

    : []

  const keywordCount = keywordGroups.reduce(

    (total, [, indicators]) =>
      total + indicators.length,

    0

  )

  const urlCount =
    analysis?.url_analysis.length ?? 0

  const suspiciousURLCount =
    analysis?.url_analysis.filter(
      (item) => item.indicator_count > 0
    ).length ?? 0


  // =========================================
  // USER INTERFACE
  // =========================================

  return (

    <div className="phishing-workspace">


      {/* PAGE HEADER */}

      <section className="phishing-heading">

        <div className="eyebrow">
          THREAT INTELLIGENCE / EMAIL SECURITY
        </div>

        <h1>
          Phishing analysis<span>.</span>
        </h1>

        <p>
          Investigate suspicious emails, identify
          phishing indicators and evaluate potential
          security risks.
        </p>

        <div className="phishing-engine-label">

          <Shield size={14} />

          Rule-based detection

          <span className="small-divider" />

          AI-assisted reporting

        </div>

      </section>


      {/* EMAIL INVESTIGATION PANEL */}

      <section className="phishing-input-panel">

        <div className="phishing-panel-header">

          <div className="phishing-panel-title">

            <div className="phishing-panel-icon">
              <Mail size={21} />
            </div>

            <div>

              <h2>Email investigation</h2>

              <p>
                Paste the complete suspicious email.
              </p>

            </div>

          </div>

          <button
            type="button"
            className="phishing-secondary-button"
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

            void analyzeEmail()

          }}
        >

          <textarea
            className="phishing-textarea"
            value={email}
            disabled={isAnalyzing}
            maxLength={MAX_EMAIL_LENGTH}
            aria-label="Suspicious email content"
            placeholder="Paste suspicious email content here..."
            onChange={(event) => {

              setEmail(event.target.value)
              setResult(null)
              setError('')

            }}
          />


          <div className="phishing-character-count">

            {email.length.toLocaleString()} /

            {' '}

            {MAX_EMAIL_LENGTH.toLocaleString()}

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
              className="phishing-ai-option"
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
                  htmlFor="phishing-investigation-title"
                  style={{
                    fontSize: '12px',
                    color: '#b0b7c6',
                    fontWeight: 500,
                  }}
                >

                  Investigation title (optional)

                </label>

                <input
                  id="phishing-investigation-title"
                  type="text"
                  value={title}
                  disabled={isAnalyzing}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="e.g. Suspicious account verification"
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

                    Structured findings and optional AI
                    reports will be stored locally in
                    unencrypted SQLite. Findings may
                    contain sensitive information.

                  </span>

                </div>

              </div>

            )}

          </div>


          <div className="phishing-input-footer">

            <label className="phishing-ai-option">

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


            <div className="phishing-actions">

              <button
                type="button"
                className="phishing-secondary-button"
                onClick={resetAnalysis}
                disabled={
                  isAnalyzing ||
                  (
                    !email &&
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
                  className="phishing-secondary-button"
                  onClick={cancelAnalysis}
                >

                  Cancel

                </button>

              ) : (

                <button
                  type="submit"
                  className="phishing-primary-button"
                  disabled={!email.trim()}
                >

                  <Scan size={17} />

                  Analyse email

                  <ArrowUpRight size={14} />

                </button>

              )}

            </div>

          </div>

        </form>

      </section>


      {/* ERROR MESSAGE */}

      {error && (

        <div
          className="phishing-error"
          role="alert"
        >

          <AlertCircle size={18} />

          <span>{error}</span>

        </div>

      )}


      {/* ANALYSIS LOADING STATE */}

      {isAnalyzing && (

        <section
          className="phishing-loading-panel"
          role="status"
        >

          <Loader2
            size={30}
            className="phishing-spinner"
          />

          <h2>Investigating email</h2>

          <p>

            {includeAI

              ? 'Evaluating indicators and generating an AI report...'

              : 'Evaluating phishing indicators...'

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

        <section className="phishing-empty-state">

          <div className="phishing-empty-icon">

            <Shield
              size={32}
              strokeWidth={1.5}
            />

          </div>

          <h2>No investigation results yet</h2>

          <p>

            Submit an email to view its risk score,
            detected indicators and URL analysis.

          </p>

        </section>

      )}


      {/* =====================================
          ANALYSIS RESULTS
          ===================================== */}

      {analysis && result && (

        <div
          className="phishing-results"
          ref={resultRef}
        >

          <div className="phishing-results-header">

            <div>

              <div className="eyebrow">
                INVESTIGATION RESULTS
              </div>

              <h2>Threat assessment</h2>

            </div>

            <div className="phishing-complete-label">

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

                  Investigation results are stored
                  in the local SQLite database.

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


          {/* TEMPORARY ANALYSIS NOTICE */}

          {result.history_saved === undefined && (

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


          {/* RISK SCORE AND METRICS */}

          <div className="phishing-overview-grid">

            <section className="phishing-result-card">

              <div className="eyebrow">

                HEURISTIC RISK SCORE

              </div>

              <RiskGauge
                score={analysis.risk_score}
                level={analysis.risk_level}
              />

              <p className="risk-gauge-note">

                Indicator-based assessment.
                Not a probability of malicious activity.

              </p>

            </section>


            <section className="phishing-result-card">

              <div className="eyebrow">

                INVESTIGATION SUMMARY

              </div>

              <div className="phishing-summary-list">


                <div className="phishing-summary-row">

                  <div>

                    <AlertTriangle size={18} />

                    <span>Keyword indicators</span>

                  </div>

                  <strong>{keywordCount}</strong>

                </div>


                <div className="phishing-summary-row">

                  <div>

                    <Link size={18} />

                    <span>URLs detected</span>

                  </div>

                  <strong>{urlCount}</strong>

                </div>


                <div className="phishing-summary-row">

                  <div>

                    <Shield size={18} />

                    <span>URLs with risk indicators</span>

                  </div>

                  <strong>{suspiciousURLCount}</strong>

                </div>


                <div className="phishing-summary-row">

                  <div>

                    <Scan size={18} />

                    <span>Keyword categories flagged</span>

                  </div>

                  <strong>

                    {keywordGroups.length}

                  </strong>

                </div>

              </div>

            </section>

          </div>


          {/* KEYWORD INDICATORS */}

          <section className="phishing-result-card">

            <div className="phishing-section-heading">

              <AlertTriangle size={19} />

              <div>

                <h2>Detected indicators</h2>

                <p>

                  Suspicious language identified
                  by the detection engine.

                </p>

              </div>

            </div>


            {keywordGroups.length === 0 ? (

              <div className="phishing-no-findings">

                <CheckCircle size={17} />

                No configured keyword indicators detected.

              </div>

            ) : (

              <div className="keyword-group-list">

                {keywordGroups.map(
                  ([category, indicators]) => (

                    <div
                      className="keyword-group"
                      key={category}
                    >

                      <h3>

                        {category.replace(/_/g, ' ')}

                      </h3>

                      <div className="keyword-tags">

                        {indicators.map(
                          (indicator, index) => (

                            <span
                              key={`${indicator}-${index}`}
                              className="keyword-tag"
                            >

                              {indicator}

                            </span>

                          )
                        )}

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </section>


          {/* URL INTELLIGENCE */}

          <section className="phishing-result-card">

            <div className="phishing-section-heading">

              <Link size={19} />

              <div>

                <h2>URL intelligence</h2>

                <p>

                  Passive inspection of embedded URLs.
                  No links are opened or visited.

                </p>

              </div>

            </div>


            {analysis.url_analysis.length === 0 ? (

              <div className="phishing-no-findings">

                No HTTP or HTTPS URLs detected.

              </div>

            ) : (

              <div className="url-analysis-list">

                {analysis.url_analysis.map(
                  (item, index) => (

                    <article
                      className="url-analysis-item"
                      key={`${item.url}-${index}`}
                    >

                      <div className="url-item-header">

                        <span className="analyzed-url">

                          {item.url}

                        </span>


                        <span
                          className={

                            item.indicator_count > 0

                              ? 'url-warning-label'

                              : 'url-neutral-label'

                          }
                        >

                          {item.indicator_count}

                          {' '}indicators

                        </span>

                      </div>


                      {item.indicators.length > 0 ? (

                        <div className="url-indicator-list">

                          {item.indicators.map(
                            (indicator, index) => (

                              <div
                                className="url-indicator"
                                key={`${indicator}-${index}`}
                              >

                                <AlertTriangle size={14} />

                                {indicator}

                              </div>

                            )
                          )}

                        </div>

                      ) : (

                        <p className="url-neutral-note">

                          No configured URL indicators
                          detected. Safety is not verified.

                        </p>

                      )}

                    </article>

                  )
                )}

              </div>

            )}

          </section>


          {/* AI SECURITY ASSESSMENT */}

          {result.ai_report && (

            <section className="phishing-result-card">

              <div className="phishing-section-heading">

                <Sparkles size={20} />

                <div>

                  <h2>AI security assessment</h2>

                  <p>

                    Generated by local Llama 3.2

                  </p>

                </div>

              </div>

              <div className="markdown-content phishing-ai-report">

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

              <div className="phishing-advisory-note">

                <AlertCircle size={15} />

                AI-generated advice may contain errors.
                Verify recommendations independently.

              </div>

            </section>

          )}


          {result.status ===
            'analysis_completed_ai_unavailable' && (

            <div className="phishing-advisory-note">

              <AlertCircle size={17} />

              Detection completed successfully, but
              the AI report could not be generated.

            </div>

          )}


          {result.status === 'success' &&
            !result.ai_report && (

            <div className="phishing-advisory-note">

              <Sparkles size={17} />

              No AI report generated.
              Enable AI reporting for an additional assessment.

            </div>

          )}

        </div>

      )}


      {/* PRIVACY AND LIMITATIONS */}

      <footer className="phishing-footer">

        <Lock size={14} />

        <span>

          Local processing. No automatic link visits.
          Investigation storage is optional.
          A low risk score does not guarantee email safety.

        </span>

      </footer>

    </div>

  )

}

export default Phishing
