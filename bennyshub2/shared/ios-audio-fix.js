/**
 * iOS/Mobile Audio Autoplay Unlocker
 * Safely wakes up WebAudio and SpeechSynthesis on the first touch interaction.
 */
(function() {
    'use strict';

    if (window.NarbeAudioFixLoaded) return;
    window.NarbeAudioFixLoaded = true;

    const audioContexts = [];

    // 1. Monkey-patch the AudioContext constructor to capture contexts
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OriginalAudioContext) {
        const AudioContextProxy = function(options) {
            const ctx = new OriginalAudioContext(options);
            audioContexts.push(ctx);
            return ctx;
        };
        AudioContextProxy.prototype = OriginalAudioContext.prototype;
        Object.assign(AudioContextProxy, OriginalAudioContext);
        
        window.AudioContext = AudioContextProxy;
        window.webkitAudioContext = AudioContextProxy;
    }

    // 2. The Unlock Routine
    function unlockAudio() {
        // A. Wake up sound effects
        audioContexts.forEach(ctx => {
            if (ctx.state === 'suspended') ctx.resume().catch(e=>{});
        });

        // B. Wake up Voices (Silent Speak)
        if (window.speechSynthesis && !window.speechSynthesis.speaking) {
            const silent = new SpeechSynthesisUtterance('');
            silent.volume = 0; 
            silent.rate = 10;
            window.speechSynthesis.speak(silent);
        }

        // C. Clean up
        ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(evt => 
            document.removeEventListener(evt, unlockAudio, true)
        );
    }

    // 3. Listen for first interaction
    ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(evt => 
        document.addEventListener(evt, unlockAudio, { capture: true, passive: true })
    );

})();
