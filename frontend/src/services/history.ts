
const API_BASE = '/api/history'

// =========================================
// SHARED TYPES
// =========================================

export type InvestigationType =
  | 'phishing'
  | 'logs'
  | 'anomaly'

export type MessageRole =
  | 'user'
  | 'assistant'

// =========================================
// CONVERSATION TYPES
// =========================================

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationSummary
  extends Conversation {
  message_count: number
  last_message?: string | null
}

export interface SavedMessage {
  id: number
  conversation_id: string
  role: MessageRole
  content: string
  created_at: string
}

export interface ConversationDetail
  extends Conversation {
  messages: SavedMessage[]
}

export interface ConversationListResponse {
  status: string
  count: number
  conversations: ConversationSummary[]
}

// =========================================
// INVESTIGATION TYPES
// =========================================

export interface InvestigationSummary {
  id: string
  investigation_type: InvestigationType
  title: string
  status: string
  risk_level: string | null
  has_ai_report: boolean
  created_at: string
}

export interface InvestigationDetail {
  id: string
  investigation_type: InvestigationType
  title: string
  status: string
  risk_level: string | null
  analysis: Record<string, unknown>
  ai_report: string | null
  created_at: string
}

export interface InvestigationListResponse {
  status: string
  count: number
  investigations: InvestigationSummary[]
}

// =========================================
// STORAGE METADATA
// =========================================

export interface ChatStorageMetadata {
  conversation_id: string | null
  history_saved: boolean
  storage_warning: string | null
}

export interface InvestigationStorageMetadata {
  investigation_id?: string | null
  history_saved?: boolean
  storage_warning?: string | null
}

// =========================================
// STATISTICS TYPES
// =========================================

export interface ConversationStatistics {
  total_conversations: number
  total_messages: number
  user_messages: number
  assistant_messages: number
}

export interface InvestigationStatistics {
  total_investigations: number
  phishing_investigations: number
  log_investigations: number
  anomaly_investigations: number
  ai_reports: number
}

export interface HistoryStatistics {
  status: string
  conversations: ConversationStatistics
  investigations: InvestigationStatistics
}

export interface DatabaseInformation {
  status: string
  sqlite_version: string
  schema_version: number
  tables: string[]
  integrity: string
  size_bytes: number
}

export interface OperationResponse {
  status: string
  message: string
  id: string
}

// =========================================
// API ERROR CLASS
// =========================================

export class HistoryAPIError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)

    this.name = 'HistoryAPIError'
    this.status = status
  }
}

// =========================================
// SHARED REQUEST FUNCTION
// =========================================

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  headers.set('Accept', 'application/json')

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers,
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    let message = `History request failed (${response.status}).`

    try {
      const error = await response.json()

      if (typeof error.detail === 'string') {
        message = error.detail
      }
    } catch {
      // Keep the fallback error message.
    }

    throw new HistoryAPIError(
      message,
      response.status,
    )
  }

  return response.json() as Promise<T>
}

// =========================================
// CONVERSATION API
// =========================================

export async function createConversation(
  title = 'New conversation',
  signal?: AbortSignal,
): Promise<Conversation> {
  return request<Conversation>(
    '/conversations',
    {
      method: 'POST',
      body: JSON.stringify({ title }),
      signal,
    },
  )
}

export async function listConversations(
  options: {
    query?: string
    limit?: number
    offset?: number
    signal?: AbortSignal
  } = {},
): Promise<ConversationListResponse> {
  const parameters = new URLSearchParams()

  parameters.set(
    'limit',
    String(options.limit ?? 50),
  )

  if (options.query?.trim()) {
    parameters.set('q', options.query.trim())
  } else {
    parameters.set(
      'offset',
      String(options.offset ?? 0),
    )
  }

  return request<ConversationListResponse>(
    `/conversations?${parameters.toString()}`,
    {
      signal: options.signal,
    },
  )
}

export async function getConversation(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return request<ConversationDetail>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { signal },
  )
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<OperationResponse> {
  return request<OperationResponse>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    },
  )
}

export async function deleteConversation(
  conversationId: string,
): Promise<OperationResponse> {
  return request<OperationResponse>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'DELETE',
    },
  )
}

// =========================================
// INVESTIGATION API
// =========================================

export async function listInvestigations(
  options: {
    type?: InvestigationType
    query?: string
    limit?: number
    offset?: number
    signal?: AbortSignal
  } = {},
): Promise<InvestigationListResponse> {
  const parameters = new URLSearchParams()

  parameters.set(
    'limit',
    String(options.limit ?? 50),
  )

  if (options.type) {
    parameters.set(
      'investigation_type',
      options.type,
    )
  }

  if (options.query?.trim()) {
    parameters.set('q', options.query.trim())
  } else {
    parameters.set(
      'offset',
      String(options.offset ?? 0),
    )
  }

  return request<InvestigationListResponse>(
    `/investigations?${parameters.toString()}`,
    {
      signal: options.signal,
    },
  )
}

export async function getInvestigation(
  investigationId: string,
  signal?: AbortSignal,
): Promise<InvestigationDetail> {
  return request<InvestigationDetail>(
    `/investigations/${encodeURIComponent(investigationId)}`,
    { signal },
  )
}

export async function renameInvestigation(
  investigationId: string,
  title: string,
): Promise<OperationResponse> {
  return request<OperationResponse>(
    `/investigations/${encodeURIComponent(investigationId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    },
  )
}

export async function deleteInvestigation(
  investigationId: string,
): Promise<OperationResponse> {
  return request<OperationResponse>(
    `/investigations/${encodeURIComponent(investigationId)}`,
    {
      method: 'DELETE',
    },
  )
}

// =========================================
// SYSTEM INFORMATION API
// =========================================

export async function getHistoryStatistics(
  signal?: AbortSignal,
): Promise<HistoryStatistics> {
  return request<HistoryStatistics>(
    '/stats',
    { signal },
  )
}

export async function getDatabaseInformation(
  signal?: AbortSignal,
): Promise<DatabaseInformation> {
  return request<DatabaseInformation>(
    '/database',
    { signal },
  )
}
