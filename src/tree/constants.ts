/** Hand-tune these. Each note says what moves when you change it. */

/** Crown ellipse. Bigger rx = wider olive. ryTop/ryBottom set the dome. */
export const ENVELOPE = {
  wide: { cy: 0.56, rx: 0.64, ryTop: 0.4, ryBottom: 0.3 },
  tall: { cy: 0.6, rx: 0.44, ryTop: 0.36, ryBottom: 0.28 },
} as const;

/** Persistent bend (gauss * BEND). Higher = more S-curves, risk of curls. */
export const BEND = 0.2;

/** Wander injection per step. Higher = twitchier twigs. */
export const WANDER = 0.042;

/** Wander decay. Closer to 1 = longer memory, smoother S. */
export const WANDER_DECAY = 0.82;

/** Max heading change per step, radians. Lower = fewer curls. */
export const MAX_TURN = 0.34;

/** Tip droop on fine wood. */
export const DROOP = 0.08;

/** Lift wood that gets too close to the ground. */
export const FLOOR_Y = 0.05;

/** Chance a mother branch keeps the alternating side. */
export const SIDE_LOCK = 0.82;

/** Pipe-model exponent. Higher = trunk much thicker than twigs. */
export const PIPE_EXP = 0.55;

/** Hairline width in tree units. */
export const HAIR = 0.0016;

/** Stipple age of a growing segment, 0..1. */
export const STIPPLE_AGE = 0.3;

/** Path flush. Higher = fewer flushes, longer path builds. */
export const PATH_FLUSH = 400;

/** Sprout duration, ms. */
export const SPROUT_MS = 1100;

/** Fallen leaf rest, ms. */
export const REST_MS = 6000;

/** Max concurrent falling leaves. */
export const MAX_FALLING = 6;

/** Breathing gap, ms. */
export const BREATH_MIN = 2000;
export const BREATH_MAX = 5000;

export const TZ = "America/Argentina/Buenos_Aires";

export const STRIDE_BRANCH = 6;
export const STRIDE_DOT = 4;
export const STRIDE_LEAF = 6;
export const STRIDE_FALL = 5;
