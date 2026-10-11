export type Shape = "wide" | "tall";

export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type TreeLayout = {
  shape: Shape;
  scale: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  groundY: number;
  ink: string;
  paper: string;
};

export function pickShape(aspect: number): Shape {
  return aspect >= 1.05 ? "wide" : "tall";
}

export function mixChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

export function parseColor(value: string): [number, number, number] | null {
  const hex = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const n = short[1];
    return [
      parseInt(n[0] + n[0], 16),
      parseInt(n[1] + n[1], 16),
      parseInt(n[2] + n[2], 16),
    ];
  }
  const long = /^#([0-9a-f]{6})$/i.exec(hex);
  if (long) {
    const n = long[1];
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,\s*([.\d]+)/i.exec(hex);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export function mixColors(primary: string, text: string, t = 0.5) {
  const a = parseColor(primary);
  const b = parseColor(text);
  if (!a || !b) return text;
  return `rgb(${mixChannel(a[0], b[0], t)} ${mixChannel(a[1], b[1], t)} ${mixChannel(a[2], b[2], t)})`;
}

export function toCssRgb(value: string) {
  const parsed = parseColor(value);
  if (!parsed) return value;
  return `rgb(${parsed[0]} ${parsed[1]} ${parsed[2]})`;
}

export function computeLayout(input: {
  width: number;
  height: number;
  navTop: number;
  groundFromBottom: number;
  bounds: Bounds;
  desktop: boolean;
  ink: string;
  paper: string;
}): TreeLayout {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const shape = pickShape(width / height);
  const groundY = height - input.groundFromBottom;
  const availableH = Math.max(80, groundY - input.navTop);
  const bleed = shape === "tall" ? 1.18 : 1;
  const spanY = Math.max(0.72, input.bounds.maxY - input.bounds.minY);
  const scale = (availableH / spanY) * (shape === "tall" ? 1.02 : 0.98) * bleed;
  const originX = input.desktop ? width * 0.6 : width * 0.5;
  const originY = groundY;
  return {
    shape,
    scale,
    originX,
    originY,
    width,
    height,
    groundY,
    ink: input.ink,
    paper: input.paper,
  };
}

export function mapPoint(layout: TreeLayout, x: number, y: number) {
  return {
    x: layout.originX + x * layout.scale,
    y: layout.originY - y * layout.scale,
  };
}
