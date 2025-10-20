# NARBE Scan Keyboard - Web Version

A fully functional HTML5 web application version of the NARBE Scan Keyboard with **real image and video search** that works immediately without any setup required.

## Features

- **Keyboard Scanning**: Navigate through rows and keys using Space and Enter
- **Text-to-Speech**: Audio feedback for all interactions
- **Predictive Text**: Word suggestions using KenLM API with local fallbacks
- **Real Image Search**: Live image search using Pexels, Google, and Unsplash APIs
- **Real Video Search**: YouTube video search using Invidious and scraping methods
- **No API Keys Required**: Works immediately out of the box
- **Responsive Design**: Works on desktop and mobile devices
- **GitHub Pages Ready**: Can be deployed to GitHub Pages instantly

## Quick Start

1. **Download or clone this repository**
2. **Open `index.html` in a web browser**
3. **Start typing and searching immediately!**

✅ **No setup required** - Real search functionality works right away!

## Controls

- **Space**: Navigate to next row/key (hold for 2.5s to go back)
- **Enter**: Select current row/key (hold for 3s for special actions)
- **Mouse/Touch**: Click any button directly

## Search Capabilities

### Image Search (Multiple Methods)
1. **Pexels API** (Primary) - High-quality stock photos, works immediately
2. **Google Custom Search** - Additional image results
3. **Unsplash Source** - Reliable fallback with themed images
4. **Bing Images** - Additional sources via scraping

### Video Search (Multiple Methods)
1. **Invidious API** - Free YouTube alternative, real search results
2. **YouTube Scraping** - Direct YouTube content parsing
3. **Curated Content** - Topic-based popular videos as fallback

### How It Works
- **No registration needed** - Uses public APIs and demo keys
- **Multiple fallbacks** - If one method fails, tries others automatically
- **Real search results** - Actually searches for your terms, not just demos
- **Fast loading** - Optimized for quick results

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── js/
│   ├── app.js          # Main application logic
│   ├── scanning.js     # Keyboard scanning functionality
│   ├── search.js       # Real search APIs (no keys needed!)
│   ├── speech.js       # Text-to-speech
│   └── predictions.js  # Predictive text
└── README.md          # This file
```

## Deployment

### GitHub Pages (Recommended)

1. Push this repository to GitHub
2. Go to repository Settings → Pages
3. Select source: Deploy from a branch
4. Choose main branch and / (root)
5. Your app will be available at `https://yourusername.github.io/repository-name`

**✅ Search functionality works on GitHub Pages!**

### Local Testing

**Python:**
```bash
python -m http.server 8000
```

**Node.js:**
```bash
npx serve .
```

Then open `http://localhost:8000`

## Search Examples

Try searching for:
- **"cats"** - Gets real cat photos and videos
- **"nature"** - Beautiful landscape and nature content  
- **"technology"** - Tech-related images and educational videos
- **"music"** - Music-related content and performances
- **"science"** - Educational science content

## Browser Compatibility

- **Chrome/Edge**: Full support, best performance
- **Firefox**: Full support, excellent performance  
- **Safari**: Full support (iOS 13+)
- **Mobile browsers**: Fully responsive on all devices

## Troubleshooting

### Search Not Working
- Check browser console for error messages
- Ensure internet connection is stable
- Some corporate firewalls may block external APIs
- Try refreshing the page if searches fail

### No Speech Output
- Check browser audio permissions
- Ensure volume is turned up
- Some browsers require user interaction before allowing speech
- Try clicking anywhere on the page first

### CORS Errors (Rare)
- Use HTTPS when possible (required for some APIs)
- GitHub Pages automatically provides HTTPS
- Local testing with HTTP server usually works fine

## Technical Details

### Image Sources
- **Pexels**: 500+ million high-quality photos
- **Google Custom Search**: Billions of indexed images
- **Unsplash**: Curated photography collection
- **Fallback generation**: Always provides results

### Video Sources  
- **Invidious**: Privacy-focused YouTube frontend APIs
- **YouTube**: Direct scraping when possible
- **Curated content**: Educational and popular videos

### Privacy & Performance
- No data stored locally or on servers
- Direct API calls from browser to search providers
- Optimized caching and fallback systems
- Speech synthesis uses browser capabilities only

## Customization

### Adding Search Providers
Edit `js/search.js` to add new image/video sources:

```javascript
// Add new image API
async searchNewImageAPI(query) {
    // Your implementation
}

// Add to search hierarchy
async searchImages(query) {
    // Add your method to the try/catch chain
}
```

### Modifying Topics
Update the `topicVideos` object in `search.js` to add new topic categories and video suggestions.

### Styling
Edit `styles.css` to customize appearance, colors, and responsive behavior.

## Advanced Features

### Predictive Text
- Uses KenLM API for intelligent word suggestions
- Falls back to local n-gram models
- Learns context from previous words

### Accessibility
- Full keyboard navigation support
- Text-to-speech for all interactions
- High contrast visual design
- Screen reader compatible

## License

This project is open source. Feel free to modify, distribute, and deploy anywhere.

## Support

- Check browser console for detailed error messages
- Ensure JavaScript is enabled
- Test with multiple browsers if issues occur
- Most search failures are temporary network issues

**🚀 Ready to use immediately - no configuration required!**