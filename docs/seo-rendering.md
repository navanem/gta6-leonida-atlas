# Public Atlas routes and initial HTML

The standalone service owns the Atlas entry and project pages. The official
Traefik deployment leaves `/app/place/:slug` and `/app/viewpoint/:slug` with the
parent site's CMS renderer. Updating the parent site's shadowed project pages
alone does not change the publicly served Atlas project pages.

`src/app/seo.ts` defines the entry and six project-page subjects. The finalizer
renders the existing React project components into initial HTML, so crawlers and
readers without JavaScript receive the same source information as the client.
The map and optional 3D explorer keep their existing client startup.

Set `VITE_ATLAS_SITE_ORIGIN` to the deployment origin at build time for absolute
canonicals and social URLs. Public forks do not inherit an official hostname.
The Docker Compose input is `ATLAS_SITE_ORIGIN`; the private official builder
supplies its already-validated parent origin. `ATLAS_BASE_PATH` still controls
all static files and navigation.

The entry retains its trailing slash. Project pages use clean, slashless paths.
Nginx redirects exact legacy `?page=` aliases and page slash/index.html variants
permanently. Unknown paths return a real 404. Other query states and `/app` stay
usable with an `X-Robots-Tag: noindex, follow` response; the client also updates
metadata when navigating between views. These application states are not separate
search resources. The service worker preserves HTTP error status responses,
using its offline shell only when a navigation cannot reach the network.

Run the unit suite, typecheck and production build after changing these rules.
Verify actual Nginx responses as well as generated HTML: `try_files` changes
`$uri`, so response-header maps must account for the resolved index.html path.
