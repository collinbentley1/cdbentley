import { ESSAYS, NOTES_INTRO, STUB_LINE } from "../../content/notes.ts";
import { SITE } from "../../content/site.ts";
import { escapeHtml } from "../html.ts";
import { renderPage } from "./layout.ts";

export function notesIndexPage(): string {
  const items = ESSAYS.map((essay) => {
    if (!essay.published) {
      return `<li class="note-item note-stub">
      <h2>${escapeHtml(essay.title)}</h2>
      <p class="note-teaser">${escapeHtml(essay.teaser)}</p>
      <p class="margin-note">${STUB_LINE}</p>
    </li>`;
    }
    return `<li class="note-item">
      <h2><a href="/notes/${essay.slug}">${escapeHtml(essay.title)}</a></h2>
      <p class="note-teaser">${escapeHtml(essay.teaser)}</p>
      <p class="pixel-small"><a href="/notes/${essay.slug}">read →</a></p>
    </li>`;
  }).join("\n");

  return renderPage({
    body: `<main id="main" tabindex="-1" class="page notes-index">
  <header class="page-header">
    <h1 class="pixel-title">THE NOTES</h1>
    <p class="page-intro">${escapeHtml(NOTES_INTRO)}</p>
  </header>
  <ul class="notes-list" role="list">
${items}
  </ul>
</main>`,
    description: NOTES_INTRO,
    path: "/notes",
    title: `The Notes — ${SITE.name}`,
  });
}

export function essayPage(slug: string): string | null {
  const essay = ESSAYS.find((candidate) => candidate.slug === slug && candidate.published);
  if (!essay) {
    return null;
  }

  return renderPage({
    body: `<main id="main" tabindex="-1" class="page essay">
  <article aria-labelledby="essay-title">
    <header class="page-header">
      <p class="breadcrumb"><a href="/notes">← the notes</a></p>
      <h1 class="essay-title" id="essay-title">${escapeHtml(essay.title)}</h1>
      <p class="margin-note">a draft Collin keeps sanding</p>
    </header>
    ${essay.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n    ")}
    <footer class="essay-footer">
      <p><a class="pixel-button" href="/dojo">practice the idea → THE DOJO</a></p>
    </footer>
  </article>
</main>`,
    description: essay.teaser,
    path: `/notes/${essay.slug}`,
    title: `${essay.title} — ${SITE.name}`,
  });
}
