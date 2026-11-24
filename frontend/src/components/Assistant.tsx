
import { useState, useRef, useEffect } from 'react'

import {
  Sparkles,
  ArrowUp,
  Shield,
  User,
  Square,
  AlertCircle,
  Lock,
  Scan,
  Terminal,
  Activity,
  Copy,
  Check,
  Brain,
  Database,
  History,
  Plus,
  RefreshCw,
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  Prism as SyntaxHighlighter,
} from 'react-syntax-highlighter'

import {
  vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

import {
  listConversations,
  getConversation,
  HistoryAPIError,
} from '../services/history'

import type {
  ConversationSummary,
  ChatStorageMetadata,
} from '../services/history'

import './Assistant.css'


// =========================================
// CONFIGURATION
// =========================================

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY_MESSAGES = 6
const MAX_HISTORY_CHARACTERS = 6000

const ACTIVE_CONVERSATION_KEY =
  'sentinel-active-conversation'


// =========================================
// TYPES
// =========================================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  incomplete?: boolean
  saved?: boolean
}

interface ContextMessage {
  role: 'user' | 'assistant'
  content: string
}


// =========================================
// LOCAL CONVERSATION POINTER
// =========================================

function readActiveConversation(): string | null {
  try {
    return localStorage.getItem(
      ACTIVE_CONVERSATION_KEY
    )
  } catch {
    return null
  }
}

function rememberActiveConversation(
  id: string | null
) {
  try {
    if (id) {
      localStorage.setItem(
        ACTIVE_CONVERSATION_KEY,
        id,
      )
    } else {
      localStorage.removeItem(
        ACTIVE_CONVERSATION_KEY
      )
    }
  } catch {
    // SQLite history remains available
    // even when browser storage is disabled.
  }
}


// =========================================
// CONVERSATION CONTEXT
// =========================================

function buildConversationHistory(
  messages: Message[]
): ContextMessage[] {

  const validMessages = messages
    .filter(
      (message) =>
        message.content.trim() &&
        !message.incomplete
    )
    .slice(-MAX_HISTORY_MESSAGES)

  const history: ContextMessage[] = []

  let totalCharacters = 0

  for (const message of [...validMessages].reverse()) {

    const content = message.content.trim()

    if (
      totalCharacters + content.length >
      MAX_HISTORY_CHARACTERS
    ) {
      break
    }

    history.unshift({
      role: message.role,
      content,
    })

    totalCharacters += content.length
  }

  return history
}


// =========================================
// SUGGESTED PROMPTS
// =========================================

const suggestions = [
  {
    icon: Shield,
    title: 'Threat intelligence',
    description: 'Explain common cybersecurity threats.',
    prompt: 'Explain the most common cybersecurity threats and how to defend against them.',
  },
  {
    icon: Scan,
    title: 'Phishing investigation',
    description: 'Identify suspicious email indicators.',
    prompt: 'How can I identify a phishing email?',
  },
  {
    icon: Terminal,
    title: 'Security investigation',
    description: 'Understand SSH brute-force attacks.',
    prompt: 'How can I detect and prevent SSH brute-force attacks?',
  },
  {
    icon: Activity,
    title: 'Machine learning',
    description: 'Understand intelligent anomaly detection.',
    prompt: 'Explain how Isolation Forest detects cybersecurity anomalies.',
  },
]


// =========================================
// CODE BLOCK COMPONENT
// =========================================

function CodeSnippet({
  language,
  code,
}: {
  language: string
  code: string
}) {

  const [copied, setCopied] = useState(false)

  const [copyError, setCopyError] =
    useState(false)

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  async function copyCode() {
    try {

      await navigator.clipboard.writeText(code)

      setCopied(true)
      setCopyError(false)

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)

    } catch {

      setCopyError(true)

    }
  }

  return (
    <div className="code-block">

      <div className="code-block-header">

        <span className="code-language">
          {language || 'text'}
        </span>

        <button
          type="button"
          className="copy-code-button"
          onClick={copyCode}
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              {copyError ? 'Retry copy' : 'Copy code'}
            </>
          )}
        </button>

      </div>

      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '18px',
          background: '#0b0e14',
          fontSize: '12px',
          lineHeight: '1.7',
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>

    </div>
  )
}


// =========================================
// MARKDOWN RENDERER
// =========================================

function MarkdownResponse({
  content,
}: {
  content: string
}) {

  return (
    <div className="markdown-content">

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{

          pre({ children }) {
            return <>{children}</>
          },

          code({ className, children }) {

            const match =
              /language-([\w+-]+)/.exec(
                className || ''
              )

            const code = String(children)

            const isBlock =
              Boolean(match) ||
              code.includes('\n')

            if (isBlock) {
              return (
                <CodeSnippet
                  language={match?.[1] || 'text'}
                  code={code.replace(/\n$/, '')}
                />
              )
            }

            return (
              <code className="inline-code">
                {children}
              </code>
            )
          },

          table({ children }) {
            return (
              <div className="markdown-table-wrapper">
                <table>{children}</table>
              </div>
            )
          },

          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            )
          },

          img({ alt }) {
            return (
              <span>
                [Image omitted: {alt || 'external image'}]
              </span>
            )
          },

        }}
      >
        {content}
      </ReactMarkdown>

    </div>
  )
}


// =========================================
// SENTINEL ASSISTANT
// =========================================

function Assistant() {

  const [messages, setMessages] =
    useState<Message[]>([])

  const [input, setInput] = useState('')

  const [isStreaming, setIsStreaming] =
    useState(false)

  const [isRestoring, setIsRestoring] =
    useState(true)

  const [isLoadingHistory, setIsLoadingHistory] =
    useState(false)

  const [error, setError] = useState('')

  const [storageWarning, setStorageWarning] =
    useState('')

  const [historyError, setHistoryError] =
    useState('')

  const [saveHistory, setSaveHistory] =
    useState(false)

  const [conversationId, setConversationId] =
    useState<string | null>(null)

  const [conversationTitle, setConversationTitle] =
    useState('New conversation')

  const [savedConversations, setSavedConversations] =
    useState<ConversationSummary[]>([])

  const [showHistory, setShowHistory] =
    useState(false)

  const bottomRef =
    useRef<HTMLDivElement>(null)

  const inputRef =
    useRef<HTMLTextAreaElement>(null)

  const abortRef =
    useRef<AbortController | null>(null)

  const restoreRef =
    useRef<AbortController | null>(null)

  const historyRef =
    useRef<AbortController | null>(null)


  // =========================================
  // SCROLL MANAGEMENT
  // =========================================

  useEffect(() => {

    bottomRef.current?.scrollIntoView({
      behavior: 'auto',
    })

  }, [messages, isStreaming])


  // =========================================
  // RESTORE ACTIVE CONVERSATION ON MOUNT
  // =========================================

  useEffect(() => {

    const controller = new AbortController()

    restoreRef.current = controller

    async function restoreActiveConversation() {

      const savedId = readActiveConversation()

      try {

        if (!savedId) {
          return
        }

        const conversation = await getConversation(
          savedId,
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setMessages(
          conversation.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            saved: true,
          }))
        )

        setConversationId(conversation.id)
        setConversationTitle(conversation.title)
        setSaveHistory(true)

      } catch (exception) {

        if (controller.signal.aborted) {
          return
        }

        if (
          exception instanceof HistoryAPIError &&
          exception.status === 404
        ) {

          rememberActiveConversation(null)

        } else {

          setHistoryError(
            'Unable to restore the saved conversation. ' +
            'Check the backend and open Saved chats.'
          )

        }

      } finally {

        if (!controller.signal.aborted) {

          setIsRestoring(false)

          if (restoreRef.current === controller) {
            restoreRef.current = null
          }

        }

      }
    }

    void restoreActiveConversation()

    return () => {
      controller.abort()
      abortRef.current?.abort()
      restoreRef.current?.abort()
      historyRef.current?.abort()
    }

  }, [])


  // =========================================
  // LOAD SAVED CONVERSATIONS
  // =========================================

  async function refreshHistory() {

    historyRef.current?.abort()

    const controller = new AbortController()

    historyRef.current = controller

    setIsLoadingHistory(true)
    setHistoryError('')

    try {

      const response = await listConversations({
        limit: 50,
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return
      }

      setSavedConversations(
        response.conversations
      )

    } catch (exception) {

      if (controller.signal.aborted) {
        return
      }

      setHistoryError(
        exception instanceof Error
          ? exception.message
          : 'Unable to load saved conversations.'
      )

    } finally {

      if (historyRef.current === controller) {

        historyRef.current = null

        if (!controller.signal.aborted) {
          setIsLoadingHistory(false)
        }

      }

    }
  }


  // =========================================
  // OPEN SAVED CONVERSATION
  // =========================================

  async function openConversation(id: string) {

    if (
      isStreaming ||
      isRestoring ||
      abortRef.current ||
      restoreRef.current
    ) {
      return
    }

    if (
      messages.some((message) => !message.saved) &&
      !window.confirm(
        'Opening a saved chat will discard unsaved messages. Continue?'
      )
    ) {
      return
    }

    const controller = new AbortController()

    restoreRef.current = controller

    setIsRestoring(true)
    setError('')
    setHistoryError('')

    try {

      const conversation = await getConversation(
        id,
        controller.signal,
      )

      if (controller.signal.aborted) {
        return
      }

      setMessages(
        conversation.messages.map((message) => ({
          id: String(message.id),
          role: message.role,
          content: message.content,
          saved: true,
        }))
      )

      setConversationId(conversation.id)
      setConversationTitle(conversation.title)
      setSaveHistory(true)
      setStorageWarning('')
      setInput('')
      setShowHistory(false)

      rememberActiveConversation(
        conversation.id
      )

    } catch (exception) {

      if (controller.signal.aborted) {
        return
      }

      setHistoryError(
        exception instanceof Error
          ? exception.message
          : 'Unable to restore conversation.'
      )

      if (
        exception instanceof HistoryAPIError &&
        exception.status === 404
      ) {

        setSavedConversations((previous) =>
          previous.filter((item) => item.id !== id)
        )

      }

    } finally {

      if (restoreRef.current === controller) {

        restoreRef.current = null

        if (!controller.signal.aborted) {
          setIsRestoring(false)
        }

      }

    }
  }


  // =========================================
  // NEW CONVERSATION
  // =========================================

  function resetConversation(
    persistent = saveHistory
  ) {

    setMessages([])
    setInput('')
    setError('')
    setStorageWarning('')
    setHistoryError('')
    setConversationId(null)
    setConversationTitle('New conversation')
    setSaveHistory(persistent)

    rememberActiveConversation(null)

    inputRef.current?.focus()
  }

  function newConversation() {

    if (
      isStreaming ||
      isRestoring ||
      abortRef.current ||
      restoreRef.current
    ) {
      return
    }

    if (
      messages.some((message) => !message.saved) &&
      !window.confirm(
        'Unsaved messages will be discarded. Start a new conversation?'
      )
    ) {
      return
    }

    resetConversation()
  }


  // =========================================
  // PERSISTENCE MODE
  // =========================================

  function changeStorageMode(enabled: boolean) {

    if (
      isStreaming ||
      isRestoring ||
      abortRef.current ||
      restoreRef.current ||
      enabled === saveHistory
    ) {
      return
    }

    if (messages.length > 0 || conversationId) {

      const confirmation = enabled

        ? 'Start a new saved conversation? Existing temporary messages will not be saved.'

        : 'Start a new temporary conversation? Previously saved history will remain in SQLite.'

      if (!window.confirm(confirmation)) {
        return
      }

    }

    resetConversation(enabled)
  }


  // =========================================
  // CONTEXT-AWARE STREAMING
  // =========================================

  async function sendMessage(text: string) {

    const message = text.trim()

    if (
      !message ||
      isStreaming ||
      isRestoring ||
      abortRef.current ||
      restoreRef.current
    ) {
      return
    }

    if (message.length > MAX_MESSAGE_LENGTH) {

      setError(
        'Messages must not exceed 4,000 characters.'
      )

      return
    }

    const persistent = saveHistory

    const activeId = conversationId

    const history = persistent
      ? []
      : buildConversationHistory(messages)

    setError('')
    setStorageWarning('')
    setInput('')
    setIsStreaming(true)

    const userId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()

    const controller = new AbortController()

    abortRef.current = controller

    setMessages((previous) => [
      ...previous,
      {
        id: userId,
        role: 'user',
        content: message,
        saved: false,
      },
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        incomplete: true,
        saved: false,
      },
    ])

    let storageMetadata: ChatStorageMetadata | null =
      null

    let fullResponse = ''

    try {

      const response = await fetch(
        '/api/chat/stream',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            message,
            history,
            conversation_id: persistent
              ? activeId
              : null,
            save_history: persistent,
          }),

          signal: controller.signal,
        }
      )

      if (!response.ok) {

        let detail =
          `Backend request failed (${response.status}).`

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

      if (!response.body) {
        throw new Error(
          'Streaming response unavailable.'
        )
      }

      const reader = response.body.getReader()

      const decoder = new TextDecoder()

      let buffer = ''
      let completed = false

      try {

        while (true) {

          const { done, value } =
            await reader.read()

          if (done) {

            buffer += decoder.decode()

          } else {

            buffer += decoder.decode(value, {
              stream: true,
            })

          }

          const events =
            buffer.split(/\r?\n\r?\n/)

          buffer = events.pop() ?? ''

          if (done && buffer.trim()) {

            events.push(buffer)
            buffer = ''

          }

          for (const event of events) {

            for (const line of event.split(/\r?\n/)) {

              if (!line.startsWith('data:')) {
                continue
              }

              const payload = line.slice(5).trim()

              if (!payload) {
                continue
              }

              const data = JSON.parse(payload)

              if (data.type === 'token') {

                const token =
                  String(data.content ?? '')

                fullResponse += token

                setMessages((previous) =>
                  previous.map((item) =>
                    item.id === assistantId
                      ? {
                          ...item,
                          content: item.content + token,
                        }
                      : item
                  )
                )

              }

              if (data.type === 'history') {

                storageMetadata = {
                  conversation_id:
                    data.conversation_id ?? null,

                  history_saved:
                    data.history_saved === true,

                  storage_warning:
                    data.storage_warning ?? null,
                }

                // Record confirmed persistence
                // as soon as the server reports it.

                if (
                  storageMetadata.history_saved &&
                  storageMetadata.conversation_id
                ) {

                  const savedId =
                    storageMetadata.conversation_id

                  setConversationId(savedId)

                  rememberActiveConversation(savedId)

                  if (!activeId) {

                    setConversationTitle(
                      message
                        .replace(/\s+/g, ' ')
                        .slice(0, 120)
                    )

                  }

                  setMessages((previous) =>
                    previous.map((item) =>
                      item.id === userId ||
                      item.id === assistantId
                        ? {
                            ...item,
                            saved: true,
                            incomplete: false,
                          }
                        : item
                    )
                  )

                }

              }

              if (data.type === 'error') {

                throw new Error(
                  data.message ||
                  'AI service unavailable.'
                )

              }

              if (data.type === 'done') {
                completed = true
              }

            }

          }

          if (done || completed) {
            break
          }

        }

        if (!completed) {

          throw new Error(
            'The AI response ended unexpectedly.'
          )

        }

        if (!fullResponse.trim()) {

          throw new Error(
            'The AI returned an empty response.'
          )

        }

        const wasSaved =
          persistent &&
          storageMetadata?.history_saved === true &&
          Boolean(storageMetadata.conversation_id)

        if (persistent && !wasSaved) {

          setStorageWarning(
            storageMetadata?.storage_warning ||
            'The response was generated, but saving was not confirmed. ' +
            'Unsaved messages will not be included in future saved context.'
          )

        }

        setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId ||
            item.id === userId
              ? {
                  ...item,
                  incomplete: false,
                  saved: wasSaved,
                }
              : item
          )
        )

        if (wasSaved && showHistory) {
          void refreshHistory()
        }

      } finally {

        await reader.cancel().catch(() => {})

        reader.releaseLock()

      }

    } catch (exception) {

      const confirmedSaved =
        storageMetadata?.history_saved === true

      if (confirmedSaved) {

        setStorageWarning(
          'The conversation was saved, but the stream ended before final confirmation. Reopen it from Saved chats to verify.'
        )

      } else if (controller.signal.aborted) {

        setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content:
                    item.content +
                    '\n\n*Response stopped.*',
                  incomplete: true,
                }
              : item.id === userId
                ? {
                    ...item,
                    incomplete: true,
                  }
                : item
          )
        )

        if (persistent) {

          setStorageWarning(
            'Response stopped. Saving was not confirmed. Check Saved chats before retrying.'
          )

        }

      } else {

        setError(
          exception instanceof Error
            ? exception.message
            : 'Unable to connect to Sentinel AI.'
        )

        setMessages((previous) =>
          previous
            .filter(
              (item) =>
                item.id !== assistantId ||
                item.content !== ''
            )
            .map((item) =>
              item.id === userId ||
              item.id === assistantId
                ? {
                    ...item,
                    incomplete: true,
                  }
                : item
            )
        )

        if (persistent) {

          setStorageWarning(
            'Saving was not confirmed. Check Saved chats before retrying.'
          )

        }

      }

    } finally {

      if (abortRef.current === controller) {
        abortRef.current = null
      }

      setIsStreaming(false)

      inputRef.current?.focus()

    }
  }


  // =========================================
  // CHAT CONTROLS
  // =========================================

  function stopResponse() {
    abortRef.current?.abort()
  }

  function toggleHistory() {

    const next = !showHistory

    setShowHistory(next)

    if (next) {
      void refreshHistory()
    }
  }

  const busy = isStreaming || isRestoring

  const memoryCount = buildConversationHistory(

    saveHistory

      ? messages.filter((message) => message.saved)

      : messages

  ).length


  // =========================================
  // USER INTERFACE
  // =========================================

  return (
    <div className="assistant-workspace">

      <header className="chat-header">

        <div className="chat-header-brand">

          <div className="chat-brand-icon">
            <Sparkles size={20} />
          </div>

          <div>

            <h1>Sentinel Assistant</h1>

            <p>
              Llama 3.2 · Context-aware intelligence
            </p>

          </div>

        </div>

        <button
          type="button"
          className="clear-chat-button"
          onClick={newConversation}
          disabled={busy}
        >
          <Plus size={16} />
          New chat
        </button>

      </header>


      {/* PERSISTENCE TOOLBAR */}

      <div className="persistent-chat-toolbar">

        <div className="persistent-chat-mode">

          {saveHistory
            ? <Database size={17} />
            : <Shield size={17} />
          }

          <div className="persistent-chat-mode-text">

            <strong>
              {saveHistory
                ? 'Saved conversation'
                : 'Temporary conversation'}
            </strong>

            <span>
              {saveHistory
                ? conversationTitle
                : 'Messages are not saved to SQLite'}
            </span>

          </div>

        </div>

        <div className="persistent-chat-actions">

          <label className="persistent-save-control">

            <input
              type="checkbox"
              checked={saveHistory}
              disabled={busy}
              onChange={(event) =>
                changeStorageMode(event.target.checked)
              }
            />

            <span>Save conversation</span>

          </label>

          <button
            type="button"
            className="clear-chat-button"
            disabled={busy}
            onClick={toggleHistory}
            aria-expanded={showHistory}
          >

            <History size={16} />

            Saved chats

          </button>

        </div>

      </div>


      {/* SAVED CONVERSATIONS */}

      {showHistory && (

        <div className="persistent-history-panel">

          <div className="persistent-history-heading">

            <div>

              <strong>Saved conversations</strong>

              <p>Restore your recent local chats.</p>

            </div>

            <button
              type="button"
              className="clear-chat-button"
              disabled={isLoadingHistory || busy}
              onClick={() => void refreshHistory()}
            >

              <RefreshCw size={14} />

              Refresh

            </button>

          </div>

          {isLoadingHistory ? (

            <p className="persistent-history-empty">
              Loading saved conversations...
            </p>

          ) : savedConversations.length === 0 ? (

            <p className="persistent-history-empty">
              No saved conversations found.
            </p>

          ) : (

            <div className="persistent-history-list">

              {savedConversations.map((conversation) => (

                <button
                  type="button"
                  key={conversation.id}
                  className={
                    'persistent-history-item ' +
                    (
                      conversationId === conversation.id
                        ? 'selected'
                        : ''
                    )
                  }
                  disabled={busy}
                  onClick={() =>
                    void openConversation(conversation.id)
                  }
                >

                  <Database size={16} />

                  <div className="persistent-history-item-text">

                    <strong>
                      {conversation.title}
                    </strong>

                    <span>

                      {conversation.message_count} messages

                      {' · '}

                      {new Date(
                        conversation.updated_at
                      ).toLocaleDateString()}

                    </span>

                  </div>

                  {conversationId === conversation.id && (
                    <Check size={15} />
                  )}

                </button>

              ))}

            </div>

          )}

        </div>

      )}


      {historyError && (

        <div className="persistent-storage-warning" role="alert">

          <AlertCircle size={16} />

          <span>{historyError}</span>

        </div>

      )}


      {/* CONVERSATION AREA */}

      <div className="chat-content">

        {isRestoring ? (

          <div className="chat-welcome">

            <div className="welcome-symbol">
              <Database size={32} />
            </div>

            <h2>Restoring conversation...</h2>

            <p>Retrieving saved intelligence from SQLite.</p>

          </div>

        ) : messages.length === 0 ? (

          <div className="chat-welcome">

            <div className="welcome-symbol">
              <Shield size={36} strokeWidth={1.5} />
            </div>

            <div className="chat-eyebrow">
              SENTINEL INTELLIGENCE
            </div>

            <h2>
              Intelligence at your command.
            </h2>

            <p>
              Investigate threats, understand vulnerabilities
              and explore cybersecurity with your local
              context-aware AI assistant.
            </p>

            <div className="suggestion-grid">

              {suggestions.map((suggestion) => (

                <button
                  key={suggestion.title}
                  className="suggestion-card"
                  disabled={busy}
                  onClick={() =>
                    void sendMessage(suggestion.prompt)
                  }
                >

                  <suggestion.icon
                    size={21}
                    strokeWidth={1.7}
                  />

                  <h3>{suggestion.title}</h3>

                  <p>{suggestion.description}</p>

                </button>

              ))}

            </div>

          </div>

        ) : (

          <div className="message-list">

            {messages.map((message) => (

              <div
                key={message.id}
                className={`chat-message ${message.role}`}
              >

                <div className="message-avatar">

                  {message.role === 'assistant'
                    ? <Shield size={19} />
                    : <User size={19} />
                  }

                </div>

                <div className="message-body">

                  <div className="message-author">

                    {message.role === 'assistant'
                      ? 'Sentinel AI'
                      : 'You'}

                  </div>

                  <div className="message-text">

                    {message.content ? (

                      message.role === 'assistant' ? (

                        <MarkdownResponse
                          content={message.content}
                        />

                      ) : (

                        message.content

                      )

                    ) : (

                      <div className="typing-indicator">
                        <span />
                        <span />
                        <span />
                      </div>

                    )}

                  </div>

                  {message.role === 'assistant' &&
                    message.saved && (

                    <div className="persistent-saved-label">

                      <Check size={12} />

                      Saved to local history

                    </div>

                  )}

                  {saveHistory &&
                    message.role === 'assistant' &&
                    !message.saved &&
                    !isStreaming && (

                    <div className="persistent-unsaved-label">

                      <AlertCircle size={12} />

                      Saving not confirmed

                    </div>

                  )}

                </div>

              </div>

            ))}

            <div ref={bottomRef} />

          </div>

        )}

      </div>


      {/* MESSAGE COMPOSER */}

      <div className="chat-input-area">

        {error && (

          <div className="chat-error" role="alert">

            <AlertCircle size={18} />

            <span>{error}</span>

          </div>

        )}

        {storageWarning && (

          <div
            className="persistent-storage-warning"
            role="alert"
          >

            <AlertCircle size={16} />

            <span>{storageWarning}</span>

          </div>

        )}

        <form
          className="chat-input-container"
          onSubmit={(event) => {

            event.preventDefault()

            void sendMessage(input)

          }}
        >

          <textarea
            ref={inputRef}
            value={input}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            disabled={isRestoring}
            aria-label="Message Sentinel"
            placeholder="Ask Sentinel anything about cybersecurity..."
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={(event) => {

              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {

                event.preventDefault()

                void sendMessage(input)

              }

            }}
          />

          <div className="chat-input-footer">

            <div className="chat-model-label">

              <Sparkles size={14} />

              Llama 3.2

              <span className="chat-model-divider" />

              <Brain size={14} />

              <span
                title="Recent messages available for conversational context"
              >
                Memory {memoryCount}/6
              </span>

            </div>

            {isStreaming ? (

              <button
                type="button"
                className="chat-send-button stop-button"
                onClick={stopResponse}
                aria-label="Stop response"
              >

                <Square size={16} />

              </button>

            ) : (

              <button
                type="submit"
                className="chat-send-button"
                disabled={!input.trim() || isRestoring}
                aria-label="Send message"
              >

                <ArrowUp size={20} />

              </button>

            )}

          </div>

        </form>

        <div className="chat-privacy-note">

          <Lock size={12} />

          <span>

            {saveHistory

              ? 'Local processing. Saved history is stored in unencrypted SQLite.'

              : 'Local processing. Session-only memory.'

            }

            {' '}Verify AI security recommendations independently.

          </span>

        </div>

      </div>

    </div>
  )
}

export default Assistant
