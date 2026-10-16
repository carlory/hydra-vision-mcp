# hydra-vision-mcp

[Publishing](docs/releasing.md)

A vision MCP server for image understanding, OCR, error diagnosis, diagrams, charts and UI analysis. Connect a text-only coding agent to a vision model through an OpenAI-compatible API.

## Run

Requires Node.js 22+. No FFmpeg dependency.

```sh
export HYDRA_API_KEY='your-upstream-key'
export HYDRA_BASE_URL='https://your-provider.example/v1'
export HYDRA_MODEL='public/kimi-k3'
npx --yes @carlory/hydra-vision-mcp@latest
```

`latest` is the only publication channel. Tested main snapshots receive an automatically generated internal npm version. See [publishing](docs/releasing.md). The command becomes available when a snapshot has been published.

For a local checkout:

```sh
npm ci
npm run build
node dist/index.js
```

Configure your MCP client using [examples/mcp.json](examples/mcp.json). The process uses stdio; tool logs go to stderr. Use an absolute path to `npx` or `node` if a desktop client cannot find it.

## Registered tools

| Tool                           | Purpose                                       | Arguments                                                |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------------- |
| `analyze_image`                | General image understanding                   | `image_source`, `prompt`                                 |
| `extract_text_from_screenshot` | OCR and code transcription                    | `image_source`, `prompt`, `programming_language?`        |
| `diagnose_error_screenshot`    | Diagnose error screenshots                    | `image_source`, `prompt`, `context?`                     |
| `understand_technical_diagram` | Architecture, UML and flowcharts              | `image_source`, `prompt`, `diagram_type?`                |
| `analyze_data_visualization`   | Charts and dashboards                         | `image_source`, `prompt`, `analysis_focus?`              |
| `ui_to_artifact`               | Generate code, prompts, specs or descriptions | `image_source`, `prompt`, `output_type`                  |
| `ui_diff_check`                | Compare expected and actual UI                | `expected_image_source`, `actual_image_source`, `prompt` |

`output_type` accepts `code`, `prompt`, `spec`, or `description`. Each task uses its own prompt, parameter validation and text-only response format.

Local images are PNG/JPEG files up to 5 MB, encoded as data URLs. HTTP(S) image URLs are forwarded unchanged for the provider to retrieve. The tool does not download remote images or expose returned image blocks to the host model. Data URLs are generated internally; they are not accepted as user-facing file paths.

The `analyze_video` implementation is retained at `src/tools/video-analysis.js` but is **not registered as an MCP tool**. It uses native `video_url`, with no frame extraction or fallback. Video analysis is not invoked by tests.

These tools provide model-based visual reasoning, including OCR and UI comparisons. They do not use a separate OCR engine or pixel-difference algorithm. The host model chooses when to call tools; attachment handling is controlled by the client.

## Configuration

| Variable            | Default               | Purpose                                        |
| ------------------- | --------------------- | ---------------------------------------------- |
| `HYDRA_API_KEY`     | Required for analysis | Upstream provider key                          |
| `HYDRA_BASE_URL`    | Required for analysis | API root; `/chat/completions` is appended      |
| `HYDRA_MODEL`       | `public/kimi-k3`      | Vision model                                   |
| `HYDRA_TIMEOUT_MS`  | `300000`              | Request timeout                                |
| `HYDRA_MAX_TOKENS`  | `131072`              | Output limit; adjust for your provider's model |
| `HYDRA_TEMPERATURE` | `0.8`                 | Sampling temperature                           |
| `HYDRA_TOP_P`       | `0.6`                 | Nucleus sampling                               |

Requests use `thinking: { "type": "enabled" }` and non-streaming responses. The backend forwards the tool's messages without rewriting prompts. Provider errors are returned as MCP tool errors. Tools retry failed operations with exponential backoff. No extra cache or structured analysis response is added.

Tool discovery works without a provider key. Configuration does not automatically load `.env`; local users can use Node's `--env-file=/path/to/private.env`.

## Development

```sh
npm ci
npm run check
npm run test:package
```

Checks cover task prompt stability, image tool requests and responses, concurrent backend isolation, CLI stdio and isolated npm package installation. `npm run test:live` is an opt-in real-provider image test. Neither ordinary tests nor live tests invoke video analysis or launch Claude.

Code is organized by responsibility: MCP registration, tools, prompts, media handling, services and API providers.

## License

See [LICENSE](LICENSE), [LICENSES](LICENSES/) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
