import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    env: { JWT_SECRET: randomBytes(32).toString('hex') },
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
