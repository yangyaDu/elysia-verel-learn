# Elysia + Vercel 学习 Demo

最小 Elysia 应用，对齐 ZenithStrat `backend-framework` 的 ESLint（扁平配置 + TypeScript 类型检查）与 Prettier 习惯；可按 [Vercel Elysia 文档](https://vercel.com/docs/frameworks/backend/elysia) 部署。

## 前置条件

- [Bun](https://bun.sh/)（本地运行 `dev:bun`）
- [Vercel 账号](https://vercel.com/)与 CLI（`bunx vercel` 或使用全局 `vercel`）

## 安装

```bash
cd elysia-vercel-learn
bun install
```

从仓库根目录复制 `.env.example` 为 `.env`，填写密钥与连接信息（`DEEPSEEK_*`、`PAGEINDEX_*`、`MINIO_*` 等）。应用与 Docker Compose 均从该文件读取；启动容器时请带上 `--env-file .env`，例如：

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d
docker compose -f docker/observability/docker-compose.yml --env-file .env up -d
```

观测栈中的 Grafana 管理员账号密码对应 `.env` 里的 `GRAFANA_ADMIN_USER`、`GRAFANA_ADMIN_PASSWORD`。

## 本地开发

### 仅用 Bun（默认）

```bash
bun run dev
```

与 `bun run dev:bun` 相同。默认监听 `http://localhost:4011`（避开 3000–4000 常见占用端口，可用 `PORT` 覆盖）。

### 模拟 Vercel（`vercel dev`）

`vercel dev` 会在本地拉起 Development Command（默认即 `bun run dev`）。因此 **`package.json` 里的 `dev` 必须是真实开发服务器命令**，不能写成 `vercel dev`，否则会 [递归调用自身](https://vercel.link/recursive-invocation-of-commands)。

首次在项目目录执行：

```bash
bunx vercel link
bun run dev:vercel
```

浏览器访问 CLI 输出的本地 URL进行验证。

部署到 Vercel 时只依赖 **`export default app`**，`listen` 分支不会在服务端打包路径里作为主要入口逻辑依赖——仍以官方 zero-config 为准。

## 部署

```bash
bunx vercel deploy
```

生产环境可加 `--prod`。CLI 版本建议满足官方说明（参见 Vercel 文档）。

## 代码质量

```bash
bun run lint
bun run tsc-check
bun run format:check
```

格式化：

```bash
bun run format
```

## 路由示例

| 方法 | 路径    | 说明                                      |
| ---- | ------- | ----------------------------------------- |
| GET  | `/`     | JSON 欢迎信息                             |
| POST | `/echo` | Body JSON：`{ "name": string }`，原样返回 |
