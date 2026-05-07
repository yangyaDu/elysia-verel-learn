import { Elysia, t } from 'elysia'
import { buildResponseBody, createApiResponseType } from '../../utils/msgWrapper'
import {
  checkStatusResponseSchema,
  documentMetadataSchema,
  listDocumentsResponseSchema,
  uploadDocumentResponseSchema,
} from './model'
import { documentService } from './service'

export const documentController = new Elysia({ prefix: '/document' })
  .post(
    '/upload',
    async ({ body: { file } }) => {
      const [code, data] = await documentService.uploadPdf({ file })
      return buildResponseBody(code, data)
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
    '/list',
    async ({ query: { limit, offset } }) => {
      const [code, data] = await documentService.listDocuments({
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      })
      return buildResponseBody(code, { documents: data ?? [] })
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      response: {
        200: createApiResponseType(listDocumentsResponseSchema),
      },
      detail: {
        tags: ['document'],
        summary: '获取文档列表',
      },
    }
  )
  .get(
    '/:docId',
    async ({ params: { docId } }) => {
      const [code, data] = await documentService.getDocument({ docId })
      return buildResponseBody(code, data)
    },
    {
      params: t.Object({
        docId: t.String(),
      }),
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
    async ({ params: { docId } }) => {
      const [code, data] = await documentService.deleteDocument({ docId })
      return buildResponseBody(code, data)
    },
    {
      params: t.Object({
        docId: t.String(),
      }),
      detail: {
        tags: ['document'],
        summary: '删除文档',
      },
    }
  )
  .get(
    '/status/:docId',
    async ({ params: { docId } }) => {
      const [code, data] = await documentService.checkStatus({ docId })
      return buildResponseBody(code, data)
    },
    {
      params: t.Object({
        docId: t.String(),
      }),
      response: {
        200: createApiResponseType(checkStatusResponseSchema),
      },
      detail: {
        tags: ['document'],
        summary: '检查文档处理状态 (Tree)',
      },
    }
  )
