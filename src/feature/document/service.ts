import { errCodeEnum, type ErrCodeT } from '../../define/errDefine'
import { MINIO_BUCKET_NAME, getMinioClient } from '../../minioClient'
import { getPageIndexClient } from '../../pageindexClient'
import type { CheckStatusResponse, DocumentMetadata, UploadDocumentResponse } from './model'

export type CheckStatusResponseType = CheckStatusResponse | null
export type UploadDocumentResponseType = UploadDocumentResponse | null

// 定义参数类
export class UploadPdfParams {
  file!: File
}

export class GetDocumentParams {
  docId!: string
}

export class ListDocumentsParams {
  limit?: number = 50
  offset?: number = 0
}

export class DeleteDocumentParams {
  docId!: string
}

export class CheckStatusParams {
  docId!: string
}

export class DocumentService {
  async uploadPdf(params: UploadPdfParams): Promise<[ErrCodeT, UploadDocumentResponseType]> {
    const { file } = params
    const pageIndexClient = getPageIndexClient()
    const minioClient = getMinioClient()

    if (!pageIndexClient || !minioClient) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const s3Key = `${Date.now()}-${file.name}`

      await minioClient.putObject(MINIO_BUCKET_NAME, s3Key, buffer, file.size, {
        'Content-Type': file.type,
      })

      const response = await pageIndexClient.api.submitDocument(buffer, file.name)

      return [
        errCodeEnum.ERR_SUCCESS.code,
        {
          doc_id: response.doc_id,
          s3_key: s3Key,
          status: 'indexed and stored',
        },
      ]
    } catch (err) {
      console.error('[documentService/uploadPdf]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  async getDocument(params: GetDocumentParams): Promise<[ErrCodeT, DocumentMetadata | null]> {
    const { docId } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      const response = await client.api.getDocument(docId)
      return [errCodeEnum.ERR_SUCCESS.code, response]
    } catch (err) {
      console.error('[documentService/getDocument]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  async listDocuments(params: ListDocumentsParams): Promise<[ErrCodeT, DocumentMetadata[] | null]> {
    const { limit = 50, offset = 0 } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      const response = await client.api.listDocuments({ limit, offset })
      return [errCodeEnum.ERR_SUCCESS.code, response as unknown as DocumentMetadata[]]
    } catch (err) {
      console.error('[documentService/listDocuments]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  async deleteDocument(params: DeleteDocumentParams): Promise<[ErrCodeT, null]> {
    const { docId } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      await client.api.deleteDocument(docId)
      return [errCodeEnum.ERR_SUCCESS.code, null]
    } catch (err) {
      console.error('[documentService/deleteDocument]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  async checkStatus(params: CheckStatusParams): Promise<[ErrCodeT, CheckStatusResponseType]> {
    const { docId } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      const response = await client.api.getTree(docId)
      return [
        errCodeEnum.ERR_SUCCESS.code,
        {
          doc_id: response.doc_id,
          status: response.status,
          result: response.result?.map((item) => ({
            title: item.title,
            node_id: item.node_id,
            page_index: item.page_index,
            text: item.text,
            nodes: (item.nodes ?? []).map((node) => ({
              title: node.title,
              node_id: node.node_id,
              page_index: node.page_index,
              text: node.text,
            })),
          })),
        },
      ]
    } catch (err) {
      console.error('[documentService/checkStatus]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }
}

export const documentService = new DocumentService()
