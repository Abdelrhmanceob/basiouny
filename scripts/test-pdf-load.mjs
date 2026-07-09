import http from 'http';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks)
      }));
    }).on('error', reject);
  });
}

const base = 'http://127.0.0.1:8080';

const pdf = await get(`${base}/assets/quran1.pdf`);
console.log('PDF:', pdf.status, pdf.headers['content-type'], pdf.body.length, 'bytes');
console.log('PDF magic:', pdf.body.slice(0, 5).toString());

const range = await get(`${base}/assets/quran1.pdf`, { Range: 'bytes=0-1023' });
console.log('Range:', range.status, range.headers['content-range'] || 'no range header');

const worker = await get('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js');
console.log('Worker CDN:', worker.status, worker.body.length, 'bytes');

const pdfjs = await get('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.js');
console.log('PDF.js CDN:', pdfjs.status, pdfjs.body.length, 'bytes');
