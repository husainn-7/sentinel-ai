
import { useEffect, useState } from 'react'

import {
  History as HistoryIcon,
  MessageSquare,
  Database,
  Mail,
  Terminal,
  Brain,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Lock,
  X,
  CheckCircle,
  FileText,
  Clock,
  Shield,
  MessagesSquare,
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './History.css'

import {
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
  listInvestigations,
  getInvestigation,
  renameInvestigation,
  deleteInvestigation,
  getHistoryStatistics,
} from '../services/history'

import type {
  ConversationSummary,
  ConversationDetail,
  InvestigationSummary,
  InvestigationDetail,
  InvestigationType,
  HistoryStatistics,
} from '../services/history'


// =========================================
// TYPES
// =========================================

interface HistoryProps {
  onOpenConversation: (id: string) => void
}

type HistoryFilter =
  | 'all'
  | 'conversations'
  | 'investigations'

type InvestigationFilter =
  | 'all'
  | InvestigationType

type HistoryRecord =

  | {
      kind: 'conversation'
      data: ConversationSummary
    }

  | {
      kind: 'investigation'
      data: InvestigationSummary
    }

type SelectedRecord =

  | {
      kind: 'conversation'
      data: ConversationDetail
    }

  | {
      kind: 'investigation'
      data: InvestigationDetail
    }

interface RecordReference {
  id: string
  kind: HistoryRecord['kind']
}


// =========================================
// CONFIGURATION
// =========================================

const PAGE_SIZE = 20

const SEARCH_LIMIT = 100

const MAX_TITLE_LENGTH = 120

const ACTIVE_CONVERSATION_KEY =
  'sentinel-active-conversation'


const historyFilters: {
  value: HistoryFilter
  label: string
}[] = [

  {
    value: 'all',
    label: 'All records',
  },

  {
    value: 'conversations',
    label: 'Conversations',
  },

  {
    value: 'investigations',
    label: 'Investigations',
  },

]


const investigationFilters: {
  value: InvestigationFilter
  label: string
}[] = [

  {
    value: 'all',
    label: 'All investigation types',
  },

  {
    value: 'phishing',
    label: 'Phishing analysis',
  },

  {
    value: 'logs',
    label: 'Security logs',
  },

  {
    value: 'anomaly',
    label: 'ML anomalies',
  },

]


// =========================================
// FORMATTING HELPERS
// =========================================

function formatDate(value: string) {

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(
    undefined,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  )

}


function getInvestigationLabel(
  type: InvestigationType
) {

  switch (type) {

    case 'phishing':
      return 'Phishing analysis'

    case 'logs':
      return 'Security logs'

    case 'anomaly':
      return 'ML anomalies'

  }

}


function getInvestigationIcon(
  type: InvestigationType
) {

  switch (type) {

    case 'phishing':
      return Mail

    case 'logs':
      return Terminal

    case 'anomaly':
      return Brain

  }

}


function getInvestigationColor(
  type: InvestigationType
) {

  switch (type) {

    case 'phishing':
      return '#fb923c'

    case 'logs':
      return '#38bdf8'

    case 'anomaly':
      return '#c084fc'

  }

}


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


function getRecordDate(
  record: HistoryRecord
) {

  return record.kind === 'conversation'

    ? record.data.updated_at

    : record.data.created_at

}


function getErrorMessage(
  exception: unknown
) {

  return exception instanceof Error

    ? exception.message

    : 'Unable to communicate with local history.'

}


function formatFieldName(value: string) {

  return value
    .replace(/_/g, ' ')
    .replace(
      /^./,
      (character) => character.toUpperCase()
    )

}


// =========================================
// SAFE MARKDOWN RENDERING
// =========================================

function HistoryMarkdown({
  content,
}: {
  content: string
}) {

  return (

    <div className="markdown-content history-markdown">

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

        {content}

      </ReactMarkdown>

    </div>

  )

}


// =========================================
// STRUCTURED FINDINGS RENDERER
// =========================================

function FindingValue({
  value,
}: {
  value: unknown
}) {

  if (
    value === null ||
    value === undefined
  ) {

    return (

      <span className="history-muted">
        Not available
      </span>

    )

  }


  if (typeof value === 'boolean') {

    return (

      <span>
        {value ? 'Yes' : 'No'}
      </span>

    )

  }


  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {

    return (

      <span className="history-finding-value">
        {String(value)}
      </span>

    )

  }


  if (Array.isArray(value)) {

    if (value.length === 0) {

      return (

        <span className="history-muted">
          No findings
        </span>

      )

    }

    return (

      <div className="history-finding-array">

        {value.map((item, index) => (

          <div
            className="history-finding-array-item"
            key={index}
          >

            {typeof item === 'object' &&
              item !== null && (

              <div className="history-finding-index">
                Entry {index + 1}
              </div>

            )}

            <FindingValue value={item} />

          </div>

        ))}

      </div>

    )

  }


  if (typeof value === 'object') {

    const entries = Object.entries(
      value as Record<string, unknown>
    )

    if (entries.length === 0) {

      return (

        <span className="history-muted">
          No findings
        </span>

      )

    }

    return (

      <div className="history-finding-object">

        {entries.map(([key, item]) => (

          <div
            className="history-finding-field"
            key={key}
          >

            <span className="history-field-label">

              {formatFieldName(key)}

            </span>

            <FindingValue value={item} />

          </div>

        ))}

      </div>

    )

  }

  return <span>{String(value)}</span>

}


// =========================================
// MAIN HISTORY COMPONENT
// =========================================

function History({
  onOpenConversation,
}: HistoryProps) {

  const [statistics, setStatistics] =
    useState<HistoryStatistics | null>(null)

  const [records, setRecords] =
    useState<HistoryRecord[]>([])

  const [filter, setFilter] =
    useState<HistoryFilter>('all')

  const [investigationFilter, setInvestigationFilter] =
    useState<InvestigationFilter>('all')

  const [searchInput, setSearchInput] =
    useState('')

  const [query, setQuery] =
    useState('')

  const [page, setPage] =
    useState(0)

  const [reloadVersion, setReloadVersion] =
    useState(0)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isDetailLoading, setIsDetailLoading] =
    useState(false)

  const [isMutating, setIsMutating] =
    useState(false)

  const [error, setError] =
    useState('')

  const [statisticsError, setStatisticsError] =
    useState('')

  const [detailError, setDetailError] =
    useState('')

  const [operationError, setOperationError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const [selectedReference, setSelectedReference] =
    useState<RecordReference | null>(null)

  const [selectedRecord, setSelectedRecord] =
    useState<SelectedRecord | null>(null)

  const [renameTarget, setRenameTarget] =
    useState<HistoryRecord | null>(null)

  const [renameTitle, setRenameTitle] =
    useState('')

  const [deleteTarget, setDeleteTarget] =
    useState<HistoryRecord | null>(null)

  const [searchTruncated, setSearchTruncated] =
    useState(false)


// =========================================
// LOAD DATABASE STATISTICS
// =========================================

  useEffect(() => {

    const controller = new AbortController()

    async function loadStatistics() {

      try {

        const data =
          await getHistoryStatistics(
            controller.signal
          )

        if (!controller.signal.aborted) {

          setStatistics(data)

        }

      } catch (exception) {

        if (!controller.signal.aborted) {

          setStatistics(null)

          setStatisticsError(
            getErrorMessage(exception)
          )

        }

      }

    }

    void loadStatistics()

    return () => {

      controller.abort()

    }

  }, [reloadVersion])


// =========================================
// LOAD AND SEARCH SAVED RECORDS
// =========================================

  useEffect(() => {

    const controller = new AbortController()

    async function loadRecords() {

      try {

        const includeConversations =
          filter !== 'investigations' &&
          investigationFilter === 'all'

        const includeInvestigations =
          filter !== 'conversations'

        const type =

          investigationFilter === 'all'

            ? undefined

            : investigationFilter

        const collected: HistoryRecord[] = []

        let truncated = false


        // The backend supports pagination for
        // ordinary listing, but not search offsets.

        if (includeConversations) {

          let offset = 0

          while (true) {

            const response =
              await listConversations({

                query,
                limit: SEARCH_LIMIT,
                offset,
                signal: controller.signal,

              })

            collected.push(

              ...response.conversations.map(

                (data): HistoryRecord => ({

                  kind: 'conversation',
                  data,

                })

              )

            )

            if (query) {

              if (
                response.conversations.length >=
                SEARCH_LIMIT
              ) {

                truncated = true

              }

              break

            }

            if (
              response.conversations.length <
              SEARCH_LIMIT
            ) {

              break

            }

            offset +=
              response.conversations.length

          }

        }


        if (includeInvestigations) {

          let offset = 0

          while (true) {

            const response =
              await listInvestigations({

                type,
                query,
                limit: SEARCH_LIMIT,
                offset,
                signal: controller.signal,

              })

            collected.push(

              ...response.investigations.map(

                (data): HistoryRecord => ({

                  kind: 'investigation',
                  data,

                })

              )

            )

            if (query) {

              if (
                response.investigations.length >=
                SEARCH_LIMIT
              ) {

                truncated = true

              }

              break

            }

            if (
              response.investigations.length <
              SEARCH_LIMIT
            ) {

              break

            }

            offset +=
              response.investigations.length

          }

        }


        collected.sort(

          (a, b) =>

            getRecordDate(b).localeCompare(
              getRecordDate(a)
            )

        )


        if (!controller.signal.aborted) {

          setRecords(collected)

          setSearchTruncated(truncated)

          setPage(0)

        }

      } catch (exception) {

        if (!controller.signal.aborted) {

          setRecords([])

          setError(
            getErrorMessage(exception)
          )

        }

      } finally {

        if (!controller.signal.aborted) {

          setIsLoading(false)

        }

      }

    }

    void loadRecords()

    return () => {

      controller.abort()

    }

  }, [

    filter,
    investigationFilter,
    query,
    reloadVersion,

  ])


// =========================================
// LOAD SELECTED RECORD DETAILS
// =========================================

  useEffect(() => {

    if (!selectedReference) {
      return
    }

    const controller = new AbortController()

    const reference = selectedReference

    async function loadDetails() {

      try {

        let record: SelectedRecord

        if (reference.kind === 'conversation') {

          const data =
            await getConversation(
              reference.id,
              controller.signal
            )

          record = {

            kind: 'conversation',
            data,

          }

        } else {

          const data =
            await getInvestigation(
              reference.id,
              controller.signal
            )

          record = {

            kind: 'investigation',
            data,

          }

        }

        if (!controller.signal.aborted) {

          setSelectedRecord(record)

        }

      } catch (exception) {

        if (!controller.signal.aborted) {

          setDetailError(
            getErrorMessage(exception)
          )

        }

      } finally {

        if (!controller.signal.aborted) {

          setIsDetailLoading(false)

        }

      }

    }

    void loadDetails()

    return () => {

      controller.abort()

    }

  }, [

    selectedReference,
    reloadVersion,

  ])


// =========================================
// KEYBOARD HANDLING
// =========================================

  useEffect(() => {

    function handleKeyDown(event: KeyboardEvent) {

      if (
        event.key !== 'Escape' ||
        isMutating
      ) {

        return

      }

      if (deleteTarget) {

        setDeleteTarget(null)
        setOperationError('')

      } else if (renameTarget) {

        setRenameTarget(null)
        setOperationError('')

      } else {

        setSelectedReference(null)
        setSelectedRecord(null)
        setDetailError('')
        setIsDetailLoading(false)

      }

    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {

      window.removeEventListener(
        'keydown',
        handleKeyDown
      )

    }

  }, [

    deleteTarget,
    renameTarget,
    isMutating,

  ])


// =========================================
// USER CONTROLS
// =========================================

  function prepareRecordList() {
    setIsLoading(true)
    setError('')
    setSearchTruncated(false)
  }

  function prepareDetails() {
    setSelectedRecord(null)
    setDetailError('')
    setIsDetailLoading(true)
  }

  function closeRecord() {
    setSelectedReference(null)
    setSelectedRecord(null)
    setDetailError('')
    setIsDetailLoading(false)
  }

  function reloadHistoryData(reloadDetails = true) {
    setStatisticsError('')
    prepareRecordList()

    if (reloadDetails && selectedReference) {
      prepareDetails()
    }

    setReloadVersion((previous) => previous + 1)
  }

  function refreshHistory() {

    setNotice('')
    setOperationError('')

    reloadHistoryData()

  }


  function changeFilter(
    value: HistoryFilter
  ) {

    if (
      value !== filter ||
      (
        value !== 'investigations' &&
        investigationFilter !== 'all'
      )
    ) {
      prepareRecordList()
    }

    setFilter(value)

    setPage(0)

    closeRecord()

    if (value !== 'investigations') {

      setInvestigationFilter('all')

    }

  }


  function searchHistory() {

    setPage(0)

    closeRecord()

    const nextQuery = searchInput.trim()

    if (nextQuery !== query) {
      prepareRecordList()
    }

    setQuery(nextQuery)

  }


  function clearSearch() {

    if (query !== '') {
      prepareRecordList()
    }

    setSearchInput('')
    setQuery('')
    setPage(0)
    closeRecord()

  }


  function viewRecord(
    record: HistoryRecord
  ) {

    prepareDetails()

    setSelectedReference({

      id: record.data.id,
      kind: record.kind,

    })

  }


  function beginRename(
    record: HistoryRecord
  ) {

    setOperationError('')
    setNotice('')
    setRenameTarget(record)
    setRenameTitle(record.data.title)

  }


  function beginDelete(
    record: HistoryRecord
  ) {

    setOperationError('')
    setNotice('')
    setDeleteTarget(record)

  }


// =========================================
// RENAME RECORD
// =========================================

  async function confirmRename() {

    if (
      !renameTarget ||
      isMutating
    ) {

      return

    }

    const title = renameTitle.trim()

    if (!title) {

      setOperationError(
        'Please enter a record title.'
      )

      return

    }

    if (title.length > MAX_TITLE_LENGTH) {

      setOperationError(
        'Titles must not exceed 120 characters.'
      )

      return

    }

    setIsMutating(true)
    setOperationError('')

    try {

      if (renameTarget.kind === 'conversation') {

        await renameConversation(
          renameTarget.data.id,
          title
        )

      } else {

        await renameInvestigation(
          renameTarget.data.id,
          title
        )

      }

      setRenameTarget(null)

      setNotice(
        'Record renamed successfully.'
      )

      reloadHistoryData()

    } catch (exception) {

      setOperationError(
        getErrorMessage(exception)
      )

    } finally {

      setIsMutating(false)

    }

  }


// =========================================
// DELETE RECORD
// =========================================

  async function confirmDelete() {

    if (
      !deleteTarget ||
      isMutating
    ) {

      return

    }

    const target = deleteTarget

    setIsMutating(true)
    setOperationError('')

    try {

      if (target.kind === 'conversation') {

        await deleteConversation(
          target.data.id
        )

        try {

          if (
            localStorage.getItem(
              ACTIVE_CONVERSATION_KEY
            ) === target.data.id
          ) {

            localStorage.removeItem(
              ACTIVE_CONVERSATION_KEY
            )

          }

        } catch {

          // Browser storage may be unavailable.
          // The Assistant also handles missing IDs.

        }

      } else {

        await deleteInvestigation(
          target.data.id
        )

      }


      const deletedSelectedRecord =
        selectedReference?.id === target.data.id &&
        selectedReference.kind === target.kind

      if (deletedSelectedRecord) {

        closeRecord()

      }

      setDeleteTarget(null)

      setNotice(
        'Record deleted successfully.'
      )

      reloadHistoryData(!deletedSelectedRecord)

    } catch (exception) {

      setOperationError(
        getErrorMessage(exception)
      )

    } finally {

      setIsMutating(false)

    }

  }


// =========================================
// PAGINATION AND STATISTICS
// =========================================

  const totalPages = Math.max(

    1,

    Math.ceil(
      records.length / PAGE_SIZE
    )

  )

  const currentPage = Math.min(
    page,
    totalPages - 1
  )

  const visibleRecords = records.slice(

    currentPage * PAGE_SIZE,

    (currentPage + 1) * PAGE_SIZE

  )


  const metrics = [

    {
      title: 'Conversations',

      value:
        statistics?.conversations
          .total_conversations,

      description: 'Saved AI conversations',

      icon: MessageSquare,

      color: '#b9c9ff',
    },

    {
      title: 'Messages',

      value:
        statistics?.conversations
          .total_messages,

      description: 'Stored conversation messages',

      icon: MessagesSquare,

      color: '#38bdf8',
    },

    {
      title: 'Investigations',

      value:
        statistics?.investigations
          .total_investigations,

      description: 'Saved security assessments',

      icon: Database,

      color: '#c084fc',
    },

    {
      title: 'AI reports',

      value:
        statistics?.investigations
          .ai_reports,

      description: 'Saved AI security reports',

      icon: Brain,

      color: '#4ade80',
    },

  ]


// =========================================
// USER INTERFACE
// =========================================

  return (

    <div className="history-workspace">


      {/* PAGE HEADER */}

      <section className="history-heading">

        <div className="eyebrow">

          LOCAL WORKSPACE / PERSISTENT INTELLIGENCE

        </div>

        <div className="history-heading-row">

          <div>

            <h1>

              History<span>.</span>

            </h1>

            <p>

              Explore, search and manage your saved
              conversations and security investigations.

            </p>

          </div>

          <button
            type="button"
            className="history-secondary-button"
            onClick={refreshHistory}
            disabled={isLoading || isMutating}
          >

            <RefreshCw
              size={16}
              className={
                isLoading
                  ? 'history-spinner'
                  : ''
              }
            />

            Refresh

          </button>

        </div>

        <div className="history-engine-label">

          <Database size={14} />

          Persistent SQLite storage

          <span className="small-divider" />

          Local intelligence archive

        </div>

      </section>


      {/* DATABASE STATISTICS */}

      <section className="history-metric-grid">

        {metrics.map((metric) => (

          <article
            key={metric.title}
            className="history-metric-card"
          >

            <div className="history-metric-header">

              <span>{metric.title}</span>

              <metric.icon
                size={19}
                strokeWidth={1.7}
                color={metric.color}
              />

            </div>

            <strong style={{
              color: metric.color,
            }}>

              {metric.value?.toLocaleString() ?? '—'}

            </strong>

            <p>{metric.description}</p>

          </article>

        ))}

      </section>


      {statisticsError && (

        <div
          className="history-error"
          role="alert"
        >

          <AlertCircle size={17} />

          <span>

            Statistics unavailable: {statisticsError}

          </span>

        </div>

      )}


      {/* INVESTIGATION DISTRIBUTION */}

      {statistics && (

        <section className="history-distribution">

          {[

            {
              title: 'Phishing cases',

              count:
                statistics.investigations
                  .phishing_investigations,

              icon: Mail,

              color: '#fb923c',
            },

            {
              title: 'Log investigations',

              count:
                statistics.investigations
                  .log_investigations,

              icon: Terminal,

              color: '#38bdf8',
            },

            {
              title: 'ML investigations',

              count:
                statistics.investigations
                  .anomaly_investigations,

              icon: Brain,

              color: '#c084fc',
            },

          ].map((item) => (

            <div
              className="history-distribution-item"
              key={item.title}
            >

              <item.icon
                size={17}
                color={item.color}
              />

              <span>{item.title}</span>

              <strong>{item.count}</strong>

            </div>

          ))}

        </section>

      )}


      {/* SEARCH AND FILTER PANEL */}

      <section className="history-record-panel">

        <div className="history-panel-header">

          <div className="history-panel-title">

            <div className="history-panel-icon">

              <HistoryIcon size={22} />

            </div>

            <div>

              <h2>Saved intelligence</h2>

              <p>

                Your locally stored workspace records.

              </p>

            </div>

          </div>

        </div>


        {/* MAIN FILTERS */}

        <div className="history-tabs">

          {historyFilters.map((item) => (

            <button
              type="button"
              key={item.value}
              className={`history-tab ${
                filter === item.value
                  ? 'active'
                  : ''
              }`}
              aria-pressed={
                filter === item.value
              }
              disabled={isMutating}
              onClick={() =>
                changeFilter(item.value)
              }
            >

              {item.label}

            </button>

          ))}

        </div>


        {/* SEARCH CONTROLS */}

        <div className="history-search-controls">

          <form
            className="history-search-form"
            onSubmit={(event) => {

              event.preventDefault()

              searchHistory()

            }}
          >

            <div className="history-search-input">

              <Search size={17} />

              <input
                type="search"
                value={searchInput}
                maxLength={200}
                disabled={isMutating}
                placeholder="Search saved intelligence..."
                aria-label="Search saved history"
                onChange={(event) =>
                  setSearchInput(event.target.value)
                }
              />

              {searchInput && (

                <button
                  type="button"
                  className="history-icon-button"
                  aria-label="Clear search"
                  disabled={isMutating}
                  onClick={clearSearch}
                >

                  <X size={16} />

                </button>

              )}

            </div>

            <button
              type="submit"
              className="history-secondary-button"
              disabled={isMutating}
            >

              Search

            </button>

          </form>


          {filter === 'investigations' && (

            <select
              className="history-type-select"
              value={investigationFilter}
              aria-label="Investigation type"
              disabled={isMutating}
              onChange={(event) => {

                const nextFilter =
                  event.target.value as InvestigationFilter

                if (nextFilter !== investigationFilter) {
                  prepareRecordList()
                }

                setInvestigationFilter(nextFilter)

                setPage(0)

                closeRecord()

              }}
            >

              {investigationFilters.map((item) => (

                <option
                  key={item.value}
                  value={item.value}
                >

                  {item.label}

                </option>

              ))}

            </select>

          )}

        </div>


        {/* SUCCESS NOTIFICATION */}

        {notice && (

          <div
            className="history-success"
            role="status"
          >

            <CheckCircle size={17} />

            <span>{notice}</span>

            <button
              type="button"
              className="history-icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >

              <X size={15} />

            </button>

          </div>

        )}


        {/* ERROR STATE */}

        {error && (

          <div
            className="history-error"
            role="alert"
          >

            <AlertCircle size={18} />

            <span>{error}</span>

          </div>

        )}


        {/* LOADING STATE */}

        {isLoading && (

          <div
            className="history-loading"
            role="status"
          >

            <Loader2
              size={28}
              className="history-spinner"
            />

            <h3>Loading saved intelligence</h3>

            <p>

              Retrieving records from local SQLite.

            </p>

          </div>

        )}


        {/* EMPTY STATE */}

        {!isLoading &&
          !error &&
          records.length === 0 && (

          <div className="history-empty-state">

            <div className="history-empty-icon">

              <HistoryIcon
                size={32}
                strokeWidth={1.5}
              />

            </div>

            <h3>

              {query

                ? 'No matching records'

                : 'No saved records yet'}

            </h3>

            <p>

              {query

                ? 'Try another search term or change your filters.'

                : 'Enable saving when chatting with Sentinel or running an investigation.'}

            </p>

          </div>

        )}


        {/* SAVED RECORD LIST */}

        {!isLoading &&
          !error &&
          records.length > 0 && (

          <>

            <div className="history-list-meta">

              <span>

                {records.length}

                {' '}

                {records.length === 1
                  ? 'record'
                  : 'records'}

                {query
                  ? ' matching your search'
                  : ' available'}

              </span>

              <span>

                Newest first

              </span>

            </div>


            {searchTruncated && (

              <div className="history-search-warning">

                <AlertCircle size={15} />

                Search results may be limited to 100
                records per category. Refine your search.

              </div>

            )}


            <div className="history-record-list">

              {visibleRecords.map((record) => {

                const isConversation =
                  record.kind === 'conversation'

                const RecordIcon =

                  record.kind === 'conversation'

                    ? MessageSquare

                    : getInvestigationIcon(
                        record.data.investigation_type
                      )

                const color =

                  record.kind === 'conversation'

                    ? '#b9c9ff'

                    : getInvestigationColor(
                        record.data.investigation_type
                      )

                const category =

                  record.kind === 'conversation'

                    ? 'AI conversation'

                    : getInvestigationLabel(
                        record.data.investigation_type
                      )

                const selected =

                  selectedReference?.id ===
                    record.data.id &&

                  selectedReference.kind ===
                    record.kind


                return (

                  <article
                    key={`${record.kind}-${record.data.id}`}
                    className={`history-record ${
                      selected
                        ? 'selected'
                        : ''
                    }`}
                  >

                    <div
                      className="history-record-icon"
                      style={{
                        color,
                        backgroundColor: `${color}12`,
                      }}
                    >

                      <RecordIcon size={21} />

                    </div>


                    <button
                      type="button"
                      className="history-record-main"
                      disabled={isMutating}
                      onClick={() =>
                        viewRecord(record)
                      }
                    >

                      <strong>

                        {record.data.title}

                      </strong>

                      <div className="history-record-meta">

                        <span>{category}</span>

                        <span className="history-meta-dot" />

                        {record.kind === 'conversation' && (

                          <span>

                            {record.data.message_count}

                            {' '}messages

                          </span>

                        )}


                        {record.kind === 'investigation' && (

                          <span>

                            {record.data.has_ai_report

                              ? 'AI report included'

                              : 'Structured findings'}

                          </span>

                        )}

                      </div>


                      {isConversation &&
                        record.kind === 'conversation' &&
                        record.data.last_message && (

                        <p className="history-record-preview">

                          {record.data.last_message}

                        </p>

                      )}


                      <span className="history-record-date">

                        <Clock size={12} />

                        {formatDate(
                          getRecordDate(record)
                        )}

                      </span>

                    </button>


                    <div className="history-record-actions">

                      {record.kind === 'investigation' &&
                        record.data.risk_level && (

                        <span
                          className="history-risk-label"
                          style={{
                            color: getRiskColor(
                              record.data.risk_level
                            ),
                          }}
                        >

                          {record.data.risk_level}

                        </span>

                      )}


                      <button
                        type="button"
                        className="history-icon-button"
                        title="Rename record"
                        aria-label={`Rename ${record.data.title}`}
                        disabled={isMutating}
                        onClick={() =>
                          beginRename(record)
                        }
                      >

                        <Pencil size={15} />

                      </button>


                      <button
                        type="button"
                        className="history-icon-button history-delete-button"
                        title="Delete record"
                        aria-label={`Delete ${record.data.title}`}
                        disabled={isMutating}
                        onClick={() =>
                          beginDelete(record)
                        }
                      >

                        <Trash2 size={15} />

                      </button>


                      <button
                        type="button"
                        className="history-icon-button"
                        title="View record"
                        aria-label={`View ${record.data.title}`}
                        disabled={isMutating}
                        onClick={() =>
                          viewRecord(record)
                        }
                      >

                        <ChevronRight size={19} />

                      </button>

                    </div>

                  </article>

                )

              })}

            </div>


            {/* PAGINATION */}

            {totalPages > 1 && (

              <div className="history-pagination">

                <button
                  type="button"
                  className="history-secondary-button"
                  disabled={
                    currentPage === 0 ||
                    isMutating
                  }
                  onClick={() =>
                    setPage(currentPage - 1)
                  }
                >

                  <ChevronLeft size={16} />

                  Previous

                </button>

                <span>

                  Page {currentPage + 1}

                  {' of '}

                  {totalPages}

                </span>

                <button
                  type="button"
                  className="history-secondary-button"
                  disabled={
                    currentPage >= totalPages - 1 ||
                    isMutating
                  }
                  onClick={() =>
                    setPage(currentPage + 1)
                  }
                >

                  Next

                  <ChevronRight size={16} />

                </button>

              </div>

            )}

          </>

        )}

      </section>


      {/* RECORD DETAIL PANEL */}

      {selectedReference && (

        <section className="history-detail-panel">

          <div className="history-detail-header">

            <div>

              <div className="eyebrow">

                SAVED RECORD DETAILS

              </div>

              <h2>

                {selectedRecord?.data.title ??
                  'Record details'}

              </h2>

            </div>

            <button
              type="button"
              className="history-icon-button"
              aria-label="Close record details"
              onClick={() =>
                closeRecord()
              }
            >

              <X size={21} />

            </button>

          </div>


          {isDetailLoading && (

            <div
              className="history-loading"
              role="status"
            >

              <Loader2
                size={26}
                className="history-spinner"
              />

              <p>Retrieving record details...</p>

            </div>

          )}


          {detailError && (

            <div
              className="history-error"
              role="alert"
            >

              <AlertCircle size={17} />

              {detailError}

            </div>

          )}


          {/* SAVED CONVERSATION */}

          {!isDetailLoading &&
            selectedRecord?.kind === 'conversation' && (

            <>

              <div className="history-detail-metadata">

                <span>

                  <MessageSquare size={15} />

                  AI conversation

                </span>

                <span>

                  {selectedRecord.data.messages.length}

                  {' '}messages

                </span>

                <span>

                  Created:

                  {' '}

                  {formatDate(
                    selectedRecord.data.created_at
                  )}

                </span>

              </div>


              <div className="history-detail-toolbar">

                <button
                  type="button"
                  className="history-primary-button"
                  disabled={isMutating}
                  onClick={() =>
                    onOpenConversation(
                      selectedRecord.data.id
                    )
                  }
                >

                  <MessageSquare size={17} />

                  Open in AI Assistant

                  <ArrowUpRight size={15} />

                </button>

              </div>


              <div className="history-message-list">

                {selectedRecord.data.messages.length === 0 && (

                  <p className="history-muted">

                    This conversation has no saved messages.

                  </p>

                )}


                {selectedRecord.data.messages.map(
                  (message) => (

                    <article
                      key={message.id}
                      className={`history-message ${message.role}`}
                    >

                      <div className="history-message-header">

                        <strong>

                          {message.role === 'user'

                            ? 'You'

                            : 'Sentinel AI'}

                        </strong>

                        <span>

                          {formatDate(
                            message.created_at
                          )}

                        </span>

                      </div>


                      {message.role === 'assistant' ? (

                        <HistoryMarkdown
                          content={message.content}
                        />

                      ) : (

                        <div className="history-message-text">

                          {message.content}

                        </div>

                      )}

                    </article>

                  )
                )}

              </div>

            </>

          )}


          {/* SAVED INVESTIGATION */}

          {!isDetailLoading &&
            selectedRecord?.kind === 'investigation' && (

            <>

              <div className="history-detail-metadata">

                <span>

                  <Shield size={15} />

                  {getInvestigationLabel(
                    selectedRecord.data.investigation_type
                  )}

                </span>

                <span>

                  {formatDate(
                    selectedRecord.data.created_at
                  )}

                </span>

                {selectedRecord.data.risk_level && (

                  <span
                    style={{
                      color: getRiskColor(
                        selectedRecord.data.risk_level
                      ),
                    }}
                  >

                    {selectedRecord.data.risk_level}

                    {' '}risk

                  </span>

                )}

              </div>


              <div className="history-investigation-status">

                <span>Status</span>

                <strong>

                  {formatFieldName(
                    selectedRecord.data.status
                  )}

                </strong>

              </div>


              {/* STRUCTURED FINDINGS */}

              <section className="history-detail-section">

                <div className="history-section-heading">

                  <Database size={19} />

                  <div>

                    <h3>Investigation findings</h3>

                    <p>

                      Original structured analysis stored
                      by the detection engine.

                    </p>

                  </div>

                </div>


                <div className="history-findings">

                  <FindingValue
                    value={
                      selectedRecord.data.analysis
                    }
                  />

                </div>

              </section>


              {/* SAVED AI REPORT */}

              <section className="history-detail-section">

                <div className="history-section-heading">

                  <FileText size={19} />

                  <div>

                    <h3>AI security report</h3>

                    <p>

                      Previously generated assessment.

                    </p>

                  </div>

                </div>


                {selectedRecord.data.ai_report ? (

                  <>

                    <HistoryMarkdown
                      content={
                        selectedRecord.data.ai_report
                      }
                    />

                    <div className="history-advisory">

                      <AlertCircle size={15} />

                      AI-generated advice may contain errors.
                      Verify recommendations independently.

                    </div>

                  </>

                ) : (

                  <p className="history-muted">

                    No AI report was saved with this investigation.

                  </p>

                )}

              </section>


              <div className="history-record-id">

                Record ID: {selectedRecord.data.id}

              </div>

            </>

          )}

        </section>

      )}


      {/* RENAME DIALOG */}

      {renameTarget && (

        <div className="history-modal-overlay">

          <section
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-rename-heading"
          >

            <div className="history-modal-icon">

              <Pencil size={23} />

            </div>

            <h2 id="history-rename-heading">

              Rename record

            </h2>

            <p>

              Choose a new title for this saved record.

            </p>


            <form
              onSubmit={(event) => {

                event.preventDefault()

                void confirmRename()

              }}
            >

              <label
                className="history-modal-label"
                htmlFor="history-rename-title"
              >

                Record title

              </label>

              <input
                id="history-rename-title"
                className="history-modal-input"
                type="text"
                value={renameTitle}
                maxLength={MAX_TITLE_LENGTH}
                disabled={isMutating}
                autoFocus
                onChange={(event) =>
                  setRenameTitle(event.target.value)
                }
              />

              <div className="history-title-count">

                {renameTitle.length}

                /{MAX_TITLE_LENGTH}

              </div>


              {operationError && (

                <div
                  className="history-error"
                  role="alert"
                >

                  <AlertCircle size={16} />

                  {operationError}

                </div>

              )}


              <div className="history-modal-actions">

                <button
                  type="button"
                  className="history-secondary-button"
                  disabled={isMutating}
                  onClick={() => {

                    setRenameTarget(null)

                    setOperationError('')

                  }}
                >

                  Cancel

                </button>

                <button
                  type="submit"
                  className="history-primary-button"
                  disabled={
                    isMutating ||
                    !renameTitle.trim()
                  }
                >

                  {isMutating && (

                    <Loader2
                      size={15}
                      className="history-spinner"
                    />

                  )}

                  Save title

                </button>

              </div>

            </form>

          </section>

        </div>

      )}


      {/* DELETE CONFIRMATION DIALOG */}

      {deleteTarget && (

        <div className="history-modal-overlay">

          <section
            className="history-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="history-delete-heading"
          >

            <div className="history-modal-icon danger">

              <Trash2 size={23} />

            </div>

            <h2 id="history-delete-heading">

              Delete record?

            </h2>

            <p>

              You are about to delete:

            </p>

            <div className="history-delete-target">

              {deleteTarget.data.title}

            </div>

            <p>

              {deleteTarget.kind === 'conversation'

                ? 'The conversation and all its saved messages will be removed.'

                : 'The investigation findings and associated AI report will be removed.'}

            </p>

            <div className="history-delete-warning">

              <AlertCircle size={17} />

              This action cannot be undone through Sentinel.

            </div>


            {operationError && (

              <div
                className="history-error"
                role="alert"
              >

                <AlertCircle size={16} />

                {operationError}

              </div>

            )}


            <div className="history-modal-actions">

              <button
                type="button"
                className="history-secondary-button"
                disabled={isMutating}
                autoFocus
                onClick={() => {

                  setDeleteTarget(null)

                  setOperationError('')

                }}
              >

                Cancel

              </button>

              <button
                type="button"
                className="history-danger-button"
                disabled={isMutating}
                onClick={() =>
                  void confirmDelete()
                }
              >

                {isMutating ? (

                  <Loader2
                    size={16}
                    className="history-spinner"
                  />

                ) : (

                  <Trash2 size={16} />

                )}

                Delete record

              </button>

            </div>

          </section>

        </div>

      )}


      {/* PRIVACY FOOTER */}

      <footer className="history-footer">

        <Lock size={14} />

        <span>

          Local SQLite storage.
          No cloud synchronisation.
          Stored records are not encrypted.
          Deletion is not guaranteed secure erasure.

        </span>

      </footer>

    </div>

  )

}

export default History
