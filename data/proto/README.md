# Elysia 内置 V1 Proto 数据

`v1-release-20260901T000000Z` 是从 `proto-poker-range` 的 V1 发布目录复制的可运行 release，包含以下 9 个维度：

- `default_6max_100BB`
- `default_6max_200BB`
- `default_6max_300BB`
- `default_8max_100BB`
- `default_8max_200BB`
- `default_8max_300BB`
- `default_9max_100BB`
- `default_9max_200BB`
- `default_9max_300BB`

每个维度都包含：

- `manifest.json`
- `drill-scenarios.pb/.idx`
- `abstract-action-paths.pb/.idx`
- `concrete-action-paths.pb/.idx`
- `hand-strategies.pb/.idx`

Node-API 默认读取这个 release 根目录，并根据请求中的 `playerCount` 与 `depthBb` 选择维度。需要其他数据版本时，通过 `PROTO_POKER_RANGE_DATA_DIR` 指向外部 release 根目录。
