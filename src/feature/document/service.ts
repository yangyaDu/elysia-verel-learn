import { errCodeEnum, type ErrCodeT } from '../../define/errDefine'
import { getPageIndexClient } from '../../pageindexClient'
import type { CheckStatusResponse, UploadDocumentResponse } from './model'

export type CheckStatusResponseType = CheckStatusResponse | null
export type UploadDocumentResponseType = UploadDocumentResponse | null

export class DocumentService {
  async checkStatus(doc_id: string): Promise<[ErrCodeT, CheckStatusResponseType]> {
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      const documentsApi = (client.api as unknown as {
        documents: { getDocument: (targetDocId: string) => Promise<CheckStatusResponse> }
      }).documents
      const response = await documentsApi.getDocument(doc_id)
      return [errCodeEnum.ERR_SUCCESS.code, response]
    } catch (err) {
      console.error('[documentService/checkStatus]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  async uploadPdf(file: File): Promise<[ErrCodeT, UploadDocumentResponseType]> {
    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer())

      // 调用 SDK 提交文档
      // 根据 SDK 文档，submitDocument 接收 buffer 和文件名
      const response = await client.api.submitDocument(buffer, file.name)

      return [errCodeEnum.ERR_SUCCESS.code, {
        doc_id: response.doc_id,
        s3_key: '',
        status: 'submitted',
      }]
    } catch (err) {
      console.error('[documentService/uploadPdf]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }
}

export const documentService = new DocumentService()
