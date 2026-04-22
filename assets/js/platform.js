const navToggle = document.querySelector('[data-mobile-toggle]');
const navLinks = document.querySelector('[data-nav-links]');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

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

function renderLibrary() {
  const grid = document.querySelector('[data-library-grid]');
  if (!grid) return;

  const docs = [
    { title: 'نسخة القرآن الرئيسية', category: 'religion', date: '2026-04-18', popularity: 95, pages: 604 },
    { title: 'ملاحظات دراسة القرآن', category: 'education', date: '2026-03-22', popularity: 81, pages: 240 },
    { title: 'دليل قراءة القرآن', category: 'guides', date: '2026-02-11', popularity: 73, pages: 88 }
  ];

  const categoryLabels = {
    religion: 'ديني',
    education: 'تعليمي',
    guides: 'أدلة'
  };

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

    grid.innerHTML = list.map((doc) => `
      <article class="card reveal">
        <span class="tag">${categoryLabels[doc.category] || doc.category}</span>
        <h3 style="margin-top:.6rem">${doc.title}</h3>
        <p class="muted">${doc.pages} صفحة • ${doc.date}</p>
        <div class="actions-row" style="margin-top:.8rem">
          <a class="btn primary" href="viewer.html?doc=quran1.pdf">فتح</a>
          <a class="btn" href="assets/quran1.pdf" download>تحميل</a>
        </div>
      </article>
    `).join('');
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
    { title: 'نسخة القرآن الرئيسية', snippet: 'ابحث عن الآيات والأقسام بسرعة ضمن تجربة PDF كاملة.', page: 15 },
    { title: 'دليل قراءة القرآن', snippet: 'دليل مختصر يساعدك على قراءة يومية أوضح.', page: 5 },
    { title: 'ملاحظات دراسة القرآن', snippet: 'ملاحظات تفصيلية مع كلمات مفتاحية مرجعية.', page: 42 }
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

renderLibrary();
renderSearchResults();
wireContactForm();