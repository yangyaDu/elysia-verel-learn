import { sleep } from 'bun'
import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { buildResponseBody, bulidSseResponse, createApiResponseType } from '../../utils/msgWrapper'
import { chatBodySchema, chatDataSchema, echoBodySchema } from './model'
import { deepSeekChatService } from './service'

const DEFAULT_CHAT_PROMPT = '用不超过两句话解释：什么是 REST API？'

export const chatController = new Elysia()
  .post(
    '/echo',
    async ({ body }) => {
      await sleep(100)
      return buildResponseBody(0, body)
    },
    {
      body: echoBodySchema,
      response: {
        200: createApiResponseType(echoBodySchema),
      },
      detail: {
        tags: ['echo'],
      },
    }
  )
  .post(
    '/chat',
    async ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT
      const [code, data] = await deepSeekChatService.chat({ prompt })
      return buildResponseBody(code, data)
    },
    {
      body: chatBodySchema,
      response: {
        200: createApiResponseType(chatDataSchema),
      },
      detail: {
        tags: ['chat'],
      },
    }
  )
  .post(
    '/chat/tools',
    async ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT
      const [code, data] = await deepSeekChatService.chatWithTools({ prompt })
      return buildResponseBody(code, data)
    },
    {
      body: chatBodySchema,
      response: {
        200: createApiResponseType(chatDataSchema),
      },
      detail: {
        tags: ['chat'],
        summary: '带工具调用的 RAG 对话 (PageIndex)',
      },
    }
  )
  .post(
    '/chat/stream',
    ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      try {
        const streamIterable = deepSeekChatService.chatStream({ prompt })
        return bulidSseResponse(streamIterable)
      } catch (err) {
        console.error('[chat/stream]', err)
        return Response.json(buildResponseBody(errCodeEnum.ERR_THIRDPARTY_ERROR.code, null), {
          status: 502,
        })
      }
    },
    {
      body: chatBodySchema,
      response: {
        200: t.String(),
      },
      detail: {
        tags: ['chat'],
      },
    }
  )
  .post(
    '/chat/stream/tools',
    async ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      try {
        const streamIterable = await deepSeekChatService.chatStreamWithTools({ prompt })
        return bulidSseResponse(streamIterable)
      } catch (err) {
        console.error('[chat/stream/tools]', err)
        return Response.json(buildResponseBody(errCodeEnum.ERR_THIRDPARTY_ERROR.code, null), {
          status: 502,
        })
      }
    },
    {
      body: chatBodySchema,
      response: {
        200: t.String(),
      },
      detail: {
        tags: ['chat'],
        summary: '带工具调用的流式 RAG 对话 (PageIndex)',
      },
    }
  )
