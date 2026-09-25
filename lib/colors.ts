// density ramp (SOURCE_OF_TRUTH §13) — people per m² → colour
const RAMP: [number, [number, number, number]][] = [
  [0, [0x2c, 0x47, 0x50]],
  [1, [0x3f, 0x7a, 0x6b]],
  [2, [0x9a, 0xa2, 0x4b]],
  [3, [0xc7, 0x93, 0x38]],
  [4, [0xcc, 0x5f, 0x2c]],
  [5.8, [0xb0, 0x2d, 0x1e]],
];

export function denRGB(d: number): [number, number, number] {
  d = Math.max(0, Math.min(5.8, d || 0));
  let i = 0;
  while (i < RAMP.length - 2 && d > RAMP[i + 1][0]) i++;
  const [a0, A] = RAMP[i],
    [a1, B] = RAMP[i + 1];
  const t = (d - a0) / (a1 - a0 || 1);
  return [Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t)];
}

export function denColor(d: number, a = 1): string {
  const [r, g, b] = denRGB(d);
  return `rgba(${r},${g},${b},${a})`;
}

/** plain-language name for a density (copy rule: idea first, number second) */
export function denWords(d: number): string {
  if (d >= 5.0) return 'so tight nobody can move';
  if (d >= 4.0) return 'dangerously tight';
  if (d >= 3.0) return 'shoulder to shoulder';
  if (d >= 2.0) return 'crowded';
  if (d >= 1.0) return 'busy';
  if (d >= 0.3) return 'calm';
  return 'empty';
}
