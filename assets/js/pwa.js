const PWA_DOCS = [
  { id: 'quran1.pdf', label: 'الدليل المفيد — النسخة الكاملة', pages: 241 },
  { id: 'quran1_compressed.pdf', label: 'الدليل المفيد — نسخة مضغوطة', pages: 241 }
];

const PWA_VIEWERS = [
  { id: 'images', label: 'عارض الصور المضغوط (افتراضي)', description: 'يعرض الصفحات بصور JPG مضغوطة — أسرع للتثبيت والاستخدام على الهاتف.' },
  { id: 'pdfjs', label: 'عارض PDF.js', description: 'يعرض PDF عبر PDF.js، لكنه أثقل في التحميل على الهاتف.' },
  { id: 'native', label: 'عارض المتصفح المدمج', description: 'يفتح PDF عبر عارض النظام داخل الصفحة.' }
];

let deferredInstallPrompt = null;

function getSelectedValue(name, fallback = '') {
  const field = document.querySelector(`[name="${name}"]:checked`) || document.querySelector(`[name="${name}"]`);
  return field ? field.value : fallback;
}

function buildViewerStartUrl(options = {}) {
  const doc = options.doc || 'quran1.pdf';
  const viewer = options.viewer || '';
  const page = Math.max(1, Number(options.page || 1));
  const params = new URLSearchParams({ doc, page: String(page), utm_source: 'pwa' });
  if (viewer) params.set('viewer', viewer);
  return `/viewer.html?${params.toString()}`;
}

function buildManifestUrl(options = {}) {
  const params = new URLSearchParams({
    doc: options.doc || 'quran1.pdf',
    page: String(Math.max(1, Number(options.page || 1))),
    name: options.name || 'منصة الدليل المفيد'
  });
  if (options.viewer) params.set('viewer', options.viewer);
  return `/manifest.webmanifest?${params.toString()}`;
}

function updateManifestLink(options = {}) {
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = buildManifestUrl(options);
}

function getInstallOptionsFromForm() {
  const doc = getSelectedValue('pwa-doc', 'quran1.pdf');
  const viewer = getSelectedValue('pwa-viewer', '');
  const page = getSelectedValue('pwa-page', '1');
  const nameInput = document.querySelector('[data-pwa-app-name]');
  const docMeta = PWA_DOCS.find((item) => item.id === doc);
  const viewerMeta = PWA_VIEWERS.find((item) => item.id === viewer);
  const shortName = nameInput?.value?.trim()
    || `${docMeta?.label?.split('(')[0]?.trim() || 'الدليل'}${viewerMeta?.id ? ` — ${viewerMeta.label.split(' ')[0]}` : ''}`;

  return { doc, viewer, page, name: shortName };
}

function setInstallStatus(message, type = 'info') {
  const node = document.querySelector('[data-pwa-status]');
  if (!node) return;
  node.textContent = message;
  node.dataset.state = type;
}

function updatePreview() {
  const options = getInstallOptionsFromForm();
  const startUrl = buildViewerStartUrl(options);
  const manifestUrl = buildManifestUrl(options);

  const startPreview = document.querySelector('[data-pwa-start-preview]');
  const manifestPreview = document.querySelector('[data-pwa-manifest-preview]');
  if (startPreview) startUrl && (startPreview.textContent = startUrl);
  if (manifestPreview) manifestPreview.textContent = manifestUrl;

  updateManifestLink(options);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('[PWA] Service worker registration failed.', error);
    return null;
  }
}

function wireInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.querySelectorAll('[data-pwa-install-btn]').forEach((button) => {
      button.disabled = false;
    });
    setInstallStatus('التطبيق جاهز للتثبيت على هذا الجهاز.', 'ready');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallStatus('تم تثبيت التطبيق بنجاح.', 'success');
  });
}

async function promptInstall() {
  if (window.location.protocol === 'file:') {
    setInstallStatus('افتح الموقع عبر http://127.0.0.1:8080 وليس file:// لتثبيت التطبيق.', 'error');
    return false;
  }

  updatePreview();

  if (!deferredInstallPrompt) {
    setInstallStatus('استخدم قائمة المتصفح: تثبيت التطبيق / Install App — أو جرّب Chrome أو Edge على localhost.', 'warn');
    return false;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;

  if (choice.outcome === 'accepted') {
    setInstallStatus('جاري تثبيت التطبيق...', 'success');
    return true;
  }

  setInstallStatus('تم إلغاء التثبيت.', 'warn');
  return false;
}

function renderInstallForm() {
  const root = document.querySelector('[data-pwa-install-root]');
  if (!root) return;

  root.innerHTML = `
    <div class="pwa-grid">
      <article class="card pwa-card">
        <h2>١) اختر واجهة PDF للتطبيق</h2>
        <p class="muted">حدد الملف ووضع العرض وصفحة البداية — عند التثبيت يفتح التطبيق مباشرة على هذه الواجهة.</p>

        <label class="pwa-label" for="pwa-doc">ملف PDF</label>
        <select id="pwa-doc" name="pwa-doc" data-pwa-doc>
          ${PWA_DOCS.map((doc) => `<option value="${doc.id}">${doc.label}</option>`).join('')}
        </select>

        <label class="pwa-label" for="pwa-viewer">واجهة العرض</label>
        <select id="pwa-viewer" name="pwa-viewer" data-pwa-viewer>
          ${PWA_VIEWERS.map((viewer) => `<option value="${viewer.id}">${viewer.label}</option>`).join('')}
        </select>
        <p class="muted pwa-hint" data-pwa-viewer-hint>${PWA_VIEWERS[0].description}</p>

        <label class="pwa-label" for="pwa-page">صفحة البداية</label>
        <input id="pwa-page" name="pwa-page" type="number" min="1" value="1" data-pwa-page>

        <label class="pwa-label" for="pwa-app-name">اسم التطبيق (اختياري)</label>
        <input id="pwa-app-name" data-pwa-app-name type="text" placeholder="مثال: الدليل المفيد — القرآن">

        <div class="pwa-preview">
          <div><span class="muted">صفحة البداية:</span> <code data-pwa-start-preview>/viewer.html?doc=quran1.pdf&amp;page=1</code></div>
          <div><span class="muted">ملف التطبيق:</span> <code data-pwa-manifest-preview>/manifest.webmanifest</code></div>
        </div>

        <div class="pwa-actions">
          <button class="btn primary" type="button" data-pwa-install-btn disabled>تثبيت كتطبيق ويب</button>
          <button class="btn" type="button" data-pwa-apply-config>تطبيق الإعدادات فقط</button>
          <a class="btn" data-pwa-open-preview href="${buildViewerStartUrl({ doc: 'quran1.pdf', page: 1 })}" target="_blank" rel="noopener">معاينة الواجهة</a>
        </div>
        <p class="pwa-status" data-pwa-status data-state="info">سجّل Service Worker ثم اختر الإعدادات واضغط تثبيت.</p>
      </article>

      <article class="card pwa-card">
        <h2>٢) تثبيت الموقع الكامل</h2>
        <p class="muted">يثبّت المنصة من الصفحة الرئيسية مع المكتبة والبحث والعارض.</p>
        <button class="btn primary" type="button" data-pwa-install-site>تثبيت المنصة كاملة</button>
      </article>

      <article class="card pwa-card">
        <h2>٣) تحميل PDF بالفهرسة الفعّالة</h2>
        <p class="muted">تحميل <strong>الكتاب كاملاً</strong> (وليس صفحة واحدة) — مع خيار النسخة المفهرسة بإشارات مرجعية Bookmarks.</p>
        <div class="pwa-actions">
          <a class="btn primary" data-pwa-download-full href="/api/pdf-download?doc=quran1.pdf" download="quran1.pdf">تحميل PDF كامل</a>
          <a class="btn" data-pwa-download-indexed href="/api/pdf-indexed?doc=quran1.pdf" download="quran1_indexed.pdf">تحميل PDF مفهرس</a>
          <a class="btn" data-pwa-download-bundle href="/api/index-bundle?doc=quran1.pdf" download="quran1_index_bundle.json">حزمة الفهرس (JSON)</a>
        </div>
        <p class="muted pwa-hint">لإنشاء نسخة مفهرسة دائمة: <code>python scripts/build_indexed_pdf.py</code></p>
      </article>
    </div>
  `;

  root.querySelectorAll('[name="pwa-doc"], [name="pwa-viewer"], [name="pwa-page"], [data-pwa-app-name]').forEach((field) => {
    field.addEventListener('input', updatePreview);
    field.addEventListener('change', updatePreview);
  });

  root.querySelector('[data-pwa-viewer]')?.addEventListener('change', (event) => {
    const viewer = PWA_VIEWERS.find((item) => item.id === event.target.value);
    const hint = root.querySelector('[data-pwa-viewer-hint]');
    if (hint && viewer) hint.textContent = viewer.description;
  });

  root.querySelector('[data-pwa-apply-config]')?.addEventListener('click', () => {
    updatePreview();
    setInstallStatus('تم تحديث إعدادات التطبيق. اضغط «تثبيت كتطبيق ويب» عندما يظهر.', 'ready');
  });

  root.querySelector('[data-pwa-install-btn]')?.addEventListener('click', () => promptInstall());

  root.querySelector('[data-pwa-install-site]')?.addEventListener('click', () => {
    updateManifestLink({ doc: 'quran1.pdf', page: 1, name: 'منصة الدليل المفيد', viewer: '' });
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.href = '/manifest.webmanifest';
    setInstallStatus('تم ضبط التثبيت للمنصة الكاملة. اضغط تثبيت أو استخدم قائمة المتصفح.', 'ready');
    promptInstall();
  });

  updatePreview();
}

function wireDownloadLinks() {
  document.addEventListener('click', (event) => {
    const fullLink = event.target.closest('[data-pwa-download-full]');
    const indexedLink = event.target.closest('[data-pwa-download-indexed]');
    const bundleLink = event.target.closest('[data-pwa-download-bundle]');
    if (!fullLink && !indexedLink && !bundleLink) return;

    const doc = getSelectedValue('pwa-doc', 'quran1.pdf');
    if (fullLink) {
      fullLink.href = `/api/pdf-download?doc=${encodeURIComponent(doc)}`;
      fullLink.setAttribute('download', doc);
    }
    if (indexedLink) {
      indexedLink.href = `/api/pdf-indexed?doc=${encodeURIComponent(doc)}`;
      indexedLink.setAttribute('download', doc.replace(/\.pdf$/i, '_indexed.pdf'));
    }
    if (bundleLink) {
      bundleLink.href = `/api/index-bundle?doc=${encodeURIComponent(doc)}`;
      bundleLink.setAttribute('download', doc.replace(/\.pdf$/i, '_index_bundle.json'));
    }
  });
}

function injectPwaHead() {
  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#c7a45a';
    document.head.appendChild(theme);
  }

  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/manifest.webmanifest';
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'apple-touch-icon';
    icon.href = '/assets/dlel.png';
    document.head.appendChild(icon);
  }
}

async function initPwa() {
  injectPwaHead();
  wireInstallPrompt();
  wireDownloadLinks();
  renderInstallForm();
  await registerServiceWorker();
  updatePreview();

  if (window.matchMedia('(display-mode: standalone)').matches) {
    setInstallStatus('أنت تستخدم التطبيق في وضع standalone.', 'success');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPwa);
} else {
  initPwa();
}

export {
  buildViewerStartUrl,
  buildManifestUrl,
  updateManifestLink,
  promptInstall
};
