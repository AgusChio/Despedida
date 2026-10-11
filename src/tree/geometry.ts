import {
  BEND,
  DROOP,
  ENVELOPE,
  FLOOR_Y,
  HAIR,
  MAX_TURN,
  PIPE_EXP,
  SIDE_LOCK,
  STRIDE_BRANCH,
  STRIDE_DOT,
  STRIDE_FALL,
  STRIDE_LEAF,
  WANDER,
  WANDER_DECAY,
} from "./constants.ts";
import type { Bounds, Shape } from "./layout.ts";
import { gauss, mulberry32 } from "./rng.ts";

export type TreeOpts = {
  seed: number;
  shape: Shape;
  detail: number;
};

export type LateSprig = {
  branches: Float32Array;
  leaves: Float32Array;
};

export type TreeData = {
  branches: Float32Array;
  grain: Float32Array;
  barkDots: Float32Array;
  ribs: Float32Array;
  leaves: Float32Array;
  late: LateSprig[];
  fallSources: Float32Array;
  bounds: Bounds;
  duration: number;
};

type Seg = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  dist: number;
  depth: number;
  parent: number;
  leaves: number;
  wood: boolean;
};

/**
 * RNG order IS the tree. Do not reorder calls.
 * 1. envelope jitter (4)
 * 2. trunk height, gap, two strand bends (8)
 * 3. each mother: height, flip, length, heading (4N)
 * 4. per step: wander gauss, spawn roll; if spawn: side, aim, length
 * 5. foliage field 6x6, then per twig: density, open, late, leaf jitters
 */
export function* treeSteps(opts: TreeOpts): Generator<void, TreeData, void> {
  const detail = clamp(opts.detail, 0, 1);
  const rng = mulberry32(opts.seed >>> 0);
  const env0 = ENVELOPE[opts.shape];
  const env = {
    cy: env0.cy + (rng() - 0.5) * 0.03,
    rx: env0.rx * (0.94 + rng() * 0.12),
    ryTop: env0.ryTop * (0.94 + rng() * 0.1),
    ryBottom: env0.ryBottom * (0.94 + rng() * 0.1),
  };
  const trunkH = 0.2 + rng() * 0.05;
  const gap = 0.012 + rng() * 0.01;
  const leftBend = gauss(rng) * BEND * 1.15;
  const rightBend = gauss(rng) * BEND * 1.15;
  rng();
  rng();
  rng();

  const segs: Seg[] = [];
  const step = 0.016 + (1 - detail) * 0.006;
  const maxDepth = 6;
  const minLen = 0.03 / (0.55 + detail);

  type Job = {
    x: number;
    y: number;
    heading: number;
    depth: number;
    remain: number;
    persist: number;
    wander: number;
    side: number;
    dist: number;
    parent: number;
    wood: boolean;
    spawnEvery: number;
    sinceSpawn: number;
    inside: boolean;
  };

  const jobs: Job[] = [];

  function pushSeg(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    dist: number,
    depth: number,
    parent: number,
    wood: boolean,
  ) {
    const id = segs.length;
    segs.push({ x0, y0, x1, y1, dist, depth, parent, leaves: 0, wood });
    return id;
  }

  function inCrown(x: number, y: number) {
    const dy = y - env.cy;
    const ry = dy >= 0 ? env.ryTop : env.ryBottom;
    return (x / env.rx) ** 2 + (dy / ry) ** 2 <= 1;
  }

  function allowed(x: number, y: number, depth: number) {
    if (y < -0.03) return false;
    if (depth <= 1 && y < trunkH + 0.06) return Math.abs(x) < env.rx * 0.72;
    return inCrown(x, y) || y < env.cy - env.ryBottom * 0.15;
  }

  function shortest(from: number, to: number) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function growJob(job: Job, budget: number) {
    let used = 0;
    while (job.remain > step && used < budget) {
      used += 1;
      job.wander = job.wander * WANDER_DECAY + gauss(rng) * WANDER * (job.depth < 2 ? 1.25 : 0.8);
      let heading = job.heading + job.persist + job.wander;
      if (job.depth >= 2 && job.remain < 0.08) heading -= DROOP * job.side * 0.25 + DROOP * 0.35;
      if (job.y < FLOOR_Y) heading += shortest(heading, Math.PI / 2) * 0.55;
      const turn = clamp(shortest(job.heading, heading), -MAX_TURN, MAX_TURN);
      job.heading += turn;
      const x1 = job.x + Math.cos(job.heading) * step;
      const y1 = job.y + Math.sin(job.heading) * step;
      const was = job.inside || allowed(job.x, job.y, job.depth);
      const now = allowed(x1, y1, job.depth);
      if (was && inCrown(job.x, job.y) && !now && job.depth > 0) {
        job.remain = 0;
        break;
      }
      const id = pushSeg(job.x, job.y, x1, y1, job.dist, job.depth, job.parent, job.wood);
      job.x = x1;
      job.y = y1;
      job.dist += step;
      job.remain -= step;
      job.sinceSpawn += step;
      job.inside = now;
      job.parent = id;
      const spawnRoll = rng();
      if (
        job.depth < maxDepth &&
        job.sinceSpawn >= job.spawnEvery &&
        job.remain > minLen &&
        spawnRoll < 0.62 + detail * 0.2
      ) {
        const childSide = rng() < 0.5 ? -job.side : job.side * -1;
        const aim = job.heading + childSide * (0.55 + rng() * 0.5) + shortest(job.heading, Math.PI / 2) * 0.28;
        const len = Math.max(minLen, job.remain * (0.38 + rng() * 0.34));
        jobs.push({
          x: job.x,
          y: job.y,
          heading: aim,
          depth: job.depth + 1,
          remain: len,
          persist: gauss(rng) * BEND * (job.depth < 1 ? 1.2 : 0.7),
          wander: 0,
          side: childSide,
          dist: job.dist,
          parent: id,
          wood: false,
          spawnEvery: 0.045 + rng() * 0.04,
          sinceSpawn: 0,
          inside: now,
        });
        job.sinceSpawn = 0;
        job.side *= -1;
      }
    }
    return job.remain > step;
  }

  const left = growTrunk(-1, -gap * 0.5, Math.PI / 2 + 0.16, leftBend);
  const right = growTrunk(1, gap * 0.5, Math.PI / 2 - 0.16, rightBend);

  function growTrunk(side: number, x: number, heading: number, persist: number) {
    const job: Job = {
      x,
      y: 0,
      heading,
      depth: 0,
      remain: trunkH,
      persist,
      wander: 0,
      side,
      dist: 0,
      parent: -1,
      wood: true,
      spawnEvery: 99,
      sinceSpawn: 0,
      inside: true,
    };
    jobs.push(job);
    return job;
  }

  const mothers = opts.shape === "wide" ? 5 : 4;
  const trunkJobs = [left, right];
  for (let i = 0; i < mothers; i++) {
    const t = (i + 0.35 + rng() * 0.2) / mothers;
    const side = (i % 2 === 0 ? -1 : 1) * (rng() < SIDE_LOCK ? 1 : -1);
    const length = (0.42 - t * 0.2) * (0.86 + rng() * 0.22);
    const steep = Math.PI / 2 - side * (1.15 - t * 0.7);
    const host = trunkJobs[i % 2];
    jobs.push({
      x: host.x,
      y: trunkH * (0.22 + t * 0.72),
      heading: steep + (rng() - 0.5) * 0.18,
      depth: 1,
      remain: length,
      persist: gauss(rng) * BEND * 1.3,
      wander: 0,
      side,
      dist: trunkH * t,
      parent: -1,
      wood: true,
      spawnEvery: 0.055 + rng() * 0.03,
      sinceSpawn: 0,
      inside: true,
    });
  }

  const rootN = 2 + (rng() < 0.45 ? 1 : 0);
  for (let i = 0; i < rootN; i++) {
    const side = i === 0 ? -1 : i === 1 ? 1 : rng() < 0.5 ? -1 : 1;
    jobs.push({
      x: side * gap * 0.4,
      y: 0,
      heading: -0.35 * side - 0.55,
      depth: 0,
      remain: 0.045 + rng() * 0.03,
      persist: gauss(rng) * 0.08,
      wander: 0,
      side,
      dist: 0,
      parent: -1,
      wood: true,
      spawnEvery: 99,
      sinceSpawn: 0,
      inside: true,
    });
  }

  yield;

  let growing = true;
  while (growing) {
    growing = false;
    for (const job of jobs) {
      if (growJob(job, 28)) growing = true;
    }
    if (growing) yield;
  }

  yield;

  const field: number[] = [];
  for (let i = 0; i < 36; i++) field.push(rng());

  function sampleField(x: number, y: number) {
    const u = clamp((x + env.rx) / (env.rx * 2), 0, 0.999);
    const v = clamp((y - (env.cy - env.ryBottom)) / (env.ryTop + env.ryBottom), 0, 0.999);
    const gx = u * 5;
    const gy = v * 5;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const i00 = field[y0 * 6 + x0];
    const i10 = field[y0 * 6 + Math.min(5, x0 + 1)];
    const i01 = field[Math.min(5, y0 + 1) * 6 + x0];
    const i11 = field[Math.min(5, y0 + 1) * 6 + Math.min(5, x0 + 1)];
    return lerp(lerp(i00, i10, tx), lerp(i01, i11, tx), ty);
  }

  const leafBudget = Math.floor(260 + detail * 820);
  const leafRows: number[] = [];
  const ribRows: number[] = [];
  const late: LateSprig[] = [];
  const fallRows: number[] = [];
  let leafCount = 0;

  const tips = segs.filter((seg) => seg.depth >= 1 && seg.y1 > 0.26);
  for (const tip of tips) {
    if (leafCount >= leafBudget) break;
    const dens = sampleField(tip.x1, tip.y1);
    const heading = Math.atan2(tip.y1 - tip.y0, tip.x1 - tip.x0);
    const onSil = Math.abs((tip.x1 / env.rx) ** 2 + ((tip.y1 - env.cy) / env.ryTop) ** 2 - 1) < 0.28;
    const reserve = onSil && rng() < 0.12 && late.length < 22;
    const twigN = dens > 0.66 ? 5 : dens > 0.38 ? 2 + (rng() < 0.5 ? 1 : 0) : 1;
    const sprigBranches: number[] = [];
    const sprigLeaves: number[] = [];
    for (let t = 0; t < twigN; t++) {
      const spread = dens > 0.66 ? (t / Math.max(1, twigN - 1) - 0.5) * 1.3 : (rng() - 0.5) * 0.7;
      const h = heading + spread + shortest(heading, Math.PI / 2) * 0.15;
      const len = 0.028 + rng() * 0.03;
      const x0 = tip.x1;
      const y0 = tip.y1;
      const x1 = x0 + Math.cos(h) * len;
      const y1 = y0 + Math.sin(h) * len;
      const row = [x0, y0, x1, y1, HAIR, tip.dist];
      if (reserve) sprigBranches.push(...row);
      else {
        ribRows.push(...row);
        addLeaves(x0, y0, x1, y1, h, tip.dist, leafRows, rng);
        leafCount += 4;
      }
      if (reserve) addLeaves(x0, y0, x1, y1, h, tip.dist, sprigLeaves, rng);
    }
    if (reserve && sprigBranches.length) {
      late.push({
        branches: new Float32Array(sprigBranches),
        leaves: new Float32Array(sprigLeaves),
      });
    } else if (dens > 0.66) {
      const dark = heading + Math.PI;
      const x1 = tip.x1 + Math.cos(dark) * 0.012;
      const y1 = tip.y1 + Math.sin(dark) * 0.01;
      ribRows.push(tip.x1, tip.y1, x1, y1, HAIR * 1.4, tip.dist);
    }
    if (tip.y1 < env.cy - 0.04) {
      const last = leafRows.length;
      if (last >= STRIDE_LEAF) {
        fallRows.push(
          leafRows[last - 6],
          leafRows[last - 5],
          Math.abs(leafRows[last - 4]),
          Math.abs(leafRows[last - 3]),
          leafRows[last - 2],
        );
      }
    }
  }

  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    if (seg.leaves < 1) seg.leaves = 1;
    if (seg.parent >= 0) segs[seg.parent].leaves += seg.leaves;
  }

  const branchRows: number[] = [];
  const grainRows: number[] = [];
  const barkRows: number[] = [];
  let maxDist = 0.001;
  for (const seg of segs) if (seg.dist > maxDist) maxDist = seg.dist;

  const lightX = -0.55;
  const lightY = 0.82;
  let maxT = 0.8;
  for (const seg of segs) {
    const supported = Math.max(1, seg.leaves);
    let w = 0.0022 * supported ** PIPE_EXP;
    if (seg.depth === 0) w *= 1.25 * Math.exp(-seg.dist * 2.1);
    if (seg.wood) w += Math.sin(seg.dist * 38 + seg.x0 * 9) * w * 0.08;
    w = Math.min(0.026, Math.max(HAIR, w));
    const t = swellLag(w) + (seg.dist / maxDist) ** 0.8;
    branchRows.push(seg.x0, seg.y0, seg.x1, seg.y1, w, t);
    if (t > maxT) maxT = t;
    if (w < 0.01) continue;
    const hx = seg.x1 - seg.x0;
    const hy = seg.y1 - seg.y0;
    const len = Math.hypot(hx, hy) || 1;
    const nx = -hy / len;
    const ny = hx / len;
    const lit = nx * lightX + ny * lightY > 0 ? 1 : -1;
    const dots = Math.floor(2 + detail * 7 * w * 40);
    for (let i = 0; i < dots; i++) {
      const s = rng();
      const x = lerp(seg.x0, seg.x1, s) + nx * lit * w * (0.35 + rng() * 0.5);
      const y = lerp(seg.y0, seg.y1, s) + ny * lit * w * (0.35 + rng() * 0.5);
      grainRows.push(x, y, 0.0012 + rng() * 0.0014, t);
    }
    const shade = -lit;
    const nBark = Math.floor(1 + detail * 4 * w * 28);
    for (let i = 0; i < nBark; i++) {
      const s = rng();
      const x = lerp(seg.x0, seg.x1, s) + nx * shade * w * (0.2 + rng() * 0.45);
      const y = lerp(seg.y0, seg.y1, s) + ny * shade * w * (0.2 + rng() * 0.45);
      barkRows.push(x, y, 0.001 + rng() * 0.0018, t);
    }
    if (w > 0.012) {
      const wander = (rng() - 0.5) * 0.35;
      const x0 = seg.x0 + nx * w * 0.15;
      const y0 = seg.y0 + ny * w * 0.15;
      const x1 = seg.x1 + nx * w * 0.15 + Math.cos(Math.atan2(hy, hx) + wander) * 0.01;
      const y1 = seg.y1 + ny * w * 0.15;
      ribRows.push(x0, y0, x1, y1, HAIR, t);
    }
  }

  yield;

  const bounds = measure(branchRows, leafRows);
  const duration = maxT + 0.08;
  const branches = sortByTime(new Float32Array(branchRows), STRIDE_BRANCH, 5);
  const grain = sortByTime(new Float32Array(grainRows), STRIDE_DOT, 3);
  const barkDots = sortByTime(new Float32Array(barkRows), STRIDE_DOT, 3);
  const ribs = sortByTime(new Float32Array(ribRows), STRIDE_BRANCH, 5);
  const leaves = sortByTime(new Float32Array(leafRows), STRIDE_LEAF, 5);
  const fallSources = new Float32Array(fallRows.slice(0, 40 * STRIDE_FALL));

  return {
    branches,
    grain,
    barkDots,
    ribs,
    leaves,
    late,
    fallSources,
    bounds,
    duration,
  };
}

export function generateTree(opts: TreeOpts): TreeData {
  const walk = treeSteps(opts);
  let step = walk.next();
  while (!step.done) step = walk.next();
  return step.value;
}

function addLeaves(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  heading: number,
  dist: number,
  out: number[],
  rng: () => number,
) {
  const n = 3 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const s = (i + 0.35) / n;
    const side = i % 2 === 0 ? 1 : -1;
    const x = lerp(x0, x1, s);
    const y = lerp(y0, y1, s);
    const rot = heading + side * 0.7 + (rng() - 0.5) * 0.15;
      const rx = 0.012 + rng() * 0.007;
    const ry = 0.028 + rng() * 0.012;
    const open = rng() < 0.45;
    out.push(x, y, rx, open ? -ry : ry, rot, dist);
  }
}

function swellLag(w: number) {
  return 0.035 + w * 0.55;
}

function sortByTime(data: Float32Array, stride: number, tIndex: number) {
  const n = data.length / stride;
  const rank = new Float64Array(n);
  const ids = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    ids[i] = i;
    rank[i] = data[i * stride + tIndex];
  }
  ids.sort((a, b) => rank[a] - rank[b] || a - b);
  const out = new Float32Array(data.length);
  for (let i = 0; i < n; i++) {
    const src = ids[i] * stride;
    out.set(data.subarray(src, src + stride), i * stride);
  }
  return out;
}

function measure(branches: number[], leaves: number[]): Bounds {
  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0.2 };
  for (let i = 0; i < branches.length; i += STRIDE_BRANCH) {
    bounds.minX = Math.min(bounds.minX, branches[i], branches[i + 2]);
    bounds.maxX = Math.max(bounds.maxX, branches[i], branches[i + 2]);
    bounds.minY = Math.min(bounds.minY, branches[i + 1], branches[i + 3]);
    bounds.maxY = Math.max(bounds.maxY, branches[i + 1], branches[i + 3]);
  }
  for (let i = 0; i < leaves.length; i += STRIDE_LEAF) {
    bounds.minX = Math.min(bounds.minX, leaves[i] - 0.02);
    bounds.maxX = Math.max(bounds.maxX, leaves[i] + 0.02);
    bounds.minY = Math.min(bounds.minY, leaves[i + 1] - 0.02);
    bounds.maxY = Math.max(bounds.maxY, leaves[i + 1] + 0.02);
  }
  return bounds;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
