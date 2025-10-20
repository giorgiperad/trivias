// Speech compatibility layer for shared voice manager
// This provides the same interface as the old SpeechManager but uses NarbeVoiceManager

class SpeechManager {
    constructor() {
        // Wait for the shared voice manager to be available
        this.ready = false;
        this.init();
    }
    
    async init() {
        // Wait for NarbeVoiceManager to be available
        while (!window.NarbeVoiceManager) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Wait for voices to load
        await window.NarbeVoiceManager.waitForVoices();
        this.ready = true;
        
        console.log('SpeechManager compatibility layer initialized with shared voice manager');
    }
    
    speak(text) {
        if (!this.ready || !text || text.trim() === '') return;
        
        // Use the shared voice manager's speakProcessed method for better pronunciation
        window.NarbeVoiceManager.speakProcessed(text.toString());
    }
    
    queueSpeak(text) {
        // The shared voice manager handles queuing internally
        this.speak(text);
    }
    
    stop() {
        if (window.NarbeVoiceManager) {
            window.NarbeVoiceManager.cancel();
        }
    }
    
    toggle() {
        if (window.NarbeVoiceManager) {
            return window.NarbeVoiceManager.toggleTTS();
        }
        return true;
    }
    
    // Getter to check if TTS is enabled
    get enabled() {
        if (window.NarbeVoiceManager) {
            const settings = window.NarbeVoiceManager.getSettings();
            return settings.ttsEnabled;
        }
        return true;
    }
    
    // Setter for enabled state
    set enabled(value) {
        if (window.NarbeVoiceManager) {
            const settings = window.NarbeVoiceManager.getSettings();
            if (settings.ttsEnabled !== value) {
                window.NarbeVoiceManager.toggleTTS();
            }
        }
    }
}

// Global speech manager instance using the compatibility layer
window.speechManager = new SpeechManager();