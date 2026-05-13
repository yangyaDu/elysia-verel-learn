import type { ChatToolAuditRoute } from './toolAudit'

export type { ChatToolAuditRoute }

export type ChatToolAuditRequestScope = {
  requestId?: string
  route: ChatToolAuditRoute
}

const scopeByRequest = new WeakMap<Request, ChatToolAuditRequestScope>()

export function setChatToolAuditRequestScope(request: Request, scope: ChatToolAuditRequestScope): void {
  scopeByRequest.set(request, scope)
}

export function getChatToolAuditRequestScope(request: Request): ChatToolAuditRequestScope | undefined {
  return scopeByRequest.get(request)
}

export function clearChatToolAuditRequestScope(request: Request): void {
  scopeByRequest.delete(request)
}
