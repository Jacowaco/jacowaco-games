// Genera img/*.webp a partir de originales/*.jpg
// uso: node tools/optimize.mjs
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'originales';
const OUT = 'img';
await mkdir(OUT, { recursive: true });

const files = (await readdir(SRC)).filter(f => /\.jpe?g$/i.test(f));

for (const f of files) {
  const name = path.parse(f).name;
  const input = sharp(path.join(SRC, f)).rotate(); // respeta EXIF
  const meta = await input.metadata();
  await input.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 }).toFile(path.join(OUT, `${name}.webp`));
  await input.clone().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 }).toFile(path.join(OUT, `${name}-s.webp`));
  console.log(name, meta.width + 'x' + meta.height);
}

// Recortes de premios (fracciones del ancho/alto de la foto, ya rotada)
const crops = [
  { src: 'ganadores2025.jpg', out: 'premio-copa',  left: 0.36, top: 0.36, w: 0.22, h: 0.17 },
  { src: 'ganadores2019.jpg', out: 'premio-cofre', left: 0.37, top: 0.38, w: 0.22, h: 0.29 },
  { src: 'ganadores2025.jpg', out: 'premio-caja',  left: 0.46, top: 0.59, w: 0.19, h: 0.145 },
];
for (const c of crops) {
  const img = sharp(path.join(SRC, c.src)).rotate();
  const m = await img.metadata();
  const W = m.width, H = m.height;
  await img.extract({
    left: Math.round(c.left * W), top: Math.round(c.top * H),
    width: Math.round(c.w * W), height: Math.round(c.h * H),
  }).resize({ width: 600, height: 600, fit: 'cover' }).webp({ quality: 80 })
    .toFile(path.join(OUT, `${c.out}.webp`));
  console.log('crop', c.out);
}

// Imagen Open Graph 1200x630 (preview de WhatsApp)
await sharp(path.join(SRC, 'foto2018.jpg')).rotate()
  .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82 }).toFile(path.join(OUT, 'og.jpg'));
console.log('og.jpg');
