import { t } from 'elysia'

export const uploadDocumentResponseSchema = t.Object({
  doc_id: t.String({ description: 'PageIndex 文档 ID' }),
  s3_key: t.String({ description: 'MinIO 中的对象键' }),
  url: t.Optional(t.String({ description: '文件的访问或下载 URL' })),
  status: t.Optional(t.String({ description: '状态' })),
})

export type UploadDocumentResponse = typeof uploadDocumentResponseSchema.static

const checkStatusResult = t.Object({
  title: t.String({ description: '标题' }),
  node_id: t.String({ description: '节点 ID' }),
  page_index: t.Number({ description: '页面索引' }),
  text: t.String({ description: '文本' }),
  nodes: t.Array(
    t.Object({
      title: t.String({ description: '标题' }),
      node_id: t.String({ description: '节点 ID' }),
      page_index: t.Number({ description: '页面索引' }),
      text: t.String({ description: '文本' }),
    })
  ),
})

export const checkStatusResponseSchema = t.Object({
  doc_id: t.String({ description: 'PageIndex 文档 ID' }),
  status: t.String({ description: '状态' }),
  result: t.Optional(t.Array(checkStatusResult)),
})

export type CheckStatusResponse = typeof checkStatusResponseSchema.static
