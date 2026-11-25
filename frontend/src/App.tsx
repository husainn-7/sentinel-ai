
import {
  useState,
  lazy,
  Suspense,
  Component,
} from 'react'

import type {
  ReactNode,
} from 'react'

import {
  Shield,
  LayoutDashboard,
  MessageSquare,
  Scan,
  Terminal,
  Activity,
  History as HistoryIcon,
  Settings as SettingsIcon,
  ArrowUpRight,
  ChevronRight,
  Cpu,
  Lock,
  Sparkles,
  ArrowUp,
  Layers,
  Loader2,
  AlertCircle,
  RefreshCw,
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

import './App.css'


// =========================================
// LAZY-LOADED WORKSPACE MODULES
// =========================================

const Assistant = lazy(
  () => import('./components/Assistant')
)

const Phishing = lazy(
  () => import('./components/Phishing')
)

const SecurityLogs = lazy(
  () => import('./components/SecurityLogs')
)

const MLAnomalies = lazy(
  () => import('./components/MLAnomalies')
)

const History = lazy(
  () => import('./components/History')
)

const Settings = lazy(
  () => import('./components/Settings')
)


// =========================================
// WORKSPACE ERROR BOUNDARY
// =========================================

interface WorkspaceErrorBoundaryProps {
  children: ReactNode
  onReturn: () => void
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean
}

class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {

  constructor(
    props: WorkspaceErrorBoundaryProps
  ) {

    super(props)

    this.state = {
      hasError: false,
    }

  }

  static getDerivedStateFromError():
    WorkspaceErrorBoundaryState {

    return {
      hasError: true,
    }

  }

  render() {

    if (this.state.hasError) {

      return (

        <div
          className="placeholder-page"
          role="alert"
        >

          <div
            style={{
              color: '#f87171',
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={36} />
          </div>

          <div className="eyebrow">
            WORKSPACE ERROR
          </div>

          <h1>
            Unable to load workspace
          </h1>

          <p>
            This module encountered an unexpected
            error. Your other workspaces remain
            available.
          </p>

          <p>
            Return to Overview or reload the
            application to try again. Reloading
            may discard unsaved session data.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '20px',
            }}
          >

            <button
              type="button"
              className="back-button"
              onClick={this.props.onReturn}
            >
              Return to overview
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() =>
                window.location.reload()
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={15} />

              Reload application
            </button>

          </div>

        </div>

      )

    }

    return this.props.children

  }

}


// =========================================
// WORKSPACE LOADING STATE
// =========================================

function WorkspaceLoading({
  page,
}: {
  page: string
}) {

  return (

    <div
      className="placeholder-page"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >

      <div
        style={{
          color: '#b9c9ff',
          marginBottom: '18px',
        }}
      >
        <Loader2 size={34} />
      </div>

      <div className="eyebrow">
        SENTINEL WORKSPACE
      </div>

      <h1>
        Loading {page}
      </h1>

      <p>
        Initialising your intelligence workspace.
      </p>

    </div>

  )

}


// =========================================
// WORKSPACE NAVIGATION
// =========================================

const navigation = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'AI Assistant', icon: MessageSquare },
  { name: 'Phishing Analysis', icon: Scan },
  { name: 'Security Logs', icon: Terminal },
  { name: 'ML Anomalies', icon: Activity },
]

const systemNavigation = [
  { name: 'History', icon: HistoryIcon },
  { name: 'Settings', icon: SettingsIcon },
]


// =========================================
// PERSISTENT CONVERSATION CONFIGURATION
// =========================================

const ACTIVE_CONVERSATION_KEY =
  'sentinel-active-conversation'


// =========================================
// MODEL PERFORMANCE DATA
// =========================================

const performanceData = [
  { name: 'Accuracy', ML: 95.49, Rules: 81.63 },
  { name: 'Precision', ML: 84.71, Rules: 36.43 },
  { name: 'Recall', ML: 70.94, Rules: 94.58 },
  { name: 'F1-score', ML: 77.21, Rules: 52.60 },
]

const metrics = [
  {
    title: 'Model accuracy',
    value: '95.49%',
    description: 'Synthetic test evaluation',
    icon: Activity,
  },
  {
    title: 'False positive rate',
    value: '1.55%',
    description: 'Isolation Forest',
    icon: Shield,
  },
  {
    title: 'Automated tests',
    value: '173/173',
    description: 'Last verified test run',
    icon: Terminal,
  },
  {
    title: 'Intelligence engines',
    value: '03',
    description: 'Rules · ML · LLM',
    icon: Layers,
  },
]


// =========================================
// MAIN APPLICATION
// =========================================

function App() {

  const [activePage, setActivePage] =
    useState('Overview')


  // =========================================
  // RESTORE A SAVED CONVERSATION
  // =========================================

  function openSavedConversation(
    conversationId: string
  ) {

    if (!conversationId.trim()) {
      return
    }

    try {

      localStorage.setItem(
        ACTIVE_CONVERSATION_KEY,
        conversationId
      )

    } catch {

      window.alert(
        'Browser storage is unavailable. Open the AI Assistant and select the conversation from Saved chats instead.'
      )

      return

    }

    setActivePage('AI Assistant')

  }


  // =========================================
  // WORKSPACE MODULE SELECTION
  // =========================================

  function renderWorkspace() {

    switch (activePage) {

      case 'AI Assistant':
        return <Assistant />

      case 'Phishing Analysis':
        return <Phishing />

      case 'Security Logs':
        return <SecurityLogs />

      case 'ML Anomalies':
        return <MLAnomalies />

      case 'History':
        return (
          <History
            onOpenConversation={
              openSavedConversation
            }
          />
        )

      case 'Settings':
        return <Settings />

      default:
        return (

          <div className="placeholder-page">

            <div className="eyebrow">
              SENTINEL WORKSPACE
            </div>

            <h1>
              Page unavailable
            </h1>

            <p>
              The requested workspace
              could not be found.
            </p>

            <button
              type="button"
              className="back-button"
              onClick={() =>
                setActivePage('Overview')
              }
            >
              Return to overview
            </button>

          </div>

        )

    }

  }


  // =========================================
  // APPLICATION INTERFACE
  // =========================================

  return (

    <div className="app-shell">


      {/* =================================
          SIDEBAR
          ================================= */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">

            <Shield
              size={23}
              strokeWidth={1.8}
            />

          </div>

          <div>

            <div className="brand-name">
              sentinel<span>.</span>
            </div>

            <div className="brand-caption">
              INTELLIGENCE SYSTEM
            </div>

          </div>

        </div>


        {/* WORKSPACE SELECTOR */}

        <div className="workspace-selector">

          <div className="workspace-icon">
            <Cpu size={17} />
          </div>

          <div>

            <div className="workspace-name">
              Local workspace
            </div>

            <div className="workspace-caption">
              Personal environment
            </div>

          </div>

        </div>


        {/* WORKSPACE NAVIGATION */}

        <div className="nav-label">
          WORKSPACE
        </div>

        <nav className="navigation">

          {navigation.map((item) => (

            <button
              key={item.name}
              type="button"
              aria-label={item.name}
              aria-current={
                activePage === item.name
                  ? 'page'
                  : undefined
              }
              className={`nav-item ${
                activePage === item.name
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                setActivePage(item.name)
              }
            >

              <item.icon
                size={18}
                strokeWidth={1.7}
              />

              <span>{item.name}</span>

              {activePage === item.name && (

                <ChevronRight
                  size={14}
                  className="nav-arrow"
                />

              )}

            </button>

          ))}

        </nav>


        {/* SYSTEM NAVIGATION */}

        <div className="nav-label system-label">
          SYSTEM
        </div>

        <nav className="navigation">

          {systemNavigation.map((item) => (

            <button
              key={item.name}
              type="button"
              aria-label={item.name}
              aria-current={
                activePage === item.name
                  ? 'page'
                  : undefined
              }
              className={`nav-item ${
                activePage === item.name
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                setActivePage(item.name)
              }
            >

              <item.icon
                size={18}
                strokeWidth={1.7}
              />

              <span>{item.name}</span>

              {activePage === item.name && (

                <ChevronRight
                  size={14}
                  className="nav-arrow"
                />

              )}

            </button>

          ))}

        </nav>


        {/* SIDEBAR FOOTER */}

        <div className="sidebar-footer">

          <div className="privacy-box">

            <Lock size={16} />

            <div>

              <strong>
                Local-first architecture
              </strong>

              <p>
                Designed for private processing.
              </p>

            </div>

          </div>

          <div className="version-label">

            SENTINEL AI

            <span>v0.9</span>

          </div>

        </div>

      </aside>


      {/* =================================
          MAIN WORKSPACE
          ================================= */}

      <main className="main-workspace">

        <header className="topbar">

          <div className="breadcrumb">

            Workspace

            <ChevronRight size={14} />

            <span>{activePage}</span>

          </div>

          <div className="topbar-right">

            <span className="local-indicator" />

            Local environment

          </div>

        </header>


        {/* =================================
            WORKSPACE ERROR PROTECTION
            ================================= */}

        <WorkspaceErrorBoundary
          key={activePage}
          onReturn={() =>
            setActivePage('Overview')
          }
        >

          <Suspense
            fallback={
              <WorkspaceLoading
                page={activePage}
              />
            }
          >


            {/* =================================
                OVERVIEW PAGE
                ================================= */}

            {activePage === 'Overview' ? (

              <div className="dashboard">


                {/* PAGE HEADER */}

                <section className="page-heading">

                  <div className="eyebrow">
                    INTELLIGENCE OVERVIEW
                  </div>

                  <h1>
                    Security intelligence<span>.</span>
                  </h1>

                  <p>
                    Your private workspace for threat
                    detection, investigation and
                    AI-powered security analysis.
                  </p>

                  <div className="model-label">

                    <Cpu size={14} />

                    Llama 3.2

                    <span className="small-divider" />

                    Isolation Forest

                  </div>

                </section>


                {/* METRIC CARDS */}

                <section className="metric-grid">

                  {metrics.map((metric) => (

                    <div
                      className="metric-card"
                      key={metric.title}
                    >

                      <div className="metric-header">

                        <span>{metric.title}</span>

                        <metric.icon
                          size={17}
                          strokeWidth={1.6}
                        />

                      </div>

                      <div className="metric-value">
                        {metric.value}
                      </div>

                      <div className="metric-description">
                        {metric.description}
                      </div>

                    </div>

                  ))}

                </section>


                {/* PERFORMANCE CHART */}

                <section className="analytics-panel">

                  <div className="panel-header">

                    <div>

                      <div className="eyebrow">
                        MODEL EVALUATION
                      </div>

                      <h2>
                        Detection performance
                      </h2>

                      <p>
                        Machine learning versus
                        rule-based detection
                      </p>

                    </div>

                    <div className="panel-tag">
                      Held-out synthetic test
                    </div>

                  </div>


                  <div className="chart-legend">

                    <span>

                      <i className="legend-ml" />

                      Isolation Forest

                    </span>

                    <span>

                      <i className="legend-rules" />

                      Rule-based

                    </span>

                  </div>


                  <div className="chart-container">

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <BarChart
                        data={performanceData}
                        barGap={7}
                        barCategoryGap="35%"
                      >

                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#252933"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: '#9299aa',
                            fontSize: 12,
                          }}
                        />

                        <YAxis
                          domain={[0, 100]}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: '#737b8c',
                            fontSize: 11,
                          }}
                          tickFormatter={(value) =>
                            `${value}%`
                          }
                        />

                        <Tooltip
                          cursor={{
                            fill: '#ffffff05',
                          }}
                          contentStyle={{
                            background: '#171b24',
                            border: '1px solid #303541',
                            borderRadius: '10px',
                            color: '#e2e8f0',
                          }}
                        />

                        <Bar
                          dataKey="ML"
                          fill="#b9c9ff"
                          radius={[4, 4, 0, 0]}
                        />

                        <Bar
                          dataKey="Rules"
                          fill="#3d465b"
                          radius={[4, 4, 0, 0]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                  <div className="chart-note">

                    Evaluated on 1,884 held-out
                    synthetic authentication
                    observations. These results
                    do not establish real-world
                    accuracy.

                  </div>

                </section>


                {/* INTELLIGENCE TOOLS */}

                <section className="quick-access">

                  <div className="section-heading">

                    <h2>Intelligence tools</h2>

                    <span>
                      Explore your workspace
                    </span>

                  </div>

                  <div className="tools-grid">

                    {[

                      {
                        title: 'Phishing analysis',
                        description:
                          'Inspect suspicious emails and URL indicators.',
                        icon: Scan,
                        page: 'Phishing Analysis',
                      },

                      {
                        title: 'Security logs',
                        description:
                          'Investigate authentication events and rapid failures.',
                        icon: Terminal,
                        page: 'Security Logs',
                      },

                      {
                        title: 'ML anomaly detection',
                        description:
                          'Identify unusual authentication behaviour.',
                        icon: Activity,
                        page: 'ML Anomalies',
                      },

                    ].map((tool) => (

                      <button
                        key={tool.title}
                        type="button"
                        className="tool-card"
                        onClick={() =>
                          setActivePage(tool.page)
                        }
                      >

                        <div className="tool-card-top">

                          <div className="tool-icon">

                            <tool.icon
                              size={21}
                              strokeWidth={1.7}
                            />

                          </div>

                          <ArrowUpRight size={17} />

                        </div>

                        <h3>{tool.title}</h3>

                        <p>{tool.description}</p>

                      </button>

                    ))}

                  </div>

                </section>


                {/* AI ASSISTANT QUICK ACCESS */}

                <section className="assistant-panel">

                  <div className="assistant-heading">

                    <div className="tool-icon">
                      <Sparkles size={21} />
                    </div>

                    <div>

                      <h2>
                        Sentinel Assistant
                      </h2>

                      <p>
                        Your local cybersecurity
                        intelligence companion.
                      </p>

                    </div>

                  </div>

                  <button
                    type="button"
                    className="assistant-launcher"
                    onClick={() =>
                      setActivePage('AI Assistant')
                    }
                  >

                    <span>
                      Start a conversation with Sentinel...
                    </span>

                    <div className="send-icon">
                      <ArrowUp size={18} />
                    </div>

                  </button>

                </section>


                {/* DASHBOARD FOOTER */}

                <footer className="dashboard-footer">

                  <span>
                    SENTINEL / INTELLIGENCE SYSTEM
                  </span>

                  <span>
                    Private by design.
                  </span>

                </footer>

              </div>

            ) : (

              renderWorkspace()

            )}

          </Suspense>

        </WorkspaceErrorBoundary>

      </main>

    </div>

  )

}

export default App
