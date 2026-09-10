import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = "public/logo.png";
const outDir = "public/icons";
const bgWhite = { r: 255, g: 255, b: 255, alpha: 1 };
const bgMaskable = { r: 15, g: 23, b: 42, alpha: 1 }; // slate-900

fs.mkdirSync(outDir, { recursive: true });

async function square(size, file) {
  const inner = Math.round(size * 0.75);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bgWhite },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(outDir, file));
}

async function maskable(size, file) {
  const inner = Math.round(size * 0.6);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bgMaskable },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(outDir, file));
}

await square(192, "icon-192.png");
await square(512, "icon-512.png");
await maskable(512, "icon-maskable-512.png");
await maskable(192, "icon-maskable-192.png");
await square(180, "apple-touch-icon.png");
console.log("PWA icons generated in", outDir);
