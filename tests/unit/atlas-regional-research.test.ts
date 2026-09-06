import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { filterPlaces } from "../../src/domain/filter";
import ExplorerView from "../../src/features/explorer/ExplorerView";
import RegionalResearch from "../../src/features/library/RegionalResearch";
import {
  getResearchForPlace,
  getRegionDiscoveries,
  RESEARCH_SOURCES,
} from "../../src/features/street-leonida/leonida-research";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-7c3f8c2.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

// A nearby or similarly named marker must never inherit official identity from regional research.
describe("regional source discoveries", () => {
  it("associates region IDs and reviewed landmarks without guessing from names or coordinates", () => {
    expect(
      getResearchForPlace({ id: "region:ambrosia", evidence: "approximate" })
        ?.region.slug,
    ).toBe("ambrosia");
    expect(
      getResearchForPlace({ id: "L399", evidence: "approximate" })?.region.slug,
    ).toBe("ambrosia");
    expect(
      getResearchForPlace({ id: "L530", evidence: "approximate" })?.region.slug,
    ).toBe("mount-kalaga-national-park");
    expect(
      getResearchForPlace({
        id: "custom:region:ambrosia",
        evidence: "personal",
      }),
    ).toBeNull();
    expect(
      getResearchForPlace({ id: "region:ambrosia", evidence: "personal" }),
    ).toBeNull();
    expect(
      getResearchForPlace({
        id: "unreviewed-ambrosia",
        evidence: "approximate",
      }),
    ).toBeNull();
    expect(
      getResearchForPlace({ id: "region:toString", evidence: "approximate" }),
    ).toBeNull();
    expect(
      getResearchForPlace({ id: "L407", evidence: "uncertain" }),
    ).toBeNull();
  });

  it("renders primary citations and keeps observations separate from unknown precise positions", () => {
    const html = renderToStaticMarkup(
      createElement(RegionalResearch, { region: "leonida-keys" }),
    );
    expect(html).toContain("Leonida Keys");
    expect(html).toContain("Exact locations are not established");
    expect(html).toContain("Official image");
    expect(html).toContain(
      "https://www.rockstargames.com/VI/_next/static/media/Leonida_Keys_06.0eapr3hbeyewx.jpg",
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<iframe");
    for (const discovery of getRegionDiscoveries("leonida-keys")) {
      expect(discovery.placement).toBe("UNPOSITIONED");
      expect(discovery.travelRegion).toBe("leonida-keys");
      for (const sourceId of discovery.sourceIds) {
        const source = RESEARCH_SOURCES[sourceId];
        expect(source).toBeDefined();
        expect(new URL(source!.url).hostname).toBe("www.rockstargames.com");
        if (source!.evidence === "official-image")
          expect(source!.publishedAt).toBeNull();
      }
    }
  });

  it("offers only established region travel actions in the mounted explorer evidence dialog", () => {
    const html = renderToStaticMarkup(
      createElement(ExplorerView, { onClose() {} }),
    );
    const evidence =
      html.split('data-walk-evidence-dialog=""')[1]?.split("</dialog>")[0] ??
      "";
    const destinations = [
      ...evidence.matchAll(/data-walk-region="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(destinations.sort()).toEqual([
      "ambrosia",
      "grassrivers",
      "leonida-keys",
      "mount-kalaga-national-park",
      "port-gellhorn",
      "vice-city",
    ]);
    expect(evidence).toContain("Explore the region");
    expect(evidence).not.toContain("data-walk-map-marker");
  });

  it("adds source context without changing any source coordinate or introducing discovery pins", () => {
    const catalogue = catalogueFromSnapshot(snapshot);
    expect(catalogue.length).toBe(snapshot.landmarks.length + 6);
    const raw = snapshot.landmarks.find(
      (place: { id: string }) => place.id === "L399",
    );
    expect(catalogue.find((place) => place.id === "L399")?.position).toEqual({
      x: raw.inGameCoordinates[0],
      y: raw.inGameCoordinates[1],
    });
    expect(catalogue.some((place) => place.id.startsWith("discovery:"))).toBe(
      false,
    );
    const region = catalogue.find((place) => place.id === "region:ambrosia")!;
    expect(region.description).toMatch(/Allied Crystal/);
    expect(region.evidence).toBe("approximate");
    expect(region.position).not.toBeNull();
    const search = (query: string) =>
      filterPlaces(
        catalogue,
        {
          query,
          category: "region",
          favoritesOnly: false,
          personalOnly: false,
          evidence: "all",
          collectionId: null,
        },
        [],
        [],
        [],
      ).map((place) => place.id);
    expect(search("Little Cuba")).toEqual(["region:vice-city"]);
    expect(search("Final Chapter")).toEqual(["region:ambrosia"]);
  });
});
