import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';
import fs from 'fs/promises';
import path from 'path';

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
  loader: { '.wasm': 'binary' },
});

// Copy sql.js WASM next to main.js so the runtime can fetch it via locateFile.
async function copyWasm() {
  const src = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
  const dest = path.resolve('sql-wasm.wasm');
  await fs.copyFile(src, dest);
  console.log('Copied sql-wasm.wasm');
}

await copyWasm();

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
