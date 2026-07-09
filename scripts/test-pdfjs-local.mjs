import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pdfjsPath = pathToFileURL(path.join(root, 'assets/vendor/pdfjs/pdf.min.mjs')).href;
const pdfjs = await import(pdfjsPath);

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(root, 'assets/vendor/pdfjs/pdf.worker.min.mjs')
).href;

const pdfBytes = fs.readFileSync(path.join(root, 'assets/quran1.pdf'));
const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) });
const doc = await loadingTask.promise;
console.log('PDF.js local OK — pages:', doc.numPages);

const page = await doc.getPage(2);
const viewport = page.getViewport({ scale: 0.5 });
console.log('Page 2 size:', Math.round(viewport.width), 'x', Math.round(viewport.height));
