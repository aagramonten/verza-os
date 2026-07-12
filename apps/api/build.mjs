// Production bundler. Inlines first-party code (including the @verza/shared
// workspace package, which is raw TypeScript) into single self-contained JS
// files so the runtime image needs no workspace resolution and no TS support.
// npm dependencies stay external and are provided by node_modules at runtime
// (Prisma in particular ships a generated client + native engine).
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
const external = Object.keys(pkg.dependencies ?? {}).filter((dep) => dep !== '@verza/shared');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external,
  logLevel: 'info',
  // Allow bundled CJS deps that call require() to work inside an ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
};

await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' });
await build({ ...common, entryPoints: ['prisma/seed.ts'], outfile: 'dist/seed.js' });
