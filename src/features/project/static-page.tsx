import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ProjectPage from "./ProjectPage";
import {
  ATLAS_ENTRY_META,
  ATLAS_PROJECT_META,
  atlasPageMeta,
} from "../../app/seo";
import { projectPath, publicPath } from "../explorer/public-path";

function AtlasIntroduction() {
  return (
    <main className="project-page" aria-labelledby="atlas-introduction-title">
      <header className="project-header">
        <span className="project-brand">LEONIDA ATLAS</span>
      </header>
      <div className="project-layout">
        <nav className="project-navigation" aria-label="Project pages">
          {Object.keys(ATLAS_PROJECT_META).map((page) => (
            <a key={page} href={projectPath(page)}>
              {ATLAS_PROJECT_META[page]!.heading}
            </a>
          ))}
        </nav>
        <article className="project-article">
          <p className="project-eyebrow">INDEPENDENT COMMUNITY PROJECT</p>
          <h1 id="atlas-introduction-title">{ATLAS_ENTRY_META.heading}</h1>
          <p className="project-lead">{ATLAS_ENTRY_META.description}</p>
          <h2>Sources and approximate geography</h2>
          <p>
            The map uses Yanis v16 cartography and GTADB landmark records.
            Community-estimated positions are distinct from official Rockstar
            location evidence. This is not an official map, and absent coverage
            remains unknown.
          </p>
          <p>
            <a href={projectPath("documentation")}>
              Read the map guide and evidence labels
            </a>{" "}
            or{" "}
            <a href={projectPath("credits")}>
              inspect the map sources and attribution
            </a>
            .
          </p>
          <h2>Your personal atlas</h2>
          <p>
            The interactive map opens with JavaScript. Explore as a guest, save
            favorites, write notes and organize collections locally in this
            browser. An optional 3D reconstruction uses the same approximate
            coordinate frame.
          </p>
          <p>
            <a href={`${publicPath("")}?view=3d`}>
              Open the optional 3D explorer
            </a>
          </p>
        </article>
      </div>
    </main>
  );
}
export function renderStaticPage(page: string, base: string, origin: string) {
  const path = `${base}${page}`;
  return {
    metadata: atlasPageMeta(path, "", base, origin),
    markup: renderToString(
      Object.hasOwn(ATLAS_PROJECT_META, page)
        ? createElement(ProjectPage, { page, onClose: () => undefined })
        : createElement(AtlasIntroduction),
    ),
  };
}
