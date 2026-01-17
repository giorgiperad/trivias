
class JumbleEditor {
    constructor() {
        this.words = [];
        this.filteredWords = [];
        this.currentIndex = -1; // Index in this.words
        
        // Bind UI
        this.wordInput = document.getElementById('word-input');
        this.sentenceInput = document.getElementById('sentence-input');
        this.imageInput = document.getElementById('image-input');
        this.previewImg = document.getElementById('image-preview');
        this.filterInput = document.getElementById('filter-input');
        this.listContainer = document.getElementById('word-list');
        this.countDisplay = document.getElementById('count-display');
        
        // Enter key for symbol search
        document.getElementById('symbol-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        this.init();
    }

    async init() {
        // Try to load from LocalStorage first if user prefers? 
        // Or just load default for now and let user "Load Local"
        // Actually, let's load default and see if we can overlay logic later.
        // For editor, loading server file is safer baseline.
        
        try {
            const res = await fetch('words.json');
            if (!res.ok) throw new Error("Failed to fetch words.json");
            this.words = await res.json();
            
            // Check if local storage exists and prompt?
            const local = localStorage.getItem('wordjumble_custom_words');
            if (local) {
                // We won't auto-load, but we indicate it's available?
                // Or maybe just auto-load if it exists? 
                // Let's stick to base behavior, but maybe add a toast saying "Found local data"
                this.showStatus("Loaded Server Data. 'Save Local' to capture edits.");
            }

            // Initial cleanup: deduplicate and sort
            this.cleanData();
            
            this.filterList();
        } catch (e) {
            console.error(e);
            // Fallback to local storage if server fails
            const local = localStorage.getItem('wordjumble_custom_words');
            if (local) {
               this.words = JSON.parse(local);
               this.cleanData();
               this.filterList();
               this.showStatus("Server unavailable. Loaded Local Storage backup.");
            } else {
               alert("Could not load words.json and no local backup found.");
            }
        }
    }

    cleanData() {
        // Remove duplicates based on 'word' property
        const unique = new Map();
        this.words.forEach(item => {
            if (item.word) {
                // Normalize word
                const w = item.word.trim().toLowerCase();
                if (!unique.has(w)) {
                    // Start clean object, stripping 'mode' if present implicitly by reconstruction
                    unique.set(w, {
                        word: w,
                        sentence: item.sentence || "",
                        image: item.image || ""
                    });
                } else {
                    // Update existing if new one has image or better sentence?
                    // For now, keep first, but maybe merge image?
                    const existing = unique.get(w);
                    if (!existing.image && item.image) existing.image = item.image;
                }
            }
        });
        
        this.words = Array.from(unique.values()).sort((a, b) => a.word.localeCompare(b.word));
    }

    filterList() {
        const query = this.filterInput.value.toLowerCase();
        this.filteredWords = this.words.filter(w => w.word.toLowerCase().includes(query));
        this.renderList();
    }

    renderList() {
        this.listContainer.innerHTML = '';
        this.filteredWords.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'word-item';
            if (item === this.words[this.currentIndex]) div.classList.add('active');
            
            // Find actual index in main array
            const realIndex = this.words.indexOf(item);
            
            div.innerHTML = `
                <div>
                    <strong>${item.word}</strong> <span style="color:#888">(${item.word.length})</span>
                    <div style="font-size:12px; color:#666; margin-top:2px;">${item.sentence.substring(0, 30)}${item.sentence.length > 30 ? '...' : ''}</div>
                </div>
                ${item.image ? '<span style="font-size:12px">🖼️</span>' : ''}
            `;
            div.onclick = () => this.selectWord(realIndex);
            
            this.listContainer.appendChild(div);
        });
        
        this.countDisplay.innerText = `${this.filteredWords.length} words`;
    }

    selectWord(index) {
        this.currentIndex = index;
        const item = this.words[index];
        
        this.wordInput.value = item.word;
        this.sentenceInput.value = item.sentence;
        this.imageInput.value = item.image || "";
        
        this.renderImagePreview();
        this.highlightSelection();
        
        // Scroll list if needed (simple)
    }
    
    highlightSelection() {
        // Simple re-render to update 'active' class
        // Could be optimized but list isn't huge
        this.renderList();
        // Keep scroll position? renderList clears it.
        // For now sufficient.
    }

    createNew() {
        this.currentIndex = -1;
        this.wordInput.value = "";
        this.sentenceInput.value = "";
        this.imageInput.value = "";
        this.previewImg.style.display = 'none';
        
        // Unselect in UI
        const active = this.listContainer.querySelector('.active');
        if (active) active.classList.remove('active');
        
        this.wordInput.focus();
    }

    updatePreview() {
        // Optional: validate word or show length
    }

    renderImagePreview() {
        const url = this.imageInput.value;
        if (url) {
            this.previewImg.src = url;
            this.previewImg.style.display = 'block';
            this.previewImg.onerror = () => { this.previewImg.style.display = 'none'; };
        } else {
            this.previewImg.style.display = 'none';
        }
    }

    applyChanges() {
        const word = this.wordInput.value.trim().toLowerCase();
        const sentence = this.sentenceInput.value.trim();
        const image = this.imageInput.value.trim();
        
        if (!word) { alert("Word is required"); return; }
        if (!sentence) { alert("Sentence is required"); return; }

        const newItem = { word, sentence, image };
        
        if (this.currentIndex >= 0) {
            // Update existing
            // If word changed, check for collision
            const originalWord = this.words[this.currentIndex].word;
            if (originalWord !== word) {
                if (this.words.some(w => w.word === word)) {
                    if (!confirm("This word already exists. Overwrite?")) return;
                    // Remove the other instance to avoid duplicates
                    this.words = this.words.filter(w => w.word !== word);
                    // Re-calculate index logic... actually easier to just proceed
                }
            }
            this.words[this.currentIndex] = newItem;
        } else {
            // New Item
            if (this.words.some(w => w.word === word)) {
                alert("Word already exists!");
                return;
            }
            this.words.push(newItem);
            this.currentIndex = this.words.length - 1;
        }
        
        // Re-sort
        this.words.sort((a, b) => a.word.localeCompare(b.word));
        // Find new index
        this.currentIndex = this.words.indexOf(newItem);
        
        this.filterList();
        this.showStatus("Changes applied locally. Remember to Save!");
    }

    deleteCurrent() {
        if (this.currentIndex < 0) return;
        if (!confirm("Are you sure you want to delete this word?")) return;
        
        this.words.splice(this.currentIndex, 1);
        this.createNew();
        this.filterList();
        this.showStatus("Word deleted locally.");
    }

    async saveToFile() {
        try {
            const btn = document.querySelector('.btn-success');
            const originalText = btn.innerText;
            btn.innerText = "Saving...";
            btn.disabled = true;

            const res = await fetch('/api/save_words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.words)
            });
            
            if (res.ok) {
                this.showStatus("File Saved Successfully!");
            } else {
                throw new Error("Server status: " + res.status);
            }
            
            btn.innerText = originalText;
            btn.disabled = false;
        } catch (e) {
            console.error(e);
            alert("Error saving file: " + e.message);
            document.querySelector('.btn-success').disabled = false;
        }
    }

    showStatus(msg) {
        const el = document.getElementById('status-bar');
        el.innerText = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('wordjumble_custom_words', JSON.stringify(this.words));
            this.showStatus("Saved to Browser Storage!");
        } catch (e) {
            alert("Failed to save to browser: " + e.message);
        }
    }

    downloadJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.words, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "my_word_jumble.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    uploadJSON(input) {
        const file = input.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    if (confirm("This will replace your current list. Continue?")) {
                        this.words = data;
                        this.cleanData();
                        this.filterList();
                        this.showStatus("Loaded file successfully!");
                    }
                } else {
                    alert("Invalid file format. Expected a list of words.");
                }
            } catch (err) {
                alert("Error reading file: " + err.message);
            }
        };
        reader.readAsText(file);
        input.value = ''; // Reset
    }

    // --- Open Symbols Handling ---
    openSymbolSearch() {
        document.getElementById('search-modal').style.display = 'flex';
        document.getElementById('symbol-search-input').focus();
    }

    async performSearch() {
        const query = document.getElementById('symbol-search-input').value;
        if (!query) return;
        
        const container = document.getElementById('search-results');
        container.innerHTML = "Loading...";
        
        try {
            // Using Open Symbols API directly
            const res = await fetch(`https://www.opensymbols.org/api/v1/symbols/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            container.innerHTML = "";
            if (!data || data.length === 0) {
                container.innerHTML = "No results found.";
                return;
            }
            
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'symbol-item';
                div.innerHTML = `
                    <img src="${item.image_url}" loading="lazy">
                    <div style="font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</div>
                `;
                div.onclick = () => {
                    this.imageInput.value = item.image_url;
                    this.renderImagePreview();
                    document.getElementById('search-modal').style.display = 'none';
                };
                container.appendChild(div);
            });
            
        } catch (e) {
            console.error(e);
            container.innerHTML = "Error fetching symbols.";
        }
    }
}

const editor = new JumbleEditor();
