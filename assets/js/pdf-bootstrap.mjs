import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url
).href;

window.pdfjsLib = pdfjsLib;

await new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'assets/js/viewer.js?v=20260709-pwa-compressed';
  script.onload = resolve;
  script.onerror = () => reject(new Error('تعذر تحميل viewer.js'));
  document.head.appendChild(script);
});
