// esbuild's `binary` loader returns Uint8Array for .wasm imports at build time.
declare module '*.wasm' {
  const content: Uint8Array;
  export default content;
}
