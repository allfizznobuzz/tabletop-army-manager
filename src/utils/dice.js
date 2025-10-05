// Simple, deterministic dice roller with optional seeding
// Exposed helpers:
// - makeRng(seed)
// - parseDiceExpression(expr)
// - rollDice(count, sides, rng)
// - rollExpression(expr, opts)

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s) {
  if (!s) return 0xa5a5a5a5;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  if (seed === undefined || seed === null) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return mulberry32(buf[0] >>> 0);
    }
    return mulberry32((Math.random() * 0xffffffff) >>> 0);
  }
  const n =
    typeof seed === "number" ? seed >>> 0 : hashStringToSeed(String(seed));
  return mulberry32(n);
}

export function parseDiceExpression(expr) {
  if (!expr || typeof expr !== "string")
    return { count: 1, sides: 6, modifier: 0, valid: false };
  const trimmed = expr.replace(/\s+/g, "");
  // Patterns: NdS, NdS+M, NdS-M
  const m = trimmed.match(/^(\d+)[dD](\d+)([+\-]\d+)?$/);
  if (!m) return { count: 1, sides: 6, modifier: 0, valid: false };
  const count = Math.max(1, parseInt(m[1], 10) || 1);
  const sides = Math.max(2, parseInt(m[2], 10) || 6);
  const modifier = m[3] ? parseInt(m[3], 10) || 0 : 0;
  return { count, sides, modifier, valid: true };
}

export function rollDice(count, sides, rng = Math.random) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const v = 1 + Math.floor(rng() * sides);
    out.push(v);
  }
  return out;
}

export function rollExpression(expr, opts = {}) {
  const { count, sides, modifier, valid } = parseDiceExpression(expr);
  const seed = opts.seed ?? null;
  const rng = makeRng(seed);
  const rolls = rollDice(count, sides, rng);
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  return {
    expr: valid
      ? expr
      : `${count}d${sides}${modifier ? (modifier > 0 ? "+" + modifier : modifier) : ""}`,
    count,
    sides,
    modifier,
    rolls,
    total,
    seed: seed ?? undefined,
    timestamp: Date.now(),
  };
}
