# Releases

## v0.6.0 — 2026-09-05

**Released: account workspaces and selected 3D destinations.** This changelog contains only the current release.

Live application: [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/).

### Selected map destination in 3D

Choosing Ambrosia, Leonida Keys or another positioned place before opening **3D explorer** now carries that destination into the actual world spawn. Reloading the explorer URL preserves it. Existing approach offsets and collision clearance remain; opening the explorer without a selection keeps its default entry. Rapid map/explorer transitions also cancel pending Leaflet zoom callbacks.

### Official accounts and independent forks

The official deployment supplies a separately maintained private account service and panel: registration with email, a unique username and password; sign-in by email or username; profile and password controls; recovery keys; account deletion; and explicit server backup save/restore. Email confirmation is disabled for now. Both email and username uniqueness are enforced by the server. Backups use revision checks to avoid silently overwriting another device's newer copy.

The public core adds an empty-by-default extension point and distinct local account workspaces. Accepted writes finish in their original workspace; stale reads, drafts and backup operations are guarded across identity changes. Guest data remains separate and is never automatically uploaded on sign-in.

A default fork still needs no account, server, CMS, API credentials or parent site. The private account implementation, database and configuration remain outside this repository. Google Analytics remains optional, deployment-configured and isolated from personal application data.

### Preserved map, data and licensing

The standalone React/Vite map retains local favorites, notes, collections, personal markers, validated portable backups, public offline caching and the optional Three.js explorer. GTADB / Map GTA data stays attributed under **CC BY 4.0**: all 2,198 records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placements remain **APPROXIMATE** and absent coverage **UNKNOWN**.

Original source remains **AGPL-3.0-only**; third-party rights are unchanged. See [third-party notices](THIRD_PARTY_LICENSES.md) and the [verification record](docs/refactor/VERIFICATION.md) for test scope and browser limitations.
