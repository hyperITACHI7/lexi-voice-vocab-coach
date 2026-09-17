// Copies the Silero VAD model, its audio worklet, and the ONNX Runtime WASM
// files into public/vad so the voice detector is self-hosted (no CDN needed).
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "vad");
mkdirSync(out, { recursive: true });

const files = [
  ["node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js"],
  ["node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx"],
  ["node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"],
  ["node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"],
];

for (const [rel] of files) {
  const src = join(root, rel);
  if (!existsSync(src)) {
    console.error(`[copy-vad-assets] missing ${rel}. Run npm install first.`);
    process.exit(1);
  }
  cpSync(src, join(out, rel.split("/").pop()));
}
console.log(`[copy-vad-assets] copied ${files.length} files to public/vad`);
