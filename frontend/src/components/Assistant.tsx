
import { useState, useRef, useEffect } from 'react'

import {
  Sparkles,
  ArrowUp,
  Trash2,
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
} from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

import './Assistant.css'


/* =========================================
   CONFIGURATION
   ========================================= */

const MAX_HISTORY_MESSAGES = 6
const MAX_HISTORY_CHARACTERS = 6000
const MAX_MESSAGE_LENGTH = 4000


type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  incomplete?: boolean
}

type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}


/* =========================================
   CONVERSATION MEMORY
   ========================================= */

function buildConversationHistory(
  messages: Message[]
): HistoryMessage[] {

  const validMessages = messages.filter(
    (message) =>
      message.content.trim() &&
      !message.incomplete
  )

  const recentMessages = validMessages.slice(
    -MAX_HISTORY_MESSAGES
  )

  const history: HistoryMessage[] = []

  let totalCharacters = 0

  for (
    let index = recentMessages.length - 1;
    index >= 0;
    index--
  ) {

    const message = recentMessages[index]

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


/* =========================================
   SUGGESTED PROMPTS
   ========================================= */

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


/* =========================================
   SYNTAX-HIGHLIGHTED CODE BLOCK
   ========================================= */

function CodeSnippet({
  language,
  code,
}: {
  language: string
  code: string
}) {

  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

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


/* =========================================
   MARKDOWN RESPONSE RENDERER
   ========================================= */

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


/* =========================================
   SENTINEL ASSISTANT
   ========================================= */

function Assistant() {

  const [messages, setMessages] =
    useState<Message[]>([])

  const [input, setInput] = useState('')

  const [isStreaming, setIsStreaming] =
    useState(false)

  const [error, setError] = useState('')

  const bottomRef =
    useRef<HTMLDivElement>(null)

  const inputRef =
    useRef<HTMLTextAreaElement>(null)

  const abortRef =
    useRef<AbortController | null>(null)


  useEffect(() => {

    bottomRef.current?.scrollIntoView({
      behavior: 'auto',
    })

  }, [messages, isStreaming])


  useEffect(() => {

    return () => {
      abortRef.current?.abort()
    }

  }, [])


  /* =========================================
     CONTEXT-AWARE STREAMING
     ========================================= */

  async function sendMessage(text: string) {

    const message = text.trim()

    if (
      !message ||
      isStreaming ||
      abortRef.current
    ) {
      return
    }

    if (message.length > MAX_MESSAGE_LENGTH) {

      setError(
        'Messages must not exceed 4,000 characters.'
      )

      return

    }


    /* CAPTURE PREVIOUS CONVERSATION */

    const history =
      buildConversationHistory(messages)


    setError('')
    setInput('')
    setIsStreaming(true)


    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
    }

    const assistantId = crypto.randomUUID()


    setMessages((previous) => [
      ...previous,
      userMessage,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        incomplete: true,
      },
    ])


    const controller = new AbortController()

    abortRef.current = controller


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
          }),

          signal: controller.signal,
        }
      )


      if (!response.ok) {

        throw new Error(
          `Backend request failed (${response.status}).`
        )

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

      let receivedContent = false


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

            const lines =
              event.split(/\r?\n/)


            for (const line of lines) {

              if (!line.startsWith('data:')) {
                continue
              }

              const payload =
                line.slice(5).trim()

              if (!payload) {
                continue
              }


              const data = JSON.parse(payload)


              if (data.type === 'token') {

                const token =
                  String(data.content ?? '')

                if (token) {
                  receivedContent = true
                }

                setMessages((previous) =>
                  previous.map((item) =>
                    item.id === assistantId
                      ? {
                          ...item,
                          content:
                            item.content + token,
                        }
                      : item
                  )
                )

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


        if (!receivedContent) {

          throw new Error(
            'The AI returned an empty response.'
          )

        }


        /* MARK SUCCESSFUL RESPONSE */

        setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  incomplete: false,
                }
              : item
          )
        )


      } finally {

        await reader.cancel().catch(() => {})

        reader.releaseLock()

      }


    } catch (exception) {

      if (
        exception instanceof Error &&
        exception.name === 'AbortError'
      ) {

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
              : item
          )
        )

      } else {

        setError(
          exception instanceof Error
            ? exception.message
            : 'Unable to connect to Sentinel AI.'
        )

        setMessages((previous) =>
          previous.filter(
            (item) =>
              item.id !== assistantId ||
              item.content !== ''
          )
        )

      }


    } finally {

      abortRef.current = null

      setIsStreaming(false)

      inputRef.current?.focus()

    }

  }


  /* =========================================
     CHAT CONTROLS
     ========================================= */

  function stopResponse() {

    abortRef.current?.abort()

  }


  function clearConversation() {

    if (isStreaming) {
      return
    }

    setMessages([])
    setError('')
    setInput('')

    inputRef.current?.focus()

  }


  const memoryCount =
    buildConversationHistory(messages).length


  /* =========================================
     USER INTERFACE
     ========================================= */

  return (
    <div className="assistant-workspace">


      {/* ASSISTANT HEADER */}

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
          className="clear-chat-button"
          onClick={clearConversation}
          disabled={
            isStreaming ||
            messages.length === 0
          }
          aria-label="Clear conversation"
        >

          <Trash2 size={16} />

          Clear conversation

        </button>

      </header>


      {/* CONVERSATION AREA */}

      <div className="chat-content">


        {messages.length === 0 ? (


          <div className="chat-welcome">

            <div className="welcome-symbol">

              <Shield
                size={36}
                strokeWidth={1.5}
              />

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
                  onClick={() =>
                    sendMessage(suggestion.prompt)
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

                  {message.role === 'assistant' ? (

                    <Shield size={19} />

                  ) : (

                    <User size={19} />

                  )}

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

          <div
            className="chat-error"
            role="alert"
          >

            <AlertCircle size={18} />

            <span>{error}</span>

          </div>

        )}


        <form
          className="chat-input-container"
          onSubmit={(event) => {

            event.preventDefault()

            sendMessage(input)

          }}
        >


          <textarea
            ref={inputRef}
            value={input}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
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

                sendMessage(input)

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
                disabled={!input.trim()}
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

            Local processing. Session-only memory.
            Verify AI security recommendations independently.

          </span>

        </div>

      </div>

    </div>
  )

}

export default Assistant
