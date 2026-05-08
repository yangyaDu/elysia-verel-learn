import { tool } from 'ai'
import { z } from 'zod'
import { getPageIndexClient } from '../utils/pageindexClient'

const getClient = () => {
  const client = getPageIndexClient()
  if (!client) {
    throw new Error('PageIndex Client not configured')
  }
  return client
}

export const documentTools = {
  getDocumentStructure: tool({
    description: '获取已处理文档的分层目录/大纲。',
    inputSchema: z.object({
      docName: z.string().describe('文档名称'),
      part: z.number().optional().describe('大文档的分片编号'),
      waitForCompletion: z.boolean().optional().describe('是否等待处理完成后再返回'),
      folderId: z.string().optional().describe('文件夹 ID'),
    }),
    execute: async (args) => {
      return await getClient().tools.getDocumentStructure(args)
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
      return await getClient().tools.getPageContent(args)
    },
  }),

  getDocumentImage: tool({
    description: '获取 Base64 编码的嵌入图像数据。',
    inputSchema: z.object({
      imagePath: z.string().describe('图像路径，格式为 <docName>/<imagePath>'),
    }),
    execute: async (args) => {
      return await getClient().tools.getDocumentImage(args)
    },
  }),

  recentDocuments: tool({
    description: '列出最近创建的文档及其处理状态摘要。',
    inputSchema: z.object({
      folderId: z.string().optional().describe('按文件夹 ID 过滤'),
      cursor: z.string().optional().describe('分页游标'),
      limit: z.number().optional().describe('最大返回数量'),
    }),
    execute: async (args) => {
      return await getClient().tools.recentDocuments(args)
    },
  }),

  findRelevantDocuments: tool({
    description: '通过关键词或语义查询搜索文档库。',
    inputSchema: z.object({
      query: z.string().describe('搜索关键词'),
      cursor: z.string().optional().describe('分页游标'),
      limit: z.number().optional().describe('最大结果数量'),
      folderId: z.string().optional().describe('按文件夹 ID 过滤'),
    }),
    execute: async (args) => {
      return await getClient().tools.findRelevantDocuments(args)
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
      return await getClient().tools.getDocument(args)
    },
  }),

  removeDocument: tool({
    description: '批量删除指定名称的文档。',
    inputSchema: z.object({
      docNames: z.array(z.string()).describe('待删除的文档名称数组'),
      folderId: z.string().optional().describe('覆盖默认文件夹范围'),
    }),
    execute: async (args) => {
      return await getClient().tools.removeDocument(args)
    },
  }),

  listFolders: tool({
    description: '获取文件夹列表，可按父级过滤。',
    inputSchema: z.object({
      parentFolderId: z.string().optional().describe('"root" 表示根目录，或指定 ID 获取子目录'),
    }),
    execute: async (args) => {
      return await getClient().tools.listFolders(args)
    },
  }),
}
