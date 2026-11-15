import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rgba)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function render(size, branded) {
  const scale = 4;
  const width = size * scale;
  const pixels = new Uint8Array(width * width * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= width) return;
    const offset = (y * width + x) * 4;
    pixels.set(color, offset);
  };
  const bg = [92, 107, 255, 255];
  if (branded) {
    const radius = 8 * scale;
    for (let y = 0; y < width; y += 1)
      for (let x = 0; x < width; x += 1) {
        const cx = Math.max(radius, Math.min(width - radius, x + 0.5));
        const cy = Math.max(radius, Math.min(width - radius, y + 0.5));
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2) set(x, y, bg);
      }
  }
  const points =
    size === 16
      ? [
          [1.5, 9],
          [4.7, 9],
          [6.7, 4.9],
          [9.8, 13.1],
          [12.1, 7.1],
          [13.5, 9],
          [16.5, 9],
        ]
      : [
          [4.5, 16],
          [9.7, 16],
          [12.8, 9.6],
          [17.5, 22.4],
          [21.1, 13.3],
          [23.2, 16],
          [27.5, 16],
        ];
  const stroke = (size === 16 ? 1.65 : 2.4) * scale;
  const color = branded ? [184, 255, 216, 255] : [0, 0, 0, 255];
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    const x1 = ax * scale,
      y1 = ay * scale,
      x2 = bx * scale,
      y2 = by * scale;
    const radius = stroke / 2;
    const left = Math.floor(Math.min(x1, x2) - radius - 1),
      right = Math.ceil(Math.max(x1, x2) + radius + 1);
    const top = Math.floor(Math.min(y1, y2) - radius - 1),
      bottom = Math.ceil(Math.max(y1, y2) + radius + 1);
    const dx = x2 - x1,
      dy = y2 - y1,
      length2 = dx * dx + dy * dy;
    for (let y = top; y <= bottom; y += 1)
      for (let x = left; x <= right; x += 1) {
        const t = Math.max(0, Math.min(1, ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / length2));
        if ((x + 0.5 - (x1 + t * dx)) ** 2 + (y + 0.5 - (y1 + t * dy)) ** 2 <= radius ** 2)
          set(x, y, color);
      }
  }
  const output = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    output[row] = 0;
    for (let x = 0; x < size; x += 1)
      for (let channel = 0; channel < 4; channel += 1) {
        let total = 0;
        for (let sy = 0; sy < scale; sy += 1)
          for (let sx = 0; sx < scale; sx += 1)
            total += pixels[((y * scale + sy) * width + x * scale + sx) * 4 + channel];
        output[row + 1 + x * 4 + channel] = Math.round(total / (scale * scale));
      }
  }
  return png(size, size, output);
}

await Promise.all([
  writeFile(path.join(dir, 'tray-template.png'), render(16, false)),
  writeFile(path.join(dir, 'tray-template@2x.png'), render(32, false)),
  writeFile(path.join(dir, 'tray-color.png'), render(32, true)),
]);
