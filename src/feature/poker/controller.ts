import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { buildResponseBody, createApiResponseType } from '../../utils/msgWrapper'
import { isPokerOperation } from './adapter'
import {
  pokerCompareBodySchema,
  pokerCompareResponseSchema,
  pokerQueryBodySchema,
  pokerQueryResponseSchema,
} from './model'
import { pokerService } from './service'

export const pokerController = new Elysia({ prefix: '/poker' })
  .post(
    '/query-hand-strategy',
    async ({ body }) => {
      const [err, data] = await pokerService.queryHandStrategy(body)
      return buildResponseBody(err, data)
    },
    {
      body: pokerQueryBodySchema,
      response: {
        200: createApiResponseType(pokerQueryResponseSchema),
      },
      detail: {
        tags: ['poker'],
        summary: '查询指定牌面在具体行动线下的策略',
      },
    }
  )
  .post(
    '/operation/:operation',
    async ({ params, body }) => {
      if (!isPokerOperation(params.operation)) {
        return buildResponseBody(errCodeEnum.ERR_PARAMS_ERROR, null)
      }
      const [err, data] = await pokerService.execute(params.operation, body)
      return buildResponseBody(err, data)
    },
    {
      params: t.Object({ operation: t.String() }),
      body: t.Any(),
      response: {
        200: createApiResponseType(t.Any()),
      },
      detail: {
        tags: ['poker'],
        summary: '执行其他扑克 SDK 查询操作',
      },
    }
  )
  .post(
    '/compare',
    async ({ body }) => {
      const [err, data] = await pokerService.compare(body)
      return buildResponseBody(err, data)
    },
    {
      body: pokerCompareBodySchema,
      response: {
        200: createApiResponseType(pokerCompareResponseSchema),
      },
      detail: {
        tags: ['poker'],
        summary: '仅内部使用：对比 Node-API 与 Bun FFI 的同步查询延迟',
      },
    }
  )
