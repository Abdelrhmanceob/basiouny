import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const base = 'http://127.0.0.1:8080';
const doc = 'quran1.pdf';

const meta = await fetch(`${base}/api/pdf-meta?doc=${doc}`).then((r) => r.json());
console.log('meta', meta);

const size = meta.size;
const chunkSize = 1024 * 1024;
const merged = new Uint8Array(size);
let loaded = 0;

for (let offset = 0; offset < size; offset += chunkSize) {
  const length = Math.min(chunkSize, size - offset);
  const response = await fetch(`${base}/api/pdf-chunk?doc=${doc}&offset=${offset}&length=${length}`);
  if (!response.ok) {
    throw new Error(`chunk failed ${offset} status ${response.status}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  merged.set(buffer, offset);
  loaded += buffer.byteLength;
  if (offset % (10 * chunkSize) === 0) {
    console.log(`loaded ${loaded}/${size}`);
  }
}

console.log('download OK', loaded, 'magic', String.fromCharCode(...merged.slice(0, 4)));

const pdfjsPath = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets/vendor/pdfjs/pdf.min.mjs')).href;
const pdfjs = await import(pdfjsPath);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets/vendor/pdfjs/pdf.worker.min.mjs')
).href;

const docRef = await pdfjs.getDocument({ data: merged }).promise;
console.log('pdfjs pages', docRef.numPages);
const page = await docRef.getPage(2);
const viewport = page.getViewport({ scale: 0.4 });
console.log('page2', Math.round(viewport.width), 'x', Math.round(viewport.height));
