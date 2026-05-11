import type { TSchema } from '@sinclair/typebox'
import { t } from 'elysia'
import { getErrInfoFromCode, type ErrCodeT, type ErrInfo } from '../define/errDefine'

export const createApiResponseType = <T extends TSchema | null>(dataSchema: T) =>
  t.Object({
    code: t.Number({ default: 0, description: 'Status code, 0 for success' }),
    message: t.String({ default: 'success', description: 'Response message' }),
    data: dataSchema ? t.Union([dataSchema, t.Null()]) : t.Null(),
  })

export const buildResponseBody = <T>(err: ErrInfo | ErrCodeT, data: T | null, customMessage?: string) => {
  const errInfo = typeof err === 'number' ? getErrInfoFromCode(err) : err
  return {
    code: errInfo.code,
    message: customMessage ?? errInfo.message,
    data,
  }
}

const toSseData = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `data: ${line}\n`)
    .join('') + '\n'

const toSseEventData = (eventName: string, text: string) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let out = `event: ${eventName}\n`
  for (const line of lines) {
    out += `data: ${line}\n`
  }
  return out + '\n'
}

const toSseJsonEventData = (eventName: string, data: unknown) =>
  toSseEventData(eventName, JSON.stringify(data))

/** SSE 条目：`string` 与原来一致；结构化事件用于分轨返回 thinking / tool 数据。 */
export type ChatSseChunk =
  | string
  | { part: 'thinking' | 'answer'; delta: string }
  | { part: 'tool-call' | 'tool-result' | 'tool-error'; data: unknown }

export function bulidSseResponse(
  streamIterable: AsyncIterable<ChatSseChunk>
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamIterable) {
          if (typeof chunk === 'string') {
            controller.enqueue(encoder.encode(toSseData(chunk)))
          } else if (chunk.part === 'thinking') {
            controller.enqueue(encoder.encode(toSseEventData('thinking', chunk.delta)))
          } else if (
            chunk.part === 'tool-call' ||
            chunk.part === 'tool-result' ||
            chunk.part === 'tool-error'
          ) {
            controller.enqueue(encoder.encode(toSseJsonEventData(chunk.part, chunk.data)))
          } else if (chunk.part === 'answer') {
            controller.enqueue(encoder.encode(toSseData(chunk.delta)))
          }
        }
        controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'))
        controller.close()
      } catch (streamErr) {
        console.error('[sseWrapper:stream]', streamErr)
        controller.error(
          streamErr instanceof Error ? streamErr : new Error(String(streamErr))
        )
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
