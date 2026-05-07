import type { TSchema } from '@sinclair/typebox'
import { t } from 'elysia'
import { getErrInfoFromCode, type ErrCodeT } from '../define/errDefine'

export const createApiResponseType = <T extends TSchema | null>(dataSchema: T) =>
  t.Object({
    code: t.Number({ default: 0, description: 'Status code, 0 for success' }),
    message: t.String({ default: 'success', description: 'Response message' }),
    data: dataSchema ? t.Union([dataSchema, t.Null()]) : t.Null(),
  })

export const buildResponseBody = <T>(errCode: ErrCodeT, data: T | null) => {
  const { code, message } = getErrInfoFromCode(errCode)
  return { code, message, data }
}

const toSseData = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `data: ${line}\n`)
    .join('') + '\n'

export function createSseResponse(streamIterable: AsyncIterable<string>): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamIterable) {
          controller.enqueue(encoder.encode(toSseData(chunk)))
        }
        controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'))
        controller.close()
      } catch (streamErr) {
        console.error('[sseWrapper:stream]', streamErr)
        controller.error(streamErr)
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
