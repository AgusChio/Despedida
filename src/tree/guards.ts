import type { Bounds, Shape } from "./layout.ts";
import { STRIDE_BRANCH } from "./constants.ts";

export type TreeLike = {
  branches: Float32Array;
  bounds: Bounds;
};

function massSides(branches: Float32Array) {
  let left = 0;
  let right = 0;
  for (let i = 0; i < branches.length; i += STRIDE_BRANCH) {
    const x = (branches[i] + branches[i + 2]) * 0.5;
    const w = branches[i + 4];
    if (x < 0) left += w;
    else right += w;
  }
  return { left, right };
}

export function boundsAsymmetry(bounds: Bounds) {
  const span = bounds.maxX - bounds.minX;
  if (span <= 1e-6) return 1;
  return Math.abs(bounds.minX + bounds.maxX) / span;
}

export function massBalance(tree: TreeLike) {
  const { left, right } = massSides(tree.branches);
  const a = Math.min(left, right);
  const b = Math.max(left, right);
  if (b <= 1e-6) return 0;
  return a / b;
}

export function domeScore(tree: TreeLike) {
  const { bounds, branches } = tree;
  const mid = (bounds.minX + bounds.maxX) * 0.5;
  const span = Math.max(0.2, bounds.maxX - bounds.minX);
  let center = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < branches.length; i += STRIDE_BRANCH) {
    const x = (branches[i] + branches[i + 2]) * 0.5;
    const y = Math.max(branches[i + 1], branches[i + 3]);
    if (y < 0.24) continue;
    const t = (x - mid) / span;
    if (Math.abs(t) < 0.16) center = Math.max(center, y);
    else if (t < 0) left = Math.max(left, y);
    else right = Math.max(right, y);
  }
  if (!center || !left || !right) return 0;
  return center - (left + right) * 0.5;
}

export function emptySector(tree: TreeLike) {
  const bins = [0, 0, 0, 0];
  for (let i = 0; i < tree.branches.length; i += STRIDE_BRANCH) {
    const x = (tree.branches[i] + tree.branches[i + 2]) * 0.5;
    const y = (tree.branches[i + 1] + tree.branches[i + 3]) * 0.5;
    if (y < 0.2) continue;
    const a = Math.atan2(y, x);
    const t = Math.max(0, Math.min(0.999, (a - 0.2) / (Math.PI - 0.4)));
    bins[Math.floor(t * 4)] += 1;
  }
  const ranked = [...bins].sort((a, b) => a - b);
  if (ranked[3] <= 0) return 0;
  return ranked[0] / ranked[3];
}

export function passesGuards(tree: TreeLike, _shape: Shape) {
  return (
    boundsAsymmetry(tree.bounds) < 0.12 &&
    massBalance(tree) > 0.72 &&
    domeScore(tree) > 0.03 &&
    emptySector(tree) > 0.05
  );
}
