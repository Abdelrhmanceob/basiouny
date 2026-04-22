# Interactive Digital Book Website

This is a fully functional interactive book website generated from a PDF file with Arabic/English support.

## Features

✅ **Interactive Table of Contents** - Click any chapter to navigate directly  
✅ **Full-Text Search** - Search across the entire book in Arabic and English  
✅ **Responsive Design** - Works perfectly on mobile and desktop  
✅ **Dark Mode** - Toggle between light and dark themes  
✅ **Keyboard Navigation** - Use arrow keys to navigate pages  
✅ **Optimized PDF Download** - Download the compressed PDF version  
✅ **RTL/LTR Support** - Automatic detection and proper text direction  

## Deployment Instructions

### Option 1: Local Deployment

1. **Open directly in browser**
   - Simply double-click `index.html` to open the website
   - Works without any server setup

2. **Using Python HTTP Server**
   ```bash
   cd website
   python -m http.server 8000
   ```
   Then open http://localhost:8000

3. **Using Node.js HTTP Server**
   ```bash
   npx http-server -p 8000
   ```
   Then open http://localhost:8000

### Option 2: Web Server Deployment

1. **Upload all files** in this folder to your web server
2. **Ensure file structure** is maintained:
   ```
   /
   ├── index.html
   └── assets/
       ├── content.json
       ├── search_index.json
       ├── book_optimized.pdf
       ├── css/
       │   └── style.css
       └── js/
           └── app.js
   ```

3. **No server-side configuration** needed - it's a static website

### Option 3: GitHub Pages

1. Create a new GitHub repository
2. Upload all files
3. Go to Settings → Pages
4. Select source branch and save
5. Your site will be available at `https://[username].github.io/[repo-name]`

### Option 4: Netlify/Vercel

1. Drag and drop the entire `website` folder
2. Your site will be instantly deployed with a custom URL

## File Structure

- `index.html` - Main HTML file
- `assets/content.json` - Book content data (pages and TOC)
- `assets/search_index.json` - Search index for fast searching
- `assets/book_optimized.pdf` - Downloadable optimized PDF
- `assets/css/style.css` - Responsive styles with RTL support
- `assets/js/app.js` - Interactive functionality

## Usage

### Navigation
- Click TOC items to jump to chapters
- Use Previous/Next buttons to navigate pages
- Use arrow keys (← →) for keyboard navigation

### Search
- Type in the search box and press Enter or click 🔍
- Click on search results to jump to that page
- Close search results with the × button

### Features
- Click ☰ to toggle sidebar on mobile
- Click 🌓 to toggle dark mode
- Click ⬇ PDF to download the optimized PDF

## Browser Support

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## Performance

- Fast loading with lazy content
- Optimized for mobile devices
- Minimal bandwidth usage
- No external dependencies

## Customization

To customize the appearance, edit:
- `assets/css/style.css` for styling
- CSS variables at the top for colors
- Font families for different languages

## License

This website was generated from your PDF content. The website code is free to use and modify.

---

Generated on: March 09, 2026