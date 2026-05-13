import { randomUUID } from 'node:crypto'
import { errCodeEnum, type ErrInfo } from '../../define/errDefine'
import { db } from '../../db/client'
import {
  deleteDocumentRowByPageindexId,
  findDocumentByPageindexId,
  findDocumentByS3Key,
  getTreeSnapshotByDocumentId,
  insertDocumentRow,
  listDocumentsFromDb,
  upsertTreeSnapshot,
} from './documentRepo'
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

async function presignS3Key(s3Key: string): Promise<[ErrInfo, string | null]> {
  const minioClient = getMinioClient()
  if (!minioClient) {
    return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
  }
  try {
    const url = await minioClient.presignedGetObject(MINIO_BUCKET_NAME, s3Key, 3600)
    return [errCodeEnum.ERR_SUCCESS, url]
  } catch (err) {
    console.error('[documentService/presignS3Key]', err)
    return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
  }
}

function treeSnapshotCacheTtlMs(): number {
  const sec = Number.parseInt(process.env.TREE_SNAPSHOT_CACHE_SECS ?? '300', 10)
  return (Number.isFinite(sec) && sec > 0 ? sec : 300) * 1000
}

function isSnapshotFresh(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) {
    return false
  }
  const t = Date.parse(fetchedAt.replace(' ', 'T'))
  if (Number.isNaN(t)) {
    return false
  }
  return Date.now() - t < treeSnapshotCacheTtlMs()
}

export class DocumentService {
  async getPreviewUrl(params: GetPreviewParams): Promise<[ErrInfo, string | null]> {
    const { s3Key } = params
    if (db) {
      const row = await findDocumentByS3Key(db, s3Key)
      if (!row) {
        return [errCodeEnum.ERR_NOT_FOUND, null]
      }
    }

    return presignS3Key(s3Key)
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

      const result: UploadDocumentResponse = {
        doc_id: response.doc_id,
        s3_key: s3Key,
        status: 'indexed and stored',
      }

      if (db) {
        try {
          await insertDocumentRow(db, {
            id: randomUUID(),
            pageindexDocId: response.doc_id,
            s3Key,
            originalFilename: file.name,
            contentType: file.type,
            fileSizeBytes: file.size,
            status: result.status ?? 'indexed and stored',
            folderId: null,
            pageindexCreatedAt: null,
          })
        } catch (dbErr) {
          console.error('[documentService/uploadPdf] db insert failed', dbErr)
        }
      }

      const [codeErr, url] = await presignS3Key(s3Key)
      if (codeErr !== errCodeEnum.ERR_SUCCESS) {
        return [codeErr, null]
      }
      result.url = url ?? undefined

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

  async listDocuments(params: ListDocumentsParams): Promise<[ErrInfo, DocumentMetadata[] | null]> {
    const limitNum = params.limit ? parseInt(String(params.limit), 10) : 50
    const offsetNum = params.offset ? parseInt(String(params.offset), 10) : 0

    if (db) {
      try {
        const rows = await listDocumentsFromDb(db, limitNum, offsetNum)
        const data: DocumentMetadata[] = rows.map((r) => ({
          id: r.pageindexDocId,
          name: r.originalFilename,
          status: r.status,
          created_at: r.createdAt,
          folder_id: r.folderId ?? undefined,
        }))
        return [errCodeEnum.ERR_SUCCESS, data]
      } catch (err) {
        console.error('[documentService/listDocuments]', err)
        return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
      }
    }

    const client = getPageIndexClient()
    if (!client) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    try {
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

    let s3Key: string | null = null
    if (db) {
      const row = await findDocumentByPageindexId(db, docId)
      if (row) {
        s3Key = row.s3Key
      }
    }

    const minioClient = getMinioClient()
    if (s3Key && minioClient) {
      try {
        await minioClient.removeObject(MINIO_BUCKET_NAME, s3Key)
      } catch (err) {
        console.error('[documentService/deleteDocument] minio removeObject', err)
      }
    }

    try {
      await client.api.deleteDocument(docId)
      if (db) {
        try {
          await deleteDocumentRowByPageindexId(db, docId)
        } catch (dbErr) {
          console.error('[documentService/deleteDocument] db delete failed', dbErr)
        }
      }
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

    if (db) {
      const docRow = await findDocumentByPageindexId(db, docId)
      if (docRow) {
        const snap = await getTreeSnapshotByDocumentId(db, docRow.id)
        if (snap && isSnapshotFresh(snap.fetchedAt)) {
          const cached = new CheckStatusResponse()
          cached.doc_id = docId
          cached.status = snap.pageindexStatus
          cached.result = snap.treeResult.map((item) => {
            const node = new CheckStatusResult()
            node.title = item.title
            node.node_id = item.node_id
            node.start_index = item.start_index
            node.end_index = item.end_index
            node.summary = item.summary
            node.text = item.text
            return node
          })
          return [errCodeEnum.ERR_SUCCESS, cached]
        }
      }
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

      if (db && result.result) {
        const docRow = await findDocumentByPageindexId(db, docId)
        if (docRow) {
          try {
            const treePayload = result.result.map((n) => ({
              title: n.title,
              node_id: n.node_id,
              start_index: n.start_index,
              end_index: n.end_index,
              summary: n.summary,
              text: n.text,
            }))
            await upsertTreeSnapshot(db, {
              id: randomUUID(),
              documentId: docRow.id,
              pageindexStatus: result.status,
              treeResult: treePayload,
            })
          } catch (snapErr) {
            console.error('[documentService/checkStatus] snapshot upsert failed', snapErr)
          }
        }
      }

      return [errCodeEnum.ERR_SUCCESS, result]
    } catch (err) {
      console.error('[documentService/checkStatus]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }
}

export const documentService = new DocumentService()
