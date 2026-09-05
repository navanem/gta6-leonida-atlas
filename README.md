# GTA6 Leonida Atlas

Evidence-led, approximate community atlas and 3D explorer for GTA VI's Leonida.

Live project: <https://www.gta6state.com/gta6-leonida-atlas>  
Live app: <https://www.gta6state.com/gta6-leonida-atlas/app>

This repository contains the Atlas app only. It is not the full GTA6State website, CMS, deployment stack or editorial database.

## What it does

- Opens into the Explore 3D module.
- Provides a fullscreen map module from the Map button.
- Shows the current position on the map.
- Lets users click/tap the map to travel to that approximate coordinate in the 3D world.
- Renders a source-derived, generalized Leonida basemap from pinned GTADB / Map GTA community material.
- Separates supported entries, uncertain entries, unpositioned entries and unknown/low-evidence coverage.
- Keeps all map/3D movement on one deterministic GTADB-derived coordinate frame.
- Includes project pages for About, Documentation, Credits, Contributing, Changelog and Licenses.

## Evidence boundaries

GTA6 Leonida Atlas is not an official Rockstar map.

Official Rockstar media can support visual identity or existence. GTADB / Map GTA provides community-estimated placement. Areas without mapped source coverage stay labelled `UNKNOWN`; reconstructed or transformed placements stay labelled `APPROXIMATE`.

The app must not invent confirmed GTA VI landmarks, roads, buildings or geography.

## Repository structure

```txt
src/
  components/          Astro UI and app shell components
  features/
    street-leonida/    Map, 3D world, coordinates, evidence, releases
  layouts/             Standalone Atlas layouts
  pages/
    gta6-leonida-atlas/ Project and app routes
  styles/              Atlas/app CSS
public/
  assets/
    gta6-leonida-atlas/ Generated Atlas basemap and metadata
    street-leonida/     Local 3D/material/map assets
scripts/               Dataset/basemap helper scripts
tests/                 Unit and Playwright coverage for the Atlas module
docs/                  Design notes and visual evidence notes
```

## Development

Requirements:

- Node.js 22+
- pnpm 10+

```bash
git clone https://github.com/navanem/gta6-leonida-atlas.git
cd gta6-leonida-atlas
pnpm install
cp .env.example .env
pnpm dev
```

Build and checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm run build
```

The app can read compatible Payload CMS endpoints through `PAYLOAD_URL` / `PAYLOAD_PUBLIC_URL`. Without a compatible CMS, it must keep unavailable data explicit instead of fabricating fallback evidence.

## Releases

See [RELEASES.md](./RELEASES.md).

Current app release: `v0.3.0`.

## License

The original source code of **GTA6 Leonida Atlas** is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**.

See [LICENSE](./LICENSE) for details.

### Third-party data

Some data used by GTA6 Leonida Atlas originates from **gtadb.org** / Map GTA and is licensed separately under the **Creative Commons Attribution 4.0 International License (CC BY 4.0)**.

Attribution: **gtadb.org and contributors**

Data originating from `gtadb.org` remains subject to CC BY 4.0, including attribution requirements.

See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for details.

## Disclaimer

GTA6 Leonida Atlas is an independent fan/community project. It is not affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two Interactive.

Grand Theft Auto, Grand Theft Auto VI, GTA VI, Rockstar Games names, media and related intellectual property belong to their respective owners.
