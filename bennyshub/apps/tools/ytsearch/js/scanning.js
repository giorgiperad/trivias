// Scanning functionality for row and key navigation
class ScanningManager {
    constructor() {
        this.mode = 'ROWS'; // 'ROWS' or 'KEYS'
        this.currentRowIndex = 0;
        this.currentKeyIndex = 0;
        this.overlayOpen = false;
        this.overlayIndex = 0;
        
        // Timing configuration
        this.SHORT_MIN = 250;
        this.SHORT_MAX = 3000;
        this.SCAN_BACK_MS = 2500;
        this.ENTER_HOLD_MS = 3000;
        this.INPUT_COOLDOWN_MS = 500;
        
        // Input state
        this.spaceDown = false;
        this.spaceAt = 0;
        this.spaceScanned = false;
        this.spaceTimer = null;
        
        this.enterDown = false;
        this.enterAt = 0;
        this.enterLongFired = false;
        this.enterTimer = null;
        
        this.cooldownUntil = 0;
        this.suppressRowLabelOnce = false;
        
        // Get all rows
        this.rows = Array.from(document.querySelectorAll('.row-wrap'));
        this.rowLabels = {
            'row_text': 'text',
            'row_modes': 'search controls',
            'row_controls': 'controls',
            'row_history_1': 'recent searches',
            'row_history_2': 'more searches', 
            'row_history_3': 'search history',
            'row_history_4': 'older searches',
            'row_history_5': 'previous searches',
            'row_history_6': 'older searches',
            'row1': 'a b c d e f',
            'row2': 'g h i j k l',
            'row3': 'm n o p q r',
            'row4': 's t u v w x',
            'row5': 'y z zero one two three',
            'row6': 'four five six seven eight nine',
            'predRow': 'predictive text'
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.highlightRows();
    }
    
    setupEventListeners() {
        // Global keyboard event listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Prevent default space/enter behavior
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
            }
        });
    }
    
    handleKeyDown(e) {
        if (e.repeat) return;
        
        if (e.code === 'Space') {
            if (!this.spaceDown) {
                this.spaceDown = true;
                this.spaceAt = Date.now();
                this.spaceScanned = false;
                this.startSpaceTimer();
            }
        } else if (e.code === 'Enter') {
            if (!this.enterDown) {
                this.enterDown = true;
                this.enterAt = Date.now();
                this.enterLongFired = false;
                if (!this.overlayOpen) {
                    this.startEnterTimer();
                }
            }
        }
    }
    
    handleKeyUp(e) {
        if (e.repeat) return;
        
        // Handle overlay scanning
        if (this.overlayOpen && (e.code === 'Space' || e.code === 'Enter')) {
            if (e.code === 'Space') {
                if (!this.spaceDown) return;
                const held = Date.now() - this.spaceAt;
                this.spaceDown = false;
                this.stopSpaceTimer();
                
                if (this.inCooldown()) return;
                if (this.SHORT_MIN <= held && held < this.SHORT_MAX) {
                    this.overlayFocusNext();
                    this.armCooldown();
                }
            } else if (e.code === 'Enter') {
                if (!this.enterDown) return;
                this.enterDown = false;
                if (this.inCooldown()) return;
                this.overlayActivate();
                this.armCooldown();
            }
            return;
        }
        
        if (e.code === 'Space') {
            if (!this.spaceDown) return;
            const held = Date.now() - this.spaceAt;
            this.spaceDown = false;
            this.stopSpaceTimer();
            
            if (this.inCooldown()) return;
            if (this.SHORT_MIN <= held && held < this.SHORT_MAX && !this.spaceScanned) {
                if (this.mode === 'ROWS') {
                    this.scanRowsNext();
                } else {
                    this.scanKeysNext();
                }
                this.armCooldown();
            }
        } else if (e.code === 'Enter') {
            if (!this.enterDown) return;
            this.enterDown = false;
            
            this.stopEnterTimer();
            if (this.enterLongFired) {
                this.enterLongFired = false;
                return;
            }
            
            if (this.inCooldown()) return;
            
            if (this.mode === 'KEYS') {
                this.activateKey();
                this.mode = 'ROWS';
                this.highlightRows();
            } else {
                this.enterRow();
            }
            this.armCooldown();
        }
    }
    
    startSpaceTimer() {
        this.stopSpaceTimer();
        this.spaceTimer = setTimeout(() => {
            this.spaceScanned = true;
            if (this.overlayOpen) {
                this.overlayFocusPrev();
                return;
            }
            if (this.mode === 'ROWS') {
                this.scanRowsPrev();
            } else {
                this.scanKeysPrev();
            }
        }, this.SCAN_BACK_MS);
    }
    
    stopSpaceTimer() {
        if (this.spaceTimer) {
            clearTimeout(this.spaceTimer);
            this.spaceTimer = null;
        }
    }
    
    startEnterTimer() {
        this.stopEnterTimer();
        this.enterTimer = setTimeout(() => {
            this.onEnterHold();
        }, this.ENTER_HOLD_MS);
    }
    
    stopEnterTimer() {
        if (this.enterTimer) {
            clearTimeout(this.enterTimer);
            this.enterTimer = null;
        }
    }
    
    onEnterHold() {
        if (!this.enterDown || this.overlayOpen) return;
        
        if (this.mode === 'KEYS') {
            this.mode = 'ROWS';
            this.highlightRows();
            window.speechManager.speak('rows');
            this.enterLongFired = true;
        } else if (this.mode === 'ROWS') {
            // Jump to predictive row
            const predRowIndex = this.rows.findIndex(row => 
                row.dataset.rowId === 'predRow'
            );
            if (predRowIndex !== -1) {
                this.currentRowIndex = predRowIndex;
                this.suppressRowLabelOnce = true;
                this.highlightRows();
                this.readPredictiveRow();
                this.enterLongFired = true;
            }
        }
    }
    
    readPredictiveRow() {
        const predButtons = document.querySelectorAll('[data-pred="true"]');
        const words = Array.from(predButtons)
            .map(btn => btn.textContent.trim())
            .filter(text => text.length > 0);
        
        if (words.length > 0) {
            this.readWordsSequentially(words, 0);
        }
    }
    
    readWordsSequentially(words, index) {
        if (index >= words.length) return;
        
        window.speechManager.speak(words[index]);
        
        if (index + 1 < words.length) {
            setTimeout(() => {
                this.readWordsSequentially(words, index + 1);
            }, 1000);
        }
    }
    
    inCooldown() {
        return Date.now() < this.cooldownUntil;
    }
    
    armCooldown() {
        this.cooldownUntil = Date.now() + this.INPUT_COOLDOWN_MS;
    }
    
    // Row scanning methods
    scanRowsNext() {
        this.currentRowIndex = (this.currentRowIndex + 1) % this.rows.length;
        this.highlightRows();
    }
    
    scanRowsPrev() {
        this.currentRowIndex = (this.currentRowIndex - 1 + this.rows.length) % this.rows.length;
        this.highlightRows();
    }
    
    enterRow() {
        const currentRow = this.rows[this.currentRowIndex];
        const rowId = currentRow.dataset.rowId;
        
        // Handle text row specially
        if (rowId === 'row_text') {
            const textInput = document.getElementById('text-input');
            const value = textInput.value.trim();
            if (value) {
                window.speechManager.speak(value);
            } else {
                window.speechManager.speak('empty');
            }
            return;
        }
        
        // Enter key mode for other rows
        this.clearRowHighlights();
        this.mode = 'KEYS';
        this.currentKeyIndex = 0;
        this.highlightKeys();
    }
    
    // Key scanning methods
    scanKeysNext() {
        const currentRow = this.rows[this.currentRowIndex];
        const keys = Array.from(currentRow.querySelectorAll('.scan-btn, .text-input'));
        this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
        this.highlightKeys();
    }
    
    scanKeysPrev() {
        const currentRow = this.rows[this.currentRowIndex];
        const keys = Array.from(currentRow.querySelectorAll('.scan-btn, .text-input'));
        this.currentKeyIndex = (this.currentKeyIndex - 1 + keys.length) % keys.length;
        this.highlightKeys();
    }
    
    activateKey() {
        const currentRow = this.rows[this.currentRowIndex];
        const keys = Array.from(currentRow.querySelectorAll('.scan-btn, .text-input'));
        const currentKey = keys[this.currentKeyIndex];
        
        if (currentKey && currentKey.classList.contains('scan-btn')) {
            // Clear key focus before performing action
            this.clearKeyHighlights();
            // Trigger the button action
            currentKey.click();
        }
    }
    
    // Visual highlighting methods
    highlightRows() {
        this.clearKeyHighlights();
        this.clearRowHighlights();
        
        if (this.mode === 'ROWS' && !this.overlayOpen) {
            const currentRow = this.rows[this.currentRowIndex];
            if (currentRow && !currentRow.classList.contains('hidden')) {
                currentRow.classList.add('focused');
                // Force a repaint to ensure the highlight is visible
                currentRow.offsetHeight;
            }
        }
        
        // Update status display
        this.updateStatus();
        
        if (!this.suppressRowLabelOnce) {
            this.speakRowLabel();
        } else {
            this.suppressRowLabelOnce = false;
        }
    }
    
    highlightKeys() {
        this.clearRowHighlights();
        this.clearKeyHighlights();
        
        const currentRow = this.rows[this.currentRowIndex];
        if (!currentRow) return;
        
        const keys = Array.from(currentRow.querySelectorAll('.scan-btn:not([style*="display: none"]), .text-input'));
        const currentKey = keys[this.currentKeyIndex];
        
        if (currentKey) {
            currentKey.classList.add('focused');
            // Force a repaint to ensure the highlight is visible
            currentKey.offsetHeight;
        }
        
        // Update status display
        this.updateStatus();
        
        this.speakKeyLabel();
    }
    
    clearRowHighlights() {
        this.rows.forEach(row => {
            row.classList.remove('focused');
        });
    }
    
    clearKeyHighlights() {
        document.querySelectorAll('.scan-btn, .text-input').forEach(el => {
            el.classList.remove('focused');
        });
    }
    
    // Speech methods
    speakRowLabel() {
        const currentRow = this.rows[this.currentRowIndex];
        const rowId = currentRow.dataset.rowId;
        
        if (rowId === 'row_text') return;
        
        const label = this.rowLabels[rowId] || currentRow.dataset.label || 'row';
        window.speechManager.speak(label);
    }
    
    speakKeyLabel() {
        const currentRow = this.rows[this.currentRowIndex];
        const keys = Array.from(currentRow.querySelectorAll('.scan-btn, .text-input'));
        const currentKey = keys[this.currentKeyIndex];
        
        if (currentKey) {
            // Check if this is the YouTube button with separate text span
            const buttonTextSpan = currentKey.querySelector('.button-text');
            let label;
            
            if (buttonTextSpan) {
                label = buttonTextSpan.textContent.trim();
            } else {
                label = currentKey.textContent.trim() || currentKey.placeholder || 'button';
            }
            
            window.speechManager.speak(label);
        }
    }
    
    // Overlay scanning methods
    getOverlayButtons() {
        const shortsFeed = document.getElementById('shorts-feed');
        
        if (shortsFeed && !shortsFeed.classList.contains('hidden')) {
            return Array.from(shortsFeed.querySelectorAll('.scan-btn'));
        }
        
        const imageSlideshow = document.getElementById('image-slideshow');
        const videoSlideshow = document.getElementById('video-slideshow');
        
        if (imageSlideshow && !imageSlideshow.classList.contains('hidden')) {
            return Array.from(imageSlideshow.querySelectorAll('.scan-btn'));
        }
        
        if (videoSlideshow && !videoSlideshow.classList.contains('hidden')) {
            return Array.from(videoSlideshow.querySelectorAll('.scan-btn'));
        }
        
        return [];
    }
    
    overlayFocusNext() {
        const buttons = this.getOverlayButtons();
        if (buttons.length === 0) return;
        
        this.overlayIndex = (this.overlayIndex + 1) % buttons.length;
        this.applyOverlayFocus(buttons);
    }
    
    overlayFocusPrev() {
        const buttons = this.getOverlayButtons();
        if (buttons.length === 0) return;
        
        this.overlayIndex = (this.overlayIndex - 1 + buttons.length) % buttons.length;
        this.applyOverlayFocus(buttons);
    }
    
    applyOverlayFocus(buttons) {
        buttons.forEach((btn, index) => {
            btn.classList.toggle('focused', index === this.overlayIndex);
        });
        
        const currentButton = buttons[this.overlayIndex];
        if (currentButton) {
            const label = currentButton.textContent.trim() || 'button';
            window.speechManager.speak(label);
        }
    }
    
    overlayActivate() {
        const buttons = this.getOverlayButtons();
        if (buttons.length === 0) return;
        
        const currentButton = buttons[this.overlayIndex];
        if (currentButton) {
            currentButton.click();
        }
    }
    
    // Public methods for overlay management
    openOverlay() {
        this.overlayOpen = true;
        this.overlayIndex = 0;
        
        // Apply initial focus
        setTimeout(() => {
            const buttons = this.getOverlayButtons();
            if (buttons.length > 0) {
                this.applyOverlayFocus(buttons);
            }
        }, 100);
    }
    
    closeOverlay() {
        this.overlayOpen = false;
        this.overlayIndex = 0;
        
        // Clear any overlay button focus
        document.querySelectorAll('.slideshow-overlay .scan-btn').forEach(btn => {
            btn.classList.remove('focused');
        });
    }
    
    // Update status display
    updateStatus() {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            const modeText = this.mode === 'ROWS' ? 'Rows' : 'Keys';
            statusElement.textContent = `Mode: ${modeText} • Space=next • Enter=select`;
        }
    }
    
    updateRows() {
        // Refresh the rows array to account for hidden/shown elements
        this.rows = Array.from(document.querySelectorAll('.row-wrap:not(.hidden)'));
        
        // Ensure current row index is valid
        if (this.currentRowIndex >= this.rows.length) {
            this.currentRowIndex = Math.max(0, this.rows.length - 1);
        }
        
        // Re-highlight current row
        if (this.mode === 'ROWS') {
            this.highlightRows();
        }
    }
}

// Global scanning manager instance
window.scanningManager = new ScanningManager();