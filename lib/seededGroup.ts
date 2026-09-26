/*
 * A tiny, dependency-free seeded PRNG (same mulberry32 algorithm the engine uses, duplicated
 * rather than imported: this file is used by the server room backends, which otherwise have no
 * reason to depend on @/engine, and the algorithm is 4 lines). Used only to give each participant
 * a small, deterministic "travelling in a group" size — not a simulation number, never fed into
 * the engine directly.
 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic per-participant group size, 1-4 (§12 of the room-upgrade brief). */
export function seededGroupSize(pid: string): number {
  const rnd = mulberry32(hashStr(pid));
  return 1 + Math.floor(rnd() * 4);
}
