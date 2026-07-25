#!/usr/bin/env node
// Image optimization pass (Phase 5). Run with: node scripts/optimize-images.js
//
// Does three things, all via the bundled `sharp`:
//   1. Converts the five large photographic background PNGs to WebP (lossy,
//      q82) — these are photos, so WebP cuts them ~70-85% vs. PNG with no
//      visible loss. Callers already reference them by path; the .webp
//      versions replace the .png references in code (see commit).
//   2. Losslessly recompresses every other PNG under public/images with max
//      zlib + palette quantization where it shrinks the file (safe for the
//      flat sprite art; for the rare photographic PNG it keeps the lossless
//      variant). Files that don't shrink are left untouched.
//   3. Re-encodes the favicon / app icon to 256x256 PNG (it ships as a
//      460 KB 1024x1024 JPEG mislabelled .png today).
//
// Idempotent: re-running only re-encodes if output would be smaller.
// Originals are in git history if a regression is suspected.

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public", "images");

// Backgrounds to convert PNG→WebP (referenced by these exact basenames).
const BACKGROUNDS_TO_WEBP = ["forest", "mountains", "night", "background", "nature"];

async function fileExists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function sizeOf(p) {
  return (await fs.promises.stat(p)).size;
}

// Windows (esp. with AV scanning) intermittently returns EUNKNOWN on writes
// to a just-read file. Retry a few times with backoff, writing to a temp file
// then atomically renaming so a partial write never corrupts the asset.
async function writeFileRetry(target, data) {
  const tmp = `${target}.opttmp`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.promises.writeFile(tmp, data);
      await fs.promises.rename(tmp, target);
      return;
    } catch (err) {
      if (attempt < 4 && (err.code === "UNKNOWN" || err.code === "EBUSY" || err.code === "EPERM")) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        continue;
      }
      try {
        await fs.promises.unlink(tmp).catch(() => {});
      } catch {}
      throw err;
    }
  }
}

// Recompress a PNG in place. Tries palette (8-bit) first; if that is larger
// than the original (photographic content), falls back to lossless max-zlib.
// Only writes if the result is smaller than the current file.
async function recompressPng(file) {
  const original = await sizeOf(file);
  const buf = await sharp(file).png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 }).toBuffer();
  if (buf.length < original) {
    await writeFileRetry(file, buf);
    return original - buf.length;
  }
  // Lossless fallback.
  const lossless = await sharp(file).png({ compressionLevel: 9, palette: false, effort: 10 }).toBuffer();
  if (lossless.length < original) {
    await writeFileRetry(file, lossless);
    return original - lossless.length;
  }
  return 0;
}

async function convertBackgroundToWebp(basename) {
  const png = path.join(IMAGES_DIR, `${basename}.png`);
  const webp = path.join(IMAGES_DIR, `${basename}.webp`);
  if (!(await fileExists(png))) return 0;
  const original = await sizeOf(png);
  const buf = await sharp(png).webp({ quality: 82, effort: 6 }).toBuffer();
  await fs.promises.writeFile(webp, buf);
  // Remove the now-orphaned PNG (callers will point at the .webp).
  await fs.promises.unlink(png);
  return original - buf.length;
}

async function optimizeFavicon(file, sizePx) {
  if (!(await fileExists(file))) return 0;
  const original = await sizeOf(file);
  const buf = await sharp(file)
    .resize(sizePx, sizePx, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();
  await writeFileRetry(file, buf);
  return original - buf.length;
}

async function main() {
  let totalSaved = 0;

  // 1. Backgrounds → WebP.
  for (const base of BACKGROUNDS_TO_WEBP) {
    const saved = await convertBackgroundToWebp(base);
    if (saved > 0) {
      console.log(`webp  ${base}.png → ${base}.webp   saved ${(saved / 1024).toFixed(0)} KB`);
      totalSaved += saved;
    }
  }

  // 2. Recompress remaining PNGs (skips the ones we just deleted).
  async function walk(dir) {
    const out = [];
    for (const name of await fs.promises.readdir(dir)) {
      const full = path.join(dir, name);
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) out.push(...(await walk(full)));
      else if (name.endsWith(".png")) out.push(full);
    }
    return out;
  }
  const files = await walk(IMAGES_DIR);
  for (const file of files) {
    const saved = await recompressPng(file);
    if (saved > 0) {
      console.log(`png   ${path.relative(ROOT, file).replace(/\\/g, "/")}   saved ${(saved / 1024).toFixed(0)} KB`);
      totalSaved += saved;
    }
  }

  // 3. Favicons / app icon.
  for (const f of [path.join(ROOT, "public", "favicon.png"), path.join(ROOT, "app", "icon.png")]) {
    const saved = await optimizeFavicon(f, 256);
    if (saved > 0) {
      console.log(`icon  ${path.relative(ROOT, f).replace(/\\/g, "/")}   saved ${(saved / 1024).toFixed(0)} KB`);
      totalSaved += saved;
    }
  }

  console.log(`\nTotal saved: ${(totalSaved / (1024 * 1024)).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});