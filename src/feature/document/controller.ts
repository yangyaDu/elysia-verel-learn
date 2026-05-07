import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { buildResponseBody, createApiResponseType } from '../../utils/msgWrapper'
import { checkStatusResponseSchema, uploadDocumentResponseSchema } from './model'
import { documentService } from './service'

export const documentController = new Elysia({ prefix: '/document' })
  .post(
    '/upload',
    async ({ body: { file } }) => {
      if (!file || file.type !== 'application/pdf') {
        return buildResponseBody(errCodeEnum.ERR_PARAMS_ERROR.code, null)
      }

      const [errCode, result] = await documentService.uploadPdf(file)
      return buildResponseBody(errCode, result)
    },
    {
      body: t.Object({
        file: t.File({
          type: 'application/pdf',
          maxSize: '20m',
        }),
      }),
      response: {
        200: createApiResponseType(uploadDocumentResponseSchema),
      },
      detail: {
        tags: ['document'],
        summary: '上传 PDF 并生成 PageIndex',
      },
    }
  )
  .get(
    '/check-status',
    async ({ query: { doc_id } }) => {
      const [errCode, result] = await documentService.checkStatus(doc_id)
      return buildResponseBody(errCode, result)
    },
    {
      query: t.Object({
        doc_id: t.String(),
      }),
      response: {
        200: createApiResponseType(checkStatusResponseSchema),
      },
      detail: {
        tags: ['document'],
        summary: '检查文档状态',
      },
    }
  )
