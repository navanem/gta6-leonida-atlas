import { useId } from "react";
import { explorerPath } from "../explorer/public-path";
import type { StreetLeonidaRegionSlug } from "../street-leonida/leonida-evidence";
import {
  getRegionDiscoveries,
  RESEARCH_REGIONS,
  RESEARCH_REVIEWED_AT,
  RESEARCH_SOURCES,
} from "../street-leonida/leonida-research";
import "./regional-research.css";

interface RegionalResearchProps {
  /** Omit to show all six region groups in the explorer's existing Evidence dialog. */
  region?: StreetLeonidaRegionSlug;
  travel?: "explorer" | "link";
}

export default function RegionalResearch({
  region,
  travel = "link",
}: RegionalResearchProps) {
  const headingId = useId();
  const groups = region
    ? RESEARCH_REGIONS.filter((item) => item.slug === region)
    : RESEARCH_REGIONS;
  return (
    <section className="regional-research" aria-labelledby={headingId}>
      <h3 id={headingId}>Discover Leonida</h3>
      <p className="regional-research-intro">
        {region ? "Regional context. " : ""}
        Official names and visible details. Exact locations are not established
        by these sources.
      </p>
      <small className="regional-research-reviewed">
        Sources reviewed{" "}
        <time dateTime={RESEARCH_REVIEWED_AT}>{RESEARCH_REVIEWED_AT}</time>.
        Individual screenshot publication dates are not supplied.
      </small>
      {groups.map((group) => (
        <details className="regional-research-group" key={group.slug}>
          <summary>
            {group.name}
            <span>{getRegionDiscoveries(group.slug).length} discoveries</span>
          </summary>
          <p className="regional-research-overview">{group.summary}</p>
          <ul className="regional-discoveries">
            {getRegionDiscoveries(group.slug).map((discovery) => (
              <li key={discovery.id} data-research-discovery={discovery.id}>
                <h4>{discovery.title}</h4>
                <p>{discovery.summary}</p>
                <ul
                  className="regional-discovery-sources"
                  aria-label={`Sources for ${discovery.title}`}
                >
                  {discovery.sourceIds.map((sourceId) => {
                    const source = RESEARCH_SOURCES[sourceId]!;
                    return (
                      <li key={sourceId}>
                        <span>
                          {source.evidence === "official-image"
                            ? "Official image"
                            : "Official text"}
                        </span>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          <p className="regional-research-placement">
            Travel opens the existing approximate region view, not the specific
            site described above.
          </p>
          {travel === "explorer" ? (
            <button
              type="button"
              data-walk-region={group.slug}
              aria-label={`Explore the region: ${group.name}`}
            >
              Explore the region
            </button>
          ) : (
            <a
              className="regional-research-travel"
              href={explorerPath(`region:${group.slug}`)}
            >
              Explore {group.name} in 3D
            </a>
          )}
        </details>
      ))}
      {!region && (
        <div className="regional-research-videos">
          <h4>Official video sources</h4>
          <p>Rockstar’s video releases, with their published dates.</p>
          {["extended-look", "trailer-2"].map((id) => {
            const source = RESEARCH_SOURCES[id]!;
            return (
              <p key={id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                {" · "}
                <time dateTime={source.publishedAt!}>{source.publishedAt}</time>
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}
