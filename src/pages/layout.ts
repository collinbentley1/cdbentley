import { COLOPHON, NAV, SITE } from "../../content/site.ts";
import { escapeAttr, escapeHtml, joinHtml } from "../html.ts";

export type PageSpec = {
  /** Route path, e.g. "/work/medlock". */
  path: string;
  title: string;
  description: string;
  /** Main content; landmarks included by the page itself. */
  body: string;
  /** Client bundle name under /assets (without extension), if the page has behavior. */
  script?: string;
  /** Extra class applied to <body>. */
  bodyClass?: string;
  /** Skip the standard footer (the journey renders its own, with extras). */
  bareFooter?: boolean;
};

export function renderPage(spec: PageSpec): string {
  const canonical = `${SITE.origin}${spec.path === "/" ? "" : spec.path}`;
  const nav = NAV.map((item) => {
    const current = item.href === spec.path || (item.href !== "/" && spec.path.startsWith(item.href));
    return `<a href="${item.href}" ${current ? 'aria-current="page"' : ""}>${item.label}</a>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(spec.title)}</title>
    <meta name="description" content="${escapeAttr(spec.description)}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:title" content="${escapeAttr(spec.title)}">
    <meta property="og:description" content="${escapeAttr(spec.description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${SITE.origin}/assets/og/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${SITE.origin}/assets/og/og.png">
    <link rel="preload" href="/assets/fonts/press-start-2p-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/caveat-600-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png">
    <link rel="stylesheet" href="/assets/styles.css">
    <script>document.documentElement.classList.add("js")</script>
  </head>
  <body${spec.bodyClass ? ` class="${spec.bodyClass}"` : ""}>
    <a class="skip-link" href="#main">Skip to content</a>
    <nav class="site-nav" aria-label="Site">${nav}</nav>
    ${spec.body}
    ${spec.bareFooter ? "" : renderFooter()}
    ${renderColophon()}
    ${spec.script ? `<script type="module" src="/assets/${spec.script}.js"></script>` : ""}
    <script type="module" src="/assets/shared.js"></script>
  </body>
</html>`;
}

export function renderFooter(extra = ""): string {
  return `<footer class="site-footer" id="footer">
  <div class="footer-links">
    <a href="${SITE.github}" rel="me noopener" target="_blank">GitHub</a>
    <span aria-hidden="true">·</span>
    <a href="${SITE.linkedin}" rel="me noopener" target="_blank">LinkedIn</a>
    <span aria-hidden="true">·</span>
    <a href="mailto:${SITE.email}">email</a>
    <span aria-hidden="true">·</span>
    <button class="colophon-button" type="button" data-colophon-open>colophon</button>
  </div>
  ${extra}
  <p class="footer-name">${SITE.name} · NYC</p>
</footer>`;
}

function renderColophon(): string {
  return `<dialog class="colophon" id="colophon" aria-labelledby="colophon-title">
  <h2 class="pixel-heading" id="colophon-title">${COLOPHON.title}</h2>
  ${COLOPHON.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n  ")}
  <p><a href="${SITE.repo}" rel="noopener" target="_blank">${COLOPHON.repoLabel} →</a></p>
  <form method="dialog"><button class="pixel-button" type="submit">close</button></form>
</dialog>`;
}

export { joinHtml };
