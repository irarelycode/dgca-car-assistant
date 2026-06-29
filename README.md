# DGCA CAR Assistant – Live GitHub Version

Dynamic, real-time chatbot knowledge base linked directly to your Google Sheet.

## How it works
- No backend. Pure HTML/JS hosted on GitHub Pages.
- Fetches your sheet as CSV on every page load.
- Updates in Google Sheets appear instantly.

## Deploy in 3 minutes
1. **Make sheet public (read-only)**
   - Open your sheet → File → Share → Anyone with link: Viewer
   - Then File → Publish to web → Entire document → CSV → Publish → copy URL
2. **Edit config.js**
   - Replace SHEET_CSV_URL with your published CSV link
3. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "DGCA live"
   git branch -M main
   git remote add origin https://github.com/<you>/dgca-assistant.git
   git push -u origin main
   ```
4. **Enable Pages**
   - GitHub → Settings → Pages → Source: main branch / root → Save
   - Your site: https://<you>.github.io/dgca-assistant/

## Files
- index.html – UI
- app.js – fetches CSV, renders table, mock chat
- config.js – your sheet URL
- style.css

Updates? Just edit the Google Sheet. No redeploy needed.
