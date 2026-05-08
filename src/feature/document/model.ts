import { t } from 'elysia'

export const uploadDocumentResponseSchema = t.Object({
  doc_id: t.String({ description: 'PageIndex 文档 ID' }),
  s3_key: t.String({ description: 'MinIO 中的对象键' }),
  url: t.Optional(t.String({ description: '文件的访问或下载 URL' })),
  status: t.Optional(t.String({ description: '状态' })),
})

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

export type UploadDocumentResponse = typeof uploadDocumentResponseSchema.static
export type DocumentMetadata = typeof documentMetadataSchema.static
export type ListDocumentsResponse = typeof listDocumentsResponseSchema.static

const checkStatusResult = t.Object({
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
  result: t.Optional(t.Array(checkStatusResult)),
})

export type CheckStatusResponse = typeof checkStatusResponseSchema.static
