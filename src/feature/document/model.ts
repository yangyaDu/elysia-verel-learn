import { t } from 'elysia'

// --- Request Schemas & Classes ---

export const getPreviewParamsSchema = t.Object({
  s3Key: t.String(),
})

export class GetPreviewParams {
  s3Key!: string
}

export const uploadBodySchema = t.Object({
  file: t.File({
    type: 'application/pdf',
    maxSize: '20m',
  }),
})

export class UploadPdfParams {
  file!: File
}

export const listQuerySchema = t.Object({
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
})

export class ListDocumentsParams {
  limit?: string | number
  offset?: string | number
}

export const docParamsSchema = t.Object({
  docId: t.String(),
})

export class DocParams {
  docId!: string
}

// --- Response Schemas & Classes ---

export type UploadDocumentResponse = {
  doc_id: string
  s3_key: string
  url?: string
  status?: string
} | null

export const uploadDocumentResponseSchema = t.Object({
  doc_id: t.String({ description: 'PageIndex 文档 ID' }),
  s3_key: t.String({ description: 'MinIO 中的对象键' }),
  url: t.Optional(t.String({ description: '文件的访问或下载 URL' })),
  status: t.Optional(t.String({ description: '状态' })),
})

/** 文档元数据对象（列表项、详情成功时的形状） */
export type DocumentMetadataFields = {
  id: string
  name: string
  status: string
  created_at?: string
  folder_id?: string
}

/** 单条查询结果：无文档时为 null */
export type DocumentMetadata = DocumentMetadataFields | null

export const documentMetadataSchema = t.Object({
  id: t.String(),
  name: t.String(),
  status: t.String(),
  created_at: t.Optional(t.String()),
  folder_id: t.Optional(t.String()),
})

export const listDocumentsResponseSchema = t.Object({
  documents: t.Array(documentMetadataSchema),
})

export class CheckStatusResult {
  title!: string
  node_id!: string
  start_index!: number
  end_index!: number
  summary!: string
  text!: string
}

export class CheckStatusResponse {
  doc_id!: string
  status!: string
  result?: CheckStatusResult[]
}

const checkStatusResultSchema = t.Object({
  title: t.String({ description: '标题' }),
  node_id: t.String({ description: '节点 ID' }),
  start_index: t.Number({ description: '开始索引' }),
  end_index: t.Number({ description: '结束索引' }),
  summary: t.String({ description: '摘要' }),
  text: t.String({ description: '文本' }),
})

export const checkStatusResponseSchema = t.Object({
  doc_id: t.String({ description: 'PageIndex 文档 ID' }),
  status: t.String({ description: '状态' }),
  result: t.Optional(t.Array(checkStatusResultSchema)),
})
