// news-image-20261120 — "20 November 2026: Houthi Missile Hits Riyadh's PIF Tower"
// Checks entry.png (PNG magic, IHDR size + CRC-32, dimensions, IEND) and
// copies it byte-for-byte to MAKEFUN_OUTPUT_DIR (or /output) as entry.png.
// Node 22 stdlib only, no dependencies. The copy is exact, so repeated
// runs are byte-identical and deterministic.
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT_BYTES = 1048576; // 1 MiB
const LIMIT_EDGE = 1024;
const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC-32 (IEEE 802.3) lookup table, built once at startup.
const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function main() {
  const src = join(import.meta.dirname, "entry.png");
  let data;
  try {
    data = readFileSync(src);
  } catch {
    die(`cannot read ${src}`);
  }

  if (data.length > LIMIT_BYTES) {
    die(`entry.png is ${data.length} bytes, over the 1 MiB limit (${LIMIT_BYTES})`);
  }
  if (data.length < 8 || !data.subarray(0, 8).equals(MAGIC)) {
    die("entry.png does not start with the PNG magic bytes");
  }

  // Walk the chunk stream: IHDR first, IEND last, nothing after it.
  let at = 8;
  let width = 0;
  let height = 0;
  let sawEnd = false;
  let sawIdat = false;
  let first = true;
  while (at + 8 <= data.length) {
    const len = data.readUInt32BE(at);
    const kind = data.toString("latin1", at + 4, at + 8);
    const end = at + 8 + len + 4;
    if (end > data.length) die(`truncated ${kind} chunk at offset ${at}`);
    if (first && kind !== "IHDR") die(`first chunk is ${kind}, expected IHDR`);
    if (kind === "IHDR") {
      if (len !== 13) die(`IHDR length is ${len}, expected 13`);
      width = data.readUInt32BE(at + 8);
      height = data.readUInt32BE(at + 12);
      const stored = data.readUInt32BE(at + 8 + len);
      const actual = crc32(data.subarray(at + 4, at + 8 + len));
      if (stored !== actual) {
        die(`IHDR CRC-32 mismatch: stored ${stored}, computed ${actual}`);
      }
      if (width === 0 || height === 0) die("dimensions must be non-zero");
      if (width > LIMIT_EDGE || height > LIMIT_EDGE) {
        die(`dimensions ${width}x${height} exceed the ${LIMIT_EDGE}x${LIMIT_EDGE} limit`);
      }
      // IHDR bytes 9-10: bit depth 8, colour type 2 (RGB) or 6 (RGBA).
      const depth = data[at + 8 + 8];
      const colour = data[at + 8 + 9];
      if (depth !== 8) die(`unsupported PNG bit depth ${depth}, expected 8`);
      if (colour !== 2 && colour !== 6) {
        die(`unsupported PNG colour type ${colour}, expected 2 (RGB) or 6 (RGBA)`);
      }
    }
    if (kind === "IDAT") {
      if (len === 0) die("empty IDAT chunk");
      sawIdat = true;
    }
    if (kind === "IEND") {
      if (len !== 0) die("IEND chunk must be empty");
      const storedEnd = data.readUInt32BE(at + 8 + len);
      const actualEnd = crc32(data.subarray(at + 4, at + 8 + len));
      if (storedEnd !== actualEnd) {
        die(`IEND CRC-32 mismatch: stored ${storedEnd}, computed ${actualEnd}`);
      }
      if (end !== data.length) die("trailing bytes after IEND chunk");
      sawEnd = true;
      break;
    }
    first = false;
    at = end;
  }
  if (!sawEnd) die("missing complete IEND chunk");
  if (!sawIdat) die("missing IDAT chunk: entry.png carries no image data");

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, "entry.png");
  copyFileSync(src, dest);
  const written = statSync(dest).size;
  if (written !== data.length) {
    die(`copy size mismatch: wrote ${written} bytes but entry.png is ${data.length}`);
  }
  console.log(`ok: entry.png ${width}x${height}, ${data.length} bytes -> ${dest}`);
}

main();
