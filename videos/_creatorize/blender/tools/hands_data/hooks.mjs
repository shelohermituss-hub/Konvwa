// Module hooks for hands_data.mjs: every import of the recon engine.js resolves to the headless stub next to this file.
const STUB = new URL('./engine_stub.mjs', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (/(^|\/)engine\.js$/.test(spec) && ctx.parentURL && /\/recon\/lib\//.test(ctx.parentURL)) return { url: STUB, shortCircuit: true };
  return next(spec, ctx);
}
