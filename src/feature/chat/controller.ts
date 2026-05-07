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
      await sleep(1000)
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

      const [errCode, result] = await deepSeekChatService.chat(prompt)
      return buildResponseBody(errCode, result)
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
    '/chat/stream',
    async ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      const [errCode, streamIterable] = await deepSeekChatService.chatStream(prompt)
      if (errCode !== errCodeEnum.ERR_SUCCESS.code || !streamIterable) {
        return Response.json(buildResponseBody(errCode, null))
      }

      return bulidSseResponse(streamIterable)
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
