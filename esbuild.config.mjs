import esbuild from 'esbuild';
import process from 'process';
import { builtinModules as builtins } from 'node:module';

const banner = `/* Dayflow plugin — auto-generated bundle. Do not edit. */`;

const prod = process.argv.includes('production');
const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  // The `binary` loader inlines .wasm files as Uint8Array at build time, so
  // sql-wasm.wasm is embedded into main.js (no separate release asset).
  loader: { '.wasm': 'binary' },
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
