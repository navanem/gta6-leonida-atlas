# Leonida Atlas basemap

Source: **Yanis v16 GTA VI Community Map**, distributed by **GTADB** at pinned revision `7c3f8c295d64254e6b6d269b77c6f84fc4339f9c`. [Source](https://github.com/rolux/gtadb.org/tree/7c3f8c295d64254e6b6d269b77c6f84fc4339f9c/maps).

Source cartography is licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). This original atlas presentation changes the palette, interprets surface colors, suppresses source annotations where practical, generalizes raster detail and excludes the source legend and screenshot column. This is a community reconstruction, **APPROXIMATE**, not official Rockstar geography. No source author endorsement is implied.

Rebuild: `node scripts/build-leonida-atlas-basemap.mjs`. Uses local pinned tiles and Astro's installed Sharp dependency; no network download. Registration, method, bounds and an input SHA-256 are in `metadata.json`. The SVG contains its raster internally and can be displayed directly with SVG `<image>`.

UNKNOWN margins represent absent geographic source content. Color classification cannot reliably separate all neutral text from roads; residual marks must not be treated as new evidence. The land shading follows source raster colors, not a validated elevation measurement.
