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

## 扑克查询引擎对比（仅本地 / 长驻 Bun 服务）

`/poker/query-hand-strategy` 根据 `PROTO_POKER_RANGE_ENGINE`（`node-api`、`ffi` 或 `sqlite`）选择一套查询实现。`sqlite` 通过 Drizzle 只读查询源 `range.db`，用于基线对比而非线上运行时。`/poker/compare` 仅在 `POKER_COMPARE_ENABLED=1` 时可用，会在同一请求中依次测量三套实现；不要将它对外暴露。

其余 SDK 查询统一使用 `POST /poker/operation/:operation`：`getConcreteLines`、`getAbstractLines`、`handsByActions`、`queryBatch`、`prewarm` 和 `stats`。请求体与同名 SDK 方法一致，`stats` 的请求体为 `{}`。

本地比较前，先在同级 `proto-poker-range` 仓库构建原生库，并准备一个独立的 Proto V3 数据目录：

```bash
cd ../proto-poker-range
cargo build --locked --release -p proto-poker-range-node -p proto-poker-range-ffi
cp target/release/libproto_poker_range_node.dylib crates/node/index.node # macOS
```

随后在本项目配置绝对路径：

```bash
export PROTO_POKER_RANGE_DATA_DIR=/path/to/proto-v3-release-root
export PROTO_POKER_RANGE_NODE_API_MODULE="$PWD/../proto-poker-range/crates/node/index.js"
export PROTO_POKER_RANGE_FFI_MODULE="$PWD/../proto-poker-range/crates/bun-ffi/index.ts"
export PROTO_POKER_RANGE_FFI_LIBRARY="$PWD/../proto-poker-range/target/release/libproto_poker_range_ffi.dylib"
export PROTO_POKER_RANGE_SQLITE_DB="$PWD/../proto-poker-range/range-data/sqlite/range.db"
export PROTO_POKER_RANGE_ENGINE=node-api
export POKER_COMPARE_ENABLED=1
```

Linux 部署时分别使用 `libproto_poker_range_node.so` 与 `libproto_poker_range_ffi.so`。Vercel 函数不适合作为外部 V3 数据目录的长期宿主；请在长驻 Bun 进程或容器中运行该功能。

## 路由示例

| 方法 | 路径    | 说明                                      |
| ---- | ------- | ----------------------------------------- |
| GET  | `/`     | JSON 欢迎信息                             |
| POST | `/echo` | Body JSON：`{ "name": string }`，原样返回 |
