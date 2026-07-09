/**
 * Entry for /ocean/harness/deep-shape.html — built to
 * /assets/ocean/harness/deep-shape.js by tools/build.ts.
 *
 * Harness tip: the pass is rare by design (motion.idleDelay 30s at depth 0).
 * To see it now, set motion.summon to 1 (fires ~1.5s later) or drop
 * motion.idleDelay.
 */

import { runHarness } from "../../sdk/index.ts";
import { deepShapeScene } from "./scene.ts";

runHarness(deepShapeScene);
