// STANDALONE REPLACEMENTS FOR SHARED LIBRARIES

// 1. Voice Manager
window.NarbeVoiceManager = {
    _unlocked: false,
    init: function() {
        // Prime the voices
        if (window.speechSynthesis) {
             const load = () => { window.speechSynthesis.getVoices(); };
             load();
             if (window.speechSynthesis.onvoiceschanged !== undefined) {
                 window.speechSynthesis.onvoiceschanged = load;
             }
        }
    },
    unlock: function() {
        if (!window.speechSynthesis) return;
        if (this._unlocked) return;
        
        // Play a silent utterance to unlock the queue on iOS
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; 
        u.rate = 1.0; 
        window.speechSynthesis.speak(u);
        this._unlocked = true;
        console.log("TTS Unlocked");
    },
    speak: function(text) {
        if (!window.speechSynthesis) return;
        
        // Important: Cancel previous to avoid queue buildup / blocks
        window.speechSynthesis.cancel(); 
        
        const u = new SpeechSynthesisUtterance(text);
        
        // Try to pick a decent english voice
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            // Voices might not be loaded yet, just let default happen
        } else {
             const enVoice = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
             if (enVoice) u.voice = enVoice;
        }
        
        u.rate = 1.0;
        u.pitch = 1.0;
        
        // Ensure volume is set
        u.volume = 1.0; 
        
        window.speechSynthesis.speak(u);
    }
};
window.NarbeVoiceManager.init();

// 2. Scan Manager
window.NarbeScanManager = (function() {
    const settings = {
        autoScan: false,
        scanInterval: 1500
    };
    const SPEEDS = [1500, 1000, 2000, 3000];
    let speedIdx = 0;

    return {
        getSettings: () => settings,
        getScanInterval: () => settings.scanInterval,
        setAutoScan: (val) => { 
            settings.autoScan = !!val;
            console.log("AutoScan:", settings.autoScan);
        },
        cycleScanSpeed: () => {
            speedIdx = (speedIdx + 1) % SPEEDS.length;
            settings.scanInterval = SPEEDS[speedIdx];
            console.log("Scan Speed:", settings.scanInterval);
            return settings.scanInterval;
        }
    };
})();

console.log("Standalone utilities loaded.");
