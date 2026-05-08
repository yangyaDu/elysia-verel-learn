import { cors } from '@elysiajs/cors'
import swagger from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { chatController } from './feature/chat/controller'
import { documentController } from './feature/document/controller'

const allowOrigins = (process.env.CORS_ALLOW_ORIGINS ?? 'http://localhost:3030')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = new Elysia()
  .use(
    cors({
      origin: allowOrigins,
      credentials: true,
    })
  )
  .use(chatController)
  .use(documentController)

app.use(
  swagger({
    documentation: {
      info: {
        title: 'ZenithStrat - Backend API Endpoint',
        version: '1.0',
      },
    },
    specPath: '/swagger.json',
  })
)

export default app

// 本地可直接 `bun run dev:bun`；Vercel 生产环境仅使用上方的 default export。
if (import.meta.main) {
  const port = Number(process.env.PORT) || 3010
  app.listen(port)
  console.info(`Listening on http://localhost:${port}`)
}
