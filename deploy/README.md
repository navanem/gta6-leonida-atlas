# Independent production hosting

The Docker image is a static Nginx application. It needs no CMS network, database or account service. Root hosting works with the commands in the main README.

For an existing Traefik deployment, copy `.env.example` to ignored `.env.production.local` at the repository root, keep the optional instance Analytics ID there, and add:

```dotenv
ATLAS_HOSTNAME=atlas.example.com
ATLAS_ROUTE_PREFIX=/atlas
ATLAS_PROXY_NETWORK=proxy
ATLAS_TLS_RESOLVER=letsencrypt
ATLAS_IMAGE=leonida-atlas:prod
```

The prefix must start with `/` and have no trailing slash. The existing proxy must own DNS/TLS for that hostname. No DNS, TLS or cloud resources are provisioned by this file.

```sh
docker compose --env-file .env.production.local -f deploy/docker-compose.prod.yml build
docker compose --env-file .env.production.local -f deploy/docker-compose.prod.yml up -d --no-build
```

Only the configured path is routed to Atlas. The container joins the shared proxy network and exposes no host port. Atlas's worker and public asset URLs are scoped to its prefix. A path without its trailing slash redirects to the canonical URL. Other applications keep their own containers and networks.

For rollback, keep the previous image tag before publishing and recreate this service with that image. When replacing a route previously handled by another service, stopping only `leonida-atlas-web` restores the lower-priority existing router.

### Optional analytics

Build with the measurement ID, the exact HTTPS application origin and a
different HTTPS origin for the measurement helper. The image grants the helper
origin permission to load in the application and limits embedding of
`analytics.html` to the configured application origin. Route the helper
hostname only to `analytics.html` and `analytics-bootstrap.js` under the Atlas
prefix. If the proxy overrides CSP, preserve these two exact origin rules.
Check the response headers on both hosts and verify that measurement starts
only after consent. Keep the optional settings empty for a public fork with
analytics disabled.

GitHub release publication uses `.github/workflows/release.yml`; instance environment files and compiled Analytics configuration are excluded from the source repository.
