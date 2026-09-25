import path from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts', 'lib/**/*.test.ts'],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      // 'server-only' throws outside Next's own build/runtime (it has no concept of
      // "server components" here) — stub it for tests only; the real Next.js build still
      // enforces it normally, this alias never ships.
      'server-only': path.resolve(root, 'lib/__tests__/stubs/server-only.ts'),
      '@': root,
    },
  },
});
