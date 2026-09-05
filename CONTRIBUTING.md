# Contributing to Leonida Atlas

Thanks for helping improve Leonida Atlas. Bug fixes, accessibility improvements, documentation, tests and carefully sourced map corrections are welcome.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security reports must follow [SECURITY.md](SECURITY.md) and must not be opened as public issues.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use an issue template for bugs, features or public-data corrections.
- Keep changes focused. Discuss large architectural changes in an issue first.
- Do not commit credentials, environment files, private account code, user exports or generated caches.
- Only submit work that you have the right to license under this repository's licenses.

## Local setup

Requirements: Node.js 22.12 or newer and pnpm 10 or newer.

```sh
git clone https://github.com/navanem/gta6-leonida-atlas.git
cd gta6-leonida-atlas
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The public project does not require an account, database, private API or `.env` file. Copy `.env.example` only when you need to document a supported public build option, and keep real values in an ignored `.env.local`.

## Contribution workflow

1. Fork the repository and create a short, descriptive branch from `main`.
2. Make one focused change and add or update tests when behavior changes.
3. Run the checks below.
4. Push the branch to your fork and open a pull request.
5. Explain the motivation, verification performed and any user-visible impact.

Prefer clear commits such as `fix: preserve selected place on reload` or `docs: clarify data provenance`. Maintainers normally squash pull requests when merging.

## Required checks

```sh
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
```

Run `pnpm test:e2e` for browser-facing changes after installing the required Playwright browsers. Maintainers may also run `pnpm test:fork`, which verifies the repository in an isolated public-fork environment with no private configuration.

## Public map data and corrections

Public place data must remain evidence-led:

- include a stable ID and explicit provenance;
- cite a public, reviewable source in the issue and pull request;
- use `position: null` when placement is unknown;
- never derive in-game placement from a real-world analogue;
- preserve GTADB evidence fields and attribution;
- keep personal markers and user backups out of the public catalogue.

For a correction, use the dedicated data-correction issue template before changing the bundled source. See [the methodology](docs/METHODOLOGY.md) and [third-party licenses](THIRD_PARTY_LICENSES.md).

## Pull request review

Pull requests must pass CI and resolve review conversations before merge. A maintainer may request smaller commits, stronger evidence, tests, attribution changes or removal of unrelated edits. Force-pushing after review should be avoided unless it is necessary to address feedback.
