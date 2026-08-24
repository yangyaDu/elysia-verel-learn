# Elysia + Vercel 学习 Demo

最小 Elysia 应用，对齐 ZenithStrat `backend-framework` 的 ESLint（扁平配置 + TypeScript 类型检查）与 Prettier 习惯；可按 [Vercel Elysia 文档](https://vercel.com/docs/frameworks/backend/elysia) 部署。

## 项目目录与文件职责

以下目录树以当前仓库受版本控制的业务与配置文件为准。省略了 `.git/`、依赖安装目录
`node_modules/`、本机环境文件 `.env` 和 macOS 自动生成的 `.DS_Store`。

```text
.
├── .env.example                                      # 本地、Docker 与观测栈共用的环境变量模板
├── .gemini/
│   └── settings.json                                 # Gemini 开发工具的 PageIndex MCP 服务配置
├── .gitignore                                        # Git 忽略规则（依赖、构建产物、密钥与本地 Docker 数据）
├── .prettierignore                                   # Prettier 跳过格式化的目录和锁文件
├── .prettierrc.js                                    # Prettier 代码格式规范
├── .vscode/
│   ├── launch.json                                   # VS Code 中 Bun 的启动、附加与断点调试配置
│   └── settings.json                                 # VS Code 的 Bun 调试终端设置
├── GEMINI.md                                         # 供 AI 协作工具参考的项目分层、类型与服务约定
├── README.md                                         # 项目使用、部署、扑克引擎与目录说明（本文档）
├── bun.lock                                          # Bun 依赖解析锁文件，确保 Bun 安装结果可复现
├── docker/
│   ├── docker-compose.yml                            # MinIO、PageIndex API 和建桶工具的本地编排
│   ├── pageindex.Dockerfile                          # 构建内置 PageIndex 的 Python 服务镜像
│   ├── pageindex_server.py                           # PageIndex REST/MCP 包装器；异步解析 PDF 并持久化索引结果
│   ├── pageindex_data/
│   │   └── results_cache.json                        # PageIndex 容器挂载的文档解析结果缓存
│   └── observability/
│       ├── docker-compose.yml                        # Loki、Promtail、Grafana 本地观测栈编排
│       ├── promtail-config.yml                       # Promtail 从 Docker stdout 采集 JSON 日志并推送至 Loki
│       └── grafana/provisioning/datasources/loki.yml # Grafana 启动时自动创建 Loki 数据源
├── eslint.config.js                                  # TypeScript 类型感知 ESLint 与 Prettier 兼容配置
├── package.json                                      # 项目元信息、脚本和运行/开发依赖声明
├── package-lock.json                                 # npm 依赖解析锁文件；兼容 npm 工具链
├── src/
│   ├── index.ts                                      # Elysia 应用入口：挂载中间件、路由、Swagger 与本地监听器
│   ├── define/
│   │   └── errDefine.ts                              # 统一业务错误码、错误信息与 BusinessError 定义
│   ├── feature/
│   │   ├── chat/
│   │   │   ├── chatToolAuditRequestContext.ts        # 用 WeakMap 在单个请求内保存聊天审计上下文
│   │   │   ├── controller.ts                         # `/chat`、`/chat/stream` 与 `/echo` HTTP 路由
│   │   │   ├── model.ts                              # 聊天请求、响应、工具事件与 Elysia 校验 Schema
│   │   │   ├── service.ts                            # 调用 AI SDK/DeepSeek、RAG 工具并产出普通或 SSE 流式回复
│   │   │   └── toolAudit.ts                          # 工具调用审计、脱敏与结构化日志输出
│   │   ├── document/
│   │   │   ├── controller.ts                         # 文档上传、预览、查询、删除和状态路由
│   │   │   ├── model.ts                              # 文档接口的请求参数、返回类型与校验 Schema
│   │   │   └── service.ts                            # 协调 MinIO 与 PageIndex，处理 PDF 存储和索引生命周期
│   │   └── poker/
│   │       ├── adapter.ts                            # 统一 Node-API、FFI、SQLite 三种扑克查询引擎的加载与选择
│   │       ├── controller.ts                         # `/poker` 查询、通用操作及内部性能对比路由
│   │       ├── model.ts                              # 扑克查询、动作结果和基准测试的 Elysia Schema/类型
│   │       ├── sceneDrill.ts                         # 场景参数归一化、Node-API 查询和 Drill 推荐转换
│   │       ├── service.ts                            # 执行查询、映射引擎错误，并对三种实现进行一致性/延迟对比
│   │       ├── sqliteAdapter.ts                      # 对 range.db 的只读 Drizzle/Bun SQLite 基线实现
│   │       └── sqliteSchema.ts                       # SQLite 扑克维度表、行动线表和 Drizzle 表结构映射
│   ├── middlewares/
│   │   ├── chatToolAuditRequestMiddleware.ts         # 将 requestId 和路由写入聊天工具审计请求域
│   │   └── middlewares.ts                            # 全局请求日志、响应日志、异常处理与统一错误响应
│   ├── tools/
│   │   └── documentTool.ts                           # 暴露给 LLM 的 PageIndex 文档检索与读取工具集合
│   └── utils/
│       ├── deepseekClient.ts                         # DeepSeek AI SDK Provider/模型的进程内单例
│       ├── minioClient.ts                            # 按环境变量创建 MinIO 客户端并导出存储桶名称
│       ├── msgWrapper.ts                             # 通用 JSON 响应包装与聊天 SSE 编码器
│       ├── pageindexClient.ts                        # PageIndex SDK 单例及 MCP 连接保活/重连逻辑
│       └── plgLog.ts                                 # 输出供 Promtail/Loki 消费的单行 JSON 日志
├── tsconfig.json                                     # TypeScript 编译目标、严格校验与源码包含范围
├── data/
│   ├── proto/README.md                                # 内置 V1 archive 的来源与替换说明
│   └── proto/v1-release-20260721T105500Z/
│       ├── default_{6,8,9}max_{100,200,300}BB/       # 随项目提供的 9 个 V1 维度
└── vercel.json                                       # Vercel 部署配置（指定 Bun 1.x 运行时）
```

`src/feature` 采用 Controller → Service → Model 分层：Controller 只处理 HTTP 与参数校验，
Service 承载业务逻辑，Model 定义 TypeBox/Elysia schema 与静态类型。`utils` 和 `tools` 则提供可被
多个 feature 复用的外部服务客户端、响应格式和 LLM 工具。扑克 Node-API 二进制属于平台相关产物，
更新原生库、操作系统或 CPU 架构后需要按下文步骤重新生成。

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

本地比较前，先在同级 `proto-poker-range` 仓库构建原生库，并准备一个独立的 Proto V1 数据目录：

```bash
cd ../proto-poker-range
cargo build --locked --release -p proto-poker-range-node -p proto-poker-range-ffi
node scripts/prepare-elysia-node-api-bundle.mjs \
  ../elysia-verel-learn/vendor/proto-poker-range-bun-node-api \
  target/release/libproto_poker_range_node.dylib # macOS
cd ../elysia-verel-learn
bun install
```

Node-API 使用 GitHub Packages 中发布的 `@yangyadu/proto-poker-range-bun-node-api@0.1.3`。项目根目录的 `.npmrc` 会把 `@yangyadu` 指向 GitHub Packages，并从 `GITHUB_TOKEN` 读取安装凭证：

```bash
export GITHUB_TOKEN=你的_PAT_或_GitHub_Actions_Token
bun install
```

运行时默认读取项目内 `data/proto/v1-release-20260721T105500Z`，其中包含 `6/8/9max × 100/200/300BB` 的全部 9 个维度；`player_count` 与 `depth_bb` 会选择对应的 archive。如果使用其他 V1 archive，设置 `PROTO_POKER_RANGE_DATA_DIR` 覆盖默认路径；Node-API 的 `getAbstractLinesByDimensionFilters` 会复用 V1 页面读取、IDX 定位和页缓存。

场景转换接口为 `POST /poker/scene-to-drill`，输入字段沿用方案文档的 snake_case 命名，例如：

```json
{
  "street": "flop",
  "spot_type": "postflop_vs_check",
  "hero_position": "BB",
  "opponent_position": "CO",
  "player_count": 6,
  "depth_bb": 100
}
```

转换层只构造有值的 `DimensionFilter[]`，Node-API 单次调用完成 Bitmap 筛选和候选行动线聚合；`opponent_position` 是单个位置，表示当前决策街 Hero 行动前最后一次 `R` 的玩家位置；`matchedDimensions`、`ignoredDimensions` 通过结构化日志记录，不进入 Drill 推荐结果。

随后在本项目配置数据和 FFI 的绝对路径：

```bash
export PROTO_POKER_RANGE_DATA_DIR=/path/to/proto-v1-release-root
export PROTO_POKER_RANGE_FFI_MODULE="$PWD/../proto-poker-range/crates/bun-ffi/index.ts"
export PROTO_POKER_RANGE_FFI_LIBRARY="$PWD/../proto-poker-range/target/release/libproto_poker_range_ffi.dylib"
export PROTO_POKER_RANGE_SQLITE_DB="$PWD/../proto-poker-range/range-data/sqlite/range.db"
export PROTO_POKER_RANGE_ENGINE=node-api
export POKER_COMPARE_ENABLED=1
```

Linux 部署时，使用与运行平台匹配的 Node-API 包和 V1 archive。Node-API 的 `.node` 二进制必须与实际运行的平台和 CPU 架构一致。Vercel 函数不适合作为外部 V1 数据目录的长期宿主；请在长驻 Bun 进程或容器中运行该功能。

## 路由示例

| 方法 | 路径    | 说明                                      |
| ---- | ------- | ----------------------------------------- |
| GET  | `/`     | JSON 欢迎信息                             |
| POST | `/echo` | Body JSON：`{ "name": string }`，原样返回 |
