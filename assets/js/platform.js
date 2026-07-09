const navToggle = document.querySelector('[data-mobile-toggle]');
const navLinks = document.querySelector('[data-nav-links]');

function closeMobileNav() {
  if (navLinks) navLinks.classList.remove('open');
}

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

if (navLinks && !navLinks.querySelector('[data-nav-close]')) {
  const navClose = document.createElement('button');
  navClose.type = 'button';
  navClose.className = 'icon-btn nav-close-btn';
  navClose.setAttribute('data-nav-close', '');
  navClose.setAttribute('aria-label', 'إغلاق القائمة');
  navClose.textContent = '✕';
  navLinks.appendChild(navClose);
}

document.querySelectorAll('[data-nav-close]').forEach((button) => {
  button.addEventListener('click', closeMobileNav);
});

const darkModeBtn = document.querySelector('[data-dark-toggle]');
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.body.classList.add('dark');
}

if (darkModeBtn) {
  darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
}

const langBtn = document.querySelector('[data-lang-toggle]');
if (langBtn) {
  langBtn.addEventListener('click', () => {
    document.body.classList.toggle('rtl');
    localStorage.setItem('dir', document.body.classList.contains('rtl') ? 'rtl' : 'ltr');
  });
}

const savedDir = localStorage.getItem('dir');
if (savedDir === 'rtl') {
  document.body.classList.add('rtl');
}

function buildCurrentViewerManifestUrl() {
  if (!document.body.classList.contains('viewer-mode')) return '/manifest.webmanifest';
  const params = new URLSearchParams(window.location.search);
  const doc = params.get('doc') || 'quran1.pdf';
  const page = Math.max(1, Number(params.get('page') || 1));
  const viewer = params.get('viewer') || 'images';
  const manifestParams = new URLSearchParams({
    doc,
    page: String(page),
    viewer,
    name: 'الدليل المفيد'
  });
  return `/manifest.webmanifest?${manifestParams.toString()}`;
}

function updateViewerManifestLink() {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return;
  link.href = buildCurrentViewerManifestUrl();
}

updateViewerManifestLink();
window.addEventListener('popstate', updateViewerManifestLink);
document.addEventListener('pdf:rendered', updateViewerManifestLink);

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

if (document.body.classList.contains('viewer-mode')) {
  let viewerInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    viewerInstallPrompt = event;
    document.querySelectorAll('[data-viewer-install]').forEach((button) => {
      button.disabled = false;
      button.hidden = false;
    });
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-viewer-install]');
    if (!button) return;

    updateViewerManifestLink();
    if (!viewerInstallPrompt) {
      button.textContent = 'من قائمة المتصفح';
      button.title = 'اختر Install App أو إضافة إلى الشاشة الرئيسية من قائمة المتصفح';
      return;
    }

    viewerInstallPrompt.prompt();
    await viewerInstallPrompt.userChoice;
    viewerInstallPrompt = null;
    button.textContent = 'تم';
  });
}

const activeLink = document.querySelector(`.nav-link[href="${window.location.pathname.split('/').pop() || 'index.html'}"]`);
if (activeLink) {
  activeLink.classList.add('active');
}

const quickSearchForms = document.querySelectorAll('[data-search-form]');
quickSearchForms.forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.querySelector('input');
    const q = input ? encodeURIComponent(input.value.trim()) : '';
    window.location.href = `search.html?q=${q}`;
  });
});

const LIBRARY_DOCS = [
  {
    title: 'الدليل المفيد',
    category: 'education',
    date: '2026-04-16',
    popularity: 100,
    pages: 241,
    doc: 'quran1.pdf'
  },
  {
    title: 'الدليل المفيد — نسخة مضغوطة',
    category: 'education',
    date: '2026-05-23',
    popularity: 90,
    pages: 241,
    doc: 'quran1_compressed.pdf'
  }
];

const CATEGORY_LABELS = {
  religion: 'ديني',
  education: 'تعليمي',
  guides: 'أدلة'
};

function getPdfDownloadUrl(doc) {
  return `/api/pdf-download?doc=${encodeURIComponent(doc)}`;
}

function getPdfIndexedDownloadUrl(doc) {
  return `/api/pdf-indexed?doc=${encodeURIComponent(doc)}`;
}

function renderIslamicPdfCard(doc) {
  const categoryLabel = CATEGORY_LABELS[doc.category] || doc.category;
  const viewerHref = `viewer.html?doc=${encodeURIComponent(doc.doc)}`;
  const downloadHref = getPdfDownloadUrl(doc.doc);
  const indexedHref = getPdfIndexedDownloadUrl(doc.doc);

  return `
    <article class="islamic-pdf-card">
      <div class="islamic-card-inner">
        <div class="islamic-card-ornament" aria-hidden="true">
          <span></span>
          <i>✦</i>
          <span></span>
        </div>
        <span class="islamic-card-badge">${categoryLabel}</span>
        <h3 class="islamic-card-title">${doc.title}</h3>
        <div class="islamic-card-meta">
          <span>${doc.pages} صفحة</span>
          <span>${doc.date}</span>
        </div>
        <div class="islamic-card-actions">
          <a class="btn primary" href="${viewerHref}">فتح</a>
          <a class="btn" href="${downloadHref}" download="${doc.doc}">تحميل PDF كامل</a>
          <a class="btn" href="${indexedHref}" download="${doc.doc.replace(/\.pdf$/i, '_indexed.pdf')}">PDF مفهرس</a>
        </div>
      </div>
    </article>
  `;
}

function renderLandingBooks() {
  const grid = document.querySelector('[data-landing-books]');
  if (!grid) return;

  grid.innerHTML = LIBRARY_DOCS.map((doc) => renderIslamicPdfCard(doc)).join('');
}

function renderLibrary() {
  const grid = document.querySelector('[data-library-grid]');
  if (!grid) return;

  const docs = LIBRARY_DOCS;
  const categoryInput = document.querySelector('[data-filter-category]');
  const sortInput = document.querySelector('[data-filter-sort]');
  const params = new URLSearchParams(window.location.search);
  const categoryFromUrl = (params.get('category') || '').toLowerCase();
  if (categoryInput && categoryFromUrl) {
    categoryInput.value = ['religion', 'education', 'guides'].includes(categoryFromUrl) ? categoryFromUrl : 'all';
  }

  const paint = () => {
    let list = [...docs];
    const category = categoryInput ? categoryInput.value : 'all';
    const sort = sortInput ? sortInput.value : 'popularity';

    if (category !== 'all') {
      list = list.filter((doc) => doc.category === category);
    }

    if (sort === 'date') {
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    if (sort === 'popularity') {
      list.sort((a, b) => b.popularity - a.popularity);
    }

    if (sort === 'pages') {
      list.sort((a, b) => b.pages - a.pages);
    }

    if (!list.length) {
      grid.innerHTML = '<div class="empty">لا توجد ملفات PDF مطابقة لهذا الفلتر.</div>';
      return;
    }

    grid.innerHTML = list.map((doc) => renderIslamicPdfCard(doc)).join('');
  };

  grid.innerHTML = '<div class="loading"><div class="skeleton"><div class="shimmer"></div><div class="shimmer"></div><div class="shimmer" style="width:65%"></div></div></div>';
  setTimeout(paint, 350);

  if (categoryInput) categoryInput.addEventListener('change', paint);
  if (sortInput) sortInput.addEventListener('change', paint);
}

function renderSearchResults() {
  const container = document.querySelector('[data-search-results]');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const q = (params.get('q') || '').trim();
  const headline = document.querySelector('[data-search-headline]');
  if (headline) {
    headline.textContent = q ? `نتائج البحث عن "${q}"` : 'نتائج البحث';
  }

  const entries = [
    { title: 'الدليل المفيد', snippet: 'كتاب التجويد والقرآن الكريم — فهرس تفاعلي وبحث داخل المحتوى.', page: 15 },
    { title: 'الدليل المفيد — المبحث الأول', snippet: 'القرآن الكريم فضله وآداب تلاوته.', page: 2 },
    { title: 'الدليل المفيد — أحكام التجويد', snippet: 'أحكام النون الساكنة والتنوين والمد والقصر.', page: 54 }
  ];

  if (!q) {
    container.innerHTML = '<div class="empty">اكتب كلمة للبحث. سريع وواضح.</div>';
    return;
  }

  const normalized = q.toLowerCase();
  const matched = entries.filter((entry) => (`${entry.title} ${entry.snippet}`).toLowerCase().includes(normalized));

  if (!matched.length) {
    container.innerHTML = '<div class="empty">لا توجد نتائج مطابقة. جرّب كلمة أخرى.</div>';
    return;
  }

  const mark = (text) => text.replace(new RegExp(`(${q})`, 'ig'), '<mark>$1</mark>');
  container.innerHTML = matched.map((entry) => `
    <article class="card reveal">
      <h3>${mark(entry.title)}</h3>
      <p class="muted">${mark(entry.snippet)}</p>
      <div class="actions-row">
        <a class="btn primary" href="viewer.html?doc=quran1.pdf&page=${entry.page}">فتح الصفحة ${entry.page}</a>
      </div>
    </article>
  `).join('');
}

function wireContactForm() {
  const form = document.querySelector('[data-contact-form]');
  const feedback = document.querySelector('[data-form-feedback]');
  if (!form || !feedback) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    feedback.textContent = 'تم إرسال الرسالة بنجاح. سنقوم بالرد قريباً.';
    form.reset();
  });
}

renderLandingBooks();
renderLibrary();
renderSearchResults();
wireContactForm();
