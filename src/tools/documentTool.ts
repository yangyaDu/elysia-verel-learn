import { tool } from 'ai'
import { z } from 'zod'
import type { DocumentItem, TreeNode } from '@pageindex/sdk'
import { getConnectedPageIndexClient, getPageIndexClient } from '../utils/pageindexClient'

type ListDocumentsShape = DocumentItem[] | { documents: DocumentItem[] }

const getApiClient = () => {
  const client = getPageIndexClient()
  if (!client) {
    throw new Error('PageIndex Client not configured')
  }
  return client
}

const normalizeDocuments = (response: ListDocumentsShape): DocumentItem[] =>
  Array.isArray(response) ? response : response.documents

const listDocuments = async (folderId?: string | null, limit = 100): Promise<DocumentItem[]> => {
  const response = (await getApiClient().api.listDocuments({
    limit,
    offset: 0,
    folderId: folderId ?? undefined,
  })) as unknown as ListDocumentsShape
  return normalizeDocuments(response)
}

const findDocumentByName = async (docName: string, folderId?: string | null): Promise<DocumentItem> => {
  const docs = await listDocuments(folderId)
  const exact = docs.find((doc) => doc.name === docName)
  if (exact) {
    return exact
  }

  const fuzzy = docs.find((doc) => doc.name.includes(docName) || docName.includes(doc.name))
  if (fuzzy) {
    return fuzzy
  }

  throw new Error(`Document not found: ${docName}`)
}

const flattenTree = (nodes: TreeNode[] = []): TreeNode[] =>
  nodes.flatMap((node) => [node, ...flattenTree(node.nodes ?? [])])

const parsePages = (pages: string): Set<number> => {
  const selected = new Set<number>()
  for (const part of pages.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) {
      continue
    }

    const [startRaw, endRaw] = trimmed.split('-')
    const start = Number(startRaw)
    const end = endRaw ? Number(endRaw) : start
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      continue
    }

    for (let page = start; page <= end; page += 1) {
      selected.add(page)
    }
  }
  return selected
}

/**
 * 供 LLM 在 chat 中使用的 RAG 检索工具（只读）。
 * 每次调用前通过 getConnectedPageIndexClient 确保 MCP transport 已连接，
 * 避免空闲超时断开后首次工具调用时 ZodError（protocolVersion / capabilities / serverInfo 缺失）。
 */
export const ragTools = {
  findRelevantDocuments: tool({
    description: '通过关键词或语义查询搜索文档库，找到与问题相关的文档。',
    inputSchema: z.object({
      query: z.string().describe('搜索关键词或问题描述'),
      cursor: z.string().optional().describe('分页游标'),
      limit: z.number().optional().describe('最大结果数量'),
      folderId: z.string().optional().describe('按文件夹 ID 过滤'),
    }),
    execute: async (args) => {
      const query = args.query?.toLowerCase().trim()
      const docs = await listDocuments(args.folderId, args.limit ?? 10)
      const filtered = query
        ? docs.filter((doc) => {
            const text = `${doc.name} ${doc.description ?? ''}`.toLowerCase()
            return text.includes(query)
          })
        : docs

      return {
        docs: filtered.slice(0, args.limit ?? 10).map((doc) => ({
          id: doc.id,
          name: doc.name,
          description: doc.description ?? '',
          status: doc.status,
          pageNum: doc.pageNum ?? 0,
          createdAt: doc.createdAt,
          folderId: doc.folderId ?? null,
        })),
        search_mode: 'keyword',
        total_returned: filtered.length,
        has_more: filtered.length > (args.limit ?? 10),
        next_steps: {
          summary: 'Use getDocumentStructure or getPageContent with the selected document name.',
          options: ['getDocumentStructure', 'getPageContent'],
        },
      }
    },
  }),

  getPageContent: tool({
    description: '读取文档特定页面的文本内容和图像标注。',
    inputSchema: z.object({
      docName: z.string().describe('文档名称'),
      pages: z.string().describe('页面规范，如 "5"、"3,7,10" 或 "5-10"'),
      waitForCompletion: z.boolean().optional().describe('是否等待处理完成'),
      folderId: z.string().optional().describe('文件夹 ID'),
    }),
    execute: async (args) => {
      const doc = await findDocumentByName(args.docName, args.folderId)
      const tree = await getApiClient().api.getTree(doc.id)
      const selectedPages = parsePages(args.pages)
      const nodes = flattenTree(tree.result ?? [])
      const content = [...selectedPages].map((page) => {
        const pageNodes = nodes.filter((node) => node.page_index === page)
        return {
          page,
          text: pageNodes.map((node) => node.text).filter(Boolean).join('\n\n'),
        }
      })

      return {
        doc_name: doc.name,
        total_pages: doc.pageNum ?? 0,
        requested_pages: args.pages,
        returned_pages: args.pages,
        content,
        next_steps: {
          summary: 'Answer using the returned page content.',
          options: ['cite the document name and pages when useful'],
        },
      }
    },
  }),

  getDocumentStructure: tool({
    description: '获取已处理文档的分层目录/大纲，用于了解文档整体结构。',
    inputSchema: z.object({
      docName: z.string().describe('文档名称'),
      part: z.number().optional().describe('大文档的分片编号'),
      waitForCompletion: z.boolean().optional().describe('是否等待处理完成后再返回'),
      folderId: z.string().optional().describe('文件夹 ID'),
    }),
    execute: async (args) => {
      const doc = await findDocumentByName(args.docName, args.folderId)
      const tree = await getApiClient().api.getTree(doc.id, { nodeSummary: true })

      return {
        doc_name: doc.name,
        structure: tree.result ?? [],
        next_steps: {
          summary: 'Use this outline to summarize the PDF structure.',
          options: ['getPageContent for important sections if more detail is needed'],
        },
      }
    },
  }),

  getDocumentImage: tool({
    description: '获取 Base64 编码的嵌入图像数据。',
    inputSchema: z.object({
      imagePath: z.string().describe('图像路径，格式为 <docName>/<imagePath>'),
    }),
    execute: async (args) => {
      const client = await getConnectedPageIndexClient()
      return await client.tools.getDocumentImage(args)
    },
  }),

  getDocument: tool({
    description: '通过名称查找文档元数据。',
    inputSchema: z.object({
      docName: z.string().describe('文档名称'),
      waitForCompletion: z.boolean().optional().describe('是否等待处理完成'),
      folderId: z.string().optional().describe('覆盖默认文件夹范围'),
    }),
    execute: async (args) => {
      const doc = await findDocumentByName(args.docName, args.folderId)
      return {
        id: doc.id,
        name: doc.name,
        description: doc.description ?? '',
        status: doc.status,
        createdAt: doc.createdAt,
        pageNum: doc.pageNum,
        next_steps: {
          summary: 'Use getDocumentStructure or getPageContent for document details.',
          options: ['getDocumentStructure', 'getPageContent'],
        },
      }
    },
  }),
}

/**
 * 文档管理工具（有副作用），仅供后台管理接口使用，不应传给 chat LLM。
 */
export const documentAdminTools = {
  recentDocuments: tool({
    description: '列出最近创建的文档及其处理状态摘要。',
    inputSchema: z.object({
      folderId: z.string().optional().describe('按文件夹 ID 过滤'),
      cursor: z.string().optional().describe('分页游标'),
      limit: z.number().optional().describe('最大返回数量'),
    }),
    execute: async (args) => {
      const client = await getConnectedPageIndexClient()
      return await client.tools.recentDocuments(args)
    },
  }),

  removeDocument: tool({
    description: '批量删除指定名称的文档。',
    inputSchema: z.object({
      docNames: z.array(z.string()).describe('待删除的文档名称数组'),
      folderId: z.string().optional().describe('覆盖默认文件夹范围'),
    }),
    execute: async (args) => {
      const client = await getConnectedPageIndexClient()
      return await client.tools.removeDocument(args)
    },
  }),

  listFolders: tool({
    description: '获取文件夹列表，可按父级过滤。',
    inputSchema: z.object({
      parentFolderId: z.string().optional().describe('"root" 表示根目录，或指定 ID 获取子目录'),
    }),
    execute: async (args) => {
      const client = await getConnectedPageIndexClient()
      return await client.tools.listFolders(args)
    },
  }),
}
