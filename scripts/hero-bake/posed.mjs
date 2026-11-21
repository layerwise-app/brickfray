// usage: node posed.mjs <outdir> [ids…]  — dumps each showroom figure as posed (positions + indices per mesh) for Blender.
import { chromium } from '/private/tmp/claude-501/pw/node_modules/playwright-core/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
// usage: node posed.mjs <outdir> <unshaded|bare> [ids…]
const [out, mode, ...ids] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:5390/lab?scene=hero&quality=high&${mode}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lab?.ready || window.__lab?.error, null, { timeout: 60000 });
const all = ids.length ? ids : await page.evaluate(() => window.__lab.call('ids'));
for (const id of all) {
  await page.evaluate((i) => { window.__lab.call('show', i); window.__lab.call('time', 0); }, id);
  const { meshes, bones } = await page.evaluate(() => window.__lab.call('posed'));
  writeFileSync(`${out}/${id}-bones.json`, JSON.stringify(bones));
  const meta = meshes.map((m, k) => {
    const pos = Buffer.from(m.position, 'base64'), idx = Buffer.from(m.index, 'base64');
    writeFileSync(`${out}/${id}-${k}.pos`, pos); writeFileSync(`${out}/${id}-${k}.idx`, idx);
    if (m.bone) writeFileSync(`${out}/${id}-${k}.bone`, Buffer.from(m.bone, 'base64'));
    if (m.color) writeFileSync(`${out}/${id}-${k}.col`, Buffer.from(m.color, 'base64'));
    return { skinned: m.skinned, verts: pos.length / 12, tris: idx.length / 12 };
  });
  writeFileSync(`${out}/${id}.json`, JSON.stringify(meta));
  console.log(id, JSON.stringify(meta.filter((m) => m.skinned)), 'meshes', meta.length);
}
await browser.close();
