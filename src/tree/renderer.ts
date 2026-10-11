import {
  HAIR,
  MAX_FALLING,
  PATH_FLUSH,
  REST_MS,
  SPROUT_MS,
  STRIDE_BRANCH,
  STRIDE_DOT,
  STRIDE_FALL,
  STRIDE_LEAF,
  STIPPLE_AGE,
} from "./constants.ts";
import type { LateSprig, TreeData } from "./geometry.ts";
import { mapPoint, type TreeLayout } from "./layout.ts";
import { hashIndex, mulberry32 } from "./rng.ts";

type Falling = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  destX: number;
  born: number;
  landed: number;
};

type Sprout = {
  sprig: LateSprig;
  born: number;
};

export class TreeRenderer {
  t = 0;
  busy = false;
  private data: TreeData | null = null;
  private layout: TreeLayout | null = null;
  private ink: CanvasRenderingContext2D;
  private live: CanvasRenderingContext2D;
  private inkCanvas: HTMLCanvasElement;
  private liveCanvas: HTMLCanvasElement;
  private cursors = { branches: 0, grain: 0, bark: 0, ribs: 0, leaves: 0 };
  private growing = new Map<number, number>();
  private falling: Falling[] = [];
  private sprouts: Sprout[] = [];
  private usedFall = new Uint8Array(0);
  private lateIndex = 0;

  constructor(inkCanvas: HTMLCanvasElement, liveCanvas: HTMLCanvasElement) {
    const ink = inkCanvas.getContext("2d");
    const live = liveCanvas.getContext("2d");
    if (!ink || !live) throw new Error("Canvas 2D missing");
    this.inkCanvas = inkCanvas;
    this.liveCanvas = liveCanvas;
    this.ink = ink;
    this.live = live;
  }

  setTree(data: TreeData) {
    this.data = data;
    this.cursors = { branches: 0, grain: 0, bark: 0, ribs: 0, leaves: 0 };
    this.growing.clear();
    this.falling = [];
    this.sprouts = [];
    this.usedFall = new Uint8Array(data.fallSources.length / STRIDE_FALL);
    this.lateIndex = 0;
    this.t = 0;
    this.busy = false;
    this.paintInk(0);
  }

  resize(layout: TreeLayout) {
    this.layout = layout;
    const dpr = Math.min(2, (typeof window === "undefined" ? 1 : window.devicePixelRatio) || 1);
    for (const canvas of [this.inkCanvas, this.liveCanvas]) {
      canvas.width = Math.floor(layout.width * dpr);
      canvas.height = Math.floor(layout.height * dpr);
    }
    this.ink.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.live.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintInk(this.t);
  }

  tick(nowT: number) {
    this.t = nowT;
    if (!this.data || !this.layout) {
      this.busy = false;
      return false;
    }
    this.advance(nowT);
    this.drawLive(nowT);
    this.busy = this.growing.size > 0 || this.falling.length > 0 || this.sprouts.length > 0;
    return this.busy;
  }

  sprout(now: number) {
    if (!this.data || this.lateIndex >= this.data.late.length) return false;
    this.sprouts.push({ sprig: this.data.late[this.lateIndex], born: now });
    this.lateIndex += 1;
    this.busy = true;
    return true;
  }

  drop(now: number, rng: () => number) {
    if (!this.data || !this.layout || this.falling.length >= MAX_FALLING) return false;
    const n = this.usedFall.length;
    if (!n) return false;
    let pick = -1;
    for (let k = 0; k < n; k++) {
      const i = Math.floor(rng() * n);
      if (!this.usedFall[i]) {
        pick = i;
        break;
      }
    }
    if (pick < 0) return false;
    this.usedFall[pick] = 1;
    const o = pick * STRIDE_FALL;
    const src = this.data.fallSources;
    this.falling.push({
      x: src[o],
      y: src[o + 1],
      rx: src[o + 2] * 1.8,
      ry: src[o + 3] * 1.8,
      rot: src[o + 4],
      destX: src[o] + (rng() - 0.5) * 0.08,
      born: now,
      landed: 0,
    });
    this.busy = true;
    return true;
  }

  private advance(nowT: number) {
    const data = this.data;
    if (!data) return;
    this.take(data.branches, STRIDE_BRANCH, 5, nowT, "branches", true);
    this.take(data.grain, STRIDE_DOT, 3, nowT, "grain", false);
    this.take(data.barkDots, STRIDE_DOT, 3, nowT, "bark", false);
    this.take(data.ribs, STRIDE_BRANCH, 5, nowT, "ribs", false);
    this.take(data.leaves, STRIDE_LEAF, 5, nowT, "leaves", false);
    const done: number[] = [];
    for (const [index, born] of this.growing) {
      if (nowT - born > 0.22) done.push(index);
    }
    if (done.length) {
      this.stampGrowing(done);
      for (const index of done) this.growing.delete(index);
    }
  }

  private take(
    data: Float32Array,
    stride: number,
    tIndex: number,
    nowT: number,
    key: keyof TreeRenderer["cursors"],
    grow: boolean,
  ) {
    let i = this.cursors[key];
    while (i * stride < data.length && data[i * stride + tIndex] <= nowT) {
      if (grow && data[i * stride + 4] > HAIR * 1.8) this.growing.set(i, nowT);
      else this.stampItem(key, i);
      i += 1;
    }
    this.cursors[key] = i;
  }

  private paintInk(until: number) {
    const { ink, layout } = this;
    if (!layout) return;
    ink.clearRect(0, 0, layout.width, layout.height);
    this.cursors = { branches: 0, grain: 0, bark: 0, ribs: 0, leaves: 0 };
    this.growing.clear();
    if (!this.data) return;
    this.clipGround(ink);
    this.stampRange("branches", this.data.branches, STRIDE_BRANCH, 5, until, true);
    this.stampRange("grain", this.data.grain, STRIDE_DOT, 3, until, false);
    this.stampRange("bark", this.data.barkDots, STRIDE_DOT, 3, until, false);
    this.stampRange("ribs", this.data.ribs, STRIDE_BRANCH, 5, until, false);
    this.stampRange("leaves", this.data.leaves, STRIDE_LEAF, 5, until, false);
    ink.restore();
  }

  private stampRange(
    key: keyof TreeRenderer["cursors"],
    data: Float32Array,
    stride: number,
    tIndex: number,
    until: number,
    skipGrowing: boolean,
  ) {
    let i = 0;
    while (i * stride < data.length && data[i * stride + tIndex] <= until) {
      if (skipGrowing && data[i * stride + 4] > HAIR * 1.8 && until < data[i * stride + tIndex] + 0.22) {
        this.growing.set(i, data[i * stride + tIndex]);
      } else {
        this.stampItem(key, i);
      }
      i += 1;
    }
    this.cursors[key] = i;
  }

  private stampGrowing(ids: number[]) {
    if (!this.data || !this.layout) return;
    this.clipGround(this.ink);
    this.ink.strokeStyle = this.layout.ink;
    this.ink.fillStyle = this.layout.ink;
    this.ink.lineCap = "round";
    this.ink.lineJoin = "round";
    this.ink.beginPath();
    let n = 0;
    for (const i of ids) {
      const d = this.data.branches;
      const o = i * STRIDE_BRANCH;
      this.branchPath(this.ink, d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4]);
      n += 1;
      if (n % PATH_FLUSH === 0) {
        this.ink.stroke();
        this.ink.beginPath();
      }
    }
    this.ink.stroke();
    this.ink.restore();
  }

  private stampItem(key: keyof TreeRenderer["cursors"], i: number) {
    const data = this.data;
    const layout = this.layout;
    if (!data || !layout) return;
    this.clipGround(this.ink);
    if (key === "branches" || key === "ribs") {
      const src = key === "branches" ? data.branches : data.ribs;
      const o = i * STRIDE_BRANCH;
      this.ink.strokeStyle = layout.ink;
      this.ink.lineCap = "round";
      this.ink.beginPath();
      this.branchPath(this.ink, src[o], src[o + 1], src[o + 2], src[o + 3], src[o + 4]);
      this.ink.stroke();
    } else if (key === "grain") {
      const o = i * STRIDE_DOT;
      const p = mapPoint(layout, data.grain[o], data.grain[o + 1]);
      this.ink.fillStyle = layout.paper;
      this.ink.beginPath();
      this.ink.arc(p.x, p.y, data.grain[o + 2] * layout.scale, 0, Math.PI * 2);
      this.ink.fill();
    } else if (key === "bark") {
      const o = i * STRIDE_DOT;
      const p = mapPoint(layout, data.barkDots[o], data.barkDots[o + 1]);
      this.ink.fillStyle = layout.ink;
      this.ink.beginPath();
      this.ink.arc(p.x, p.y, data.barkDots[o + 2] * layout.scale, 0, Math.PI * 2);
      this.ink.fill();
    } else {
      const o = i * STRIDE_LEAF;
      this.drawLeaf(
        this.ink,
        data.leaves[o],
        data.leaves[o + 1],
        data.leaves[o + 2],
        data.leaves[o + 3],
        data.leaves[o + 4],
        1,
      );
    }
    this.ink.restore();
  }

  private drawLive(nowT: number) {
    const { live, layout, data } = this;
    if (!layout || !data) return;
    live.clearRect(0, 0, layout.width, layout.height);
    this.clipGround(live);
    live.strokeStyle = layout.ink;
    live.fillStyle = layout.ink;
    live.lineCap = "round";
    for (const [index, born] of this.growing) {
      const o = index * STRIDE_BRANCH;
      const age = clamp01((nowT - born) / 0.22);
      const w = data.branches[o + 4];
      if (age < STIPPLE_AGE) {
        this.stipple(live, data.branches[o], data.branches[o + 1], data.branches[o + 2], data.branches[o + 3], w, index, age);
      } else {
        const eased = 1 - (1 - (age - STIPPLE_AGE) / (1 - STIPPLE_AGE)) ** 2;
        live.beginPath();
        this.branchPath(live, data.branches[o], data.branches[o + 1], data.branches[o + 2], data.branches[o + 3], w * eased);
        live.stroke();
      }
    }
    for (const item of this.sprouts) {
      const u = cubicOut(clamp01((performance.now() - item.born) / SPROUT_MS));
      this.drawSprig(live, item.sprig, u);
    }
    this.sprouts = this.sprouts.filter((item) => {
      if (performance.now() - item.born < SPROUT_MS) return true;
      this.stampSprig(item.sprig);
      return false;
    });
    const now = performance.now();
    this.falling = this.falling.filter((leaf) => {
      const life = now - leaf.born;
      if (!leaf.landed) {
        const y = leaf.y - life / 4200;
        if (y <= 0.01) {
          leaf.y = 0.01;
          leaf.landed = now;
        } else {
          leaf.y = y;
          leaf.x = leaf.destX + Math.sin(life / 280) * 0.03;
          leaf.rot += 0.02;
        }
      }
      const fade =
        leaf.landed && now - leaf.landed > REST_MS
          ? 1 - clamp01((now - leaf.landed - REST_MS) / 900)
          : 1;
      if (fade <= 0) return false;
      this.drawLeaf(live, leaf.x, leaf.y, leaf.rx, leaf.ry, leaf.landed ? 0 : leaf.rot, fade);
      return true;
    });
    live.restore();
  }

  private stipple(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w: number,
    index: number,
    age: number,
  ) {
    const layout = this.layout;
    if (!layout) return;
    const n = 4 + Math.floor(age * 10);
    ctx.fillStyle = layout.ink;
    for (let i = 0; i < n; i++) {
      const u = hashIndex(index * 17 + i);
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      const p = mapPoint(layout, x, y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, w * layout.scale * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private branchPath(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w: number,
  ) {
    const layout = this.layout;
    if (!layout) return;
    const a = mapPoint(layout, x0, y0);
    const b = mapPoint(layout, x1, y1);
    ctx.lineWidth = Math.max(0.7, w * layout.scale);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }

  private drawLeaf(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    alpha: number,
  ) {
    const layout = this.layout;
    if (!layout) return;
    const p = mapPoint(layout, x, y);
    const open = ry < 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(-rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(rx) * layout.scale, Math.abs(ry) * layout.scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = layout.ink;
    ctx.lineWidth = 0.8;
    if (open) ctx.stroke();
    else {
      ctx.fillStyle = layout.ink;
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSprig(ctx: CanvasRenderingContext2D, sprig: LateSprig, u: number) {
    for (let i = 0; i < sprig.branches.length; i += STRIDE_BRANCH) {
      const x1 = sprig.branches[i] + (sprig.branches[i + 2] - sprig.branches[i]) * u;
      const y1 = sprig.branches[i + 1] + (sprig.branches[i + 3] - sprig.branches[i + 1]) * u;
      ctx.beginPath();
      this.branchPath(ctx, sprig.branches[i], sprig.branches[i + 1], x1, y1, sprig.branches[i + 4]);
      ctx.stroke();
    }
    if (u < 0.45) return;
    for (let i = 0; i < sprig.leaves.length; i += STRIDE_LEAF) {
      this.drawLeaf(
        ctx,
        sprig.leaves[i],
        sprig.leaves[i + 1],
        sprig.leaves[i + 2],
        sprig.leaves[i + 3],
        sprig.leaves[i + 4],
        (u - 0.45) / 0.55,
      );
    }
  }

  private stampSprig(sprig: LateSprig) {
    if (!this.layout) return;
    this.clipGround(this.ink);
    this.ink.strokeStyle = this.layout.ink;
    this.ink.lineCap = "round";
    this.ink.beginPath();
    for (let i = 0; i < sprig.branches.length; i += STRIDE_BRANCH) {
      this.branchPath(
        this.ink,
        sprig.branches[i],
        sprig.branches[i + 1],
        sprig.branches[i + 2],
        sprig.branches[i + 3],
        sprig.branches[i + 4],
      );
    }
    this.ink.stroke();
    for (let i = 0; i < sprig.leaves.length; i += STRIDE_LEAF) {
      this.drawLeaf(
        this.ink,
        sprig.leaves[i],
        sprig.leaves[i + 1],
        sprig.leaves[i + 2],
        sprig.leaves[i + 3],
        sprig.leaves[i + 4],
        1,
      );
    }
    this.ink.restore();
  }

  private clipGround(ctx: CanvasRenderingContext2D) {
    const layout = this.layout;
    if (!layout) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, layout.width, layout.groundY + 0.5);
    ctx.clip();
  }
}

export function breathRng(seed: number) {
  return mulberry32((seed ^ 0x51ed) >>> 0);
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function cubicOut(t: number) {
  return 1 - (1 - t) ** 3;
}
