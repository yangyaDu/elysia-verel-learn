import type { ChatToolCall, ChatToolError, ChatToolResult } from '../../feature/chat/model'
import { plgJsonLog } from '../../utils/plgLog'

export type ChatToolAuditRoute = 'chat' | 'chat/stream'

export type ChatToolAuditPhase =
  | 'tool-call'
  | 'tool-result'
  | 'tool-error'
  | 'stream-end'
  | 'stream-error'
  | 'chat-complete'
  | 'chat-error'

export type ChatToolAuditRecord = {
  schema: 'chat_tool_audit.v1'
  ts: string
  traceId: string
  requestId?: string
  route: ChatToolAuditRoute
  phase: ChatToolAuditPhase
  toolCallId?: string
  toolName?: string
  inputRedacted?: unknown
  outputRedacted?: unknown
  errorRedacted?: unknown
  /** 仅 stream-end / chat-complete：统计与元信息，不含全文 */
  meta?: {
    durationMs?: number
    sourceCount?: number
    toolCallCount?: number
    toolResultCount?: number
    toolErrorCount?: number
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
    docNamesCount?: number
    thinking?: boolean
    message?: string
  }
}

export type ChatToolAuditRequestMeta = {
  requestId?: string
}

let warnedLegacyMinioMode = false

function parseChatToolAuditEnabled(): boolean {
  const raw = (process.env.CHAT_TOOL_AUDIT ?? '').toLowerCase().trim()
  if (raw === '' || raw === '0' || raw === 'false' || raw === 'off') {
    return false
  }
  if (raw === 'minio' || raw === 'both') {
    if (!warnedLegacyMinioMode) {
      warnedLegacyMinioMode = true
      console.warn(
        '[chat_tool_audit] CHAT_TOOL_AUDIT=minio|both is deprecated; audit is log-only. Use CHAT_TOOL_AUDIT=on (or true/1/stdout).'
      )
    }
    return true
  }
  return raw === 'on' || raw === '1' || raw === 'true' || raw === 'stdout'
}

export function isChatToolAuditEnabled(): boolean {
  return parseChatToolAuditEnabled()
}

const MAX_INLINE_STRING = 512
const MAX_JSON_CHARS = 12_288

export function redactForAudit(value: unknown): unknown {
  try {
    const text = JSON.stringify(value, (_key, v) => {
      if (typeof v === 'string' && v.length > MAX_INLINE_STRING) {
        return `${v.slice(0, MAX_INLINE_STRING)}...(+${v.length - MAX_INLINE_STRING} chars)`
      }
      return v as unknown
    })
    if (text.length > MAX_JSON_CHARS) {
      return { _truncated: true, preview: text.slice(0, MAX_JSON_CHARS) }
    }
    return JSON.parse(text) as unknown
  } catch {
    return { _redactionError: true }
  }
}

function redactError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: truncateStr(err.message, 2000) }
  }
  return redactForAudit(err)
}

function truncateStr(s: string, max: number): string {
  if (s.length <= max) {
    return s
  }
  return `${s.slice(0, max)}...(+${s.length - max} chars)`
}

function emitRecord(base: Omit<ChatToolAuditRecord, 'schema' | 'ts'>): void {
  if (!isChatToolAuditEnabled()) {
    return
  }
  const record: ChatToolAuditRecord = {
    schema: 'chat_tool_audit.v1',
    ts: new Date().toISOString(),
    ...base,
  }
  plgJsonLog(record)
}

export interface ChatToolAuditSession {
  readonly traceId: string
  toolCall(payload: ChatToolCall): void
  toolResult(payload: ChatToolResult): void
  toolError(payload: ChatToolError): void
  streamEnd(meta: {
    durationMs: number
    sourceCount: number
    docNamesCount?: number
    thinking?: boolean
  }): void
  streamError(err: unknown): void
  chatComplete(meta: {
    durationMs: number
    toolCallCount: number
    toolResultCount: number
    toolErrorCount: number
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
    docNamesCount?: number
    thinking?: boolean
  }): void

  chatError(err: unknown): void
}

class ChatToolAuditSessionImpl implements ChatToolAuditSession {
  readonly traceId: string

  constructor(
    private readonly requestId: string | undefined,
    private readonly route: ChatToolAuditRoute
  ) {
    this.traceId = crypto.randomUUID()
  }

  toolCall(payload: ChatToolCall): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'tool-call',
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      inputRedacted: redactForAudit(payload.input),
    })
  }

  toolResult(payload: ChatToolResult): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'tool-result',
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      inputRedacted: redactForAudit(payload.input),
      outputRedacted: redactForAudit(payload.output),
    })
  }

  toolError(payload: ChatToolError): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'tool-error',
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      inputRedacted: redactForAudit(payload.input),
      errorRedacted: redactError(payload.error),
    })
  }

  streamEnd(meta: {
    durationMs: number
    sourceCount: number
    docNamesCount?: number
    thinking?: boolean
  }): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'stream-end',
      meta,
    })
  }

  streamError(err: unknown): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'stream-error',
      meta: { message: truncateStr(err instanceof Error ? err.message : String(err), 2000) },
      errorRedacted: redactError(err),
    })
  }

  chatComplete(meta: {
    durationMs: number
    toolCallCount: number
    toolResultCount: number
    toolErrorCount: number
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
    docNamesCount?: number
    thinking?: boolean
  }): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'chat-complete',
      meta,
    })
  }

  chatError(err: unknown): void {
    emitRecord({
      traceId: this.traceId,
      requestId: this.requestId,
      route: this.route,
      phase: 'chat-error',
      meta: { message: truncateStr(err instanceof Error ? err.message : String(err), 2000) },
      errorRedacted: redactError(err),
    })
  }
}

/**
 * 开始聊天工具审计（仅结构化日志；由 CHAT_TOOL_AUDIT 开关控制）
 */
export function startChatToolAudit(ctx: {
  requestId?: string
  route: ChatToolAuditRoute
}): ChatToolAuditSession | null {
  if (!isChatToolAuditEnabled()) {
    return null
  }
  return new ChatToolAuditSessionImpl(ctx.requestId, ctx.route)
}
