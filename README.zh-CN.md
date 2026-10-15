# hydra-vision-mcp

[English](README.md) | [贡献指南](CONTRIBUTING.md) | [发布流程](docs/releasing.md)

为编程助手提供图片理解、文字识别、报错诊断、技术图和 UI 分析能力的 MCP 服务。通过 OpenAI 兼容 API 调用视觉模型，让主模型使用文字结果继续完成任务。

## 使用

需要 Node.js 22+，无需 FFmpeg。

```sh
export HYDRA_API_KEY='你的上游密钥'
export HYDRA_BASE_URL='https://your-provider.example/v1'
export HYDRA_MODEL='public/rundao-kimi-k3'
npx --yes @carlory/hydra-vision-mcp@latest
```

只维护 `latest`，由通过检查的 `main` 快照更新。npm 要求唯一内部版本号，由 CI 自动生成，不维护正式版本。命令在快照实际发布后可用。

本地源码运行：

```sh
npm ci
npm run build
node dist/index.js
```

客户端配置见 [examples/mcp.json](examples/mcp.json)。通过 stdio 通信，工具日志写入 stderr。桌面客户端找不到命令时，使用 `npx` 或 `node` 的绝对路径。

## 注册的工具

| 工具                         | 功能                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| analyze_image                | 通用图片理解                                                         |
| extract_text_from_screenshot | 文字和代码转录，可提供 programming_language                          |
| diagnose_error_screenshot    | 错误截图诊断，可提供 context                                         |
| understand_technical_diagram | 技术图理解，可提供 diagram_type                                      |
| analyze_data_visualization   | 图表分析，可提供 analysis_focus                                      |
| ui_to_artifact               | 根据 output_type 选择 code、prompt、spec、description 四套完整提示词 |
| ui_diff_check                | 同时提供预期图片和实际图片，分析视觉差异                             |

各工具使用专用提示词，完成参数校验、补充上下文和文本结果返回。普通图片工具接收 image_source 和 prompt；UI 比较接收 expected_image_source、actual_image_source 和 prompt。

本地图片支持 PNG/JPEG，大小上限 5 MB，读取后编码成 data URL。远程 HTTP(S) 图片地址原样传给上游，由上游读取。工具不会在本地下载远程图片。data URL 是内部编码格式，不作为用户输入的文件路径。

视频实现保留在 `src/tools/video-analysis.js`，但不注册为 MCP 工具、不执行调用测试。实现直接发送原生 video_url。

OCR、图表分析、UI 比较均依靠视觉模型完成。主模型是否使用工具由客户端和主模型决定，MCP 不拦截附件。

## 配置

| 环境变量          | 默认值                | 用途                               |
| ----------------- | --------------------- | ---------------------------------- |
| HYDRA_API_KEY     | 分析时必填            | 上游密钥                           |
| HYDRA_BASE_URL    | 分析时必填            | API 根路径，追加 /chat/completions |
| HYDRA_MODEL       | public/rundao-kimi-k3 | 视觉模型                           |
| HYDRA_TIMEOUT_MS  | 300000                | 单次请求超时                       |
| HYDRA_MAX_TOKENS  | 131072                | 输出上限，可按平台模型限制调整     |
| HYDRA_TEMPERATURE | 0.8                   | 采样温度                           |
| HYDRA_TOP_P       | 0.6                   | 核采样参数                         |

请求默认开启 thinking，使用非流式响应。调用层不改写工具构造的 messages，不增加结果缓存或额外结构化返回。失败时返回 MCP 工具错误，并按指数退避重试。

只读取 HYDRA 配置，不自动加载 .env。列出工具不需要密钥；本地可用 Node --env-file 加载仓库外的配置文件。

## 开发验证

```sh
npm run check
npm run test:package
# 可选，仅通过 MCP SDK 测试真实上游的图片接口：
npm run test:live
```

验证提示词稳定性、图片工具请求和响应、并发账号隔离、stdio 以及 npm 包独立安装。不调用视频分析工具，不启动或修改本机 Claude，不自动发布 npm 包。

源码按 MCP 接口、工具、提示词、媒体处理、服务和 API 调用分层，详见 [贡献指南](CONTRIBUTING.md)。

## 许可

见 [LICENSE](LICENSE)、[LICENSES](LICENSES/) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
