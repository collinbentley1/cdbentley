# Scene directories (Phase B fan-out)

One directory per scene, named by its reserved id: `beach`, `stage`, `classroom`, `corridor`, `trading-floor`, `airport-gate`, `subway-platform`, `ocean-floor`, `anglerfish`, `deep-shape`.

A scene agent owns exactly:

- `src/ocean/scenes/<sceneId>/` — `scene.ts`, `harness.ts`, optional `*.test.ts` + helpers
- `public/ocean/harness/<sceneId>.html` — copied from `public/ocean/harness/demo.html`

Contract, harness pattern, and rules: `src/ocean/sdk/README.md` (frozen at tag `scene-sdk-v1`). Do not edit the SDK, tools/, other scenes, or existing site pages.
