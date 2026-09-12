import { mkdir, readdir, copyFile } from 'node:fs/promises';
const source = new URL('../node_modules/decap-cms/dist/', import.meta.url);
const destination = new URL('../public/vendor/decap/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of await readdir(source)) {
  if (file.endsWith('.decap-cms.js') || file === 'decap-cms.js' || file.endsWith('.wasm') || file.endsWith('LICENSE.txt') || file.endsWith('.css')) {
    await copyFile(new URL(file, source), new URL(file, destination));
  }
}
