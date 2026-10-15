# Publishing latest from main

The public npm package is `@carlory/hydra-vision-mcp`, in the `carlory` account. The executable is `hydra-vision-mcp`. Published packages appear on the account's [Packages page](https://www.npmjs.com/settings/carlory/packages).

## One channel: latest

Publishing is disabled until the repository Actions variable `NPM_PUBLISH_ENABLED` is set to `true`. Once enabled, only tested pushes to `main` publish. There are no formal release channels, no GitHub Release trigger, and no tag-triggered publication.

```sh
npx --yes @carlory/hydra-vision-mcp@latest
```

npm requires every uploaded package to have a unique semantic version. `latest` is a movable dist-tag, not a substitute for that required field. The workflow generates an internal version such as `0.0.0-main.123456.1` from the GitHub run ID and attempt, then publishes it with `--tag latest`. Users consume `latest`; maintainers do not choose or increment formal release versions. npm still retains snapshot versions in its version history.

The committed `package.json` version `0.0.0` is a local development placeholder. The prepublish hook rejects this placeholder, formal versions and tags other than `latest`. CI changes the version and generated lockfile only inside the runner; it does not commit generated versions to Git. CLI and MCP metadata use the same package version.

## Workflow

1. A push to `main` starts `.github/workflows/publish.yml` on a GitHub-hosted runner.
2. Formatting, ESLint, TypeScript and offline tests must pass.
3. The workflow generates the snapshot version, builds the actual npm tarball, installs it into an isolated directory, and tests the CLI and MCP stdio call.
4. Immediately before publication it checks the current remote `main` head. An outdated commit is skipped.
5. The workflow publishes publicly using npm OIDC, updating only `latest`. Provenance is enabled for public repositories and disabled for private repositories, where npm does not support it.
6. It waits for the exact version to become readable from the registry before finishing. Publishes are serialized through this processing window.

Until a newer commit successfully becomes available, `latest` remains on the last published snapshot. It can lag `main` while checks run or if a publish fails.

npm scans uploaded packages before making them installable. The workflow waits up to 15 minutes. If it times out, inspect the accepted upload's status before rerunning: npm versions are immutable, and the upload may already be processing. See the official [publish-time scanning announcement](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/).

## One-time setup

No project script creates a GitHub repository or configures an npm account automatically.

1. Use the `carlory/hydra-vision-mcp` repository, which may be private. If its location changes, update `package.json` repository metadata to match the actual repository.
2. npm requires the package to exist before a Trusted Publisher can be configured. If bootstrapping a new package, create it using an automatically named main snapshot, not a formal release version. This initial publication requires the maintainer's npm login and account verification. Do not publish the local `0.0.0` placeholder.
3. In the package's npm Settings, configure GitHub Actions as a Trusted Publisher: owner `carlory`, repository `hydra-vision-mcp`, workflow filename `publish.yml`, environment `npm`. Enable direct `npm publish` for this publisher.
4. Create the GitHub environment `npm` and allow the `main` branch. The workflow requests `id-token: write` and does not require a long-lived `NPM_TOKEN`.
5. Complete the first trusted publish within npm's initial validation window, currently 48 hours. Recreate an expired configuration if needed.
6. Set the repository Actions variable `NPM_PUBLISH_ENABLED` to `true` when ready to enable automatic publishing. Leave it unset or `false` to push code and run CI without publishing npm packages.

The workflow uses Node.js 24 and npm 11 for OIDC support. Consult npm's [trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) and [scoped public package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) when setting up the account.

## Verification

```sh
npm view @carlory/hydra-vision-mcp dist-tags --json
npx --yes @carlory/hydra-vision-mcp@latest --version
```

The dist-tags should contain only `latest`. The CLI reports the generated snapshot version underneath that tag.
