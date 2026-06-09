import { SITE } from "../../content/site.ts";
import { renderPage } from "./layout.ts";

export function notFoundPage(): string {
  return renderPage({
    body: `<main id="main" tabindex="-1" class="page notfound">
  <header class="page-header">
    <img class="cairn pixel-img" src="/assets/sprites/cairn-2.png" alt="" width="84" height="90">
    <h1 class="pixel-title">404</h1>
    <p class="page-intro">No cairn marks this trail. The path you followed isn't here.</p>
    <p><a class="pixel-button" href="/">back to the trailhead</a></p>
  </header>
</main>`,
    description: "Page not found.",
    path: "/404",
    title: `Not found — ${SITE.name}`,
  });
}
