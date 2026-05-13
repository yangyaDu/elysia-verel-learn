import { cors } from '@elysiajs/cors'
import swagger from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { authController } from './feature/auth/controller'
import { chatController } from './feature/chat/controller'
import { documentController } from './feature/document/controller'
import { errorMiddleware, loggerMiddleware } from './middlewares/middlewares'

const allowOrigins = (process.env.CORS_ALLOW_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = new Elysia()
  .use(loggerMiddleware)
  .use(errorMiddleware)
  .use(
    cors({
      origin: allowOrigins,
      credentials: true,
    })
  )
  .use(authController)
  .use(chatController)
  .use(documentController)

app.use(
  swagger({
    documentation: {
      info: {
        title: 'ZenithStrat - Backend API Endpoint',
        version: '1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: '登录接口返回的 access token',
          },
        },
      },
    },
    specPath: '/swagger.json',
  })
)

export default app

// 本地可直接 `bun run dev:bun`；Vercel 生产环境仅使用上方的 default export。
if (import.meta.main) {
  const port = Number(process.env.PORT) || 4011
  app.listen(port)
  console.info(`Listening on http://localhost:${port}`)
}
