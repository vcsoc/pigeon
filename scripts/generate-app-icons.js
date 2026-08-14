const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const source = path.join(root, 'pigeon-logo.png');
const build = path.join(root, 'build');
const icons = path.join(build, 'icons');
const extensionIcons = path.join(root, 'browser-extension', 'icons');
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024];

async function pngAt(size) {
  return sharp(source)
    .ensureAlpha()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function ico(buffers) {
  const header = Buffer.alloc(6 + buffers.length * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(buffers.length, 4);
  let offset = header.length;
  buffers.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size >= 256 ? 0 : size; header[entry + 1] = size >= 256 ? 0 : size;
    header[entry + 2] = 0; header[entry + 3] = 0;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...buffers.map(({ data }) => data)]);
}

function icns(buffers) {
  const typeForSize = new Map([[16, 'icp4'], [32, 'icp5'], [64, 'icp6'], [128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']]);
  const chunks = buffers.filter(({ size }) => typeForSize.has(size)).map(({ size, data }) => {
    const chunk = Buffer.alloc(8 + data.length); chunk.write(typeForSize.get(size), 0, 4, 'ascii'); chunk.writeUInt32BE(chunk.length, 4); data.copy(chunk, 8); return chunk;
  });
  const header = Buffer.alloc(8); header.write('icns', 0, 4, 'ascii'); header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

(async () => {
  await fs.mkdir(icons, { recursive: true });
  await fs.mkdir(extensionIcons, { recursive: true });
  const buffers = [];
  for (const size of sizes) {
    const data = await pngAt(size); buffers.push({ size, data });
    await fs.writeFile(path.join(icons, `${size}x${size}.png`), data);
    if ([16, 32, 48, 128].includes(size)) await fs.writeFile(path.join(extensionIcons, `icon-${size}.png`), data);
  }
  await fs.writeFile(path.join(build, 'icon.png'), buffers.find(({ size }) => size === 1024).data);
  await fs.writeFile(path.join(build, 'icon.ico'), ico(buffers.filter(({ size }) => size <= 256)));
  await fs.writeFile(path.join(build, 'icon.icns'), icns(buffers));
  console.log(`Generated Windows, macOS, and Linux icons from ${path.basename(source)}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
