const pdfCanvas = document.querySelector('[data-pdf-canvas]');
const canvasFrame = document.querySelector('[data-canvas-frame]');
const canvasViewport = document.querySelector('[data-canvas-viewport]');
const annotationLayer = document.querySelector('[data-annotation-layer]');
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
const searchDock = document.querySelector('[data-search-dock]');
const readerToolbar = document.querySelector('[data-reader-toolbar]');
const simulatorToolbar = document.querySelector('[data-simulator-toolbar]');
const simulatorPageIndicator = document.querySelector('[data-simulator-page-indicator]');
const floatingPageLabel = document.querySelector('[data-floating-page]');
const pdfStageCloseBtn = document.querySelector('.pdf-stage-close');

const prevBtn = document.querySelector('[data-prev-page]');
const nextBtn = document.querySelector('[data-next-page]');
const zoomInBtn = document.querySelector('[data-zoom-in]');
const zoomOutBtn = document.querySelector('[data-zoom-out]');
const fullscreenBtn = document.querySelector('[data-fullscreen]');

const VIEWER_MODE = new URLSearchParams(window.location.search).get('viewer');

function resolvePdfPath() {
  const docParam = new URLSearchParams(window.location.search).get('doc');
  if (!docParam) return 'assets/quran1.pdf';
  const safeName = docParam.replace(/[/\\]/g, '').replace(/\.pdf$/i, '');
  return `assets/${safeName}.pdf`;
}

const PDF_PATH = resolvePdfPath();
const PDF_DOC_NAME = (() => {
  const docParam = new URLSearchParams(window.location.search).get('doc') || 'quran1.pdf';
  const safeName = docParam.replace(/[/\\]/g, '').replace(/\.pdf$/i, '');
  return `${safeName}.pdf`;
})();
const PDF_DOWNLOAD_URL = `/api/pdf-download?doc=${encodeURIComponent(PDF_DOC_NAME)}`;
const PDF_INDEXED_DOWNLOAD_URL = `/api/pdf-indexed?doc=${encodeURIComponent(PDF_DOC_NAME)}`;
const DOWNLOAD_PATH = PDF_DOWNLOAD_URL;
const PDF_LOAD_PATH = `api/pdf?doc=${encodeURIComponent(PDF_DOC_NAME)}`;
const PDF_CHUNK_SIZE = 1024 * 1024;
const FORCE_IMAGE_VIEW = VIEWER_MODE !== 'pdfjs' && VIEWER_MODE !== 'native';
// PDF.js renders reliably in-page; native embed only via ?viewer=native.
const USE_NATIVE_PDF_IFRAME = VIEWER_MODE === 'native';
const USE_PDFJS_VIEWER = VIEWER_MODE === 'pdfjs';
const LOCAL_PDFJS_WORKER = 'assets/vendor/pdfjs/pdf.worker.min.mjs';
const FALLBACK_PAGE_WIDTH = 699;
const FALLBACK_PAGE_HEIGHT = 987;

function configurePdfJsWorker() {
  if (!window.pdfjsLib) return false;
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      LOCAL_PDFJS_WORKER,
      window.location.href
    ).href;
  }
  return true;
}

async function openPdfDocument(onProgress) {
  configurePdfJsWorker();

  const bytes = await loadPdfBytes((progress) => {
    if (!progress.total || !onProgress) return;
    onProgress((progress.loaded / progress.total) * 100);
  });

  if (onProgress) {
    onProgress(100);
  }

  return await window.pdfjsLib.getDocument({ data: bytes }).promise;
}

function createPdfLoadingTask(source) {
  if (!configurePdfJsWorker()) {
    throw new Error('PDF.js library not loaded');
  }

  if (source instanceof Uint8Array) {
    return window.pdfjsLib.getDocument({ data: source });
  }

  return window.pdfjsLib.getDocument({
    url: PDF_PATH,
    disableRange: true,
    disableStream: true
  });
}

let cachedPdfBytes = null;

function xhrGetArrayBuffer(url, onProgress, expectedLength = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress({
        loaded: event.loaded,
        total: event.total || expectedLength || event.loaded
      });
    };

    xhr.onload = () => {
      const buffer = xhr.response;
      const status = xhr.status;

      if (!buffer || !buffer.byteLength) {
        reject(new Error(`تعذر تحميل PDF (HTTP ${status}, جسم فارغ)`));
        return;
      }

      if (status !== 200 && status !== 206) {
        reject(new Error(`تعذر تحميل PDF (HTTP ${status})`));
        return;
      }

      if (expectedLength !== null && buffer.byteLength !== expectedLength) {
        reject(new Error(`حجم غير مكتمل: ${buffer.byteLength} من ${expectedLength}`));
        return;
      }

      resolve(buffer);
    };

    xhr.onerror = () => reject(new Error('فشل اتصال تحميل PDF'));
    xhr.onabort = () => reject(new Error('تم إلغاء تحميل PDF'));
    xhr.send();
  });
}

async function fetchPdfMeta() {
  const response = await fetch(`api/pdf-meta?doc=${encodeURIComponent(PDF_DOC_NAME)}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`تعذر قراءة معلومات PDF (HTTP ${response.status})`);
  }

  const meta = await response.json();
  const size = Number(meta.size);

  if (!Number.isFinite(size) || size < 1024) {
    throw new Error('ملف PDF غير صالح');
  }

  return size;
}

function validatePdfBytes(bytes, expectedSize = null) {
  if (!bytes || bytes.byteLength < 1024) {
    throw new Error('ملف PDF فارغ أو تالف');
  }

  if (expectedSize !== null && bytes.byteLength !== expectedSize) {
    throw new Error(`حجم PDF غير مطابق: ${bytes.byteLength}/${expectedSize}`);
  }

  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (header !== '%PDF') {
    throw new Error('ملف PDF تالف (ترويسة غير صالحة)');
  }

  const tail = new TextDecoder().decode(bytes.slice(Math.max(0, bytes.byteLength - 2048)));
  if (!tail.includes('%%EOF')) {
    throw new Error('ملف PDF تالف (الملف غير مكتمل)');
  }

  return bytes;
}

async function loadPdfBytesWhole(onProgress) {
  const size = await fetchPdfMeta();
  const response = await fetch(PDF_LOAD_PATH, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`تعذر تحميل PDF (HTTP ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  if (!buffer || !buffer.byteLength) {
    throw new Error(`تعذر تحميل PDF (HTTP ${response.status}, جسم فارغ)`);
  }

  if (onProgress) {
    onProgress({ loaded: buffer.byteLength, total: size });
  }

  return validatePdfBytes(new Uint8Array(buffer), size);
}

async function loadPdfBytesChunked(onProgress) {
  const size = await fetchPdfMeta();
  const merged = new Uint8Array(size);
  let loaded = 0;

  for (let offset = 0; offset < size; offset += PDF_CHUNK_SIZE) {
    const length = Math.min(PDF_CHUNK_SIZE, size - offset);
    const buffer = await xhrGetArrayBuffer(
      `api/pdf-chunk?doc=${encodeURIComponent(PDF_DOC_NAME)}&offset=${offset}&length=${length}`,
      null,
      length
    );

    merged.set(new Uint8Array(buffer), offset);
    loaded += buffer.byteLength;

    if (onProgress) {
      onProgress({ loaded, total: size });
    }
  }

  return validatePdfBytes(merged, size);
}

async function loadPdfBytes(onProgress, attempt = 0) {
  if (cachedPdfBytes) {
    try {
      validatePdfBytes(cachedPdfBytes);
      if (onProgress) {
        onProgress({ loaded: cachedPdfBytes.length, total: cachedPdfBytes.length });
      }
      return cachedPdfBytes;
    } catch (error) {
      cachedPdfBytes = null;
      // eslint-disable-next-line no-console
      console.warn('[PDF] Cached bytes invalid, reloading.', error?.message || error);
    }
  }

  const loaders = [loadPdfBytesChunked, loadPdfBytesWhole];
  let lastError = null;

  for (const loader of loaders) {
    try {
      const bytes = await loader(onProgress);
      cachedPdfBytes = bytes;
      return bytes;
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.warn(`[PDF] ${loader.name} failed.`, error?.message || error);
    }
  }

  if (attempt < 2) {
    cachedPdfBytes = null;
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    return loadPdfBytes(onProgress, attempt + 1);
  }

  throw lastError || new Error('تعذر تحميل PDF بعد عدة محاولات');
}

async function waitForLayoutReady() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (canvasFrame) {
    canvasFrame.getBoundingClientRect();
  }
}
const INDEX_START = 2;
const INDEX_END = 9;

let pdfDoc = null;
let renderTask = null;
let currentPage = Number(new URLSearchParams(window.location.search).get('page') || 1);
let totalPages = 241;
let zoom = 1;
let indexEntries = [];
let pageListEntries = [];
let filteredIndexEntries = [];
let activeSection = null;
let controlsTimer = null;
let fallbackMode = false;
let fallbackIframe = null;
let nativePdfViewer = null;
let fallbackPagesStack = null;
let fallbackObserver = null;
let fallbackSyncLocked = false;
let indexPageImageEl = null;
let indexPageImageWrap = null;
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
let indexClickZonesByPage = new Map();
let fullPdfStack = null;
let fullPdfObserver = null;
let fullPdfSyncLocked = false;
let pageRenderCache = new Map();
let stackRenderToken = 0;
let stackScrollTimer = null;
let stackRenderWorkerRunning = false;
let pdfEmbedEl = null;
let useContinuousEmbed = false;
let useSinglePageMode = false;
let wheelNavLocked = false;
const STACK_RENDER_MARGIN_PX = 1400;

function clearPdfStackMode() {
  if (fullPdfStack?.parentNode) {
    fullPdfStack.parentNode.removeChild(fullPdfStack);
  }
  fullPdfStack = null;

  if (canvasFrame) {
    canvasFrame.classList.remove('full-pdf-scroll-mode', 'fallback-scroll-mode');
    canvasFrame.querySelectorAll('.full-pdf-pages-stack, .pdf-full-embed').forEach((node) => node.remove());
  }

  pdfEmbedEl = null;
  nativePdfViewer = null;
  fallbackIframe = null;

  if (stage) {
    stage.classList.remove('has-full-scroll');
    stage.classList.add('has-single-page');
  }
}

function updateSideNavState() {
  const sideNav = document.querySelector('[data-pdf-side-nav]');
  if (!sideNav) return;

  const prevButtons = sideNav.querySelectorAll('[data-side-prev]');
  const nextButtons = sideNav.querySelectorAll('[data-side-next]');
  const pageLabel = sideNav.querySelector('[data-side-page-label]');
  const pageTotalLabel = sideNav.querySelector('[data-side-page-total]');

  prevButtons.forEach((button) => {
    button.disabled = currentPage <= 1;
  });
  nextButtons.forEach((button) => {
    button.disabled = currentPage >= totalPages;
  });

  if (pageLabel) {
    pageLabel.textContent = String(currentPage);
  }
  if (pageTotalLabel) {
    pageTotalLabel.textContent = `/ ${totalPages}`;
  }

  sideNav.hidden = !pdfDoc && !fallbackMode;
}

function wirePdfSideNav() {
  const sideNav = document.querySelector('[data-pdf-side-nav]');
  if (!sideNav || sideNav.dataset.wired === '1') return;
  sideNav.dataset.wired = '1';

  sideNav.querySelectorAll('[data-side-prev]').forEach((button) => {
    button.addEventListener('click', () => navigateToPage(currentPage - 1, { reason: 'side-prev' }));
  });
  sideNav.querySelectorAll('[data-side-next]').forEach((button) => {
    button.addEventListener('click', () => navigateToPage(currentPage + 1, { reason: 'side-next' }));
  });
}

function wirePdfWheelNavigation() {
  const root = stage || canvasFrame;
  if (!root || root.dataset.wheelNavWired === '1') return;
  root.dataset.wheelNavWired = '1';

  root.addEventListener('wheel', (event) => {
    if (!useSinglePageMode || !pdfDoc || fallbackMode) return;
    if (event.ctrlKey) return;
    if (wheelNavLocked) return;

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 8) return;

    event.preventDefault();
    wheelNavLocked = true;
    window.setTimeout(() => {
      wheelNavLocked = false;
    }, 280);

    if (delta > 0 && currentPage < totalPages) {
      navigateToPage(currentPage + 1, { reason: 'wheel-next' });
      return;
    }
    if (delta < 0 && currentPage > 1) {
      navigateToPage(currentPage - 1, { reason: 'wheel-prev' });
    }
  }, { passive: false });
}

async function renderSinglePdfPage(reason = 'navigation') {
  if (!pdfDoc || !pdfCanvas || !canvasViewport) return;

  clearIndexPageImage();

  if (renderTask) {
    try {
      renderTask.cancel();
    } catch (error) {
      // Ignore stale render cancellation errors.
    }
    renderTask = null;
  }

  const pageRef = await pdfDoc.getPage(currentPage);
  if (
    !userZoomOverride
    || reason === 'layout-reflow'
    || reason === 'post-render-scale'
    || reason === 'initial-load'
    || reason === 'manual-zoom'
  ) {
    if (!userZoomOverride || reason !== 'manual-zoom') {
      zoom = computeAutoFitScale(pageRef);
    }
  }

  const viewport = pageRef.getViewport({ scale: zoom });
  const ratio = getRenderPixelRatio();
  const context = pdfCanvas.getContext('2d');

  pdfCanvas.width = Math.floor(viewport.width * ratio);
  pdfCanvas.height = Math.floor(viewport.height * ratio);
  pdfCanvas.style.width = `${Math.floor(viewport.width)}px`;
  pdfCanvas.style.height = `${Math.floor(viewport.height)}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

  canvasViewport.style.display = '';
  pdfCanvas.style.display = 'block';
  canvasViewport.classList.remove('is-loading');

  if (annotationLayer) {
    annotationLayer.innerHTML = '';
    annotationLayer.style.width = `${Math.floor(viewport.width)}px`;
    annotationLayer.style.height = `${Math.floor(viewport.height)}px`;
  }

  renderTask = pageRef.render({ canvasContext: context, viewport });
  await renderTask.promise;
  renderTask = null;

  await renderLinkAnnotations(pageRef, viewport, annotationLayer, currentPage);

  if (stage) {
    stage.classList.add('has-pdf', 'has-single-page');
    stage.classList.remove('has-full-scroll');
  }

  setPageMeta();
  updateSideNavState();
  revealPdfChrome();

  activeSection = getActiveSectionForPage(currentPage);
  highlightActiveIndex();

  document.dispatchEvent(new CustomEvent('pdf:rendered', {
    detail: { page: currentPage, reason: `single-page-${reason}` }
  }));
}

function getPdfScrollRoot() {
  if (stage?.classList.contains('has-full-scroll')) {
    return stage;
  }
  return canvasFrame;
}

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

function getPrerenderedPageImageSrc(pageNumber) {
  const safePage = Math.max(1, Math.min(totalPages, Number(pageNumber) || 1));
  return `assets/images/quran-pages-jpg/quran-page-${String(safePage).padStart(3, '0')}.jpg`;
}

function getFallbackImageSrc(pageNumber) {
  const entry = fallbackPages.find((item) => item.page === pageNumber);
  if (entry?.image) {
    return `assets/images/${entry.image}`;
  }
  return getPrerenderedPageImageSrc(pageNumber);
}

function isTocImagePage(pageNumber) {
  return pageNumber >= INDEX_START && pageNumber <= INDEX_END;
}

function getFallbackPageNode(pageNumber) {
  if (!fallbackPagesStack) return null;
  return fallbackPagesStack.querySelector(`[data-fallback-page="${pageNumber}"]`);
}

function scrollToFallbackPage(pageNumber, smooth = true) {
  const node = getFallbackPageNode(pageNumber);
  if (!node) return;
  const image = node.querySelector('.fallback-page-image');
  if (image) {
    image.loading = 'eager';
    image.fetchPriority = 'high';
  }
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

function scrollToStackPage(pageNumber, smooth = true) {
  const node = document.getElementById(`pdf-stack-page-${clampPage(pageNumber)}`);
  if (!node) return;
  const scrollRoot = getPdfScrollRoot();
  fullPdfSyncLocked = true;

  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetTop = scrollRoot.scrollTop + (nodeRect.top - rootRect.top) - 8;
    scrollRoot.scrollTo({
      top: Math.max(0, targetTop),
      behavior: smooth ? 'smooth' : 'auto'
    });
  } else {
    node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  window.setTimeout(() => {
    fullPdfSyncLocked = false;
  }, smooth ? 420 : 80);
}

function invalidateStackRenderCache() {
  pageRenderCache.clear();
  stackRenderToken += 1;
  if (!fullPdfStack) return;
  fullPdfStack.querySelectorAll('.full-pdf-page-viewport').forEach((viewport) => {
    viewport.innerHTML = '';
    delete viewport.dataset.rendered;
  });
}

function wireFullPdfScrollTracking() {
  if (!canvasFrame || !fullPdfStack) return;
  if (fullPdfObserver) {
    fullPdfObserver.disconnect();
  }

  fullPdfObserver = new IntersectionObserver((entries) => {
    if (fullPdfSyncLocked) return;
    let best = null;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      if (!best || entry.intersectionRatio > best.intersectionRatio) {
        best = entry;
      }
    });
    if (!best) return;
    const page = Number(best.target.getAttribute('data-pdf-stack-page'));
    if (!Number.isFinite(page) || page === currentPage) return;

    currentPage = clampPage(page);
    setPageMeta();
    activeSection = getActiveSectionForPage(currentPage);
    highlightActiveIndex();
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(currentPage));
    window.history.replaceState({}, '', url.toString());
  }, {
    root: getPdfScrollRoot(),
    threshold: [0.45, 0.6, 0.75]
  });

  fullPdfStack.querySelectorAll('[data-pdf-stack-page]').forEach((node) => {
    fullPdfObserver.observe(node);
  });
}

function wireStackScrollRendering() {
  const scrollRoot = getPdfScrollRoot();
  if (!scrollRoot || scrollRoot.dataset.stackScrollWired === '1') return;
  scrollRoot.dataset.stackScrollWired = '1';
  scrollRoot.addEventListener('scroll', () => {
    if (stackScrollTimer) {
      window.clearTimeout(stackScrollTimer);
    }
    stackScrollTimer = window.setTimeout(() => {
      renderVisibleStackPages();
    }, 100);
  }, { passive: true });
}

function getStackRenderPixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.min(2, dpr));
}

async function renderStackPagesBatch(pageNumbers, concurrency = 3) {
  const pages = [...new Set(pageNumbers.map((page) => clampPage(page)))].sort((a, b) => a - b);
  let cursor = 0;

  async function worker() {
    while (cursor < pages.length) {
      const index = cursor;
      cursor += 1;
      await renderStackPageContent(pages[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, pages.length) }, () => worker());
  await Promise.all(workers);
}

function mountFullPdfStackSkeleton(slotHeight = 720) {
  if (!canvasFrame || fullPdfStack?.isConnected) return;

  if (canvasViewport) canvasViewport.style.display = 'none';
  if (indexPageImageWrap) indexPageImageWrap.style.display = 'none';
  if (pdfCanvas) pdfCanvas.style.display = 'none';

  canvasFrame.classList.add('full-pdf-scroll-mode');
  canvasFrame.querySelectorAll('.full-pdf-pages-stack, .pdf-full-embed').forEach((node) => node.remove());
  pdfEmbedEl = null;
  nativePdfViewer = null;
  fallbackIframe = null;

  fullPdfStack = document.createElement('div');
  fullPdfStack.className = 'full-pdf-pages-stack';
  fullPdfStack.setAttribute('data-full-pdf-stack', '1');

  for (let page = 1; page <= totalPages; page += 1) {
    const item = document.createElement('article');
    item.className = 'full-pdf-page-item';
    item.id = `pdf-stack-page-${page}`;
    item.setAttribute('data-pdf-stack-page', String(page));

    const label = document.createElement('div');
    label.className = 'full-pdf-page-label';
    label.textContent = `الصفحة ${page}`;

    const viewportWrap = document.createElement('div');
    viewportWrap.className = 'full-pdf-page-viewport';
    viewportWrap.style.minHeight = `${slotHeight}px`;

    item.appendChild(label);
    item.appendChild(viewportWrap);
    fullPdfStack.appendChild(item);
  }

  canvasFrame.appendChild(fullPdfStack);
  if (stage) {
    stage.classList.remove('has-single-page');
    stage.classList.add('has-pdf', 'has-full-scroll');
  }
  const sideNav = document.querySelector('[data-pdf-side-nav]');
  if (sideNav) sideNav.hidden = true;
  revealPdfChrome();
  wireFullPdfScrollTracking();
  wireStackScrollRendering();
  scrollToStackPage(currentPage, false);
}

async function renderStackPageContent(pageNumber) {
  if (!pdfDoc || !fullPdfStack) return;

  const pageNum = clampPage(pageNumber);
  const item = document.getElementById(`pdf-stack-page-${pageNum}`);
  const viewportWrap = item?.querySelector('.full-pdf-page-viewport');
  if (!viewportWrap) return;

  const scale = userZoomOverride ? zoom : null;
  const cacheKey = `${pageNum}:${scale ?? 'auto'}:${canvasFrame?.clientWidth || 0}`;
  if (viewportWrap.dataset.rendered === cacheKey) return;
  if (viewportWrap.dataset.rendering === '1') return;

  viewportWrap.dataset.rendering = '1';
  viewportWrap.innerHTML = '';

  try {
    const pageRef = await pdfDoc.getPage(pageNum);
    const pageScale = scale ?? computeAutoFitScale(pageRef);
    const viewport = pageRef.getViewport({ scale: pageScale });
    const ratio = getStackRenderPixelRatio();

    const pageShell = document.createElement('div');
    pageShell.className = 'full-pdf-page-shell';
    pageShell.style.width = `${Math.floor(viewport.width)}px`;
    pageShell.style.height = `${Math.floor(viewport.height)}px`;

    const offscreen = document.createElement('canvas');
    const context = offscreen.getContext('2d');
    offscreen.width = Math.floor(viewport.width * ratio);
    offscreen.height = Math.floor(viewport.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    await pageRef.render({ canvasContext: context, viewport }).promise;

    const img = document.createElement('img');
    img.className = 'full-pdf-page-image';
    img.alt = `صفحة ${pageNum}`;
    img.width = Math.floor(viewport.width);
    img.height = Math.floor(viewport.height);
    img.decoding = 'async';
    img.loading = pageNum <= 3 ? 'eager' : 'lazy';
    img.src = offscreen.toDataURL('image/jpeg', 0.9);

    const layer = document.createElement('div');
    layer.className = 'annotation-layer stack-annotation-layer';
    layer.setAttribute('aria-hidden', 'true');

    pageShell.appendChild(img);
    pageShell.appendChild(layer);
    viewportWrap.appendChild(pageShell);
    viewportWrap.style.minHeight = `${Math.floor(viewport.height)}px`;

    await renderLinkAnnotations(pageRef, viewport, layer, pageNum);
    viewportWrap.dataset.rendered = cacheKey;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[PDF] Failed to render page ${pageNum}.`, error?.message || error);
    viewportWrap.innerHTML = `<div class="full-pdf-page-error">تعذر عرض الصفحة ${pageNum}</div>`;
  } finally {
    delete viewportWrap.dataset.rendering;
  }
}

async function estimateStackPageHeight() {
  if (!pdfDoc) return 720;
  try {
    const pageRef = await pdfDoc.getPage(1);
    const viewport = pageRef.getViewport({ scale: computeAutoFitScale(pageRef) });
    return Math.max(480, Math.ceil(viewport.height));
  } catch (error) {
    return 720;
  }
}

async function renderVisibleStackPages() {
  if (!fullPdfStack || !pdfDoc) return;

  const token = stackRenderToken;
  const scrollRoot = getPdfScrollRoot();
  if (!scrollRoot) return;
  const frameRect = scrollRoot.getBoundingClientRect();
  const pagesToRender = new Set();

  fullPdfStack.querySelectorAll('[data-pdf-stack-page]').forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.bottom >= frameRect.top - STACK_RENDER_MARGIN_PX && rect.top <= frameRect.bottom + STACK_RENDER_MARGIN_PX) {
      pagesToRender.add(Number(item.getAttribute('data-pdf-stack-page')));
    }
  });

  if (!pagesToRender.size) {
    pagesToRender.add(currentPage);
  }

  for (const page of [...pagesToRender].sort((a, b) => a - b)) {
    if (token !== stackRenderToken) return;
    await renderStackPageContent(page);
  }
}

async function mountFullPdfStack() {
  if (!canvasFrame || !pdfDoc) return;

  if (!fullPdfStack?.isConnected) {
    mountFullPdfStackSkeleton(720);
  }

  const slotHeight = await estimateStackPageHeight();
  fullPdfStack.querySelectorAll('.full-pdf-page-viewport').forEach((viewportWrap) => {
    if (!viewportWrap.dataset.rendered) {
      viewportWrap.style.minHeight = `${slotHeight}px`;
    }
  });

  await renderStackPageContent(currentPage);
  hidePdfLoading();

  const initialBatch = [];
  for (let page = currentPage - 2; page <= currentPage + 4; page += 1) {
    if (page >= 1 && page <= totalPages) {
      initialBatch.push(page);
    }
  }

  await renderStackPagesBatch(initialBatch, 2);
  scrollToStackPage(currentPage, false);
  await renderVisibleStackPages();

  buildIndexClickZones(pdfDoc)
    .then(() => refreshIndexStackPages())
    .catch((error) => {
      logToc('Failed to build index click zones.', error?.message || error);
    });
}

function startProgressiveStackRender() {
  renderVisibleStackPages();
}

async function ensureFullPdfStack() {
  if (useSinglePageMode || !pdfDoc || fallbackMode || useContinuousEmbed) return;
  if (!fullPdfStack?.isConnected) {
    await mountFullPdfStack();
  }
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
    image.width = FALLBACK_PAGE_WIDTH;
    image.height = FALLBACK_PAGE_HEIGHT;
    image.loading = Math.abs(entry.page - currentPage) <= 1 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.fetchPriority = Math.abs(entry.page - currentPage) <= 1 ? 'high' : 'auto';
    image.src = getFallbackImageSrc(entry.page);

    const watermark = document.createElement('div');
    watermark.className = 'pdf-watermark';
    watermark.textContent = 'الدكتورة نجوى علوان — الشيخ بسيوني أبو يوسف';

    item.appendChild(label);
    item.appendChild(image);
    item.appendChild(watermark);
    mountFallbackIndexOverlays(item, entry.page);
    fallbackPagesStack.appendChild(item);
  });

  canvasFrame.appendChild(fallbackPagesStack);
  wireFallbackScrollTracking();
  revealPdfChrome();
}

async function loadFallbackContent() {
  // Compressed pre-rendered pages generated directly from assets/quran1.pdf.
  fallbackPages = Array.from({ length: 241 }, (_, idx) => ({
    page: idx + 1,
    image: `quran-pages-jpg/quran-page-${String(idx + 1).padStart(3, '0')}.jpg`,
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

function tocTypeToLevel(type) {
  if (type === 'section') return 1;
  if (type === 'subsection') return 2;
  if (type === 'subentry') return 3;
  if (type === 'entry') return 2;
  return 1;
}

function normalizeTocEntries(rawToc) {
  const toc = Array.isArray(rawToc) ? rawToc : [];
  return toc
    .map((item) => ({
      title: String(item?.title || '').replace(/\s+/g, ' ').trim(),
      page: Number(normalizeDigits(item?.page)),
      level: tocTypeToLevel(item?.type)
    }))
    .filter((item) => item.title && Number.isFinite(item.page) && item.page >= 1);
}

async function loadTocFromJson() {
  const sources = [
    'assets/content.json',
    'dist/data/toc.json'
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: 'no-store' });
      if (!response.ok) continue;
      const data = await response.json();
      const entries = normalizeTocEntries(data?.toc ?? data);
      if (entries.length) {
        logToc(`TOC loaded from ${source}.`, { entries: entries.length });
        return entries;
      }
    } catch (error) {
      logToc(`Failed to load ${source}.`, error?.message || error);
    }
  }

  return [];
}

async function extractTocFromPdfPages(pdfDocument, fromPage, toPage) {
  const entries = [];
  const rawLines = [];
  const seen = new Set();
  let totalTextItems = 0;

  for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
    const pageRef = await pdfDocument.getPage(pageNumber);
    const textContent = await pageRef.getTextContent();
    totalTextItems += textContent.items.length;
    const lines = getLineObjectsFromTextContent(textContent);
    const baselineX = lines.length ? Math.max(...lines.map((line) => line.minX)) : 0;

    lines.forEach((line) => {
      rawLines.push(`[p${pageNumber}] ${line.text}`);
      const entry = parseIndexLine(line, baselineX);
      if (!entry) return;
      const key = `${entry.title}-${entry.page}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(entry);
    });
  }

  return { entries, rawLines, totalTextItems };
}

async function resolveIndexEntries(pdfDocument = null) {
  return buildIndexEntries(pdfDocument);
}

async function resolveIndexEntriesFast() {
  const jsonEntries = await loadTocFromJson();
  if (jsonEntries.length) {
    if (indexCaption) {
      indexCaption.textContent = 'فهرس محمّل — اضغط الموضوع أو رقم الصفحة للانتقال';
    }
    return jsonEntries;
  }
  return getFallbackIndexEntries();
}

function inferTotalPagesFromIndex(entries) {
  if (!Array.isArray(entries) || !entries.length) return totalPages;
  return Math.max(...entries.map((entry) => entry.page), totalPages);
}

function getFullPdfUrl() {
  const path = PDF_LOAD_PATH.startsWith('/') ? PDF_LOAD_PATH : `/${PDF_LOAD_PATH}`;
  return new URL(path, window.location.href).toString();
}

function getPdfViewerUrl(page = currentPage) {
  return `${getFullPdfUrl()}#page=${clampPage(page)}&zoom=page-width`;
}

function showPdfLoading(message = 'جار تحميل الكتاب...', percent = null) {
  const overlay = document.querySelector('[data-pdf-loading]');
  const text = document.querySelector('[data-pdf-loading-text]');
  const bar = document.querySelector('[data-pdf-loading-bar]');
  const percentLabel = document.querySelector('[data-pdf-loading-percent]');

  if (canvasViewport) {
    canvasViewport.classList.add('is-loading');
    canvasViewport.style.display = 'none';
  }
  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }
  if (overlay) {
    overlay.hidden = false;
  }
  if (text) {
    text.textContent = message;
  }
  if (bar && Number.isFinite(percent)) {
    bar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }
  if (percentLabel) {
    percentLabel.textContent = Number.isFinite(percent) ? `${Math.round(percent)}%` : '';
  }
}

function hidePdfLoading() {
  const overlay = document.querySelector('[data-pdf-loading]');
  if (overlay) {
    overlay.hidden = true;
  }
  if (canvasViewport) {
    canvasViewport.classList.remove('is-loading');
    canvasViewport.style.display = 'none';
  }
  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }
}

function mountContinuousPdfIframe(page = currentPage) {
  if (!canvasFrame) return null;

  if (canvasViewport) canvasViewport.style.display = 'none';
  if (pdfCanvas) pdfCanvas.style.display = 'none';

  canvasFrame.classList.add('full-pdf-scroll-mode');
  canvasFrame.querySelectorAll('.full-pdf-pages-stack, .pdf-full-embed').forEach((node) => node.remove());
  fullPdfStack = null;

  const iframe = document.createElement('iframe');
  iframe.className = 'pdf-full-embed pdf-frame-fallback';
  iframe.src = getFullPdfUrl();
  iframe.title = 'الدليل المفيد — عرض متصل لكل الصفحات';
  iframe.setAttribute('allow', 'fullscreen');

  canvasFrame.appendChild(iframe);
  pdfEmbedEl = iframe;
  nativePdfViewer = iframe;
  fallbackIframe = iframe;
  useContinuousEmbed = true;

  if (stage) {
    stage.classList.add('has-pdf', 'has-full-scroll');
  }
  revealPdfChrome();
  setPageMeta();
  return iframe;
}

function syncContinuousEmbedPage(page = currentPage) {
  if (!pdfEmbedEl) return;
  const target = getPdfViewerUrl(page);
  try {
    const currentBase = pdfEmbedEl.src.split('#')[0];
    const targetBase = target.split('#')[0];
    if (currentBase === targetBase && pdfEmbedEl.contentWindow) {
      pdfEmbedEl.contentWindow.location.replace(target);
      return;
    }
  } catch (error) {
    // Fall back to resetting src when iframe navigation is blocked.
  }
  pdfEmbedEl.src = target;
}

function setEmbeddedPdfSource(viewer, page = null) {
  if (!viewer) return;
  const url = page ? getPdfViewerUrl(page) : getFullPdfUrl();
  if ('src' in viewer) {
    viewer.src = url;
  } else {
    viewer.data = url;
  }
}

function mountNativePdfViewer(container) {
  if (!container) return null;

  container.querySelectorAll('.pdf-native-viewer, .fallback-pages-stack').forEach((node) => node.remove());
  container.classList.remove('fallback-scroll-mode');

  if (canvasViewport) {
    canvasViewport.style.display = 'none';
  }
  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }

  const objectEl = document.createElement('object');
  objectEl.className = 'pdf-frame-fallback pdf-native-viewer';
  objectEl.type = 'application/pdf';
  objectEl.setAttribute('aria-label', 'عارض PDF');

  const openLink = document.createElement('a');
  openLink.className = 'pdf-open-fallback';
  openLink.href = getPdfViewerUrl(currentPage);
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.textContent = 'افتح الملف في نافذة جديدة';
  objectEl.appendChild(openLink);

  container.appendChild(objectEl);
  setEmbeddedPdfSource(objectEl, null);
  revealPdfChrome();

  nativePdfViewer = objectEl;
  fallbackIframe = objectEl;
  return objectEl;
}

function setNativePdfPage(page = currentPage) {
  setEmbeddedPdfSource(nativePdfViewer || fallbackIframe, page);
}

function loadTotalPagesInBackground() {
  if (!window.pdfjsLib) return;

  loadPdfDocumentForToc()
    .then((doc) => {
      if (doc?.numPages) {
        totalPages = doc.numPages;
        setPageMeta();
      }
      if (doc?.destroy) {
        doc.destroy();
      }
    })
    .catch(() => {});
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
  const pageLabel = `${currentPage} / ${totalPages}`;
  if (pageIndicator) {
    pageIndicator.textContent = pageLabel;
  }
  if (simulatorPageIndicator) {
    simulatorPageIndicator.textContent = pageLabel;
  }
  if (floatingPageLabel) {
    floatingPageLabel.textContent = String(currentPage);
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
  updateSideNavState();
}

function openQuickNavPanel() {
  if (!quickNavPanel) return;
  quickNavPanel.hidden = false;
  if (quickPageInput) quickPageInput.value = String(currentPage);
  showControls();
}

function clearPrimarySearchResults() {
  if (primarySearchResults) {
    primarySearchResults.innerHTML = '<div class="empty">اكتب كلمة دلالية أو رقم صفحة ثم اضغط بحث.</div>';
  }
  if (indexSearchInput) indexSearchInput.value = '';
}

let toolbarActionsWired = false;

async function triggerPdfDownload(indexed = false, triggerEl = null) {
  const url = indexed ? PDF_INDEXED_DOWNLOAD_URL : PDF_DOWNLOAD_URL;
  const fileName = indexed
    ? PDF_DOC_NAME.replace(/\.pdf$/i, '_indexed.pdf')
    : PDF_DOC_NAME;
  const originalLabel = triggerEl?.textContent;

  if (triggerEl) {
    triggerEl.disabled = true;
    triggerEl.textContent = 'جار التحميل...';
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);

    if (triggerEl) {
      triggerEl.textContent = 'تم ✓';
      window.setTimeout(() => {
        triggerEl.textContent = originalLabel || triggerEl.textContent;
      }, 1400);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[PDF download]', error);
    window.open(url, '_blank', 'noopener,noreferrer');
    if (triggerEl) {
      triggerEl.textContent = originalLabel || triggerEl.textContent;
    }
  } finally {
    if (triggerEl) {
      triggerEl.disabled = false;
    }
  }
}

function revealPdfChrome() {
  if (stage) {
    stage.classList.add('has-pdf');
  }
  const sideNav = document.querySelector('[data-pdf-side-nav]');
  if (sideNav) {
    sideNav.hidden = !useSinglePageMode || (!pdfDoc && !fallbackMode);
  }
  if (pdfStageCloseBtn) {
    pdfStageCloseBtn.hidden = false;
  }
}

function enterSimulatorMode() {
  document.body.classList.add('simulator-mode', 'reading-cinema');
  if (sidebar) sidebar.classList.add('is-collapsed');
  if (readerToolbar) readerToolbar.hidden = true;
  if (simulatorToolbar) simulatorToolbar.hidden = false;
  revealPdfChrome();
  schedulePageWidthReflow(280);
  if (fullPdfStack) {
    scrollToStackPage(currentPage, false);
    renderVisibleStackPages();
  } else if (pdfDoc) {
    ensureFullPdfStack().catch(() => {});
  }
}

function exitSimulatorMode() {
  document.body.classList.remove('simulator-mode');
  if (!document.fullscreenElement) {
    document.body.classList.remove('reading-cinema');
  }
  if (readerToolbar) readerToolbar.hidden = false;
  if (simulatorToolbar) simulatorToolbar.hidden = true;
  schedulePageWidthReflow(280);
}

function wireToolbarActions() {
  if (toolbarActionsWired) return;
  toolbarActionsWired = true;

  document.querySelectorAll('[data-download-pdf]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerPdfDownload(false, button);
    });
  });

  document.querySelectorAll('[data-download-indexed]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerPdfDownload(true, button);
    });
  });

  document.querySelectorAll('[data-simulator-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      enterSimulatorMode();
    });
  });

  document.querySelectorAll('[data-simulator-exit]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      exitSimulatorMode();
    });
  });
}

function wireExitControls() {
  document.querySelectorAll('[data-exit-viewer]').forEach((node) => {
    node.addEventListener('click', (event) => {
      const target = node.getAttribute('href') || 'library.html';
      if (node.tagName === 'A') return;
      event.preventDefault();
      window.location.href = target;
    });
  });

  document.querySelectorAll('[data-close-pdf]').forEach((node) => {
    if (node.tagName === 'A') return;
    node.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = 'library.html';
    });
  });

  document.querySelectorAll('[data-search-dock-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!searchDock) return;
      searchDock.hidden = !searchDock.hidden;
    });
  });

  document.querySelectorAll('[data-close-search-dock]').forEach((button) => {
    button.addEventListener('click', () => {
      clearPrimarySearchResults();
      if (searchDock) searchDock.hidden = true;
    });
  });

  document.querySelectorAll('[data-close-sidebar]').forEach((button) => {
    button.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('is-collapsed');
      schedulePageWidthReflow(220);
    });
  });

  document.querySelectorAll('[data-close-loading]').forEach((button) => {
    button.addEventListener('click', hidePdfLoading);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('simulator-mode')) {
      exitSimulatorMode();
      return;
    }
    if (quickNavPanel && !quickNavPanel.hidden) {
      closeQuickNavPanel();
      return;
    }
    if (sidebar && !sidebar.classList.contains('is-collapsed') && window.innerWidth <= 1100) {
      sidebar.classList.add('is-collapsed');
      schedulePageWidthReflow(220);
    }
  });
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
    const y = item.transform[5];
    const width = item.width || 0;
    const height = item.height || 10;
    const maxX = x + width;
    const minY = y - height;
    if (!current || Math.abs(current.y - y) > 3) {
      if (current) lines.push(current);
      current = {
        y,
        minX: x,
        maxX,
        minY,
        maxY: y,
        parts: [{ x, str: item.str.trim() }]
      };
      return;
    }
    current.minX = Math.min(current.minX, x);
    current.maxX = Math.max(current.maxX, maxX);
    current.minY = Math.min(current.minY, minY);
    current.maxY = Math.max(current.maxY, y);
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
      minY: line.minY,
      maxY: line.maxY,
      y: line.y,
      height: Math.max(line.maxY - line.minY, 10)
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

  if (!normalized || normalized.length < 3) return null;
  if (/^(الفهرس|المحتويات|index|contents)$/i.test(normalized)) return null;
  if (/^المبحث\s+(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)/i.test(normalized)
    && !/\d/.test(normalized)) {
    return null;
  }

  if (lineObj.parts?.length >= 2) {
    const partOrders = [
      [...lineObj.parts].sort((a, b) => a.x - b.x),
      [...lineObj.parts].sort((a, b) => b.x - a.x)
    ];

    for (const sortedParts of partOrders) {
      for (const part of sortedParts) {
        const digitsOnly = normalizeDigits(part.str).trim();
        if (!/^\d{1,3}$/.test(digitsOnly)) continue;
        const page = Number(digitsOnly);
        if (!Number.isFinite(page) || page < 1 || page > totalPages) continue;

        const title = sortedParts
          .filter((candidate) => candidate !== part)
          .map((candidate) => candidate.str)
          .join(' ')
          .replace(/[\.\-–—_·•…:]+$/g, '')
          .replace(/^[\.\-–—_·•…:]+/g, '')
          .trim();

        if (title.length >= 2) {
          return {
            title,
            page,
            level: computeHierarchyLevel(title, lineObj.minX, baselineX)
          };
        }
      }
    }
  }

  const endMatch = normalized.match(/(.+?)[\s\.…·\-–—]{1,}\s*(\d{1,3})\s*$/);
  if (endMatch) {
    const title = endMatch[1].replace(/[\.\-–—_·•…:]+$/g, '').trim();
    const page = Number(endMatch[2]);
    if (title.length >= 2 && page >= 1 && page <= totalPages) {
      return {
        title,
        page,
        level: computeHierarchyLevel(title, lineObj.minX, baselineX)
      };
    }
  }

  const startMatch = normalized.match(/^(\d{1,3})[\s\.…·\-–—]+(.+)$/);
  if (startMatch) {
    const page = Number(startMatch[1]);
    const title = startMatch[2].replace(/[\.\-–—_·•…:]+$/g, '').trim();
    if (title.length >= 2 && page >= 1 && page <= totalPages) {
      return {
        title,
        page,
        level: computeHierarchyLevel(title, lineObj.minX, baselineX)
      };
    }
  }

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

function parsePageOnlyLine(lineObj) {
  const normalized = normalizeDigits(lineObj.text).trim();
  if (!/^\d{1,4}$/.test(normalized)) return null;
  const page = Number(normalized);
  if (!Number.isFinite(page) || page < 1 || page > totalPages) return null;
  return {
    title: `الصفحة ${page}`,
    page,
    level: 1
  };
}

function lineToClickZone(line, pageWidth, pageHeight, entry, pageNumber) {
  const padY = 6;
  const leftPx = Math.max(0, pageWidth * 0.02);
  const topPx = Math.max(0, pageHeight - line.maxY - padY);
  const widthPx = Math.max(24, pageWidth * 0.96 - leftPx);
  const heightPx = Math.max((line.maxY - line.minY) + padY * 2, 22);

  return {
    sourcePage: pageNumber,
    targetPage: clampPage(entry.page),
    title: entry.title,
    left: leftPx / pageWidth,
    top: topPx / pageHeight,
    width: widthPx / pageWidth,
    height: heightPx / pageHeight
  };
}

async function extractIndexClickZonesFromPage(pageRef, pageNumber) {
  const baseViewport = pageRef.getViewport({ scale: 1 });
  const pageWidth = baseViewport.width;
  const pageHeight = baseViewport.height;
  const textContent = await pageRef.getTextContent();
  const lines = getLineObjectsFromTextContent(textContent);
  const baselineX = lines.length ? Math.min(...lines.map((line) => line.minX)) : 0;
  const zones = [];
  const seen = new Set();

  lines.forEach((line) => {
    const entry = parseIndexLine(line, baselineX) || parsePageOnlyLine(line);
    if (!entry) return;
    const key = `${entry.title}-${entry.page}-${line.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    zones.push(lineToClickZone(line, pageWidth, pageHeight, entry, pageNumber));
  });

  return zones;
}

async function buildIndexClickZones(pdfDocument) {
  indexClickZonesByPage = new Map();
  if (!pdfDocument) return;

  for (let pageNumber = INDEX_START; pageNumber <= INDEX_END; pageNumber += 1) {
    try {
      const pageRef = await pdfDocument.getPage(pageNumber);
      const zones = await extractIndexClickZonesFromPage(pageRef, pageNumber);
      if (zones.length) {
        indexClickZonesByPage.set(pageNumber, zones);
      }
    } catch (error) {
      logToc(`Failed to build click zones for page ${pageNumber}.`, error?.message || error);
    }
  }

  logToc('Index click zones built.', { pages: indexClickZonesByPage.size });
  await refreshIndexStackPages();
}

function invalidateIndexStackPages() {
  for (let pageNumber = INDEX_START; pageNumber <= INDEX_END; pageNumber += 1) {
    const item = document.getElementById(`pdf-stack-page-${pageNumber}`);
    const viewportWrap = item?.querySelector('.full-pdf-page-viewport');
    if (!viewportWrap) continue;
    viewportWrap.innerHTML = '';
    delete viewportWrap.dataset.rendered;
    [...pageRenderCache.keys()].forEach((key) => {
      if (key.startsWith(`${pageNumber}:`)) {
        pageRenderCache.delete(key);
      }
    });
  }
}

async function refreshIndexStackPages() {
  if (!fullPdfStack?.isConnected || !pdfDoc) return;
  invalidateIndexStackPages();
  for (let pageNumber = INDEX_START; pageNumber <= INDEX_END; pageNumber += 1) {
    await renderStackPageContent(pageNumber);
  }
}

function mountClickZones(container, zones, viewportWidth, viewportHeight, clearContainer = true) {
  if (!container || !zones.length) return 0;

  if (clearContainer) {
    container.innerHTML = '';
  }

  container.style.width = `${Math.floor(viewportWidth)}px`;
  container.style.height = `${Math.floor(viewportHeight)}px`;

  zones.forEach((zone, index) => {
    const left = zone.left * viewportWidth;
    const top = zone.top * viewportHeight;
    const width = zone.width * viewportWidth;
    const height = zone.height * viewportHeight;
    if (width < 6 || height < 6) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pdf-link-annotation index-table-click-zone';
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    button.style.width = `${width}px`;
    button.style.height = `${height}px`;
    button.setAttribute('aria-label', `${zone.title} — صفحة ${zone.targetPage}`);
    button.title = `${zone.title} (صفحة ${zone.targetPage})`;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigateToPage(zone.targetPage, {
        force: true,
        flashTitle: zone.title,
        reason: 'index-table-click'
      });
    });

    container.appendChild(button);
  });

  return container.querySelectorAll('.index-table-click-zone').length;
}

function mountFallbackIndexOverlays(pageItem, pageNumber) {
  const zones = indexClickZonesByPage.get(pageNumber);
  if (!zones?.length || !pageItem) return;

  const image = pageItem.querySelector('.fallback-page-image');
  if (!image) return;

  let wrap = image.closest('.fallback-image-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'fallback-image-wrap';
    image.parentNode.insertBefore(wrap, image);
    wrap.appendChild(image);
  }

  let overlay = wrap.querySelector('.index-click-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'index-click-overlay';
    wrap.appendChild(overlay);
  }

  overlay.innerHTML = '';
  zones.forEach((zone) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'index-table-click-zone';
    button.style.left = `${zone.left * 100}%`;
    button.style.top = `${zone.top * 100}%`;
    button.style.width = `${zone.width * 100}%`;
    button.style.height = `${zone.height * 100}%`;
    button.setAttribute('aria-label', `${zone.title} — صفحة ${zone.targetPage}`);
    button.title = `${zone.title} (صفحة ${zone.targetPage})`;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigateToPage(zone.targetPage, {
        force: true,
        flashTitle: zone.title,
        reason: 'index-table-click'
      });
    });
    overlay.appendChild(button);
  });
}

function buildApproximateIndexClickZonesFromEntries(entries) {
  if (indexClickZonesByPage.size || !Array.isArray(entries) || !entries.length) return;

  const tocPages = INDEX_END - INDEX_START + 1;
  const rowsPerPage = Math.ceil(entries.length / tocPages);

  for (let pageNumber = INDEX_START; pageNumber <= INDEX_END; pageNumber += 1) {
    const pageIndex = pageNumber - INDEX_START;
    const pageEntries = entries.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    if (!pageEntries.length) continue;

    const topStart = 0.13;
    const topEnd = 0.9;
    const rowHeight = Math.min(0.045, (topEnd - topStart) / Math.max(pageEntries.length, 1));

    indexClickZonesByPage.set(pageNumber, pageEntries.map((entry, index) => ({
      sourcePage: pageNumber,
      targetPage: clampPage(entry.page),
      title: entry.title,
      left: 0.04,
      top: topStart + (index * rowHeight),
      width: 0.92,
      height: Math.max(0.026, rowHeight * 0.88)
    })));
  }
}

function refreshFallbackIndexOverlays() {
  if (!fallbackPagesStack) return;
  for (let pageNumber = INDEX_START; pageNumber <= INDEX_END; pageNumber += 1) {
    const pageItem = fallbackPagesStack.querySelector(`[data-fallback-page="${pageNumber}"]`);
    if (pageItem) {
      mountFallbackIndexOverlays(pageItem, pageNumber);
    }
  }
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

async function buildIndexEntries(pdfDocument = null) {
  tocExtractionWarning = '';

  const errors = [];
  let rawLines = [];
  let totalTextItems = 0;
  let ocrUsed = false;

  if (pdfDocument) {
    const outline = await pdfDocument.getOutline();

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

    const extracted = await extractTocFromPdfPages(pdfDocument, INDEX_START, INDEX_END);
    rawLines = extracted.rawLines;
    totalTextItems = extracted.totalTextItems;

    if (extracted.entries.length) {
      tocDebugReport = {
        totalTextItems,
        rawLines,
        parsedEntries: extracted.entries,
        ocrUsed: false,
        errors
      };

      if (indexCaption) {
        indexCaption.textContent = `فهرس مستخرج من صفحات ${INDEX_START}-${INDEX_END}`;
      }
      logToc('TOC built from PDF index pages.', { entries: extracted.entries.length });
      renderTocDebug();
      return extracted.entries;
    }

    errors.push('تعذر استخراج الفهرس من نص صفحات المحتوى.');

    const ocrResult = await tryOcrForToc(pdfDocument, INDEX_START, INDEX_END);
    rawLines = [...rawLines, ...ocrResult.rawLines];
    ocrUsed = true;

    if (ocrResult.entries.length) {
      tocDebugReport = {
        totalTextItems,
        rawLines,
        parsedEntries: ocrResult.entries,
        ocrUsed: true,
        errors: ocrResult.error ? [...errors, ocrResult.error] : errors
      };

      if (indexCaption) {
        indexCaption.textContent = `فهرس مستخرج بـ OCR من صفحات ${INDEX_START}-${INDEX_END}`;
      }
      logToc('TOC built from OCR.', { entries: ocrResult.entries.length });
      renderTocDebug();
      return ocrResult.entries;
    }

    if (ocrResult.error) {
      errors.push(ocrResult.error);
    }
  }

  const jsonEntries = await loadTocFromJson();
  if (jsonEntries.length) {
    tocDebugReport = {
      totalTextItems,
      rawLines,
      parsedEntries: jsonEntries,
      ocrUsed,
      errors
    };

    if (indexCaption) {
      indexCaption.textContent = 'فهرس محمّل من ملف toc.json';
    }
    logToc('TOC loaded from dist/data/toc.json.', { entries: jsonEntries.length });
    renderTocDebug();
    return jsonEntries;
  }

  tocDebugReport = {
    totalTextItems,
    rawLines,
    parsedEntries: [],
    ocrUsed,
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
  if (nativePdfViewer || fallbackIframe) {
    setNativePdfPage(currentPage);
    zoom = 1;
    setPageMeta();

    activeSection = getActiveSectionForPage(currentPage);
    highlightActiveIndex();

    document.dispatchEvent(new CustomEvent('pdf:rendered', {
      detail: { page: currentPage, reason }
    }));
    return;
  }

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
    const safeTitle = entry.title.replace(/"/g, '&quot;');
    return `
      <button type="button" class="index-item level-${level}" data-level="${level}" data-page="${entry.page}" data-title="${safeTitle}" title="${safeTitle}">
        <span class="idx-title">${titleMarkup}</span>
        <span class="idx-page">${entry.page}</span>
      </button>
    `;
  }).join('');

  indexList.querySelectorAll('.index-item').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const targetPage = Number(button.getAttribute('data-page'));
      if (!Number.isFinite(targetPage)) return;

      const targetTitle = button.getAttribute('data-title');
      const targetEntry = indexEntries.find((entry) => entry.page === targetPage && entry.title === targetTitle)
        || indexEntries.find((entry) => entry.page === targetPage);

      if (window.innerWidth <= 1100 && sidebar) {
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
      filteredIndexEntries = [...indexEntries];
      renderIndex(filteredIndexEntries);
      return;
    }

    filteredIndexEntries = indexEntries.filter((entry) =>
      normalizeDigits(entry.title.toLowerCase()).includes(query)
      || String(entry.page).includes(query)
    );

    renderIndex(filteredIndexEntries, query);
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
}

function wireControlsVisibility() {
  if (!controls) return;
  showControls();
}

async function renderIndexTableClickZones(pageRef, viewport, pageNumber, targetLayer = annotationLayer) {
  if (!targetLayer || pageNumber < INDEX_START || pageNumber > INDEX_END) return 0;

  let zones = indexClickZonesByPage.get(pageNumber);
  if (!zones?.length) {
    zones = await extractIndexClickZonesFromPage(pageRef, pageNumber);
    if (zones.length) {
      indexClickZonesByPage.set(pageNumber, zones);
    }
  }

  if (!zones.length) return 0;
  targetLayer.removeAttribute('aria-hidden');
  return mountClickZones(targetLayer, zones, viewport.width, viewport.height, false);
}

async function renderLinkAnnotations(pageRef, viewport, targetLayer = annotationLayer, pageNumber = currentPage) {
  if (!targetLayer) return;
  targetLayer.innerHTML = '';
  targetLayer.setAttribute('aria-hidden', 'true');

  if (pageNumber >= INDEX_START && pageNumber <= INDEX_END) {
    targetLayer.removeAttribute('aria-hidden');
    await renderIndexTableClickZones(pageRef, viewport, pageNumber, targetLayer);
    return;
  }

  let annotations = [];
  try {
    annotations = await pageRef.getAnnotations({ intent: 'display' });
  } catch (error) {
    logToc('Failed to read PDF annotations.', error?.message || error);
  }

  const links = annotations.filter((annotation) => annotation.subtype === 'Link');

  if (links.length) {
    targetLayer.style.width = `${Math.floor(viewport.width)}px`;
    targetLayer.style.height = `${Math.floor(viewport.height)}px`;
    targetLayer.removeAttribute('aria-hidden');

    links.forEach((annotation, index) => {
      const rect = viewport.convertToViewportRectangle(annotation.rect);
      const left = Math.min(rect[0], rect[2]);
      const top = Math.min(rect[1], rect[3]);
      const width = Math.abs(rect[2] - rect[0]);
      const height = Math.abs(rect[3] - rect[1]);

      if (width < 4 || height < 4) return;

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'pdf-link-annotation';
      link.style.left = `${left}px`;
      link.style.top = `${top}px`;
      link.style.width = `${width}px`;
      link.style.height = `${height}px`;
      link.setAttribute('aria-label', `انتقال من رابط الفهرس ${index + 1}`);

      link.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (annotation.dest) {
          const page = await resolveOutlineDestinationToPage(annotation.dest);
          if (page) {
            navigateToPage(page, {
              force: true,
              reason: 'pdf-link-annotation',
              flashTitle: `الصفحة ${page}`
            });
          }
          return;
        }

        if (annotation.url) {
          const hashPage = annotation.url.match(/(?:page|p)=(\d{1,4})/i);
          if (hashPage) {
            navigateToPage(Number(hashPage[1]), {
              force: true,
              reason: 'pdf-link-hash',
              flashTitle: `الصفحة ${hashPage[1]}`
            });
            return;
          }

          if (/\.pdf($|[?#])/i.test(annotation.url) || annotation.url.includes('/api/pdf')) {
            return;
          }

          window.open(annotation.url, '_blank', 'noopener,noreferrer');
        }
      });

      targetLayer.appendChild(link);
    });
  }
}

function mountIndexImageClickOverlay(wrap, pageNumber) {
  const zones = indexClickZonesByPage.get(pageNumber);
  if (!zones?.length || !wrap) return;

  let overlay = wrap.querySelector('.index-click-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'index-click-overlay';
    wrap.appendChild(overlay);
  }

  overlay.innerHTML = '';
  zones.forEach((zone) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'index-table-click-zone';
    button.style.left = `${zone.left * 100}%`;
    button.style.top = `${zone.top * 100}%`;
    button.style.width = `${zone.width * 100}%`;
    button.style.height = `${zone.height * 100}%`;
    button.setAttribute('aria-label', `${zone.title} — صفحة ${zone.targetPage}`);
    button.title = `${zone.title} (صفحة ${zone.targetPage})`;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigateToPage(zone.targetPage, {
        force: true,
        flashTitle: zone.title,
        reason: 'index-table-click'
      });
    });
    overlay.appendChild(button);
  });
}

function clearIndexPageImage() {
  if (indexPageImageWrap) {
    indexPageImageWrap.style.display = 'none';
  }
  if (pdfCanvas) {
    pdfCanvas.style.display = 'block';
  }
  if (annotationLayer) {
    annotationLayer.innerHTML = '';
    annotationLayer.setAttribute('aria-hidden', 'true');
  }
}

async function renderTocPageAsImage(reason = 'navigation') {
  if (!canvasViewport) return;

  if (annotationLayer) {
    annotationLayer.innerHTML = '';
    annotationLayer.setAttribute('aria-hidden', 'true');
  }
  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }

  if (!indexPageImageWrap) {
    indexPageImageWrap = document.createElement('div');
    indexPageImageWrap.className = 'index-page-image-wrap fallback-image-wrap';
    canvasViewport.appendChild(indexPageImageWrap);

    indexPageImageEl = document.createElement('img');
    indexPageImageEl.className = 'pdf-frame-fallback index-page-image';
    indexPageImageEl.decoding = 'async';
    indexPageImageWrap.appendChild(indexPageImageEl);
  }

  indexPageImageWrap.style.display = '';
  const src = getPrerenderedPageImageSrc(currentPage);
  indexPageImageEl.alt = `صفحة الفهرس ${currentPage}`;

  await new Promise((resolve, reject) => {
    indexPageImageEl.onload = () => resolve();
    indexPageImageEl.onerror = () => reject(new Error(`تعذر تحميل صورة الفهرس: ${src}`));
    if (indexPageImageEl.src !== new URL(src, window.location.href).href) {
      indexPageImageEl.src = src;
    } else if (indexPageImageEl.complete && indexPageImageEl.naturalWidth > 0) {
      resolve();
    }
  });

  mountIndexImageClickOverlay(indexPageImageWrap, currentPage);
  setPageMeta();

  if (stage) {
    stage.classList.add('has-pdf');
  }
  canvasViewport.style.display = '';
  canvasViewport.classList.remove('is-loading');

  activeSection = getActiveSectionForPage(currentPage);
  highlightActiveIndex();

  document.dispatchEvent(new CustomEvent('pdf:rendered', {
    detail: { page: currentPage, reason: `toc-image-${reason}` }
  }));
}

async function renderCurrentPage(reason = 'navigation') {
  if (fallbackMode) {
    renderFallbackPage(reason);
    return;
  }

  if (!pdfDoc) return;

  if (useSinglePageMode) {
    await renderSinglePdfPage(reason);
    return;
  }

  await ensureFullPdfStack();

  if (fullPdfStack) {
    if (reason === 'manual-zoom' || reason === 'layout-reflow' || reason === 'post-render-scale' || reason === 'simulator-enter') {
      if (!userZoomOverride && reason !== 'manual-zoom') {
        zoom = computeAutoFitScale(await pdfDoc.getPage(currentPage));
      }
      invalidateStackRenderCache();
      await renderVisibleStackPages();
    } else if (reason !== 'stack-scroll') {
      scrollToStackPage(currentPage, reason !== 'initial-load');
    }

    setPageMeta();
    revealPdfChrome();
    if (stage) {
      stage.classList.add('has-pdf', 'has-full-scroll');
    }
    activeSection = getActiveSectionForPage(currentPage);
    highlightActiveIndex();

    document.dispatchEvent(new CustomEvent('pdf:rendered', {
      detail: { page: currentPage, reason }
    }));
    return;
  }
}

async function navigateToPage(targetPage, options = {}) {
  const resolvedPage = clampPage(targetPage);
  if (resolvedPage === currentPage && !options.force) return;

  const isInitialLoad = options.reason === 'initial-load';
  currentPage = resolvedPage;
  pendingPostRenderScale = !userZoomOverride && !isInitialLoad;

  if (pdfEmbedEl) {
    syncContinuousEmbedPage(currentPage);
    setPageMeta();
    activeSection = getActiveSectionForPage(currentPage);
    highlightActiveIndex();

    if (options.flashTitle) {
      flashSectionTitle(options.flashTitle);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('page', String(currentPage));
    window.history.replaceState({}, '', url.toString());
    return;
  }

  if (fullPdfStack) {
    scrollToStackPage(currentPage, !isInitialLoad);
    setPageMeta();
    activeSection = getActiveSectionForPage(currentPage);
    highlightActiveIndex();

    if (options.flashTitle) {
      flashSectionTitle(options.flashTitle);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('page', String(currentPage));
    window.history.replaceState({}, '', url.toString());

    await renderVisibleStackPages();
    return;
  }

  if (canvasFrame && !isInitialLoad) {
    canvasFrame.classList.add('is-transitioning');
  }

  await renderCurrentPage(options.reason || 'navigation');

  if (canvasFrame && !isInitialLoad) {
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

  if (!isInitialLoad) {
    if (navScaleTimer) {
      window.clearTimeout(navScaleTimer);
    }
    navScaleTimer = window.setTimeout(() => {
      pendingPostRenderScale = !userZoomOverride;
      renderCurrentPage('layout-reflow');
    }, 180);
  }
}

async function adjustZoom(delta) {
  const next = Math.max(0.5, Math.min(4, zoom + delta));
  if (Math.abs(next - zoom) < 0.001) return;
  zoom = next;
  userZoomOverride = true;
  if (useSinglePageMode) {
    await renderCurrentPage('manual-zoom');
    setPageMeta();
    return;
  }
  if (fullPdfStack) {
    invalidateStackRenderCache();
    await renderVisibleStackPages();
    setPageMeta();
    return;
  }
  await renderCurrentPage('manual-zoom');
}

function wireAutoResize() {
  const rerender = () => {
    if (fallbackMode && fallbackPagesStack) {
      setPageMeta();
      return;
    }
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
  if (useSinglePageMode) {
    const pageRef = await pdfDoc.getPage(currentPage);
    const fitScale = computeAutoFitScale(pageRef);
    if (Math.abs(fitScale - zoom) < 0.01) return;
    isApplyingPostRenderScale = true;
    zoom = fitScale;
    await renderCurrentPage('post-render-scale');
    isApplyingPostRenderScale = false;
    return;
  }
  if (fullPdfStack) {
    invalidateStackRenderCache();
    await renderVisibleStackPages();
    return;
  }

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
    if (event.detail?.reason === 'initial-load') return;

    pendingPostRenderScale = false;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        enforcePageWidthAfterRender();
      });
    });
  });
}

function wireFreePanAndZoom() {
  if (!canvasFrame) return;

  canvasFrame.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    adjustZoom(delta);
  }, { passive: false });

  canvasFrame.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || fullPdfStack || pdfEmbedEl) return;
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
}

async function loadPdfDocumentForToc() {
  if (pdfDoc) return pdfDoc;
  if (!window.pdfjsLib) return null;

  try {
    return await openPdfDocument();
  } catch (error) {
    logToc('TOC-only PDF load failed.', error?.message || error);
    return null;
  }
}

async function initPdfJsViewer() {
  fallbackMode = false;

  if (nativePdfViewer?.parentNode) {
    nativePdfViewer.parentNode.removeChild(nativePdfViewer);
  }
  nativePdfViewer = null;
  fallbackIframe = null;
  pdfEmbedEl = null;

  if (canvasFrame) {
    canvasFrame.classList.remove('fallback-scroll-mode');
  }

  if (!window.pdfjsLib) {
    throw new Error('PDF.js library not loaded');
  }

  if (sectionTitle) {
    sectionTitle.textContent = 'جار تحميل PDF...';
  }

  showPdfLoading('جار تحميل الكتاب...', 0);

  resolveIndexEntriesFast()
    .then((entries) => {
      if (!entries.length) return;
      indexEntries = entries;
      filteredIndexEntries = [...entries];
      renderIndex(filteredIndexEntries);
      if (indexCaption) {
        indexCaption.textContent = 'فهرس محمّل — اضغط الموضوع أو رقم الصفحة للانتقال';
      }
    })
    .catch(() => {});

  wireIndexSearch();
  wireSidebarToggle();
  wireNavigation();
  wireControlsVisibility();
  wireAutoResize();
  wireRenderEvents();
  wireFreePanAndZoom();

  await waitForLayoutReady();

  useSinglePageMode = false;
  mountFullPdfStackSkeleton(720);
  showPdfLoading('جار تحميل صفحات الكتاب...', 8);

  try {
    pdfDoc = await openPdfDocument((percent) => {
      showPdfLoading('جار تحميل صفحات الكتاب...', Math.max(8, Math.min(98, percent)));
    });
    totalPages = pdfDoc.numPages || totalPages;
    currentPage = clampPage(currentPage);
    setPageMeta();

    await mountFullPdfStack();
    await renderCurrentPage('initial-load');
    pendingPostRenderScale = false;

    const entries = await resolveIndexEntries(pdfDoc);
    if (entries.length) {
      indexEntries = entries;
      pageListEntries = buildPageListEntries();
      filteredIndexEntries = [...indexEntries];
      renderIndex(filteredIndexEntries);
      if (indexCaption) {
        indexCaption.textContent = 'الموضوع ورقم الصفحة — اضغط للانتقال';
      }
      activeSection = getActiveSectionForPage(currentPage);
      highlightActiveIndex();
    }
  } catch (error) {
    hidePdfLoading();
    logToc('PDF viewer load failed.', error?.message || error);
    showPdfOpenFallback(error?.message || 'تعذر تحميل وعرض PDF');
    return;
  }

  if (sectionTitle) {
    sectionTitle.textContent = getActiveSectionForPage(currentPage)?.title || 'عارض PDF';
  }
}

async function initIframeViewer(reason = 'native') {
  fallbackMode = true;
  currentPage = clampPage(currentPage);

  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }
  if (canvasViewport) {
    canvasViewport.style.display = 'none';
  }

  if (sectionTitle) {
    sectionTitle.textContent = 'جار تحميل PDF...';
  }

  // عرض PDF كاملاً فوراً مع تمرير متصل داخل الإطار
  mountContinuousPdfIframe(currentPage);
  revealPdfChrome();

  indexEntries = await resolveIndexEntriesFast();
  totalPages = inferTotalPagesFromIndex(indexEntries);
  currentPage = clampPage(currentPage);
  setNativePdfPage(currentPage);

  pageListEntries = buildPageListEntries();
  filteredIndexEntries = [...indexEntries];

  renderIndex(filteredIndexEntries);
  if (indexCaption) {
    indexCaption.textContent = 'الموضوع ورقم الصفحة — اضغط للانتقال';
  }
  if (sectionTitle) {
    sectionTitle.textContent = 'عارض PDF مع فهرس تفاعلي';
  }

  wireIndexSearch();
  wireSidebarToggle();
  wireNavigation();
  wireControlsVisibility();
  wireAutoResize();
  wireRenderEvents();

  activeSection = getActiveSectionForPage(currentPage);
  highlightActiveIndex();
  setPageMeta();

  loadTotalPagesInBackground();

  document.dispatchEvent(new CustomEvent('pdf:rendered', {
    detail: { page: currentPage, reason: `initial-${reason}` }
  }));
}

async function initFallbackViewer(reason) {
  if (reason !== 'forced-image' && USE_NATIVE_PDF_IFRAME) {
    await initIframeViewer(reason);
    return;
  }

  fallbackMode = true;
  hidePdfLoading();

  if (pdfCanvas) {
    pdfCanvas.style.display = 'none';
  }
  if (canvasViewport) {
    canvasViewport.style.display = 'none';
  }

  await loadFallbackContent();
  currentPage = clampPage(currentPage);

  indexEntries = await resolveIndexEntriesFast();

  if (!indexEntries.length) {
    indexEntries = getFallbackIndexEntries();
  }
  buildApproximateIndexClickZonesFromEntries(indexEntries);

  if (canvasFrame) {
    renderFallbackPagesStack();
    refreshFallbackIndexOverlays();
  }

  pageListEntries = buildPageListEntries();
  filteredIndexEntries = [...indexEntries];
  renderIndex(filteredIndexEntries);
  if (indexCaption && !indexCaption.textContent.includes('فهرس')) {
    indexCaption.textContent = 'الموضوع ورقم الصفحة — اضغط للانتقال';
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

  tocExtractionWarning = reason === 'pdfjs-failed'
    ? 'تعذر تحميل PDF عبر المتصفح — تم عرض الصفحات كصور.'
    : (reason !== 'file'
      ? 'تعذر تشغيل PDF.js، وتم تفعيل وضع احتياطي للفهرس.'
      : '');

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

let navigationWired = false;

function wireNavigation() {
  if (navigationWired) return;
  navigationWired = true;

  document.querySelectorAll('[data-next-page]').forEach((button) => {
    button.addEventListener('click', () => navigateToPage(currentPage + 1, { reason: 'next-page' }));
  });
  document.querySelectorAll('[data-prev-page]').forEach((button) => {
    button.addEventListener('click', () => navigateToPage(currentPage - 1, { reason: 'prev-page' }));
  });
  document.querySelectorAll('[data-zoom-in]').forEach((button) => {
    button.addEventListener('click', () => adjustZoom(0.12));
  });
  document.querySelectorAll('[data-zoom-out]').forEach((button) => {
    button.addEventListener('click', () => adjustZoom(-0.12));
  });
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

  document.querySelectorAll('[data-quick-nav-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      if (quickNavPanel && !quickNavPanel.hidden) {
        closeQuickNavPanel();
      } else {
        openQuickNavPanel();
      }
    });
  });

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
  if (!canvasFrame) return;

  wireExitControls();
  wireToolbarActions();

  if (window.location.protocol === 'file:') {
    showPdfOpenFallback('افتح الموقع عبر السيرفر: http://127.0.0.1:8080/viewer.html — لا تفتح الملف مباشرة.');
    return;
  }

  try {
    if (FORCE_IMAGE_VIEW) {
      await ensureSearchIndexLoaded();
      await initFallbackViewer('forced-image');
      return;
    }

    if (USE_PDFJS_VIEWER) {
      await initPdfJsViewer();
      ensureSearchIndexLoaded().catch(() => {});
      return;
    }

    await initIframeViewer('native');
    ensureSearchIndexLoaded().catch(() => {});
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Viewer initialization failed:', error);
    hidePdfLoading();
    showPdfOpenFallback(error?.message || 'تعذر تشغيل عارض PDF');
    ensureSearchIndexLoaded().catch(() => {});
  }
}

function showPdfOpenFallback(details) {
  hidePdfLoading();

  if (sectionTitle) {
    sectionTitle.textContent = 'تعذر عرض الملف داخل الصفحة';
  }

  if (!canvasFrame) return;

  const usingApi = PDF_LOAD_PATH.startsWith('api/');

  canvasFrame.innerHTML = `
    <div class="pdf-open-panel">
      <p>تعذر تحميل PDF داخل العارض.</p>
      <p class="muted">شغّل السيرفر عبر <strong>start-server.bat</strong> أو <strong>node scripts/serve.mjs</strong> وليس <strong>http-server</strong>.</p>
      ${!usingApi ? '<p class="muted">المسار <code>/api/pdf</code> غير متاح — هذا سبب شائع لخطأ HTTP 204.</p>' : ''}
      <div class="pdf-open-panel-actions">
        <a class="btn primary" href="${getPdfViewerUrl(currentPage)}" target="_blank" rel="noopener">افتح PDF في نافذة جديدة</a>
        <a class="btn" href="${PDF_DOWNLOAD_URL}" download="${PDF_DOC_NAME}">تحميل PDF كامل</a>
        <a class="btn" href="${PDF_INDEXED_DOWNLOAD_URL}" download="${PDF_DOC_NAME.replace(/\.pdf$/i, '_indexed.pdf')}">تحميل PDF مفهرس</a>
        <button class="icon-btn panel-close-btn" type="button" data-close-fallback aria-label="إغلاق">✕</button>
      </div>
      ${details ? `<p class="muted pdf-open-panel-error">${details}</p>` : ''}
    </div>
  `;

  // eslint-disable-next-line no-console
  console.error('[PDF ERROR]', details || 'unknown');

  canvasFrame.querySelector('[data-close-fallback]')?.addEventListener('click', () => {
    window.location.href = 'library.html';
  });
}

initViewer();
