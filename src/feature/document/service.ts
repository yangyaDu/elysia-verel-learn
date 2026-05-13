import { errCodeEnum, type ErrInfo } from '../../define/errDefine'
import { MINIO_BUCKET_NAME, getMinioClient } from '../../utils/minioClient'
import { getPageIndexClient } from '../../utils/pageindexClient'
import {
  CheckStatusResponse,
  CheckStatusResult,
  DocParams,
  DocumentMetadata,
  DocumentMetadataFields,
  GetPreviewParams,
  ListDocumentsParams,
  UploadDocumentResponse,
  UploadPdfParams,
} from './model'

type TreeNodeCompatFields = {
  start_index?: number
  end_index?: number
  startIndex?: number
  endIndex?: number
  summary?: string
}

export class DocumentService {
  async getPreviewUrl(params: GetPreviewParams): Promise<[ErrInfo, string | null]> {
    const { s3Key } = params
    const minioClient = getMinioClient()
    if (!minioClient) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
      const url = await minioClient.presignedGetObject(MINIO_BUCKET_NAME, s3Key, 3600)
      return [errCodeEnum.ERR_SUCCESS, url]
    } catch (err) {
      console.error('[documentService/getPreviewUrl]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async uploadPdf(params: UploadPdfParams): Promise<[ErrInfo, UploadDocumentResponse | null]> {
    const { file } = params
    const pageIndexClient = getPageIndexClient()
    const minioClient = getMinioClient()

    if (!pageIndexClient || !minioClient) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const s3Key = `${Date.now()}-${file.name}`

      await minioClient.putObject(MINIO_BUCKET_NAME, s3Key, buffer, file.size, {
        'Content-Type': file.type,
      })

      const response = await pageIndexClient.api.submitDocument(buffer, file.name)
      const [codeErr, url] = await this.getPreviewUrl({ s3Key })
      if (codeErr !== errCodeEnum.ERR_SUCCESS) {
        return [codeErr, null]
      }

      const result: UploadDocumentResponse = {
        doc_id: response.doc_id,
        s3_key: s3Key,
        url: url ?? undefined,
        status: 'indexed and stored',
      }

      return [errCodeEnum.ERR_SUCCESS, result]
    } catch (err) {
      console.error('[documentService/uploadPdf]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async getDocument(params: DocParams): Promise<[ErrInfo, DocumentMetadata]> {
    const { docId } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
      const response = await client.api.getDocument(docId)
      const data: DocumentMetadataFields = {
        id: response.id,
        name: response.name,
        status: response.status ?? '',
        created_at: response.createdAt ?? undefined,
        folder_id: response.folderId ?? undefined,
      }

      return [errCodeEnum.ERR_SUCCESS, data]
    } catch (err) {
      console.error('[documentService/getDocument]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async listDocuments(params: ListDocumentsParams): Promise<[ErrInfo, DocumentMetadataFields[] | null]> {
    const limitNum = params.limit ? parseInt(String(params.limit)) : 50
    const offsetNum = params.offset ? parseInt(String(params.offset)) : 0

    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
      // SDK 类型定义为 { documents: DocumentItem[] }，但实际 API 直接返回数组
      const response = (await client.api.listDocuments({
        limit: limitNum,
        offset: offsetNum,
      })) as unknown as import('@pageindex/sdk').DocumentItem[]
      if (!response) {
        return [errCodeEnum.ERR_NOT_FOUND, null]
      }

      const data = response.map((item) => {
        const doc: DocumentMetadataFields = {
          id: item.id,
          name: item.name,
          status: item.status ?? '',
          created_at: item.createdAt ?? undefined,
          folder_id: item.folderId ?? undefined,
        }
        return doc
      })
      return [errCodeEnum.ERR_SUCCESS, data]
    } catch (err) {
      console.error('[documentService/listDocuments]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async deleteDocument(params: DocParams): Promise<[ErrInfo, null]> {
    const { docId } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
      await client.api.deleteDocument(docId)
      return [errCodeEnum.ERR_SUCCESS, null]
    } catch (err) {
      console.error('[documentService/deleteDocument]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async checkStatus(params: DocParams): Promise<[ErrInfo, CheckStatusResponse | null]> {
    const { docId } = params
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
      const response = await client.api.getTree(docId)
      const result = new CheckStatusResponse()
      result.doc_id = response.doc_id
      result.status = response.status
      result.result = response.result?.map((item) => {
        const compatibleItem = item as typeof item & TreeNodeCompatFields
        const node = new CheckStatusResult()
        node.title = item.title
        node.node_id = item.node_id
        node.start_index = compatibleItem.start_index ?? compatibleItem.startIndex ?? 0
        node.end_index = compatibleItem.end_index ?? compatibleItem.endIndex ?? 0
        node.summary = compatibleItem.summary ?? ''
        node.text = item.text
        return node
      })

      return [errCodeEnum.ERR_SUCCESS, result]
    } catch (err) {
      console.error('[documentService/checkStatus]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }
}

export const documentService = new DocumentService()
