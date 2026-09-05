# v0.6.0 verification — 2026-09-05

This record covers the public core and the separately maintained official account integration. The private implementation and its runtime configuration are outside this repository.

## Public core

| Check | Result | Scope |
| --- | --- | --- |
| Strict TypeScript and ESLint | PASS | Public application, extension contract and workspace implementation |
| Unit/integration tests | PASS | 431 tests in 44 files |
| Isolated public fork | PASS | Explicit source allowlist, no environment/credentials, frozen install, types, lint, unit tests and production build |
| Fork browser suite | PASS with stated skips | 18 passed, 2 skipped across desktop Chromium and mobile WebKit |
| Selected 3D entry | PASS | Ambrosia, Leonida Keys, a positioned POI, explorer URL reload and default entry; no page errors in the recorded matrix |
| Workspace integrity | PASS | Guest/account separation, pending writes, rapid transitions, stale hydration/export/import, storage errors and serialized inactive namespace deletion |

WebKit offline-navigation is conditionally skipped when its automation runtime cannot perform the offline reload; Chromium verifies cached offline reopening. The world-spawn browser case is intentionally Chromium-only. Both browsers verify local editing and persistence; these skips are not represented as Safari offline-reload or 3D-renderer passes.

The dedicated 3D regression switches Ambrosia → map → Leonida Keys and checks actual world coordinates and runtime errors. The existing documented approach offset is retained for individual destinations. The catalogue still contains 2,198 upstream records, including 107 unpositioned entries, plus six regions.

The account extension controller stays mounted across all routes, while its entry button uses a sidebar slot. Workspace invalidation changes the explorer key so an imperative 3D scene cannot retain an account's previous personal destination.

## Private account service and panel

The independent private service build passes strict TypeScript and **22 real SQLite/API tests**. These cover email/username uniqueness and concurrent registration, real secure session cookies, login and recovery races, password changes, recovery-key rotation/replay, account/header isolation, vault revision checks, origin/body limits, persistent rate limits, exact trusted proxy addresses, database restart and deletion. The production dependency audit reports zero vulnerabilities.

The private client passes strict TypeScript and **17 protocol/identity tests**. These cover authenticated request scoping, stale export/import results, explicit revision conflicts, session transition ordering and reconciliation after a late authentication response. An independent security review checked both implementations and the public workspace bridge; the reported races were corrected before production exposure.

Registration requires email, unique username and password. Email verification and email delivery are not enabled. Recovery uses a personal key shown once. Server backups are explicit save/restore actions, not automatic synchronization. The backend's authoritative session and expected account ID guard every account/vault operation; local namespaces provide data separation, not server authorization.

## Analytics and deployment boundaries

The official measurement identifier stays in ignored local/hosting configuration. Public source and release documentation contain no real identifier. An ordinary fork emits an empty Analytics bootstrap and makes no account/API request. The official build necessarily includes the public measurement identifier in its compiled Analytics artifact; the authentication secret is runtime-only and never enters a frontend build.

The account database has its own persistent volume and service. The official web build uses an explicit public-source build context plus the private client. No account database, backend source, private environment file or server secret is copied into the web image or public GitHub release. The parent website is a separate service.

## HTTPS integration

Ten end-to-end account checks pass against the official Nginx image and real private backend through a local HTTPS proxy. They exercise registration without email confirmation, secure HttpOnly scoped cookies, profile persistence, guest/account separation, email and username sign-in, explicit cross-browser cloud restore, stale revision rejection, cross-account vault rejection, normalized duplicate email/username errors, recovery-key rotation/replay and confirmed account deletion including the current browser namespace. Test accounts are deleted after the run.

With normal service workers enabled, private API responses bypass worker handling and no private API entry appears in CacheStorage. The run records no browser runtime errors. A Playwright-specific worker-blocking initialization caused errors inside the intentionally opaque Analytics iframe; the final run uses normal browser behavior rather than injecting that incompatible blocker.

The official compiled Analytics bootstrap retains the configured measurement identifier. The identifier remains absent from public source, documentation and configuration. Public production dependencies have zero reported vulnerabilities.

Seven additional HTTPS checks pass for account identity across routes and mobile Safari. Chromium verifies that signing out in a second tab removes the first tab's personal 3D destination, then writes only to the guest database. WebKit iPhone 14 verifies real sign-in, password change, cleared password fields, focus return and layout bounds. All private responses use the network, and no private/Analytics/query URL appears in the cache. Both browsers record zero page errors. The synthetic account is deleted afterward.

## Production delivery

The official web image and dedicated private account service are healthy at [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/). Public HTTPS health/session checks pass. The same ten complete account checks also pass against the live domain, including real cookie sessions and cross-browser server restore. Synthetic accounts are deleted after verification; no private API request is handled or cached by the service worker.

The deployed web image matches the tested image. The account container runs as a non-root user with a read-only root filesystem, a dedicated writable database volume and no published host port; only the configured reverse proxy is trusted. The parent website container, homepage and tools page are unchanged from the saved rollout snapshot.

The GitHub tag workflow validates the public source before publishing the current release. It verifies the replacement release before deleting superseded release entries; Git tags and source history are retained.
