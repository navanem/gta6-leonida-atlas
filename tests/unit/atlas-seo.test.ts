import { describe, expect, it } from "vitest";
import { projectPath } from "../../src/features/explorer/public-path";
import { atlasPageMeta, ATLAS_PROJECT_META } from "../../src/app/seo";

describe("Atlas public SEO boundary", () => {
  it("links to clean project routes", () => {
    expect(projectPath("documentation")).toBe("/documentation");
    expect(projectPath("credits")).toBe("/credits");
  });
  it("gives each indexable project page distinct metadata and a clean canonical", () => {
    const titles = new Set<string>();
    for (const page of Object.keys(ATLAS_PROJECT_META)) {
      const meta = atlasPageMeta(
        `/atlas/${page}`,
        "",
        "/atlas/",
        "https://example.org",
      );
      expect(meta.canonical).toBe(`https://example.org/atlas/${page}`);
      expect(meta.robots).toBe("index, follow");
      expect(meta.description.length).toBeGreaterThan(70);
      titles.add(meta.title);
    }
    expect(titles.size).toBe(Object.keys(ATLAS_PROJECT_META).length);
  });
  it("keeps the entry indexable and application states out of the index", () => {
    expect(
      atlasPageMeta("/atlas/", "", "/atlas/", "https://example.org").robots,
    ).toBe("index, follow");
    for (const [path, query] of [
      ["/atlas/", "?view=3d"],
      ["/atlas/", "?place=region:vice-city"],
      ["/atlas/app", ""],
      ["/atlas/nonsense", ""],
      ["/atlas/credits", "?page=about"],
    ]) {
      expect(
        atlasPageMeta(path!, query!, "/atlas/", "https://example.org").robots,
      ).toBe("noindex, follow");
    }
  });
  it("does not inject the official hostname into public forks", () => {
    expect(atlasPageMeta("/", "", "/").canonical).toBeNull();
    expect(atlasPageMeta("/", "", "/", "javascript:bad").canonical).toBeNull();
  });
});
