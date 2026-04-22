// Enhanced Digital Book Application
class DigitalBook {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 0;
        this.content = null;
        this.searchIndex = null;
        this.toc = null;
        this.isRTL = false;
        
        // New features state
        this.bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
        this.notes = JSON.parse(localStorage.getItem('pageNotes')) || {};
        this.readingProgress = JSON.parse(localStorage.getItem('readingProgress')) || { pagesRead: [], lastPage: 1, timeSpent: 0 };
        this.startTime = Date.now();
        this.zoomLevel = parseFloat(localStorage.getItem('zoomLevel')) || 1.0;
        this.textSize = parseInt(localStorage.getItem('textSize')) || 16;
        this.isFullscreen = false;
        this.readingStats = JSON.parse(localStorage.getItem('readingStats')) || { 
            totalTime: 0, 
            sessionsCount: 0, 
            pagesRead: 0, 
            averageTimePerPage: 0 
        };
        
        // Voice recognition setup
        this.recognition = null;
        this.isListening = false;
        this.setupVoiceRecognition();
        
        this.init();
    }
    
    async init() {
        try {
            // Show loading
            this.showLoading(true);
            
            // Load content and search index
            await this.loadContent();
            await this.loadSearchIndex();
            
            // Initialize UI
            this.setupEventListeners();
            this.renderTOC();
            this.renderPage(this.readingProgress.lastPage || 1);
            
            // Check for saved theme
            this.loadTheme();
            
            // Initialize new features
            this.initializeNewFeatures();
            
            // Hide loading
            this.showLoading(false);
        } catch (error) {
            console.error('Error initializing book:', error);
            alert('Error loading book content');
        }
    }
    
    initializeNewFeatures() {
        // Apply saved settings
        this.applyZoomLevel();
        this.applyTextSize();
        
        // Update reading statistics
        this.updateReadingStats();
        
        // Setup auto-save for reading progress
        setInterval(() => {
            this.saveReadingProgress();
        }, 30000); // Save every 30 seconds
        
        // Create floating controls
        this.createFloatingControls();
        
        // Load bookmarks UI
        this.renderBookmarks();
        
        // Setup fullscreen change handler
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
            this.updateFullscreenButton();
        });
    }
    
    async loadContent() {
        const response = await fetch('assets/content.json');
        const data = await response.json();
        
        this.content = data.pages;
        this.totalPages = data.total_pages;
        this.isRTL = data.is_rtl;
        
        // Load TOC from separate file
        try {
            const tocResponse = await fetch('dist/data/toc.json');
            const tocData = await tocResponse.json();
            this.toc = tocData.toc;
        } catch (error) {
            console.warn('Could not load TOC from dist/data/toc.json, using fallback from content.json');
            this.toc = data.toc || [];
        }
    }
    
    async loadSearchIndex() {
        const response = await fetch('assets/search_index.json');
        this.searchIndex = await response.json();
    }
    
    setupEventListeners() {
        // Navigation
        document.getElementById('prev-page').addEventListener('click', () => this.prevPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());
        
        // Search
        document.getElementById('search-btn').addEventListener('click', () => this.search());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });
        document.getElementById('close-search').addEventListener('click', () => this.closeSearch());
        
        // Sidebar
        document.getElementById('menu-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('menu-overlay').addEventListener('click', () => this.toggleSidebar());
        
        // Theme
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        
        // Download PDF
        document.getElementById('download-pdf').addEventListener('click', () => this.downloadPDF());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // New feature event listeners will be added when creating controls
    }
    
    createFloatingControls() {
        // Create floating control panel
        const floatingControls = document.createElement('div');
        floatingControls.id = 'floating-controls';
        floatingControls.className = 'floating-controls';
        floatingControls.innerHTML = `
            <div class="control-group">
                <button id="bookmark-btn" class="control-btn" title="إضافة إشارة مرجعية">🔖</button>
                <button id="note-btn" class="control-btn" title="إضافة ملاحظة">📝</button>
                <button id="zoom-in" class="control-btn" title="تكبير">🔍+</button>
                <button id="zoom-out" class="control-btn" title="تصغير">🔍-</button>
                <button id="fullscreen-btn" class="control-btn" title="شاشة كاملة">⛶</button>
                <button id="voice-btn" class="control-btn" title="التحكم الصوتي">🎤</button>
                <button id="stats-btn" class="control-btn" title="إحصائيات القراءة">📊</button>
                <button id="jump-page" class="control-btn" title="الانتقال لصفحة">📄</button>
            </div>
            <div class="control-group">
                <label class="size-control">حجم النص:
                    <input type="range" id="text-size-slider" min="12" max="24" step="1" value="${this.textSize}">
                    <span id="text-size-value">${this.textSize}px</span>
                </label>
            </div>
        `;
        document.body.appendChild(floatingControls);
        
        // Add event listeners for new controls
        document.getElementById('bookmark-btn').addEventListener('click', () => this.toggleBookmark());
        document.getElementById('note-btn').addEventListener('click', () => this.showNoteDialog());
        document.getElementById('zoom-in').addEventListener('click', () => this.adjustZoom(0.1));
        document.getElementById('zoom-out').addEventListener('click', () => this.adjustZoom(-0.1));
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('voice-btn').addEventListener('click', () => this.toggleVoiceRecognition());
        document.getElementById('stats-btn').addEventListener('click', () => this.showReadingStats());
        document.getElementById('jump-page').addEventListener('click', () => this.showPageJumpDialog());
        
        const textSizeSlider = document.getElementById('text-size-slider');
        textSizeSlider.addEventListener('input', (e) => {
            this.setTextSize(parseInt(e.target.value));
        });
    }
    
    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ar-SA'; // Arabic
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            
            this.recognition.onresult = (event) => {
                const command = event.results[0][0].transcript.toLowerCase();
                this.processVoiceCommand(command);
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;
                this.updateVoiceButton();
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                this.updateVoiceButton();
            };
        }
    }
    
    processVoiceCommand(command) {
        if (command.includes('التالي') || command.includes('next')) {
            this.nextPage();
        } else if (command.includes('السابق') || command.includes('previous')) {
            this.prevPage();
        } else if (command.includes('فهرس') || command.includes('contents')) {
            this.toggleSidebar();
        } else if (command.includes('بحث') || command.includes('search')) {
            document.getElementById('search-input').focus();
        } else if (command.includes('إشارة') || command.includes('bookmark')) {
            this.toggleBookmark();
        } else if (command.includes('ملاحظة') || command.includes('note')) {
            this.showNoteDialog();
        }
    }
    
    renderTOC() {
        const tocNav = document.getElementById('toc-nav');
        tocNav.innerHTML = '';
        
        // Add bookmarks section
        const bookmarksSection = document.createElement('div');
        bookmarksSection.className = 'bookmarks-section';
        bookmarksSection.innerHTML = `
            <h3 class="bookmarks-title">الإشارات المرجعية</h3>
            <div id="bookmarks-list" class="bookmarks-list"></div>
        `;
        tocNav.appendChild(bookmarksSection);
        
        // Add separator
        const separator = document.createElement('hr');
        separator.className = 'toc-separator';
        tocNav.appendChild(separator);
        
        // Add TOC items
        this.toc.forEach(item => {
            const tocItem = document.createElement('div');
            tocItem.className = 'toc-item';
            
            // Create title and page number display
            tocItem.innerHTML = `
                <span class="toc-title">${item.title}</span>
                <span class="toc-page">${item.page}</span>
            `;
            
            tocItem.dataset.page = item.page;
            
            tocItem.addEventListener('click', () => {
                this.renderPage(item.page);
                if (window.innerWidth <= 768) {
                    this.toggleSidebar();
                }
            });
            
            tocNav.appendChild(tocItem);
        });
        
        this.renderBookmarks();
    }
    
    renderBookmarks() {
        const bookmarksList = document.getElementById('bookmarks-list');
        if (!bookmarksList) return;
        
        bookmarksList.innerHTML = '';
        
        if (this.bookmarks.length === 0) {
            bookmarksList.innerHTML = '<p class="no-bookmarks">لا توجد إشارات مرجعية</p>';
            return;
        }
        
        this.bookmarks.forEach((bookmark, index) => {
            const bookmarkItem = document.createElement('div');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.innerHTML = `
                <span class="bookmark-title" title="${bookmark.note || ''}">
                    صفحة ${bookmark.page} - ${bookmark.title || 'إشارة مرجعية'}
                </span>
                <div class="bookmark-actions">
                    <button class="bookmark-go" data-page="${bookmark.page}" title="انتقال">→</button>
                    <button class="bookmark-delete" data-index="${index}" title="حذف">×</button>
                </div>
            `;
            bookmarksList.appendChild(bookmarkItem);
        });
        
        // Add event listeners for bookmark actions
        document.querySelectorAll('.bookmark-go').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                this.renderPage(page);
                if (window.innerWidth <= 768) {
                    this.toggleSidebar();
                }
            });
        });
        
        document.querySelectorAll('.bookmark-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeBookmark(index);
            });
        });
    }
    
    renderPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;
        
        this.currentPage = pageNum;
        const page = this.content[pageNum - 1];
        
        // Update content
        const pageContentEl = document.getElementById('page-content');
        pageContentEl.innerHTML = page.html;
        
        // Set data-page attribute for watermark targeting (pages 10-239)
        if (pageNum >= 10 && pageNum <= 239) {
            pageContentEl.setAttribute('data-page', pageNum.toString());
        } else {
            pageContentEl.removeAttribute('data-page');
        }
        
        // Update navigation
        document.getElementById('page-info').textContent = `${pageNum} / ${this.totalPages}`;
        document.getElementById('prev-page').disabled = pageNum === 1;
        document.getElementById('next-page').disabled = pageNum === this.totalPages;
        
        // Update active TOC item
        document.querySelectorAll('.toc-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.page) === pageNum);
        });
        
        // Update bookmark button
        this.updateBookmarkButton();
        
        // Track reading progress
        this.trackPageRead(pageNum);
        
        // Show notes if available
        this.showPageNotes();
        
        // Scroll to top
        document.getElementById('book-container').scrollTop = 0;
        
        // Apply current zoom and text size
        this.applyZoomLevel();
        this.applyTextSize();
    }
    
    // Enhanced navigation methods
    prevPage() {
        this.renderPage(this.currentPage - 1);
    }
    
    nextPage() {
        this.renderPage(this.currentPage + 1);
    }
    
    // New feature methods
    toggleBookmark() {
        const existingIndex = this.bookmarks.findIndex(b => b.page === this.currentPage);
        
        if (existingIndex > -1) {
            this.removeBookmark(existingIndex);
        } else {
            const title = prompt('عنوان الإشارة المرجعية (اختياري):', `صفحة ${this.currentPage}`);
            if (title !== null) {
                this.addBookmark(this.currentPage, title);
            }
        }
    }
    
    addBookmark(page, title = '', note = '') {
        const bookmark = {
            page: page,
            title: title || `صفحة ${page}`,
            note: note,
            date: new Date().toISOString()
        };
        
        this.bookmarks.push(bookmark);
        this.bookmarks.sort((a, b) => a.page - b.page);
        localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
        
        this.renderBookmarks();
        this.updateBookmarkButton();
        this.showNotification('تمت إضافة الإشارة المرجعية');
    }
    
    removeBookmark(index) {
        this.bookmarks.splice(index, 1);
        localStorage.setItem('bookmarks', JSON.stringify(this.bookmarks));
        
        this.renderBookmarks();
        this.updateBookmarkButton();
        this.showNotification('تم حذف الإشارة المرجعية');
    }
    
    updateBookmarkButton() {
        const bookmarkBtn = document.getElementById('bookmark-btn');
        const isBookmarked = this.bookmarks.some(b => b.page === this.currentPage);
        
        if (bookmarkBtn) {
            bookmarkBtn.style.color = isBookmarked ? '#ff6b6b' : '';
            bookmarkBtn.title = isBookmarked ? 'إزالة الإشارة المرجعية' : 'إضافة إشارة مرجعية';
        }
    }
    
    showNoteDialog() {
        const existingNote = this.notes[this.currentPage] || '';
        const note = prompt('ملاحظة للصفحة الحالية:', existingNote);
        
        if (note !== null) {
            if (note.trim()) {
                this.notes[this.currentPage] = note.trim();
            } else {
                delete this.notes[this.currentPage];
            }
            
            localStorage.setItem('pageNotes', JSON.stringify(this.notes));
            this.showPageNotes();
            this.showNotification(note.trim() ? 'تم حفظ الملاحظة' : 'تم حذف الملاحظة');
        }
    }
    
    showPageNotes() {
        // Remove existing note display
        const existingNote = document.querySelector('.page-note');
        if (existingNote) {
            existingNote.remove();
        }
        
        const note = this.notes[this.currentPage];
        if (note) {
            const noteElement = document.createElement('div');
            noteElement.className = 'page-note';
            noteElement.innerHTML = `
                <div class="note-content">
                    <strong>ملاحظة:</strong> ${note}
                    <button class="note-edit" onclick="digitalBook.showNoteDialog()">✏️</button>
                </div>
            `;
            
            const bookContainer = document.getElementById('book-container');
            bookContainer.insertBefore(noteElement, bookContainer.firstChild);
        }
    }
    
    adjustZoom(delta) {
        this.zoomLevel = Math.max(0.5, Math.min(3.0, this.zoomLevel + delta));
        localStorage.setItem('zoomLevel', this.zoomLevel.toString());
        this.applyZoomLevel();
        this.showNotification(`التكبير: ${Math.round(this.zoomLevel * 100)}%`);
    }
    
    applyZoomLevel() {
        const pageContent = document.getElementById('page-content');
        if (pageContent) {
            pageContent.style.transform = `scale(${this.zoomLevel})`;
            pageContent.style.transformOrigin = this.isRTL ? 'top right' : 'top left';
        }
    }
    
    setTextSize(size) {
        this.textSize = size;
        localStorage.setItem('textSize', size.toString());
        this.applyTextSize();
        
        const textSizeValue = document.getElementById('text-size-value');
        if (textSizeValue) {
            textSizeValue.textContent = `${size}px`;
        }
    }
    
    applyTextSize() {
        const pageContent = document.getElementById('page-content');
        if (pageContent) {
            pageContent.style.fontSize = `${this.textSize}px`;
        }
    }
    
    toggleFullscreen() {
        if (!this.isFullscreen) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    updateFullscreenButton() {
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.textContent = this.isFullscreen ? '⛶' : '⛶';
            fullscreenBtn.title = this.isFullscreen ? 'خروج من الشاشة الكاملة' : 'شاشة كاملة';
        }
    }
    
    toggleVoiceRecognition() {
        if (!this.recognition) {
            this.showNotification('التحكم الصوتي غير مدعوم في هذا المتصفح');
            return;
        }
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
            this.isListening = true;
        }
        
        this.updateVoiceButton();
    }
    
    updateVoiceButton() {
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.style.color = this.isListening ? '#ff6b6b' : '';
            voiceBtn.title = this.isListening ? 'إيقاف التحكم الصوتي' : 'التحكم الصوتي';
        }
    }
    
    showPageJumpDialog() {
        const page = prompt(`الانتقال إلى صفحة (1-${this.totalPages}):`, this.currentPage.toString());
        if (page !== null) {
            const pageNum = parseInt(page);
            if (pageNum >= 1 && pageNum <= this.totalPages) {
                this.renderPage(pageNum);
            } else {
                this.showNotification('رقم صفحة غير صحيح');
            }
        }
    }
    
    trackPageRead(pageNum) {
        if (!this.readingProgress.pagesRead.includes(pageNum)) {
            this.readingProgress.pagesRead.push(pageNum);
        }
        this.readingProgress.lastPage = pageNum;
        
        // Calculate reading time for this page
        const now = Date.now();
        const timeOnPage = now - this.startTime;
        this.readingProgress.timeSpent += timeOnPage;
        this.startTime = now;
    }
    
    saveReadingProgress() {
        localStorage.setItem('readingProgress', JSON.stringify(this.readingProgress));
    }
    
    updateReadingStats() {
        this.readingStats.sessionsCount++;
        this.readingStats.pagesRead = this.readingProgress.pagesRead.length;
        
        if (this.readingStats.pagesRead > 0) {
            this.readingStats.averageTimePerPage = this.readingProgress.timeSpent / this.readingStats.pagesRead;
        }
        
        localStorage.setItem('readingStats', JSON.stringify(this.readingStats));
    }
    
    showReadingStats() {
        const totalMinutes = Math.round(this.readingProgress.timeSpent / 60000);
        const progressPercentage = Math.round((this.readingProgress.pagesRead.length / this.totalPages) * 100);
        const avgTimePerPage = Math.round(this.readingStats.averageTimePerPage / 1000);
        
        const statsDialog = document.createElement('div');
        statsDialog.className = 'stats-dialog';
        statsDialog.innerHTML = `
            <div class="stats-content">
                <h3>إحصائيات القراءة</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">${this.readingProgress.pagesRead.length}</span>
                        <span class="stat-label">صفحة مقروءة</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${progressPercentage}%</span>
                        <span class="stat-label">التقدم</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${totalMinutes}</span>
                        <span class="stat-label">دقيقة قراءة</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${avgTimePerPage}</span>
                        <span class="stat-label">ثانية/صفحة</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.bookmarks.length}</span>
                        <span class="stat-label">إشارة مرجعية</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${Object.keys(this.notes).length}</span>
                        <span class="stat-label">ملاحظة</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
                <button class="close-stats" onclick="this.parentElement.parentElement.remove()">إغلاق</button>
            </div>
        `;
        
        document.body.appendChild(statsDialog);
        
        // Auto remove after 10 seconds
        setTimeout(() => {
            if (statsDialog.parentElement) {
                statsDialog.remove();
            }
        }, 10000);
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // Existing methods continue...
    async search() {
        const query = document.getElementById('search-input').value.trim().toLowerCase();
        if (!query) return;
        
        const results = [];
        const words = query.split(' ');
        
        // Search through pages
        this.content.forEach((page, index) => {
            const pageText = page.text.toLowerCase();
            
            // Check if all words are in the page
            const hasAllWords = words.every(word => pageText.includes(word));
            
            if (hasAllWords) {
                // Find context around the match
                const contextLength = 100;
                const firstWordIndex = pageText.indexOf(words[0]);
                const start = Math.max(0, firstWordIndex - contextLength);
                const end = Math.min(pageText.length, firstWordIndex + contextLength);
                const context = page.text.substring(start, end);
                
                results.push({
                    page: index + 1,
                    text: context,
                    highlight: words
                });
            }
        });
        
        this.displaySearchResults(results, query);
    }
    
    displaySearchResults(results, query) {
        const resultsContainer = document.getElementById('results-container');
        const searchResults = document.getElementById('search-results');
        
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `<p>${this.isRTL ? 'لا توجد نتائج' : 'No results found'}</p>`;
        } else {
            results.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                
                // Highlight search terms
                let highlightedText = result.text;
                result.highlight.forEach(word => {
                    const regex = new RegExp(word, 'gi');
                    highlightedText = highlightedText.replace(regex, match => 
                        `<span class="highlight">${match}</span>`
                    );
                });
                
                resultItem.innerHTML = `
                    <div class="result-page">${this.isRTL ? 'صفحة' : 'Page'} ${result.page}</div>
                    <div class="result-text">...${highlightedText}...</div>
                `;
                
                resultItem.addEventListener('click', () => {
                    this.renderPage(result.page);
                    this.closeSearch();
                });
                
                resultsContainer.appendChild(resultItem);
            });
        }
        
        searchResults.classList.remove('hidden');
    }
    
    closeSearch() {
        document.getElementById('search-results').classList.add('hidden');
        document.getElementById('search-input').value = '';
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('menu-overlay');
        
        sidebar.classList.toggle('hidden');
        overlay.classList.toggle('active');
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    downloadPDF() {
        // Download optimized PDF
        window.open('assets/book_optimized.pdf', '_blank');
    }
    
    handleKeyboard(e) {
        // Don't interfere with typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (this.isRTL) {
                    this.nextPage();
                } else {
                    this.prevPage();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (this.isRTL) {
                    this.prevPage();
                } else {
                    this.nextPage();
                }
                break;
            case 'f':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    document.getElementById('search-input').focus();
                }
                break;
            case 'b':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.toggleBookmark();
                }
                break;
            case 'n':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.showNoteDialog();
                }
                break;
            case 'g':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.showPageJumpDialog();
                }
                break;
            case '=':
            case '+':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.adjustZoom(0.1);
                }
                break;
            case '-':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.adjustZoom(-0.1);
                }
                break;
            case 'F11':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }
    
    showLoading(show) {
        document.getElementById('loading').classList.toggle('active', show);
    }
}

// Enhanced Image loading
class ImageLoader {
    static setupLazyLoading() {
        const images = document.querySelectorAll('.page-image');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.addEventListener('load', () => {
                        img.classList.add('loaded');
                    });
                    if (img.complete) {
                        img.classList.add('loaded');
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    static preloadNextImages(currentPage, totalPages) {
        // Preload next 3 images for better UX
        for (let i = 1; i <= 3; i++) {
            const nextPage = currentPage + i;
            if (nextPage <= totalPages) {
                const img = new Image();
                const pageStr = nextPage.toString().padStart(3, '0');
                img.src = `assets/images/page-${pageStr}.png`;
            }
        }
    }
}

// Global instance
let digitalBook;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    digitalBook = new DigitalBook();
    
    // Setup image loading after initialization
    setTimeout(() => {
        ImageLoader.setupLazyLoading();
    }, 1000);
});

// Enhanced renderPage override
const originalRenderPage = DigitalBook.prototype.renderPage;
DigitalBook.prototype.renderPage = function(pageNum) {
    const result = originalRenderPage.call(this, pageNum);
    
    // Setup image loading after page render
    setTimeout(() => {
        ImageLoader.setupLazyLoading();
        ImageLoader.preloadNextImages(pageNum, this.totalPages);
    }, 100);
    
    return result;
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (digitalBook) {
        digitalBook.saveReadingProgress();
        digitalBook.updateReadingStats();
    }
});
