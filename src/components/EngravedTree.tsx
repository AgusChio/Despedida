import { useEffect, useRef } from "react";
import { BREATH_MAX, BREATH_MIN } from "../tree/constants.ts";
import { generateTree, treeSteps, type TreeData } from "../tree/geometry.ts";
import { computeLayout, mixColors, pickShape, toCssRgb, type TreeLayout } from "../tree/layout.ts";
import { breathRng, TreeRenderer } from "../tree/renderer.ts";
import { seedForDay } from "../tree/seeds.ts";

export function EngravedTree({ paused = false }: { paused?: boolean }) {
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ink = inkRef.current;
    const live = liveRef.current;
    if (!ink || !live) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const detail =
      window.innerWidth < 640 || (navigator.hardwareConcurrency || 8) <= 4 ? 0.8 : 1;
    const seed = seedForDay(new Date());
    let renderer: TreeRenderer;
    try {
      renderer = new TreeRenderer(ink, live);
    } catch {
      return;
    }
    const breath = breathRng(seed);
    const palette = readPalette();

    let data: TreeData | null = null;
    let layout: TreeLayout | null = null;
    let dead = false;
    let hidden = document.visibilityState === "hidden";
    let offscreen = false;
    let growStart = 0;
    let grown = false;
    let nextBreath = 0;
    let frame = 0;
    let sleep = 0;
    let idle: number | null = null;
    let steps: Generator<void, TreeData, void> | null = treeSteps({
      seed,
      shape: pickShape(window.innerWidth / window.innerHeight),
      detail,
    });

    function stopAll() {
      return paused || hidden || offscreen;
    }

    function size() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const desktop = width >= 720;
      const groundFromBottom = desktop ? 118 : 108;
      const next = computeLayout({
        width,
        height,
        navTop: 0,
        groundFromBottom,
        bounds: data?.bounds ?? { minX: -0.5, maxX: 0.5, minY: 0, maxY: 1 },
        desktop,
        ink: palette.ink,
        paper: palette.paper,
      });
      if (data && layout && pickShape(width / height) !== layout.shape) {
        data = generateTree({ seed, shape: next.shape, detail });
        renderer.setTree(data);
        grown = reduced;
        growStart = reduced ? 0 : performance.now();
      }
      layout = next;
      renderer.resize(next);
    }

    function slice(deadline?: IdleDeadline) {
      if (dead || !steps) return;
      let more = true;
      while (more && (!deadline || deadline.timeRemaining() > 4)) {
        const step = steps.next();
        if (step.done) {
          data = step.value;
          steps = null;
          renderer.setTree(data);
          size();
          grown = reduced;
          growStart = performance.now();
          if (reduced) renderer.tick(data.duration);
          loop();
          return;
        }
        more = true;
      }
      idle = schedule(slice);
    }

    function loop() {
      if (dead) return;
      if (stopAll()) {
        sleep = window.setTimeout(loop, 400);
        return;
      }
      if (!data || !layout) return;
      let busy = false;
      if (!grown) {
        const u = Math.min(1, (performance.now() - growStart) / (data.duration * 4200));
        const t = u ** 0.86 * data.duration;
        busy = renderer.tick(t);
        if (u >= 1) {
          grown = true;
          renderer.tick(data.duration);
          nextBreath = performance.now() + BREATH_MIN + breath() * (BREATH_MAX - BREATH_MIN);
        }
      } else {
        const now = performance.now();
        if (now >= nextBreath) {
          if (breath() < 0.55) renderer.sprout(now);
          else renderer.drop(now, breath);
          nextBreath = now + BREATH_MIN + breath() * (BREATH_MAX - BREATH_MIN);
        }
        busy = renderer.tick(data.duration);
      }
      if (busy || !grown) frame = requestAnimationFrame(loop);
      else sleep = window.setTimeout(loop, Math.max(80, nextBreath - performance.now()));
    }

    size();
    idle = schedule(slice);

    const onVis = () => {
      hidden = document.visibilityState === "hidden";
      if (!hidden && grown) loop();
    };
    document.addEventListener("visibilitychange", onVis);

    const io = new IntersectionObserver((entries) => {
      offscreen = entries[0] ? entries[0].intersectionRatio <= 0.02 : false;
      if (!offscreen && grown) loop();
    });
    io.observe(ink);

    const ro = new ResizeObserver(() => size());
    ro.observe(document.documentElement);

    return () => {
      dead = true;
      if (idle != null) cancelIdle(idle);
      cancelAnimationFrame(frame);
      window.clearTimeout(sleep);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
      ro.disconnect();
    };
  }, [paused]);

  return (
    <div className="tree-host" aria-hidden="true">
      <canvas ref={inkRef} />
      <canvas ref={liveRef} />
    </div>
  );
}

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const primary = css.getPropertyValue("--rose").trim() || "#c17b88";
  const text = css.getPropertyValue("--ink").trim() || "#3e342f";
  return {
    ink: mixColors(primary, text, 0.5),
    paper: toCssRgb(body.backgroundColor || "#f8e7eb"),
  };
}

function schedule(fn: (deadline?: IdleDeadline) => void) {
  if (typeof requestIdleCallback === "function") return requestIdleCallback(fn);
  return window.setTimeout(() => fn({ timeRemaining: () => 8, didTimeout: false }), 16);
}

function cancelIdle(id: number) {
  if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
  else window.clearTimeout(id);
}
