import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const output = fileURLToPath(new URL('../.wrangler/reference-data/geonames/', import.meta.url));
const files = ['cities15000.zip', 'admin1CodesASCII.txt', 'countryInfo.txt', 'iso-languagecodes.txt', 'readme.txt'];
const base = 'https://download.geonames.org/export/dump/';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const deadline = AbortSignal.timeout(180_000);
await mkdir(output, {recursive: true});
let previous;
try { previous = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')); } catch {}
if (previous?.files?.length === files.length && (await Promise.all(previous.files.map(async file => {
  if (!files.includes(file.name) || file.url !== base + file.name) return false;
  try { return sha256(await readFile(join(output, file.name))) === file.sha256; } catch { return false; }
}))).every(Boolean)) {
  console.log(JSON.stringify({status: 'reused', manifest: join(output, 'manifest.json')}));
} else {
  const results = [];
  // Fixed official filenames only; every download shares one bounded overall deadline.
  for (const name of files) {
    const response = await fetch(base + name, {signal: deadline});
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 32 * 1024 * 1024) throw new Error(`${name}: unexpected size`);
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    if (!data.length) throw new Error(`${name}: empty response`);
    await writeFile(join(output, name + '.partial'), data);
    await rename(join(output, name + '.partial'), join(output, name));
    results.push({name, url: base + name, bytes, sha256: sha256(data)});
  }
  const manifest = {downloadedAt: new Date().toISOString(), attribution: 'GeoNames', license: 'CC BY 4.0', files: results};
  await writeFile(join(output, 'manifest.json.partial'), JSON.stringify(manifest, null, 2) + '\n');
  await rename(join(output, 'manifest.json.partial'), join(output, 'manifest.json'));
  console.log(JSON.stringify({status: 'downloaded', manifest: join(output, 'manifest.json'), files: results.map(({name, bytes}) => ({name, bytes}))}));
}
