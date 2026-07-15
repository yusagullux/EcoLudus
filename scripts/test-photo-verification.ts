import assert from "assert/strict";
import { verifyImageWithProvider } from "../lib/photo-verification";

async function run() {
  const tinyBuffer = Buffer.alloc(1024);
  const tooSmall = await verifyImageWithProvider(tinyBuffer, "user-1", "quest-1", "Quest 1", "image/png", {
    allowHeuristicFallback: false
  });
  assert.equal(tooSmall.verified, false);
  assert.equal(tooSmall.warnings.includes("file_too_small"), true);

  const unsupported = await verifyImageWithProvider(Buffer.alloc(6000), "user-1", "quest-1", "Quest 1", "image/gif", {
    allowHeuristicFallback: false
  });
  assert.equal(unsupported.verified, false);
  assert.equal(unsupported.warnings.includes("unsupported_format"), true);

  const jpeg = Buffer.alloc(6000);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  const fallback = await verifyImageWithProvider(jpeg, "user-1", "quest-1", "Quest 1", "image/jpeg", {
    allowHeuristicFallback: true
  });
  assert.equal(fallback.verified, true);
  assert.equal(fallback.provider, "heuristic-local");

  console.log("photo verification smoke test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
