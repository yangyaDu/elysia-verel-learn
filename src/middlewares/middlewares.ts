import { Elysia } from 'elysia'
import { BusinessError, errCodeEnum } from '../define/errDefine'
import { plgJsonLog } from '../utils/plgLog'
import { buildResponseBody } from '../utils/msgWrapper'

const LOG_BODY_MAX_CHARS = 4096
const LOG_HTTP_BODY = process.env.LOG_HTTP_BODY !== '0'

/** 为 `0` 时使用旧式可读文本访问日志；默认单行 JSON（`schema: http_access.v1`，便于 PLG） */
const ACCESS_LOG_PLG_JSON = process.env.ACCESS_LOG_PLG_JSON !== '0'

type FileMeta = { type: 'File'; name: string; size: number; contentType: string }

function describeFile(file: File | Blob): FileMeta {
  const name = file instanceof File ? file.name : 'blob'
  return {
    type: 'File',
    name,
    size: file.size,
    contentType: file.type,
  }
}

function replaceFiles(value: unknown): unknown {
  if (value instanceof File || value instanceof Blob) {
    return describeFile(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceFiles(item))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = replaceFiles(v)
    }
    return out
  }
  return value
}

function truncate(text: string): string {
  if (text.length <= LOG_BODY_MAX_CHARS) {
    return text
  }
  return `${text.slice(0, LOG_BODY_MAX_CHARS)}\n... (truncated, totalChars=${text.length})`
}

function formatBodyForLog(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === 'string') {
    return value.length === 0 ? null : truncate(value)
  }
  if (value instanceof File || value instanceof Blob) {
    return JSON.stringify(describeFile(value), null, 2)
  }
  try {
    const safe = replaceFiles(value)
    return truncate(JSON.stringify(safe, null, 2))
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return truncate(String(value))
  }
}

function formatResponseForLog(responseValue: unknown): string | null {
  if (responseValue instanceof Response) {
    const contentType = responseValue.headers.get('content-type') ?? ''
    if (contentType.startsWith('text/event-stream')) {
      return '[SSE stream]'
    }
    return `[Response: status=${responseValue.status}, content-type=${contentType || 'unknown'}]`
  }
  return formatBodyForLog(responseValue)
}

export const loggerMiddleware = new Elysia({ name: 'logger' })
  .onRequest(({ set }) => {
    const requestId = crypto.randomUUID()
    set.headers['x-request-id'] = requestId
  })
  .derive(({ set }) => {
    return {
      startTime: Date.now(),
      requestId: set.headers['x-request-id'],
    }
  })
  .onAfterResponse(({ request, startTime, requestId, set, body, responseValue }) => {
    const duration = Date.now() - startTime
    const { method, url } = request
    const path = (() => {
      try {
        return new URL(url).pathname
      } catch {
        return url
      }
    })()
    const status = typeof set.status === 'number' ? set.status : 200

    if (ACCESS_LOG_PLG_JSON) {
      const base: Record<string, unknown> = {
        schema: 'http_access.v1',
        ts: new Date().toISOString(),
        requestId: String(requestId ?? ''),
        method,
        path,
        url,
        status,
        durationMs: duration,
      }
      if (LOG_HTTP_BODY) {
        const reqLog = formatBodyForLog(body)
        if (reqLog !== null) {
          base.reqBodyPreview = reqLog
        }
        const resLog = formatResponseForLog(responseValue)
        if (resLog !== null) {
          base.resBodyPreview = resLog
        }
      }
      plgJsonLog(base, 'info')
    } else {
      console.info(`[${requestId}] [${method}] ${url} - ${status} (${duration}ms)`)
      if (!LOG_HTTP_BODY) {
        return
      }
      const reqLog = formatBodyForLog(body)
      if (reqLog !== null) {
        console.info(`[${requestId}] >> req body:\n${reqLog}`)
      }
      const resLog = formatResponseForLog(responseValue)
      if (resLog !== null) {
        console.info(`[${requestId}] << res body:\n${resLog}`)
      }
    }
  })
  .as('global')

export const errorMiddleware = new Elysia({ name: 'error-handler' }).onError(
  ({ code, error, set, request, path }) => {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const errorMessage = error instanceof Error ? error.message : String(error)
    const requestId = request.headers.get('x-request-id') ?? undefined

    if (error instanceof BusinessError) {
      // 业务逻辑错误，不打印完整的堆栈信息，仅记录关键信息
      if (ACCESS_LOG_PLG_JSON) {
        plgJsonLog(
          {
            schema: 'http_error.v1',
            ts: new Date().toISOString(),
            kind: 'business',
            requestId,
            path,
            method: request.method,
            errCode: error.errInfo.code,
            message: errorMessage,
          },
          'warn'
        )
      } else {
        console.warn(`[Business Error] code: ${error.errInfo.code}, message: ${errorMessage}`)
      }

      // 根据错误码设置 HTTP 状态码
      const { code } = error.errInfo
      if (code === errCodeEnum.ERR_NOT_FOUND.code) {
        set.status = 404
      } else if (code === errCodeEnum.ERR_UNAUTHORIZED.code) {
        set.status = 401
      } else if (code === errCodeEnum.ERR_FORBIDDEN.code) {
        set.status = 403
      } else if (code >= 1000) {
        set.status = 400
      }

      return buildResponseBody(error.errInfo, null, errorMessage)
    }

    if (ACCESS_LOG_PLG_JSON) {
      plgJsonLog(
        {
          schema: 'http_error.v1',
          ts: new Date().toISOString(),
          kind: 'unhandled',
          requestId,
          path,
          method: request.method,
          elysiaCode: code,
          message: errorMessage,
        },
        'error'
      )
    }
    console.error(`[Global Error] code: ${code}, message: ${errorMessage}`, error)

    switch (code) {
      case 'VALIDATION':
        set.status = 400
        return buildResponseBody(errCodeEnum.ERR_PARAMS_ERROR.code, null)
      case 'NOT_FOUND':
        set.status = 404
        return buildResponseBody(errCodeEnum.ERR_NOT_FOUND.code, null)
      default:
        set.status = 500
        return buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null)
    }
  }
)
