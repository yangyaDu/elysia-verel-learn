import swagger from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { chatController } from './feature/chat/controller'

const app = new Elysia().use(chatController)

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
