
import { useState, useRef, useEffect } from 'react'

import {
  Shield,
  Scan,
  Mail,
  AlertTriangle,
  Link,
  Sparkles,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Loader2,
  Lock,
  FileText,
  ArrowUpRight,
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import './Phishing.css'


/* =========================================
   TYPE DEFINITIONS
   ========================================= */

type URLAnalysis = {
  url: string
  indicators: string[]
  indicator_count: number
}

type PhishingAnalysis = {
  risk_score: number
  risk_level: string
  keyword_indicators: Record<string, string[]>
  url_analysis: URLAnalysis[]
}

type AnalysisResponse = {
  status: string
  analysis: PhishingAnalysis
  ai_report: string | null
}


/* =========================================
   CONFIGURATION
   ========================================= */

const MAX_EMAIL_LENGTH = 20000

const SAMPLE_EMAIL = `Subject: URGENT - Account Verification Required

Dear Customer,

Your account has been suspended due to unusual activity.

Verify your password immediately at:

http://192.0.2.50/verify-account

Failure to act immediately may result in permanent account suspension.

Security Department`


/* =========================================
   RISK COLOURS
   ========================================= */

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


/* =========================================
   RISK SCORE GAUGE
   ========================================= */

function RiskGauge({
  score,
  level,
}: {
  score: number
  level: string
}) {

  const color = getRiskColor(level)

  const safeScore = Math.max(
    0,
    Math.min(100, score)
  )

  return (
    <div className="risk-gauge">

      <svg
        viewBox="0 0 240 155"
        className="risk-gauge-svg"
        role="img"
        aria-label={`Risk score ${score} out of 100`}
      >

        <path
          d="M 25 120 A 95 95 0 0 1 215 120"
          fill="none"
          stroke="#252933"
          strokeWidth="13"
          strokeLinecap="round"
        />

        <path
          d="M 25 120 A 95 95 0 0 1 215 120"
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${safeScore} 100`}
          opacity={safeScore === 0 ? 0 : 1}
          className="risk-gauge-progress"
        />

        <text
          x="120"
          y="99"
          textAnchor="middle"
          fill="#eef0f6"
          fontSize="45"
          fontWeight="600"
        >
          {score}
        </text>

        <text
          x="120"
          y="119"
          textAnchor="middle"
          fill="#9299aa"
          fontSize="11"
          letterSpacing="2"
        >
          OUT OF 100
        </text>

        <text
          x="25"
          y="145"
          fill="#9299aa"
          fontSize="10"
          textAnchor="middle"
        >
          0
        </text>

        <text
          x="215"
          y="145"
          fill="#9299aa"
          fontSize="10"
          textAnchor="middle"
        >
          100
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


/* =========================================
   PHISHING ANALYSIS COMPONENT
   ========================================= */

function Phishing() {

  const [email, setEmail] = useState('')

  const [includeAI, setIncludeAI] = useState(false)

  const [isAnalyzing, setIsAnalyzing] =
    useState(false)

  const [result, setResult] =
    useState<AnalysisResponse | null>(null)

  const [error, setError] = useState('')

  const abortRef =
    useRef<AbortController | null>(null)

  const resultRef =
    useRef<HTMLDivElement>(null)


  /* CLEAN UP ACTIVE REQUEST */

  useEffect(() => {

    return () => {
      abortRef.current?.abort()
    }

  }, [])


  /* SCROLL TO ANALYSIS RESULTS */

  useEffect(() => {

    if (result) {

      resultRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })

    }

  }, [result])


  /* =========================================
     BACKEND COMMUNICATION
     ========================================= */

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
          }),

          signal: controller.signal,
        }
      )

      if (!response.ok) {

        throw new Error(
          `Analysis request failed (${response.status}).`
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


  /* =========================================
     USER CONTROLS
     ========================================= */

  function resetAnalysis() {

    if (isAnalyzing) {
      return
    }

    setEmail('')
    setResult(null)
    setError('')

  }


  function loadSample() {

    if (isAnalyzing) {
      return
    }

    setEmail(SAMPLE_EMAIL)
    setResult(null)
    setError('')

  }


  function cancelAnalysis() {

    abortRef.current?.abort()

  }


  /* =========================================
     ANALYSIS STATISTICS
     ========================================= */

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


  /* =========================================
     USER INTERFACE
     ========================================= */

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

            analyzeEmail()

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
                disabled={isAnalyzing || !email}
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
              : 'Evaluating phishing indicators...'}

          </p>

        </section>

      )}


      {/* INITIAL EMPTY STATE */}

      {!result && !isAnalyzing && (

        <section className="phishing-empty-state">

          <div className="phishing-empty-icon">

            <Shield size={32} strokeWidth={1.5} />

          </div>

          <h2>No investigation results yet</h2>

          <p>
            Submit an email to view its risk score,
            detected indicators and URL analysis.
          </p>

        </section>

      )}


      {/* =================================
          ANALYSIS RESULTS
          ================================= */}

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
          A low risk score does not guarantee email safety.

        </span>

      </footer>

    </div>
  )

}

export default Phishing
