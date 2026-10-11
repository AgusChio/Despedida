import { STRIDE_BRANCH, STRIDE_DOT, STRIDE_LEAF, TZ } from "./constants.ts";
import { generateTree, treeSteps } from "./geometry.ts";
import { passesGuards } from "./guards.ts";
import { computeLayout, mixColors, pickShape } from "./layout.ts";
import { localDateKey, seedForDay, SEEDS } from "./seeds.ts";

function assert(ok: boolean, message: string) {
  if (!ok) throw new Error(message);
}

function sameBuffer(a: Float32Array, b: Float32Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sortedBy(data: Float32Array, stride: number, tIndex: number) {
  for (let i = stride; i < data.length; i += stride) {
    if (data[i + tIndex] < data[i - stride + tIndex] - 1e-6) return false;
  }
  return true;
}

function inBounds(data: Float32Array, stride: number, xs: number[], ys: number[], bounds: ReturnType<typeof generateTree>["bounds"]) {
  for (let i = 0; i < data.length; i += stride) {
    for (const x of xs) {
      if (data[i + x] < bounds.minX - 0.08 || data[i + x] > bounds.maxX + 0.08) return false;
    }
    for (const y of ys) {
      if (data[i + y] < bounds.minY - 0.08 || data[i + y] > bounds.maxY + 0.08) return false;
    }
  }
  return true;
}

const sample = generateTree({ seed: 372, shape: "wide", detail: 0.8 });
const again = generateTree({ seed: 372, shape: "wide", detail: 0.8 });
assert(sameBuffer(sample.branches, again.branches), "same seed must match branches");
assert(sameBuffer(sample.leaves, again.leaves), "same seed must match leaves");

assert(sortedBy(sample.branches, STRIDE_BRANCH, 5), "branches sorted by t");
assert(sortedBy(sample.grain, STRIDE_DOT, 3), "grain sorted by t");
assert(sortedBy(sample.leaves, STRIDE_LEAF, 5), "leaves sorted by t");

assert(inBounds(sample.branches, STRIDE_BRANCH, [0, 2], [1, 3], sample.bounds), "branches in bounds");
assert(inBounds(sample.leaves, STRIDE_LEAF, [0], [1], sample.bounds), "leaves in bounds");

const sliced = treeSteps({ seed: 372, shape: "wide", detail: 0.8 });
let step = sliced.next();
while (!step.done) step = sliced.next();
assert(sameBuffer(step.value.branches, sample.branches), "treeSteps matches generateTree");

assert(pickShape(1.4) === "wide", "wide aspect");
assert(pickShape(0.6) === "tall", "tall aspect");
const layout = computeLayout({
  width: 1280,
  height: 800,
  navTop: 0,
  groundFromBottom: 118,
  bounds: sample.bounds,
  desktop: true,
  ink: "#7f575c",
  paper: "#f8e7eb",
});
assert(Math.abs(layout.originX - 1280 * 0.6) < 1, "desktop trunk at 60%");
assert(layout.originY === 800 - 118, "ground from bottom");
const mobile = computeLayout({ ...layout, width: 390, height: 844, desktop: false, bounds: sample.bounds, navTop: 0, groundFromBottom: 108, ink: layout.ink, paper: layout.paper });
assert(Math.abs(mobile.originX - 195) < 1, "mobile trunk centered");

assert(mixColors("#c17b88", "#3e342f", 0.5).startsWith("rgb("), "mix ink");

const before = new Date("2026-10-11T02:30:00.000Z"); // 11:30 Sat in -03
const after = new Date("2026-10-11T03:30:00.000Z"); // 00:30 Sun in -03
assert(localDateKey(before, TZ) === "2026-10-10", "Saturday local");
assert(localDateKey(after, TZ) === "2026-10-11", "Sunday local");
assert(seedForDay(before, TZ) === SEEDS[6], "Saturday seed");
assert(seedForDay(after, TZ) === SEEDS[0], "Sunday seed");

for (const seed of SEEDS) {
  const wide = generateTree({ seed, shape: "wide", detail: 0.85 });
  assert(passesGuards(wide, "wide"), `seed ${seed} must pass wide guards`);
}

class FakeCtx {
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  lineCap = "round";
  lineJoin = "round";
  globalAlpha = 1;
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  rect() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  clip() {}
  clearRect() {}
  setTransform() {}
}

const ink = {
  width: 0,
  height: 0,
  getContext: () => new FakeCtx(),
} as unknown as HTMLCanvasElement;
const live = {
  width: 0,
  height: 0,
  getContext: () => new FakeCtx(),
} as unknown as HTMLCanvasElement;

const { TreeRenderer } = await import("./renderer.ts");
const renderer = new TreeRenderer(ink, live);
renderer.setTree(sample);
renderer.resize(layout);
const busyStart = renderer.tick(0.2);
assert(typeof busyStart === "boolean", "tick returns busy");
renderer.resize(layout);
assert(renderer.t >= 0, "resize keeps time");

console.log("tree tests ok");
