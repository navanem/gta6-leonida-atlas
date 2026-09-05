# Security Policy

## Supported versions

GTA6 Leonida Atlas is currently pre-1.0. Security fixes are applied to the latest public release line only.

| Version | Supported |
| --- | --- |
| `v0.5.x` | Yes |
| `< v0.5.0` | No |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Report security concerns privately through GitHub Security Advisories for this repository when available. If that is not available, contact the maintainer through the profile linked from the repository owner account.

Useful reports include:

- affected package, file, route, or build step;
- reproduction steps;
- expected impact;
- whether the issue affects local development only or the deployed atlas;
- any safe proof of concept that does not expose user data or third-party systems.

## Scope

In scope:

- application source code in this repository;
- build tooling and dependency chain;
- standalone Atlas routes and local-data import/export;
- generated atlas assets bundled with this project.

Out of scope:

- social engineering;
- denial-of-service tests against the live site;
- vulnerabilities in unrelated services or repositories;
- claims based only on unofficial GTA VI interpretation disagreements.

## Licensing note

Security fixes to original project code are published under `AGPL-3.0-only`. Third-party GTADB-derived data remains under `CC BY 4.0`; see `THIRD_PARTY_LICENSES.md`.

## Personal data and optional services

The public build includes no account backend, sessions, private sync endpoints, server credentials or production user data. Local IndexedDB data is never committed. Backups are private user files and must stay outside Git. Keep `.env.local`, deployment keys and exports ignored.

Optional Analytics uses an opaque sandbox with no access to the application DOM, IndexedDB or query strings; instance configuration stays outside tracked source. Private auth/sync implementations belong in a separate private package/service with server-side access controls.
