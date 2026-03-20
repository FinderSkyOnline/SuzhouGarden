import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const collections = [
  { id: '1', name: '名录一', file: path.join(projectRoot, 'src/data/gardens.json') },
  { id: '2', name: '名录二', file: path.join(projectRoot, 'src/data/gardens2.json') },
  { id: '3', name: '名录三', file: path.join(projectRoot, 'src/data/gardens3.json') },
  { id: '4', name: '名录四', file: path.join(projectRoot, 'src/data/gardens4.json') },
];

const outputPath = path.join(projectRoot, 'public/geohub/gardens_geohub.csv');

const headers = [
  'geometry',
  '园林名称',
  '地址',
  '开放状态',
  '年代',
  '名录',
  '名录ID',
  '园林ID',
  '坐标系',
];

const types = [
  'string',
  'string',
  'string',
  'string',
  'string',
  'string',
  'string',
  'string',
  'string',
];

const parseCoordinates = (rawCoordinates) => {
  const raw = String(rawCoordinates || '').trim();
  if (!raw || !raw.includes(',')) return null;
  const [latStr, lngStr] = raw.split(',');
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const escapeCsv = (value) => {
  const raw = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  if (raw.includes(',') || raw.includes('\n')) {
    return `"${raw}"`;
  }
  return raw;
};

const main = async () => {
  const rows = [];

  for (const collection of collections) {
    const content = await readFile(collection.file, 'utf8');
    const data = JSON.parse(content);

    for (const garden of data) {
      const parsed = parseCoordinates(garden?.location?.coordinates);
      if (!parsed) continue;

      rows.push([
        `POINT (${parsed.lng} ${parsed.lat})`,
        garden.name || '',
        garden?.location?.address || '',
        garden.status || '',
        garden.year || '',
        collection.name,
        collection.id,
        garden.id || '',
        'GCJ02',
      ]);
    }
  }

  const lines = [
    headers.map(escapeCsv).join(','),
    types.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`GeoHUB CSV generated: ${outputPath}`);
  console.log(`Rows: ${rows.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
