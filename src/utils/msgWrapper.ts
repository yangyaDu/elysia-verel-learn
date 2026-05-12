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

/**
 * SSE 条目。每种 part 对应一种命名 SSE 事件（除 answer 用默认 data: 事件）：
 *
 * | part        | event name  | 含义                                               |
 * |-------------|-------------|---------------------------------------------------|
 * | answer      | *(default)* | 最终回答的增量文字（流式）                          |
 * | thinking    | thinking    | 模型推理过程增量（thinking 模式）                   |
 * | step-text   | step-text   | 中间步骤的说明文字（工具调用前的铺垫，可由前端隐藏）  |
 * | tool-call   | tool-call   | LLM 调用工具的请求                                 |
 * | tool-result | tool-result | 工具执行结果                                       |
 * | tool-error  | tool-error  | 工具执行失败                                       |
 * | sources     | sources     | 本次对话读取过的文档来源汇总（流结束前一次性发出）    |
 */
export type ChatSseChunk =
  | string
  | { part: 'thinking' | 'answer' | 'step-text'; delta: string }
  | { part: 'tool-call' | 'tool-result' | 'tool-error'; data: unknown }
  | { part: 'sources'; data: unknown[] }

export function bulidSseResponse(
  streamIterable: AsyncIterable<ChatSseChunk>
): Response {
  const encoder = new TextEncoder()
  let closed = false
  const enqueue = (controller: ReadableStreamDefaultController<Uint8Array>, text: string) => {
    if (!closed) {
      controller.enqueue(encoder.encode(text))
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // First bytes ASAP so the client completes fetch headers / first read() without
        // waiting for RAG + first model step to finish (see chatStream buffering).
        enqueue(controller, ': stream-open\n\n')

        for await (const chunk of streamIterable) {
          if (closed) {
            break
          }

          if (typeof chunk === 'string') {
            enqueue(controller, toSseData(chunk))
          } else if (chunk.part === 'thinking') {
            enqueue(controller, toSseEventData('thinking', chunk.delta))
          } else if (chunk.part === 'step-text') {
            enqueue(controller, toSseEventData('step-text', chunk.delta))
          } else if (
            chunk.part === 'tool-call' ||
            chunk.part === 'tool-result' ||
            chunk.part === 'tool-error'
          ) {
            enqueue(controller, toSseJsonEventData(chunk.part, chunk.data))
          } else if (chunk.part === 'sources') {
            enqueue(controller, toSseJsonEventData('sources', chunk.data))
          } else if (chunk.part === 'answer') {
            enqueue(controller, toSseData(chunk.delta))
          }
        }
        if (!closed) {
          enqueue(controller, 'event: done\ndata: [DONE]\n\n')
          closed = true
          controller.close()
        }
      } catch (streamErr) {
        console.error('[sseWrapper:stream]', streamErr)
        if (!closed) {
          closed = true
          controller.error(
            streamErr instanceof Error ? streamErr : new Error(String(streamErr))
          )
        }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
