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

The GitHub tag workflow validates the public source before publishing the current release. The initial v0.6.0 rollout replaced older release entries. The subsequent v0.6.1 policy retains history from v0.5.0 and restores missing historical releases; publication no longer deletes release entries.

## v0.6.1 — visitor measurement and retained release history

The public application passes strict TypeScript and ESLint, plus 458 unit/integration tests across 45 files. An isolated copy with no environment files or private service passes frozen installation, types, lint, the complete unit suite, static build and browser tests: 18 passed, with the two existing platform-specific skips. The release publisher has 25 lifecycle tests covering historical backfills from verified Git tags, existing-body preservation, pagination, retries, drafts and latest-version protection. Release metadata and About rendering have three additional focused tests.

The official image includes the unchanged private account client, whose 17 tests pass during its build. Twenty focused checks against the actual image, with its response headers preserved and service workers enabled, cover initial refusal, later acceptance and withdrawal, keyboard focus, the About preference fragment on desktop and at 390/320 px, and consent dismissal with Enter in 3D. No application runtime errors or horizontal overflow were recorded. At 320 × 640 the notice overlaps About's duplicate choices; the matching notice buttons remain usable and dismissal focuses a visible About choice.

The earlier Analytics integration emitted denied-consent pings from an opaque iframe. A controlled real-SDK experiment established that Google's granted-consent path aborts when the frame has an opaque origin. The replacement uses a dedicated, separate HTTPS origin, strict parent/source checks and consent-only messages. The Google SDK manages its own namespaced host-only cookies scoped to the Atlas path; no application data or manually invented engagement/client/session values are sent. Independent review verified that a queued cross-tab storage event cannot revive a persisted refusal, that withdrawal locks out stale configuration, and that the private host route exposes only the two helper files. Helpers bypass caching and restrict embedding to the configured app origin.

Exact-value scans found neither the configured Analytics measurement ID nor the production authentication secrets in tracked or new public files. Instance origin values, helper routing, account implementation and operational evidence remain outside GitHub. About and Changelog retain v0.5.0, v0.6.0 and v0.6.1; publication never deletes historical releases.

Nine real-SDK browser checks verify that Google returns HTTP 204 for consented page views, the same browser/session persists across reload, first-visit/session-start flags occur only initially, and withdrawal removes both scoped cookies and the measurement frame. Google requests originate only from the helper, never disclose the private test sentinel, and stop after refusal; direct helper navigation cannot load the tag. The helper keeps a real, offscreen one-pixel viewport: `display:none` produced a zero-height calculation in the SDK and a false scroll event. With the corrected geometry, only page-view events were recorded. These are transport and browser-behavior checks, not a claim that a private Google Analytics dashboard has been inspected.

Production v0.6.1 was deployed on 5 September 2026 using the existing web service and dedicated helper hostname. The web health check passes; the private account service and parent website retain the same container identities and start times, and the parent homepage/tools response bodies have unchanged hashes. Only the two helper paths bypass the existing alternate-host redirect. Operational snapshots and rollback configuration are retained privately.

The same nine SDK checks pass on the live production URLs without routing overrides or API mocks: Google accepts the two test page views, browser/session identity is retained across reload, withdrawal clears measurement cookies, and no false scroll or personal-data leakage is observed. The live service worker controls the app and the browser records no runtime or console errors. Analytics account/dashboard access was not available, so report visibility is not asserted.
