# Contributing

Use Node.js 22+ and npm.

```sh
npm ci
npm run check
npm run test:package
```

`npm run check` runs formatting, ESLint, TypeScript checks and offline tests. `npm run format` formats all application modules. Prompt content has a regression check so a structural refactor cannot silently change model instructions.

`npm run test:live` is opt-in and tests only the image tool through an MCP SDK client against the configured provider. It requires HYDRA_API_KEY and HYDRA_BASE_URL. Tests do not invoke video analysis or launch a Claude client.

## Layout

```text
src/index.ts       CLI entry point and stdio lifecycle
src/config.ts      HYDRA environment configuration
src/mcp/           Server registration and protocol content helpers
src/tools/         Task tools and parameter handling
src/prompts/       Task-specific model instructions
src/services/      Image analysis and request-scoped backend context
src/providers/     OpenAI-compatible HTTP client
src/media/         Local files, URL handling and base64 encoding
src/errors/        Error types and handling
src/validation/    Shared argument schemas

test/              MCP contracts, provider isolation, prompt stability and releases
scripts/           Build, packaging and CI publication operations
examples/          Client configuration with placeholders
docs/              Publishing operations
.github/           Workflows, dependency updates and contribution templates
LICENSES/          License texts
dist/              Generated output, excluded from Git
```

## Module boundaries

The MCP layer registers seven image tools. Tools validate their arguments, select prompts and delegate media analysis to services. Services access the request's configured provider through AsyncLocalStorage, keeping credentials isolated between concurrent server instances. Providers handle HTTP authentication, model selection, request options and timeouts.

The native video implementation remains in `src/tools/video-analysis.js`, but it is not registered or invoked by tests.

## Changes

Reproduce bugs through the MCP SDK or installed CLI before fixing them. Add focused regression coverage for meaningful behavior. Preserve tool schemas and prompt contents during structural changes. Update the documentation when configuration changes.

Keep credentials independent of host-model settings. Protocol stdout must contain only MCP messages; logs go to stderr. Do not commit credentials, private media, generated builds or tarballs. Use npm to update package-lock.json. Do not manually edit generated files or maintain a changelog.

Pull requests should explain the user-visible change and its validation. See [publishing](docs/releasing.md) for the main-only latest channel. Publishing is not part of local verification.
