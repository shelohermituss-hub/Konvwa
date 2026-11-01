// Images fixes de contrôle : node scripts/stills.mjs <Composition> <préfixe sortie> <image,image,...> [échelle]
// Windows (PC du client, carte NVIDIA) : Chrome via ANGLE. Linux (serveur cloud, sans carte graphique) : SwiftShader.
// Les bundles Remotion copient public/ dans le dossier temporaire : REMOTION_TMP permet de les mettre ailleurs.
import fs from "node:fs";
import path from "node:path";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const [id, prefix, frames, scale = "0.5"] = process.argv.slice(2);
const browserExecutable = process.env.BROWSER || (fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined);
const chromiumOptions = { gl: process.env.GL || (process.platform === "win32" ? "angle" : "swangle") };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps });
fs.mkdirSync(path.dirname(prefix), { recursive: true });
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), inputProps, browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000,
    onBrowserLog: (l) => { if (l.type === "error" || l.type === "warning" || process.env.LOGALL) console.log("[" + l.type + "]", l.text.slice(0, 400)) } });
  console.log("image", f, ((Date.now() - t0) / 1000).toFixed(1) + " s");
}
