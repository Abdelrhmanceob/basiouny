import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8080);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadTocEntries() {
  const sources = [
    path.join(root, 'assets', 'content.json'),
    path.join(root, 'dist', 'data', 'toc.json')
  ];

  for (const source of sources) {
    try {
      const data = loadJsonFile(source);
      const toc = Array.isArray(data?.toc) ? data.toc : (Array.isArray(data) ? data : []);
      if (toc.length) return toc;
    } catch {
      // try next source
    }
  }

  return [];
}

function buildManifest(query) {
  const doc = path.basename(query.get('doc') || 'quran1.pdf');
  const viewer = query.get('viewer') || '';
  const page = Math.max(1, Number(query.get('page') || 1));
  const customName = String(query.get('name') || '').trim();
  const startParams = new URLSearchParams({
    doc,
    page: String(page),
    utm_source: 'pwa'
  });
  if (viewer) startParams.set('viewer', viewer);

  const viewerLabels = {
    '': 'عارض PDF',
    images: 'عارض الصور',
    native: 'عارض مدمج'
  };

  const baseName = customName || `الدليل المفيد — ${doc.replace(/\.pdf$/i, '')}`;
  const viewerSuffix = viewer ? ` (${viewerLabels[viewer] || viewer})` : '';

  return {
    name: `${baseName}${viewerSuffix}`,
    short_name: baseName.slice(0, 24),
    description: 'منصة عرض الكتب والمراجع بصيغة PDF مع فهرس تفاعلي',
    start_url: `/viewer.html?${startParams.toString()}`,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a100d',
    theme_color: '#c7a45a',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      { src: '/assets/dlel.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/dlel.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ],
    categories: ['books', 'education'],
    prefer_related_applications: false
  };
}

function resolveIndexedPdfPath(docName) {
  const safeName = path.basename(docName || 'quran1.pdf').replace(/\.pdf$/i, '');
  const indexedPath = path.normalize(path.join(root, 'assets', `${safeName}_indexed.pdf`));
  const assetsRoot = path.join(root, 'assets');
  if (!indexedPath.startsWith(assetsRoot) || path.extname(indexedPath).toLowerCase() !== '.pdf') {
    return null;
  }
  return indexedPath;
}

function serveStaticFile(filePath, req, res) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : stat.size - 1;
        if (start >= stat.size || end >= stat.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
          return;
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
          'Content-Length': chunkSize,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
}

function resolvePdfPath(docName) {
  const safeName = path.basename(docName || 'quran1.pdf');
  const pdfPath = path.normalize(path.join(root, 'assets', safeName));
  const assetsRoot = path.join(root, 'assets');

  if (!pdfPath.startsWith(assetsRoot) || path.extname(pdfPath).toLowerCase() !== '.pdf') {
    return null;
  }

  return pdfPath;
}

function pipePdfRange(filePath, stat, req, res, headers) {
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      ...headers,
      'Content-Length': stat.size
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) {
    res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
    return;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || end >= stat.size || start > end) {
    res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.writeHead(206, {
    ...headers,
    'Content-Length': chunkSize,
    'Content-Range': `bytes ${start}-${end}/${stat.size}`
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath, { start, end }).pipe(res);
}

function servePdfFile(docName, req, res, options = {}) {
  const { attachment = false, preferIndexed = false } = options;
  let pdfPath = resolvePdfPath(docName);

  if (preferIndexed) {
    const indexedPath = resolveIndexedPdfPath(docName);
    if (indexedPath && fs.existsSync(indexedPath)) {
      pdfPath = indexedPath;
    }
  }

  if (!pdfPath) {
    res.writeHead(400).end('Invalid PDF path');
    return;
  }

  fs.stat(pdfPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end('PDF not found');
      return;
    }

    const fileName = path.basename(pdfPath);
    const disposition = attachment ? 'attachment' : 'inline';

    pipePdfRange(pdfPath, stat, req, res, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${fileName}"`,
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes'
    });
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const urlPath = decodeURIComponent(requestUrl.pathname);
  const docParam = requestUrl.searchParams.get('doc') || 'quran1.pdf';

  if (urlPath === '/api/pdf') {
    servePdfFile(docParam, req, res, { attachment: false });
    return;
  }

  if (urlPath === '/api/pdf-download') {
    servePdfFile(docParam, req, res, { attachment: true });
    return;
  }

  if (urlPath === '/api/pdf-meta') {
    const pdfPath = resolvePdfPath(docParam);
    if (!pdfPath) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }).end('{"error":"invalid"}');
      return;
    }

    fs.stat(pdfPath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }).end('{"error":"not found"}');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ doc: path.basename(pdfPath), size: stat.size }));
    });
    return;
  }

  if (urlPath === '/api/pdf-chunk') {
    const pdfPath = resolvePdfPath(docParam);
    if (!pdfPath) {
      res.writeHead(400).end('Invalid PDF path');
      return;
    }

    const offset = Math.max(0, Number(requestUrl.searchParams.get('offset') || 0));
    const length = Math.min(Math.max(1, Number(requestUrl.searchParams.get('length') || 1048576)), 1048576);

    fs.stat(pdfPath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404).end('PDF not found');
        return;
      }

      const safeOffset = Math.min(offset, stat.size);
      const end = Math.min(safeOffset + length, stat.size) - 1;
      const chunkSize = end >= safeOffset ? end - safeOffset + 1 : 0;

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': chunkSize,
        'Cache-Control': 'no-store',
        'X-Chunk-Offset': String(safeOffset),
        'X-File-Size': String(stat.size)
      });

      if (chunkSize === 0) {
        res.end();
        return;
      }

      fs.createReadStream(pdfPath, { start: safeOffset, end }).pipe(res);
    });
    return;
  }

  if (urlPath === '/manifest.webmanifest') {
    const manifest = buildManifest(requestUrl.searchParams);
    res.writeHead(200, {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(manifest, null, 2));
    return;
  }

  if (urlPath === '/api/pdf-indexed') {
    servePdfFile(docParam, req, res, {
      attachment: true,
      preferIndexed: true
    });
    return;
  }

  if (urlPath === '/api/index-bundle') {
    const toc = loadTocEntries();
    const bundle = {
      doc: path.basename(docParam),
      generatedAt: new Date().toISOString(),
      toc,
      searchIndexPath: '/assets/search_index.json',
      viewerUrl: `/viewer.html?doc=${encodeURIComponent(path.basename(docParam))}`,
      pdfUrl: `/api/pdf?doc=${encodeURIComponent(path.basename(docParam))}`,
      indexedPdfUrl: `/api/pdf-indexed?doc=${encodeURIComponent(path.basename(docParam))}`
    };

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${path.basename(docParam).replace(/\.pdf$/i, '')}_index_bundle.json"`,
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(bundle, null, 2));
    return;
  }

  if (urlPath === '/favicon.ico') {
    const iconPath = path.join(root, 'assets', 'dlel.png');
    return serveStaticFile(iconPath, req, res);
  }

  if (urlPath === '/') {
    return serveStaticFile(path.join(root, 'index.html'), req, res);
  }

  const filePath = path.normalize(path.join(root, urlPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }

  serveStaticFile(filePath, req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
