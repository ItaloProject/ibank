import sharp from "sharp";

const SRC = "public/logo sem fundo.png";
const OUT = "public/logo.png";
const FILL = [59, 130, 246]; // tailwind blue-500 / --primary do app
const INK_THRESHOLD = 15;

async function main() {
  const { data, info } = await sharp(SRC).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const size = width * height;

  const isInk = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    isInk[i] = data[i * 4 + 3] > INK_THRESHOLD ? 1 : 0;
  }

  const outside = new Uint8Array(size);
  const queue = new Int32Array(size);
  let qHead = 0, qTail = 0;

  function tryPush(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (isInk[idx] || outside[idx]) return;
    outside[idx] = 1;
    queue[qTail++] = idx;
  }

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width;
    const y = (idx / width) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  const out = Buffer.alloc(size * 4);
  for (let i = 0; i < size; i++) {
    const o = i * 4;
    if (outside[i]) {
      out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
      continue;
    }
    const a = data[o + 3];
    const alphaNorm = a / 255;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    out[o] = Math.round(r * alphaNorm + FILL[0] * (1 - alphaNorm));
    out[o + 1] = Math.round(g * alphaNorm + FILL[1] * (1 - alphaNorm));
    out[o + 2] = Math.round(b * alphaNorm + FILL[2] * (1 - alphaNorm));
    out[o + 3] = 255;
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(OUT);
  console.log("Colorized logo written to", OUT);
}

main();
