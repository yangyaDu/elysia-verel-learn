import { Elysia, t } from 'elysia'
import { authMiddleware } from '../../middlewares/authMiddleware'
import { buildResponseBody, createApiResponseType } from '../../utils/msgWrapper'
import {
  checkStatusResponseSchema,
  docParamsSchema,
  documentMetadataSchema,
  getPreviewParamsSchema,
  listQuerySchema,
  uploadBodySchema,
  uploadDocumentResponseSchema,
} from './model'
import { documentService } from './service'

export const documentController = new Elysia({ prefix: '/document' })
  .use(authMiddleware)
  .get(
    '/preview/:s3Key',
    async ({ params }) => {
      const [err, data] = await documentService.getPreviewUrl(params)
      return buildResponseBody(err, data)
    },
    {
      params: getPreviewParamsSchema,
      response: {
        200: createApiResponseType(t.String()),
      },
      detail: {
        tags: ['document'],
        summary: '获取 PDF 预览链接 (MinIO Presigned URL)',
      },
    }
  )
  .post(
    '/upload',
    async ({ body }) => {
      const [err, data] = await documentService.uploadPdf(body)
      return buildResponseBody(err, data)
    },
    {
      body: uploadBodySchema,
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
    '/list',
    async ({ query }) => {
      const [err, data] = await documentService.listDocuments({
        limit: query.limit,
        offset: query.offset,
      })
      return buildResponseBody(err, data ? { documents: data } : null)
    },
    {
      query: listQuerySchema,
      detail: {
        tags: ['document'],
        summary: '获取文档列表',
      },
    }
  )
  .get(
    '/status/:docId',
    async ({ params }) => {
      const [err, data] = await documentService.checkStatus(params)
      return buildResponseBody(err, data)
    },
    {
      params: docParamsSchema,
      response: {
        200: createApiResponseType(checkStatusResponseSchema),
      },
      detail: {
        tags: ['document'],
        summary: '检查文档处理状态 (Tree)',
      },
    }
  )
  .get(
    '/:docId',
    async ({ params }) => {
      const [err, data] = await documentService.getDocument(params)
      return buildResponseBody(err, data)
    },
    {
      params: docParamsSchema,
      response: {
        200: createApiResponseType(documentMetadataSchema),
      },
      detail: {
        tags: ['document'],
        summary: '获取文档元数据',
      },
    }
  )
  .delete(
    '/:docId',
    async ({ params }) => {
      const [err, data] = await documentService.deleteDocument(params)
      return buildResponseBody(err, data)
    },
    {
      params: docParamsSchema,
      detail: {
        tags: ['document'],
        summary: '删除文档',
      },
    }
  )
