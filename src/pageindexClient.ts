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

    const apiKey = (process.env.PAGEINDEX_API_KEY || '').trim()
    if (!apiKey) {
      PageIndexClientSingleton.instance = null
      return PageIndexClientSingleton.instance
    }

    PageIndexClientSingleton.instance = new PageIndexClient({
      apiKey,
    })
    return PageIndexClientSingleton.instance
  }
}

export function getPageIndexClient() {
  return PageIndexClientSingleton.getInstance()
}
