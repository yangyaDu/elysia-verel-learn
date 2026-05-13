import { Elysia } from 'elysia'
import {
  clearChatToolAuditRequestScope,
  setChatToolAuditRequestScope,
  type ChatToolAuditRequestScope,
} from '../feature/chat/chatToolAuditRequestContext'

function readRequestIdFromHeaders(set: {
  headers: Record<string, string | number | undefined>
}): string | undefined {
  const v = set.headers['x-request-id']
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function scopeForPath(
  path: string,
  requestId: string | undefined
): ChatToolAuditRequestScope | null {
  if (path === '/chat') {
    return { requestId, route: 'chat' }
  }
  if (path === '/chat/stream') {
    return { requestId, route: 'chat/stream' }
  }
  return null
}

/**
 * 仅对 `/chat`、`/chat/stream` 写入审计请求域（requestId + route），供 service 通过 `request` 解析。
 * 与 {@link chatToolAuditRequestContext} 成对使用。
 */
export const chatToolAuditRequestMiddleware = new Elysia({ name: 'chat-tool-audit-request' })
  .onBeforeHandle(({ request, path, set }) => {
    const requestId = readRequestIdFromHeaders(set)
    const scope = scopeForPath(path, requestId)
    if (scope) {
      setChatToolAuditRequestScope(request, scope)
    }
  })
  .onAfterHandle(({ request, path }) => {
    if (path === '/chat') {
      clearChatToolAuditRequestScope(request)
    }
  })
