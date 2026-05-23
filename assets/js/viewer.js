const pdfCanvas = document.querySelector('[data-pdf-canvas]');
const canvasFrame = document.querySelector('[data-canvas-frame]');
const pageIndicator = document.querySelector('[data-page-indicator]');
const zoomIndicator = document.querySelector('[data-zoom-indicator]');
const sectionTitle = document.querySelector('[data-section-title]');
const flash = document.querySelector('[data-section-flash]');
const indexList = document.querySelector('[data-index-list]');
const indexCaption = document.querySelector('.index-caption');
const indexSearchInput = document.querySelector('[data-index-search]');
const sidebar = document.querySelector('[data-sidebar]');
const sidebarToggles = document.querySelectorAll('[data-sidebar-toggle]');
const stage = document.querySelector('[data-stage]');
const controls = document.querySelector('[data-float-controls]');
const pageInput = document.querySelector('[data-page-input]');
const pageGoBtn = document.querySelector('[data-page-go]');
const pageTotal = document.querySelector('[data-page-total]');
const quickNavToggle = document.querySelector('[data-quick-nav-toggle]');
const quickNavPanel = document.querySelector('[data-quick-nav-panel]');
const quickNavClose = document.querySelector('[data-quick-nav-close]');
const quickPageInput = document.querySelector('[data-quick-page-input]');
const quickPageGo = document.querySelector('[data-quick-page-go]');
const keywordInput = document.querySelector('[data-keyword-input]');
const keywordSearchBtn = document.querySelector('[data-keyword-search]');
const keywordResults = document.querySelector('[data-keyword-results]');
const primarySearchBtn = document.querySelector('[data-primary-search-btn]');
const primarySearchResults = document.querySelector('[data-primary-search-results]');

const prevBtn = document.querySelector('[data-prev-page]');
const nextBtn = document.querySelector('[data-next-page]');
const zoomInBtn = document.querySelector('[data-zoom-in]');
const zoomOutBtn = document.querySelector('[data-zoom-out]');
const downloadBtn = document.querySelector('[data-download-pdf]');
const topDownloadBtn = document.querySelector('[data-download-top]');
const fullscreenBtn = document.querySelector('[data-fullscreen]');

const PDF_PATH = 'assets/quran1.pdf';
const DOWNLOAD_PATH = PDF_PATH;
const FORCE_IMAGE_VIEW = true;
const INDEX_START = 2;
const INDEX_END = 9;

let pdfDoc = null;
let renderTask = null;
let currentPage = Number(new URLSearchParams(window.location.search).get('page') || 1);
let totalPages = 241;
let zoom = 1;
let indexEntries = [];
let pageListEntries = [];
let filteredPageListEntries = [];
let activeSection = null;
let controlsTimer = null;
let fallbackMode = false;
let fallbackPagesStack = null;
let fallbackObserver = null;
let fallbackSyncLocked = false;
let fallbackPages = [];
let resizeTimer = null;
let navScaleTimer = null;
let pendingPostRenderScale = false;
let isApplyingPostRenderScale = false;
let tocDebugReport = null;
let tocExtractionWarning = '';
let userZoomOverride = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;
let searchToken = 0;
const pageTextCache = new Map();
let searchIndexData = null;
let searchIndexNormalized = null;

function normalizeDigits(value) {
  const map = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return String(value).replace(/[٠-٩۰-۹]/g, (digit) => map[digit] || digit);
}

function normalizeArabicText(value) {
  return normalizeDigits(String(value || ''))
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizeQuery(value) {
  const normalized = normalizeArabicText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length >= 2);
}

function extractPageTargetFromQuery(rawQuery) {
  const normalized = normalizeDigits(rawQuery || '').trim().toLowerCase();
  if (!normalized) return null;

  // Supports: "25", "صفحة 25", "page 25", "p25", "رقم 25"
  const directMatch = normalized.match(/(?:^|\s)(?:page|p|صفحة|رقم)?\s*[:#-]?\s*(\d{1,4})(?:\s|$)/);
  if (!directMatch) return null;

  const page = Number(directMatch[1]);
  if (!Number.isFinite(page)) return null;
  return clampPage(page);
}

function getFallbackImageSrc(pageNumber) {
  const entry = fallbackPages.find((item) => item.page === pageNumber);
  if (!entry || !entry.image) return '';
  return `assets/images/${entry.image}`;
}

function getFallbackPageNode(pageNumber) {
  if (!fallbackPagesStack) return null;
  return fallbackPagesStack.querySelector(`[data-fallback-page="${pageNumber}"]`);
}

function scrollToFallbackPage(pageNumber, smooth = true) {
  const node = getFallbackPageNode(pageNumber);
  if (!node) return;
  fallbackSyncLocked = true;
  node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  window.setTimeout(() => {
    fallbackSyncLocked = false;
  }, smooth ? 420 : 80);
}

function wireFallbackScrollTracking() {
  if (!canvasFrame || !fallbackPagesStack) return;
  if (fallbackObserver) {
    fallbackObserver.disconnect();
  }

  fallbackObserver = new IntersectionObserver((entries) => {
    if (fallbackSyncLocked) return;
    let best = null;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      if (!best || entry.intersectionRatio > best.intersectionRatio) {
        best = entry;
      }
    });
    if (!best) return;
    const page = Number(best.target.getAttribute('data-fallback-page'));
    if (!Number.isFinite(page) || page === currentPage) return;

    currentPage = clampPage(page);
    setPageMeta();
    activeSection = getActiveSectionForPage(currentPage);
    highlightActiveIndex();
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(currentPage));
    window.history.replaceState({}, '', url.toString());
  }, {
    root: canvasFrame,
    threshold: [0.5, 0.65, 0.8]
  });

  fallbackPagesStack.querySelectorAll('[data-fallback-page]').forEach((node) => {
    fallbackObserver.observe(node);
  });
}

function renderFallbackPagesStack() {
  if (!canvasFrame) return;
  canvasFrame.innerHTML = '';
  canvasFrame.classList.add('fallback-scroll-mode');

  fallbackPagesStack = document.createElement('div');
  fallbackPagesStack.className = 'fallback-pages-stack';

  fallbackPages.forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'fallback-page-item';
    item.setAttribute('data-fallback-page', String(entry.page));

    const label = document.createElement('div');
    label.className = 'fallback-page-label';
    label.textContent = `الصفحة ${entry.page}`;

    const image = document.createElement('img');
    image.className = 'pdf-frame-fallback fallback-page-image';
    image.alt = `صفحة ${entry.page}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = getFallbackImageSrc(entry.page);

    const watermark = document.createElement('div');
    watermark.className = 'pdf-watermark';
    watermark.textContent = 'ملكية: دكتوره نجوي علوان';

    item.appendChild(label);
    item.appendChild(image);
    item.appendChild(watermark);
    fallbackPagesStack.appendChild(item);
  });

  canvasFrame.appendChild(fallbackPagesStack);
  wireFallbackScrollTracking();
}

async function loadFallbackContent() {
  // Pre-rendered pages generated directly from assets/quran1.pdf.
  fallbackPages = Array.from({ length: 241 }, (_, idx) => ({
    page: idx + 1,
    image: `quran-pages/quran-page-${String(idx + 1).padStart(3, '0')}.png`,
    text: ''
  }));
  totalPages = fallbackPages.length;
}

async function ensureSearchIndexLoaded() {
  if (searchIndexData && searchIndexNormalized) return;
  try {
    const response = await fetch('assets/search_index.json');
    const raw = await response.json();
    searchIndexData = raw && typeof raw === 'object' ? raw : {};
    searchIndexNormalized = new Map();

    Object.entries(searchIndexData).forEach(([term, pages]) => {
      const normalizedTerm = normalizeArabicText(term);
      if (!normalizedTerm) return;
      if (!Array.isArray(pages)) return;
      const validPages = pages
        .map((p) => Number(normalizeDigits(p)))
        .filter((p) => Number.isFinite(p) && p >= 1);
      if (!validPages.length) return;

      if (!searchIndexNormalized.has(normalizedTerm)) {
        searchIndexNormalized.set(normalizedTerm, new Set());
      }
      const bag = searchIndexNormalized.get(normalizedTerm);
      validPages.forEach((p) => bag.add(clampPage(p)));
    });
  } catch (error) {
    searchIndexData = {};
    searchIndexNormalized = new Map();
    // eslint-disable-next-line no-console
    console.warn('Failed to load search index:', error?.message || error);
  }
}

function searchPagesBySentence(query, maxResults = 25) {
  if (!searchIndexNormalized || !searchIndexNormalized.size) return [];
  const normalizedQuery = normalizeArabicText(query);
  const terms = tokenizeQuery(query);
  if (!terms.length) return [];

  const scores = new Map();
  const matchedTermsByPage = new Map();

  terms.forEach((term) => {
    const pages = searchIndexNormalized.get(term);
    if (!pages) return;
    pages.forEach((page) => {
      scores.set(page, (scores.get(page) || 0) + 1);
      if (!matchedTermsByPage.has(page)) {
        matchedTermsByPage.set(page, new Set());
      }
      matchedTermsByPage.get(page).add(term);
    });
  });

  const exactPages = searchIndexNormalized.get(normalizedQuery);
  if (exactPages) {
    exactPages.forEach((page) => {
      scores.set(page, (scores.get(page) || 0) + terms.length + 2);
      if (!matchedTermsByPage.has(page)) {
        matchedTermsByPage.set(page, new Set());
      }
      matchedTermsByPage.get(page).add(normalizedQuery);
    });
  }

  return [...scores.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] - b[0];
    })
    .slice(0, maxResults)
    .map(([page, score]) => {
      const matched = [...(matchedTermsByPage.get(page) || [])]
        .slice(0, 5)
        .join(' ، ');
      return {
        page,
        score,
        snippet: matched ? `مطابقات: ${matched}` : `تطابق مع: ${query}`,
        source: 'index'
      };
    });
}

function isDebugMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tocDebug') === '1' || params.get('debug') === '1';
}

function logToc(message, data) {
  if (!isDebugMode()) return;
  // eslint-disable-next-line no-console
  console.log(`[TOC DEBUG] ${message}`, data ?? '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampPage(value) {
  return Math.max(1, Math.min(totalPages, value));
}

function getFallbackIndexEntries() {
  return [
    { title: 'بداية المصحف', page: 1, level: 1 },
    { title: 'الأجزاء الأولى', page: 30, level: 2 },
    { title: 'منتصف المصحف', page: 200, level: 2 },
    { title: 'الأجزاء الأخيرة', page: 450, level: 1 }
  ];
}

function buildPageListEntries() {
  const entries = [];
  for (let page = 1; page <= totalPages; page += 1) {
    entries.push({
      title: `الصفحة ${page}`,
      page,
      level: 1
    });
  }
  return entries;
}

function showTocError(message, details) {
  if (indexList) {
    indexList.innerHTML = `<div class="empty">${message}</div>`;
  }
  if (sectionTitle) {
    sectionTitle.textContent = 'تعذر استخراج الفهرس تلقائياً';
  }
  // eslint-disable-next-line no-console
  console.error('[TOC ERROR]', message, details || '');
}

function renderTocDebug() {
  if (!isDebugMode() || !tocDebugReport || !sidebar) return;

  let panel = sidebar.querySelector('[data-toc-debug-panel]');
  if (!panel) {
    panel = document.createElement('details');
    panel.setAttribute('data-toc-debug-panel', '1');
    panel.style.marginTop = '0.5rem';
    panel.style.border = '1px dashed rgba(199, 164, 90, 0.45)';
    panel.style.borderRadius = '10px';
    panel.style.padding = '0.45rem 0.55rem';
    panel.style.background = 'rgba(7, 12, 9, 0.55)';
    panel.innerHTML = '<summary style="cursor:pointer;color:#e9ddb4;font-weight:700">تشخيص الفهرس</summary><pre data-toc-debug-pre style="white-space:pre-wrap;max-height:220px;overflow:auto;color:#cfd9cf;font-size:0.76rem;margin-top:0.45rem"></pre>';
    sidebar.appendChild(panel);
  }

  const debugPre = panel.querySelector('[data-toc-debug-pre]');
  if (!debugPre) return;

  const sample = tocDebugReport.rawLines.slice(0, 120).join('\n');
  debugPre.textContent = [
    `pages: ${INDEX_START}-${INDEX_END}`,
    `textItems: ${tocDebugReport.totalTextItems}`,
    `lines: ${tocDebugReport.rawLines.length}`,
    `parsed: ${tocDebugReport.parsedEntries.length}`,
    `ocrUsed: ${tocDebugReport.ocrUsed ? 'yes' : 'no'}`,
    `errors: ${(tocDebugReport.errors || []).join(' | ') || 'none'}`,
    '',
    '--- raw extracted text sample ---',
    sample
  ].join('\n');
}

function setPageMeta() {
  if (pageIndicator) {
    pageIndicator.textContent = `${currentPage} / ${totalPages}`;
  }
  if (zoomIndicator) {
    const modeLabel = userZoomOverride ? 'حر' : 'ملء العرض';
    zoomIndicator.textContent = `${modeLabel} ${Math.round(zoom * 100)}%`;
  }
  if (pageInput) {
    pageInput.value = String(currentPage);
    pageInput.max = String(totalPages);
  }
  if (pageTotal) {
    pageTotal.textContent = `/ ${totalPages}`;
  }
  if (quickPageInput) {
    quickPageInput.max = String(totalPages);
    if (!quickPageInput.value || quickPageInput.value === '0') {
      quickPageInput.value = String(currentPage);
    }
  }
}

function openQuickNavPanel() {
  if (!quickNavPanel) return;
  quickNavPanel.hidden = false;
  if (quickPageInput) quickPageInput.value = String(currentPage);
  showControls();
}

function closeQuickNavPanel() {
  if (!quickNavPanel) return;
  quickNavPanel.hidden = true;
}

function jumpFromQuickInput() {
  if (!quickPageInput) return;
  const parsed = Number(normalizeDigits(quickPageInput.value));
  if (!Number.isFinite(parsed)) {
    quickPageInput.value = String(currentPage);
    return;
  }
  const target = clampPage(parsed);
  navigateToPage(target, { reason: 'quick-jump' });
  closeQuickNavPanel();
}

function buildSnippet(text, query) {
  const normalizedText = normalizeDigits(text);
  const normalizedQuery = normalizeDigits(query);
  const idx = normalizedText.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (idx < 0) return text.slice(0, 110);
  const start = Math.max(0, idx - 35);
  const end = Math.min(text.length, idx + query.length + 55);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function renderKeywordResults(results, query) {
  if (!keywordResults) return;
  if (!results.length) {
    keywordResults.innerHTML = '<div class="empty">لا توجد نتائج مطابقة لهذه الكلمة.</div>';
    return;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  keywordResults.innerHTML = results.map((item) => `
    <button class="quick-result-item" type="button" data-result-page="${item.page}">
      <span class="quick-result-page">الصفحة ${item.page}</span>
      <span class="quick-result-snippet">${item.snippet.replace(pattern, '<mark>$1</mark>')}</span>
    </button>
  `).join('');

  keywordResults.querySelectorAll('[data-result-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = Number(button.getAttribute('data-result-page'));
      navigateToPage(target, { reason: 'keyword-search' });
      closeQuickNavPanel();
    });
  });
}

function renderPrimarySearchResults(results, query) {
  if (!primarySearchResults) return;
  if (!results.length) {
    primarySearchResults.innerHTML = '<div class="empty">لا توجد نتائج مطابقة لهذه الكلمة.</div>';
    return;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  primarySearchResults.innerHTML = results.map((item) => `
    <button class="quick-result-item" type="button" data-primary-result-page="${item.page}">
      <span class="quick-result-page">الصفحة ${item.page}${item.source === 'index' ? ' • فهرس' : ''}</span>
      <span class="quick-result-snippet">${String(item.snippet || '').replace(pattern, '<mark>$1</mark>')}</span>
    </button>
  `).join('');

  primarySearchResults.querySelectorAll('[data-primary-result-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = Number(button.getAttribute('data-primary-result-page'));
      navigateToPage(target, { reason: 'primary-search' });
    });
  });
}

async function getPageText(pageNumber) {
  if (pageTextCache.has(pageNumber)) {
    return pageTextCache.get(pageNumber);
  }
  if (!pdfDoc) return '';

  const pageRef = await pdfDoc.getPage(pageNumber);
  const textContent = await pageRef.getTextContent();
  const text = textContent.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
  pageTextCache.set(pageNumber, text);
  return text;
}

async function searchPdfPages(query, maxResults = 25, onProgress = null) {
  const token = ++searchToken;
  const results = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (token !== searchToken) return [];
    // eslint-disable-next-line no-await-in-loop
    const text = await getPageText(page);
    if (normalizeDigits(text).toLowerCase().includes(query.toLowerCase())) {
      results.push({
        page,
        snippet: buildSnippet(text, query),
        source: 'page'
      });
      if (results.length >= maxResults) break;
    }

    if (typeof onProgress === 'function' && page % 20 === 0) {
      onProgress(page);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }
  return results;
}

async function performKeywordSearch() {
  if (!keywordInput || !keywordResults) return;
  const query = normalizeDigits(keywordInput.value.trim());
  if (!query) {
    keywordResults.innerHTML = '<div class="empty">اكتب كلمة للبحث داخل الصفحات.</div>';
    return;
  }

  const pageTarget = extractPageTargetFromQuery(query);
  if (pageTarget !== null) {
    navigateToPage(pageTarget, { reason: 'keyword-search-page-number' });
    keywordResults.innerHTML = `<div class="empty">تم الانتقال إلى الصفحة ${pageTarget}.</div>`;
    closeQuickNavPanel();
    return;
  }

  await ensureSearchIndexLoaded();

  keywordResults.innerHTML = '<div class="empty">جاري البحث داخل الصفحات...</div>';
  let results = searchPagesBySentence(query, 25);
  if (!results.length && fallbackMode && fallbackPages.length) {
    results = fallbackPages
      .filter((entry) => normalizeArabicText(entry.text).includes(normalizeArabicText(query)))
      .slice(0, 25)
      .map((entry) => ({
        page: entry.page,
        snippet: buildSnippet(entry.text || `الصفحة ${entry.page}`, query),
        source: 'page'
      }));
  } else if (!results.length && pdfDoc && !fallbackMode) {
    results = await searchPdfPages(query, 25, (page) => {
      keywordResults.innerHTML = `<div class="empty">جاري البحث... تم فحص ${page} صفحة</div>`;
    });
  }
  renderKeywordResults(results, query);
}

async function performPrimarySearch() {
  if (!indexSearchInput || !primarySearchResults) return;
  const query = normalizeDigits(indexSearchInput.value.trim());

  if (!query) {
    primarySearchResults.innerHTML = '<div class="empty">اكتب كلمة دلالية أو رقم صفحة ثم اضغط بحث.</div>';
    return;
  }

  const pageTarget = extractPageTargetFromQuery(query);
  if (pageTarget !== null) {
    navigateToPage(pageTarget, { reason: 'primary-search-number' });
    primarySearchResults.innerHTML = `<div class="empty">تم الانتقال إلى الصفحة ${pageTarget}.</div>`;
    return;
  }

  const indexMatches = indexEntries
    .filter((entry) => normalizeDigits(entry.title).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12)
    .map((entry) => ({
      page: entry.page,
      snippet: entry.title,
      source: 'index'
    }));

  primarySearchResults.innerHTML = '<div class="empty">جاري البحث داخل الفهرس والصفحات...</div>';
  await ensureSearchIndexLoaded();
  let pageMatches = searchPagesBySentence(query, 20);
  if (!pageMatches.length && fallbackMode && fallbackPages.length) {
    pageMatches = fallbackPages
      .filter((entry) => normalizeArabicText(entry.text).includes(normalizeArabicText(query)))
      .slice(0, 20)
      .map((entry) => ({
        page: entry.page,
        snippet: buildSnippet(entry.text || `الصفحة ${entry.page}`, query),
        source: 'page'
      }));
  } else if (!pageMatches.length && pdfDoc && !fallbackMode) {
    pageMatches = await searchPdfPages(query, 20, (page) => {
      primarySearchResults.innerHTML = `<div class="empty">جاري فحص الصفحات... ${page}</div>`;
    });
  }

  const merged = [];
  const seen = new Set();
  [...indexMatches, ...pageMatches].forEach((item) => {
    if (!item || !item.page) return;
    if (seen.has(item.page)) return;
    seen.add(item.page);
    merged.push(item);
  });

  renderPrimarySearchResults(merged.slice(0, 25), query);
}

function jumpToTypedPage() {
  if (!pageInput) return;
  const parsed = Number(normalizeDigits(pageInput.value));
  if (!Number.isFinite(parsed)) {
    pageInput.value = String(currentPage);
    return;
  }
  const target = clampPage(parsed);
  navigateToPage(target, { reason: 'page-selector' });
}

function getAvailableCanvasWidth() {
  if (!canvasFrame) return 0;
  const style = window.getComputedStyle(canvasFrame);
  const paddingLeft = parseFloat(style.paddingLeft || '0');
  const paddingRight = parseFloat(style.paddingRight || '0');
  const rawWidth = canvasFrame.clientWidth - paddingLeft - paddingRight;
  return Math.max(240, rawWidth - 4);
}

function computeAutoFitScale(pageRef) {
  const baseViewport = pageRef.getViewport({ scale: 1 });
  const availableWidth = getAvailableCanvasWidth();
  if (!availableWidth || !baseViewport.width) {
    return 1;
  }

  const fitScale = availableWidth / baseViewport.width;
  return Math.max(0.6, Math.min(3, fitScale));
}

function getRenderPixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const cinematicBoost = document.body.classList.contains('reading-cinema') || document.fullscreenElement ? 1.35 : 1.1;
  return Math.max(1, Math.min(4, dpr * cinematicBoost));
}

function getLineObjectsFromTextContent(textContent) {
  const sorted = [...textContent.items]
    .filter((item) => item.str && item.str.trim())
    .sort((a, b) => {
      const ay = Math.round(a.transform[5]);
      const by = Math.round(b.transform[5]);
      if (ay !== by) return by - ay;
      return a.transform[4] - b.transform[4];
    });

  const lines = [];
  let current = null;

  sorted.forEach((item) => {
    const x = item.transform[4];
    const y = Math.round(item.transform[5]);
    if (!current || Math.abs(current.y - y) > 3) {
      if (current) lines.push(current);
      current = {
        y,
        minX: x,
        maxX: x,
        parts: [{ x, str: item.str.trim() }]
      };
      return;
    }
    current.minX = Math.min(current.minX, x);
    current.maxX = Math.max(current.maxX, x);
    current.parts.push({ x, str: item.str.trim() });
  });

  if (current) lines.push(current);

  return lines.map((line) => {
    const text = line.parts
      .sort((a, b) => a.x - b.x)
      .map((part) => part.str)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      text,
      minX: line.minX,
      maxX: line.maxX,
      y: line.y
    };
  });
}

function computeHierarchyLevel(title, minX, baselineX) {
  const clean = title.trim();

  // Numbered formats like 1, 1.2, 1.2.3 indicate hierarchy depth.
  const numbered = clean.match(/^(\d+(?:\.\d+){0,4})\s*/);
  if (numbered) {
    const depth = numbered[1].split('.').length;
    return Math.max(1, Math.min(4, depth));
  }

  // Bullet or dash entries are typically sub-items.
  if (/^(?:[-–—•◦▪]|\*)\s+/.test(clean)) {
    return 2;
  }

  // Use indentation as fallback for nested levels.
  const indentDelta = Math.max(0, baselineX - minX);
  const indentLevel = Math.floor(indentDelta / 18);
  return Math.max(1, Math.min(4, 1 + indentLevel));
}

function parseIndexLine(lineObj, baselineX) {
  const normalized = normalizeDigits(lineObj.text)
    .replace(/\u200f|\u200e/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!normalized || normalized.length < 4) return null;
  if (/^(الفهرس|المحتويات|index|contents)$/i.test(normalized)) return null;

  const pageMatch = normalized.match(/(\d{1,3})(?!.*\d)/);
  if (!pageMatch) return null;

  const page = Number(pageMatch[1]);
  if (!Number.isFinite(page) || page < 1 || page > totalPages) return null;

  const title = normalized
    .slice(0, pageMatch.index)
    .replace(/[\.\-–—_·•…:]+$/g, '')
    .trim();

  if (!title || title.length < 2) return null;

  return {
    title,
    page,
    level: computeHierarchyLevel(title, lineObj.minX, baselineX)
  };
}

function parseEntryFromRawText(lineText) {
  return parseIndexLine(
    {
      text: lineText,
      minX: 0,
      maxX: 0,
      y: 0
    },
    0
  );
}

async function tryOcrForToc(pdfDocument, fromPage, toPage) {
  if (!window.Tesseract) {
    return {
      entries: [],
      rawLines: [],
      error: 'لا يتوفر محرك OCR (Tesseract).'
    };
  }

  const entries = [];
  const rawLines = [];
  const seen = new Set();

  for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
    const pageRef = await pdfDocument.getPage(pageNumber);
    const viewport = pageRef.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d');

    await pageRef.render({ canvasContext: context, viewport }).promise;

    // eslint-disable-next-line no-await-in-loop
    const result = await window.Tesseract.recognize(canvas, 'ara+eng');
    const lines = (result?.data?.text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    lines.forEach((line) => {
      rawLines.push(`[OCR p${pageNumber}] ${line}`);
      const entry = parseEntryFromRawText(line);
      if (!entry) return;
      const key = `${entry.title}-${entry.page}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(entry);
    });
  }

  return { entries, rawLines, error: null };
}

async function resolveOutlineDestinationToPage(dest) {
  if (!dest || !pdfDoc) return null;

  try {
    let resolvedDest = dest;

    if (typeof dest === 'string') {
      resolvedDest = await pdfDoc.getDestination(dest);
    }

    if (!Array.isArray(resolvedDest) || !resolvedDest[0]) {
      return null;
    }

    const pageRef = resolvedDest[0];
    const pageIndex = await pdfDoc.getPageIndex(pageRef);
    return pageIndex + 1;
  } catch (error) {
    logToc('Failed to resolve bookmark destination.', { dest, error: error?.message });
    return null;
  }
}

async function flattenOutlineItems(items, level = 1, output = [], seen = new Set()) {
  if (!Array.isArray(items) || !items.length) return output;

  for (const item of items) {
    const title = (item?.title || '').replace(/\s+/g, ' ').trim();
    const page = await resolveOutlineDestinationToPage(item?.dest);

    // Ignore external links and invalid entries for navigation sidebar.
    if (title && Number.isFinite(page)) {
      const key = `${title}-${page}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push({
          title,
          page,
          level: Math.max(1, Math.min(4, level))
        });
      }
    }

    if (Array.isArray(item?.items) && item.items.length) {
      // eslint-disable-next-line no-await-in-loop
      await flattenOutlineItems(item.items, level + 1, output, seen);
    }
  }

  return output;
}

async function buildIndexEntries() {
  tocExtractionWarning = '';

  const errors = [];
  const rawLines = [];
  const outline = await pdfDoc.getOutline();

  if (Array.isArray(outline) && outline.length) {
    const entries = await flattenOutlineItems(outline, 1, []);

    tocDebugReport = {
      totalTextItems: 0,
      rawLines,
      parsedEntries: entries,
      ocrUsed: false,
      errors
    };

    if (entries.length) {
      if (indexCaption) {
        indexCaption.textContent = 'تم البناء من الفهرس الداخلي للملف (Bookmarks)';
      }
      logToc('TOC built from PDF outline.', { entries: entries.length });
      renderTocDebug();
      return entries;
    }

    errors.push('الفهرس الداخلي موجود لكن بدون وجهات صالحة للتنقل.');
  } else {
    errors.push('لا يوجد فهرس داخلي مدمج داخل ملف PDF.');
  }

  tocDebugReport = {
    totalTextItems: 0,
    rawLines,
    parsedEntries: [],
    ocrUsed: false,
    errors
  };

  tocExtractionWarning = 'لا يوجد فهرس داخلي قابل للاستخدام في ملف PDF، تم عرض فهرس احتياطي.';
  if (indexCaption) {
    indexCaption.textContent = 'الفهرس الداخلي غير متاح - عرض فهرس احتياطي';
  }
  logToc('Outline-based TOC unavailable. Using fallback entries.', { errors });
  renderTocDebug();
  return getFallbackIndexEntries();
}

function renderFallbackPage(reason = 'fallback') {
  if (!fallbackPagesStack) return;
  scrollToFallbackPage(currentPage, reason !== 'initial-fallback');
  zoom = 1;
  setPageMeta();

  activeSection = getActiveSectionForPage(currentPage);
  highlightActiveIndex();

  document.dispatchEvent(new CustomEvent('pdf:rendered', {
    detail: { page: currentPage, reason }
  }));
}

function getActiveSectionForPage(pageNumber) {
  if (!indexEntries.length) return null;

  let current = indexEntries[0];
  for (let i = 0; i < indexEntries.length; i += 1) {
    if (indexEntries[i].page <= pageNumber) {
      current = indexEntries[i];
    } else {
      break;
    }
  }
  return current;
}

function flashSectionTitle(title) {
  if (!flash) return;
  const safeTitle = String(title || '').trim() || `الصفحة ${currentPage}`;
  flash.textContent = `تم الانتقال إلى: ${safeTitle}`;
  flash.classList.add('show');
  window.setTimeout(() => flash.classList.remove('show'), 1200);
}

function highlightActiveIndex() {
  const nodes = indexList ? indexList.querySelectorAll('.index-item') : [];
  nodes.forEach((node) => {
    const isActive = Number(node.getAttribute('data-page')) === currentPage;
    node.classList.toggle('is-active', isActive);
  });

  if (sectionTitle) {
    sectionTitle.textContent = activeSection ? activeSection.title : `الصفحة ${currentPage}`;
  }
}

function renderIndex(entries, query = '') {
  if (!indexList) return;
  if (!entries.length) {
    indexList.innerHTML = '<div class="empty">لا توجد نتائج مطابقة في الفهرس.</div>';
    return;
  }

  const pattern = query ? new RegExp(`(${escapeRegExp(query)})`, 'ig') : null;

  const warningBlock = tocExtractionWarning && !query
    ? `<div class="empty" style="margin-bottom:0.5rem">${tocExtractionWarning}</div>`
    : '';

  indexList.innerHTML = warningBlock + entries.map((entry) => {
    const titleMarkup = pattern ? entry.title.replace(pattern, '<mark>$1</mark>') : entry.title;
    const level = entry.level || 1;
    return `
      <button class="index-item level-${level}" data-level="${level}" data-page="${entry.page}" title="${entry.title}">
        <span class="idx-title">${titleMarkup}</span>
        <span class="idx-page">${entry.page}</span>
      </button>
    `;
  }).join('');

  indexList.querySelectorAll('.index-item').forEach((button) => {
    button.addEventListener('click', () => {
      const targetPage = Number(button.getAttribute('data-page'));
      const targetEntry = indexEntries.find((entry) => entry.page === targetPage);

      if (window.innerWidth <= 1100) {
        sidebar.classList.add('is-collapsed');
        schedulePageWidthReflow(220);
      }

      navigateToPage(targetPage, {
        force: true,
        flashTitle: targetEntry ? targetEntry.title : null,
        reason: 'index-click'
      });
    });
  });

  highlightActiveIndex();

  // Structured TOC data for debugging and integration.
  window.__TOC_JSON__ = entries.map((entry) => ({
    title: entry.title,
    page: entry.page,
    level: entry.level || 1
  }));
}

function wireIndexSearch() {
  if (!indexSearchInput) return;
  indexSearchInput.addEventListener('input', () => {
    const query = normalizeDigits(indexSearchInput.value.trim().toLowerCase());
    if (!query) {
      filteredPageListEntries = [...pageListEntries];
      renderIndex(filteredPageListEntries);
      return;
    }

    filteredPageListEntries = pageListEntries.filter((entry) =>
      normalizeDigits(entry.title.toLowerCase()).includes(query)
      || String(entry.page).includes(query)
    );

    renderIndex(filteredPageListEntries, query);
  });

  indexSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      performPrimarySearch();
    }
  });
}

function showControls() {
  if (!controls) return;
  controls.classList.remove('is-hidden');
  if (controlsTimer) window.clearTimeout(controlsTimer);
  controlsTimer = window.setTimeout(() => {
    controls.classList.add('is-hidden');
  }, 2200);
}

function wireControlsVisibility() {
  if (!stage || !controls) return;
  const wake = () => showControls();
  stage.addEventListener('mousemove', wake);
  stage.addEventListener('touchstart', wake, { passive: true });
  controls.addEventListener('mouseenter', wake);
  controls.addEventListener('mouseleave', () => showControls());
  showControls();
}

async function renderCurrentPage(reason = 'navigation') {
  if (fallbackMode) {
    renderFallbackPage(reason);
    return;
  }

  if (!pdfDoc || !pdfCanvas) return;

  const pageRef = await pdfDoc.getPage(currentPage);
  if (!userZoomOverride) {
    zoom = computeAutoFitScale(pageRef);
  }
  const viewport = pageRef.getViewport({ scale: zoom });
  const ratio = getRenderPixelRatio();
  const context = pdfCanvas.getContext('2d');

  pdfCanvas.width = Math.floor(viewport.width * ratio);
  pdfCanvas.height = Math.floor(viewport.height * ratio);
  pdfCanvas.style.width = `${Math.floor(viewport.width)}px`;
  pdfCanvas.style.height = `${Math.floor(viewport.height)}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  if (renderTask) {
    try {
      renderTask.cancel();
    } catch (error) {
      // Ignore canceled render task errors.
    }
  }

  renderTask = pageRef.render({ canvasContext: context, viewport });
  await renderTask.promise;
  setPageMeta();

  activeSection = getActiveSectionForPage(currentPage);
  highlightActiveIndex();

  document.dispatchEvent(new CustomEvent('pdf:rendered', {
    detail: { page: currentPage, reason }
  }));
}

async function navigateToPage(targetPage, options = {}) {
  const resolvedPage = clampPage(targetPage);
  if (resolvedPage === currentPage && !options.force) return;

  currentPage = resolvedPage;
  pendingPostRenderScale = !userZoomOverride;
  if (canvasFrame) {
    canvasFrame.classList.add('is-transitioning');
  }

  await renderCurrentPage(options.reason || 'navigation');

  if (canvasFrame) {
    window.requestAnimationFrame(() => {
      canvasFrame.classList.remove('is-transitioning');
    });
  }

  if (options.flashTitle) {
    flashSectionTitle(options.flashTitle);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('page', String(currentPage));
  window.history.replaceState({}, '', url.toString());

  // Re-apply page-width after any layout transition (sidebar collapse/expand, meta updates).
  if (navScaleTimer) {
    window.clearTimeout(navScaleTimer);
  }
  navScaleTimer = window.setTimeout(() => {
    pendingPostRenderScale = !userZoomOverride;
    renderCurrentPage('layout-reflow');
  }, 180);
}

async function adjustZoom(delta) {
  const next = Math.max(0.5, Math.min(4, zoom + delta));
  if (Math.abs(next - zoom) < 0.001) return;
  zoom = next;
  userZoomOverride = true;
  await renderCurrentPage('manual-zoom');
}

function wireAutoResize() {
  const rerender = () => {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      renderCurrentPage();
    }, 120);
  };

  window.addEventListener('resize', rerender, { passive: true });
  window.addEventListener('orientationchange', rerender, { passive: true });
}

function schedulePageWidthReflow(delay = 180) {
  if (navScaleTimer) {
    window.clearTimeout(navScaleTimer);
  }
  navScaleTimer = window.setTimeout(() => {
    pendingPostRenderScale = !userZoomOverride;
    renderCurrentPage('layout-reflow');
  }, delay);
}

async function enforcePageWidthAfterRender() {
  if (fallbackMode || !pdfDoc || isApplyingPostRenderScale) return;
  if (userZoomOverride) return;

  const pageRef = await pdfDoc.getPage(currentPage);
  const fitScale = computeAutoFitScale(pageRef);

  if (Math.abs(fitScale - zoom) < 0.01) return;

  isApplyingPostRenderScale = true;
  zoom = fitScale;
  await renderCurrentPage('post-render-scale');
  isApplyingPostRenderScale = false;
}

function wireRenderEvents() {
  document.addEventListener('pdf:rendered', (event) => {
    if (!pendingPostRenderScale) return;
    if (event.detail?.reason === 'post-render-scale') return;

    pendingPostRenderScale = false;

    // Ensure final layout settles, then enforce page-width.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        enforcePageWidthAfterRender();
      });
    });
  });
}

function wireFreePanAndZoom() {
  if (!canvasFrame) return;

  const activateCinema = () => {
    document.body.classList.add('reading-cinema');
    schedulePageWidthReflow(60);
  };

  const deactivateCinema = () => {
    document.body.classList.remove('reading-cinema');
    schedulePageWidthReflow(60);
  };

  canvasFrame.addEventListener('click', activateCinema);
  canvasFrame.addEventListener('touchstart', activateCinema, { passive: true });

  canvasFrame.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    activateCinema();
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    adjustZoom(delta);
  }, { passive: false });

  canvasFrame.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    activateCinema();
    isPanning = true;
    canvasFrame.classList.add('is-panning');
    panStartX = event.clientX;
    panStartY = event.clientY;
    panScrollLeft = canvasFrame.scrollLeft;
    panScrollTop = canvasFrame.scrollTop;
  });

  window.addEventListener('mousemove', (event) => {
    if (!isPanning) return;
    const dx = event.clientX - panStartX;
    const dy = event.clientY - panStartY;
    canvasFrame.scrollLeft = panScrollLeft - dx;
    canvasFrame.scrollTop = panScrollTop - dy;
  });

  const stopPan = () => {
    if (!isPanning) return;
    isPanning = false;
    canvasFrame.classList.remove('is-panning');
  };

  window.addEventListener('mouseup', stopPan);
  canvasFrame.addEventListener('mouseleave', stopPan);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      deactivateCinema();
    }
  });
}

async function initFallbackViewer(reason) {
  fallbackMode = true;

  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }

  await loadFallbackContent();
  currentPage = clampPage(currentPage);

  if (canvasFrame) {
    renderFallbackPagesStack();
  }

  indexEntries = getFallbackIndexEntries();
  pageListEntries = buildPageListEntries();
  filteredPageListEntries = [...pageListEntries];
  renderIndex(filteredPageListEntries);
  if (indexCaption) {
    indexCaption.textContent = `عرض الصفحات المتاحة بالتسلسل (${totalPages} صفحة)`;
  }
  wireIndexSearch();
  wireSidebarToggle();
  wireNavigation();
  wireControlsVisibility();
  wireAutoResize();

  if (sectionTitle) {
    sectionTitle.textContent = (reason === 'forced-image' || reason === 'file')
      ? 'عرض الصفحات داخل العارض'
      : 'وضع احتياطي: عرض الصفحات بدون تنزيل إجباري';
  }

  tocExtractionWarning = reason !== 'file'
    ? 'تعذر تشغيل PDF.js، وتم تفعيل وضع احتياطي للفهرس.'
    : '';

  wireRenderEvents();
  navigateToPage(currentPage, { force: true, reason: 'initial-fallback' });
}

function wireSidebarToggle() {
  if (!sidebar || !sidebarToggles.length) return;
  sidebarToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('is-collapsed');
      schedulePageWidthReflow(220);
    });
  });
}

function wireNavigation() {
  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigateToPage(currentPage + 1, { reason: 'next-page' }));
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigateToPage(currentPage - 1, { reason: 'prev-page' }));
  }
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => adjustZoom(0.12));
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => adjustZoom(-0.12));
  }
  const triggerCompressedDownload = async () => {
    const resolvedUrl = new URL(DOWNLOAD_PATH, window.location.href).toString();
    const fileName = DOWNLOAD_PATH.split('/').pop() || 'book.pdf';

    // Some browsers (especially mobile) are picky with download attribute.
    // Verify URL and fallback to direct open if needed.
    try {
      const probe = await fetch(resolvedUrl, { method: 'HEAD' });
      if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
    } catch (error) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  if (downloadBtn) downloadBtn.addEventListener('click', () => { triggerCompressedDownload(); });
  if (topDownloadBtn) topDownloadBtn.addEventListener('click', () => { triggerCompressedDownload(); });
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', async () => {
      const root = document.querySelector('[data-cinematic-root]');
      if (!document.fullscreenElement) {
        document.body.classList.add('reading-cinema');
        await root.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    });
  }

  if (pageGoBtn) {
    pageGoBtn.addEventListener('click', jumpToTypedPage);
  }

  if (pageInput) {
    pageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        jumpToTypedPage();
      }
    });

    pageInput.addEventListener('blur', () => {
      if (!pageInput.value.trim()) {
        pageInput.value = String(currentPage);
      }
    });
  }

  if (quickNavToggle) {
    quickNavToggle.addEventListener('click', () => {
      if (quickNavPanel && !quickNavPanel.hidden) {
        closeQuickNavPanel();
      } else {
        openQuickNavPanel();
      }
    });
  }

  if (quickNavClose) {
    quickNavClose.addEventListener('click', closeQuickNavPanel);
  }

  if (quickPageGo) {
    quickPageGo.addEventListener('click', jumpFromQuickInput);
  }

  if (quickPageInput) {
    quickPageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        jumpFromQuickInput();
      }
    });
  }

  if (keywordSearchBtn) {
    keywordSearchBtn.addEventListener('click', performKeywordSearch);
  }

  if (keywordInput) {
    keywordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        performKeywordSearch();
      }
    });
  }

  if (primarySearchBtn) {
    primarySearchBtn.addEventListener('click', performPrimarySearch);
  }

  document.addEventListener('fullscreenchange', () => {
    document.body.classList.toggle('is-fullscreen', !!document.fullscreenElement);

    // Fullscreen always enters cinematic view; exiting fullscreen resets it.
    if (document.fullscreenElement) {
      document.body.classList.add('reading-cinema');
    } else {
      document.body.classList.remove('reading-cinema');
    }

    showControls();
    schedulePageWidthReflow(120);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (document.body.classList.contains('rtl')) {
        navigateToPage(currentPage + 1, { reason: 'keyboard' });
      } else {
        navigateToPage(currentPage - 1, { reason: 'keyboard' });
      }
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (document.body.classList.contains('rtl')) {
        navigateToPage(currentPage - 1, { reason: 'keyboard' });
      } else {
        navigateToPage(currentPage + 1, { reason: 'keyboard' });
      }
    }
  });
}

async function initViewer() {
  if (!pdfCanvas) return;
  await ensureSearchIndexLoaded();

  // Stable mode: force in-app page rendering via images to avoid browser PDF download behavior.
  if (FORCE_IMAGE_VIEW) {
    await initFallbackViewer('forced-image');
    return;
  }

  if (window.location.protocol === 'file:') {
    await initFallbackViewer('file');
    return;
  }

  if (!window.pdfjsLib) {
    await initFallbackViewer('no-pdfjs');
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';

  try {
    const loadingTask = window.pdfjsLib.getDocument({
      url: PDF_PATH,
      disableStream: true,
      disableAutoFetch: true,
      disableRange: true
    });
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages || totalPages;
    currentPage = clampPage(currentPage);

    indexEntries = await buildIndexEntries();
    pageListEntries = buildPageListEntries();
    filteredPageListEntries = [...pageListEntries];
    renderIndex(filteredPageListEntries);
    if (indexCaption) {
      indexCaption.textContent = 'عرض جميع الصفحات بالتسلسل';
    }
    wireIndexSearch();
    wireSidebarToggle();
    wireNavigation();
    wireControlsVisibility();
    wireAutoResize();
    wireRenderEvents();
    wireFreePanAndZoom();

    await navigateToPage(currentPage, { force: true, reason: 'initial-load' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Viewer initialization failed, switching to safe fallback:', error);
    await initFallbackViewer('pdf-load-failed');
  }
}

initViewer();