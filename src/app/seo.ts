/** Public route subjects shared by the static HTML build and client navigation. */
export const ATLAS_PROJECT_META: Record<
  string,
  { title: string; heading: string; description: string }
> = {
  about: {
    title: "About GTA 6 Leonida Atlas: Evidence, Methods & Project",
    heading: "About the GTA 6 Leonida Atlas",
    description:
      "Understand the independent Leonida Atlas project, its approximate community geography, local data and public source release history.",
  },
  documentation: {
    title: "GTA 6 Map Guide: Yanis v16, Sources & Atlas Controls",
    heading: "How to Use the GTA 6 Leonida Atlas",
    description:
      "Learn how to explore the Leonida Atlas, use the Yanis v16 basemap and distinguish confirmed evidence from approximate community mapping.",
  },
  credits: {
    title: "Leonida Atlas Credits: Yanis v16, GTADB & Map Sources",
    heading: "Yanis v16 and Leonida Atlas Credits",
    description:
      "Find the Yanis v16 and GTADB map attribution, pinned landmark sources, Rockstar references and rights notices behind the Leonida Atlas.",
  },
  contributing: {
    title: "Contribute to Leonida Atlas: Evidence & Source Corrections",
    heading: "Contributing to the Leonida Atlas",
    description:
      "Learn how to contribute reproducible evidence, report mapping corrections and improve the independent Leonida Atlas while preserving source attribution.",
  },
  changelog: {
    title: "Leonida Atlas Changelog: Public Release History",
    heading: "Leonida Atlas Release History",
    description:
      "Read the public Leonida Atlas release history, including changes to community cartography, the optional 3D explorer and local map tools.",
  },
  licenses: {
    title: "Leonida Atlas Licenses: Code, Cartography & Asset Rights",
    heading: "Leonida Atlas Code and Content Licenses",
    description:
      "Review the Leonida Atlas AGPL code license, GTADB cartography attribution and separate rights for Rockstar references and other third-party assets.",
  },
};
export const ATLAS_ENTRY_META = {
  title: "GTA 6 Leonida Atlas: Interactive Community Map",
  heading: "GTA 6 Leonida Atlas",
  description:
    "Explore an approximate community map of Leonida, inspect cited location evidence and keep personal favorites, notes and collections in your browser.",
};
export function atlasPageMeta(
  pathname: string,
  search = "",
  base = "/",
  origin = "",
) {
  const prefix = `/${base.replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "");
  const relative =
    pathname === prefix
      ? ""
      : pathname.startsWith(`${prefix}/`)
        ? pathname.slice(prefix.length + 1).replace(/\/+$/, "")
        : "!unknown";
  const project = Object.hasOwn(ATLAS_PROJECT_META, relative)
    ? ATLAS_PROJECT_META[relative]
    : undefined;
  const metadata = project ?? ATLAS_ENTRY_META;
  const path = project ? `${prefix}/${relative}` : `${prefix}/`;
  let canonical: string | null = null;
  try {
    const site = new URL(origin);
    if (
      /^https?:$/.test(site.protocol) &&
      !site.username &&
      !site.password &&
      site.origin === origin.replace(/\/$/, "")
    )
      canonical = `${site.origin}${path}`;
  } catch {
    /* Public forks may omit their deployment origin. */
  }
  return {
    ...metadata,
    canonical,
    robots:
      !search && (relative === "" || project)
        ? "index, follow"
        : "noindex, follow",
  };
}
export function updateAtlasHead(pathname: string, search: string) {
  const metadata = atlasPageMeta(
    pathname,
    search,
    import.meta.env.BASE_URL,
    import.meta.env.VITE_ATLAS_SITE_ORIGIN,
  );
  document.title = metadata.title;
  for (const [name, content] of [
    ["description", metadata.description],
    ["robots", metadata.robots],
    ["twitter:title", metadata.title],
    ["twitter:description", metadata.description],
  ]) {
    let element = document.head.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`,
    );
    if (!element) {
      element = document.createElement("meta");
      element.name = name!;
      document.head.append(element);
    }
    element.content = content!;
  }
  for (const [property, content] of [
    ["og:title", metadata.title],
    ["og:description", metadata.description],
    ["og:url", metadata.canonical],
  ]) {
    const element = document.head.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`,
    );
    if (element && content) element.content = content;
  }
  const canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (canonical && metadata.canonical) canonical.href = metadata.canonical;
}
