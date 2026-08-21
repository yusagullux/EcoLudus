import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../public/images");

const TARGET_PX = 640;

/**
 * Make a square, subject-filling master image from a source PNG.
 * 1. Trim transparent/near-empty margins.
 * 2. Cover-crop to a square using saliency (`attention`) so the subject
 *    survives when possible.
 * 3. Output as optimized PNG.
 *
 * For images that are already opaque photos (plants/pets), this means a
 * center-weighted crop that fills the square tile. For transparent PNGs
 * (eggs/chests), trimming removes the empty canvas first.
 */
async function makeSquareMaster(srcPath, dstPath, target) {
  let img = sharp(srcPath);

  const metadata = await img.metadata();

  // Trim only if the image actually has an alpha channel. Otherwise trimming
  // would try to match the top-left opaque pixel and could unexpectedly crop
  // into a photo with a similar corner color.
  const hasAlpha =
    metadata.hasAlpha === true ||
    (metadata.channels != null && metadata.channels === 4);
  if (hasAlpha) {
    try {
      img = img.trim({ threshold: 16 });
    } catch {
      // trim can fail if the whole image is a single color; just continue.
    }
  }

  // Never upscale: pick the smaller of the requested target and the source's
  // longest side. This keeps simple illustrations from bloating when forced
  // to a larger square canvas.
  const maxSide = Math.max(metadata.width ?? target, metadata.height ?? target);
  const squareSize = Math.min(target, maxSide);

  // Ensure the pipeline ends at exactly `squareSize x squareSize` and the
  // subject fills it. `position: "attention"` uses saliency from libvips to
  // keep the interesting region (e.g. an animal's face, the whole egg).
  const out = await img
    .resize(squareSize, squareSize, {
      fit: "cover",
      position: "attention",
      kernel: sharp.kernel.lanczos3
    })
    .sharpen({ sigma: 0.6, flat: 1, jagged: 2 })
    .png({
      compressionLevel: 9,
      // 256-color palette gives a big size win over 24-bit PNG for these
      // downscaled card assets while remaining visually clean at tile sizes.
      palette: true,
      colors: 256,
      quality: 95,
      // Dithering smooths gradients in the limited palette.
      dither: 1.0
    })
    .toBuffer();

  await fs.writeFile(dstPath, out);
}

async function recompress(srcPath, dstPath, maxDim) {
  const img = sharp(srcPath);
  let pipeline = img;
  if (maxDim) {
    pipeline = pipeline.resize(maxDim, maxDim, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3
    });
  }
  const out = await pipeline
    .png({ compressionLevel: 9, palette: true, quality: 95 })
    .toBuffer();
  await fs.writeFile(dstPath, out);
}

async function processDir(dir, processor, ...args) {
  const absDir = path.join(ROOT, dir);
  const files = (await fs.readdir(absDir)).filter((f) =>
    f.toLowerCase().endsWith(".png")
  );
  const results = [];
  for (const file of files) {
    const src = path.join(absDir, file);
    const dst = `${src}.tmp`;
    await processor(src, dst, ...args);
    const before = (await fs.stat(src)).size;
    const after = (await fs.stat(dst)).size;
    await fs.rename(dst, src);
    results.push({ file: `${dir}/${file}`, before, after });
  }
  return results;
}

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function main() {
  const start = Date.now();
  const all = [];

  console.log("Resizing + smart square-cropping pets and plants ...");
  all.push(...(await processDir("pets", makeSquareMaster, TARGET_PX)));
  all.push(...(await processDir("plants", makeSquareMaster, TARGET_PX)));

  console.log("Trimming + square-filling eggs ...");
  all.push(...(await processDir("eggs", makeSquareMaster, 512)));

  console.log("Recompressing chests (already square) ...");
  all.push(...(await processDir("chests", recompress, 512)));

  let saved = 0;
  for (const { file, before, after } of all) {
    const delta = before - after;
    saved += delta;
    console.log(
      `${file}: ${fmt(before)} -> ${fmt(after)} (${
        delta > 0 ? "-" : "+"
      }${fmt(Math.abs(delta))})`
    );
  }

  console.log(
    `\nDone in ${Date.now() - start}ms. Total saved: ${fmt(saved)} (${(
      (saved / all.reduce((s, r) => s + r.before, 0)) *
      100
    ).toFixed(1)}%)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
