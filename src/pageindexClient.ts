import { PageIndexClient } from '@pageindex/sdk'

/**
 * 从环境变量读取 PageIndex 配置。
 */
class PageIndexClientSingleton {
  private static instance: PageIndexClient | null | undefined

  static getInstance() {
    if (PageIndexClientSingleton.instance !== undefined) {
      return PageIndexClientSingleton.instance
    }

    const apiKey = (process.env.PAGEINDEX_API_KEY || '9499faa2f01e447b91ce0c5d71d2d600').trim()
    const baseUrl = (process.env.PAGEINDEX_BASE_URL || 'http://localhost:9090').trim()

    PageIndexClientSingleton.instance = new PageIndexClient({
      apiKey,
      apiUrl: baseUrl,
    })
    return PageIndexClientSingleton.instance
  }
}

export function getPageIndexClient() {
  return PageIndexClientSingleton.getInstance()
}
