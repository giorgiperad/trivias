class MenuSystem {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.uiLayer = document.getElementById('ui-layer');
        this.active = true;
        this.state = 'MAIN_MENU'; // MAIN_MENU, SETTINGS, LEVEL_SELECT
        this.selectedIndex = 0;
        this.items = [];
        
        this.menus = {
            'MAIN_MENU': [
                { text: 'Play Game', action: () => this.showGameModeSelect() },
                { text: 'Settings', action: () => this.showSettings() },
                { text: 'Exit', action: () => this.exitGame() }
            ],
            'PAUSE_MENU': [
                { text: 'Continue Game', action: () => this.resumeGame() },
                { text: 'Settings', action: () => this.showSettings() },
                { text: 'Exit to Main Menu', action: () => this.showMainMenu() }
            ],
            'SETTINGS': [
                { text: () => `Aimer Style: ${Settings.get('aimerStyle')}`, action: () => { 
                    const current = Settings.get('aimerStyle');
                    Settings.set('aimerStyle', current === 'TRAJECTORY' ? 'BASIC' : 'TRAJECTORY');
                    this.render();
                    AudioSys.speak(Settings.get('aimerStyle'));
                }},
                { text: () => `Aimer Speed: ${Settings.get('aimerSpeed')}`, action: () => {
                    const speeds = ['Super Slow', 'Slow', 'Medium', 'Fast'];
                    let current = Settings.get('aimerSpeed');
                    let idx = speeds.indexOf(current);
                    if (idx === -1) idx = 1; // Default to Medium
                    idx = (idx + 1) % speeds.length;
                    Settings.set('aimerSpeed', speeds[idx]);
                    this.render();
                    AudioSys.speak(speeds[idx]);
                }},
                { text: () => `Ball Color: <span style="color:${Settings.get('ballColor') === 'white' ? 'white' : Settings.get('ballColor')}">●</span> ${Settings.get('ballColor').toUpperCase()}`, action: () => {
                    const colors = Utils.BALL_COLORS;
                    let idx = colors.indexOf(Settings.get('ballColor'));
                    if (idx === -1) idx = 0;
                    idx = (idx + 1) % colors.length;
                    Settings.set('ballColor', colors[idx]);
                    this.game.updateBallColor(); // Apply immediately
                    this.render();
                    AudioSys.speak(colors[idx]);
                }},
                { text: () => `Sound: ${AudioSys.soundEnabled ? 'ON' : 'OFF'}`, action: () => { AudioSys.toggleSound(); this.render(); } },
                { text: () => `Ambient Sound: ${AudioSys.musicEnabled ? 'ON' : 'OFF'}`, action: () => { AudioSys.toggleMusic(); this.render(); } },
                { text: () => `TTS: ${AudioSys.ttsEnabled ? 'ON' : 'OFF'}`, action: () => { AudioSys.toggleTTS(); this.render(); } },
                { text: () => `Voice: ${AudioSys.getCurrentVoiceName()}`, action: () => { AudioSys.cycleVoice(); this.render(); } },
                { text: () => {
                    const t = this.game.aimerThickness || 3;
                    return `Aimer Thickness: ${this.game.aimerThicknessName || 'Medium'} <span style="display:inline-block; width:40px; height:${t}px; background-color:white; vertical-align:middle; margin-left:10px; border:1px solid #777;"></span>`;
                }, action: () => { 
                    this.game.cycleAimerThickness(); 
                    this.render(); 
                    AudioSys.speak(this.game.aimerThicknessName);
                } },
                { text: 'Back', action: () => this.goBack() }
            ],
            'LEVEL_SELECT': [
                // Populated dynamically
                { text: 'Back', action: () => this.showMainMenu() }
            ]
        };

        this.setupInput();
        this.showMainMenu();

        // Mouse Support
        this.uiLayer.addEventListener('click', (e) => {
            if (!this.active) return;
            if (e.target.classList.contains('menu-item')) {
                const items = Array.from(this.uiLayer.querySelectorAll('.menu-item'));
                const index = items.indexOf(e.target);
                if (index !== -1) {
                    this.selectedIndex = index;
                    this.selectItem();
                }
            }
        });
        
        this.uiLayer.addEventListener('mousemove', (e) => {
             if (!this.active) return;
             if (e.target.classList.contains('menu-item')) {
                const items = Array.from(this.uiLayer.querySelectorAll('.menu-item'));
                const index = items.indexOf(e.target);
                if (index !== -1 && index !== this.selectedIndex) {
                    this.selectedIndex = index;
                    this.render(); 
                }
             }
        });
    }

    setupInput() {
        // We now use the global Input event system
        // The Game class will route events to us if we are active
    }

    handleInput(event) {
        if (!this.active) return;

        if (event === 'SCAN_NEXT') {
            this.moveSelection(1);
        } else if (event === 'SCAN_PREV') {
            this.moveSelection(-1);
        } else if (event === 'SELECT') {
            this.selectItem();
        }
    }

    moveSelection(dir) {
        let nextIndex = this.selectedIndex;
        let count = 0;
        
        // Find next selectable item
        do {
            nextIndex += dir;
            if (nextIndex < 0) nextIndex = this.items.length - 1;
            if (nextIndex >= this.items.length) nextIndex = 0;
            count++;
        } while (this.items[nextIndex].selectable === false && count < this.items.length);

        if (count < this.items.length) {
            this.selectedIndex = nextIndex;
            this.render();
            
            // Announce selection via TTS
            const item = this.items[this.selectedIndex];
            let text = typeof item.text === 'function' ? item.text() : item.text;
            
            // Strip HTML tags for TTS
            text = text.replace(/<[^>]*>/g, '');
            
            AudioSys.speak(text);
        }
    }

    selectItem() {
        const item = this.items[this.selectedIndex];
        if (item.selectable !== false && item.action) item.action();
    }

    showMainMenu() {
        this.state = 'MAIN_MENU';
        this.items = this.menus['MAIN_MENU'];
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak("Main Menu");
    }

    showPauseMenu() {
        this.state = 'PAUSE_MENU';
        this.items = this.menus['PAUSE_MENU'];
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak("Paused");
    }

    resumeGame() {
        this.game.resumeGame();
    }

    goBack() {
        if (this.game.state === 'PAUSED') {
            this.showPauseMenu();
        } else {
            this.showMainMenu();
        }
    }

    showSettings() {
        this.state = 'SETTINGS';
        this.items = this.menus['SETTINGS'];
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak("Settings");
    }

    loadCustomCourse() {
        this.showCustomCourseWarning();
    }

    showCustomCourseWarning() {
        this.state = 'WARNING';
        this.items = [
            { text: "Loading a custom course requires mouse input.", selectable: false },
            { text: "Proceed", action: () => this.triggerFileLoad() },
            { text: "Cancel", action: () => this.showLevelSelect() }
        ];
        this.selectedIndex = 1; // Default to Proceed
        this.render();
        AudioSys.speak("Warning. Loading a custom course requires mouse input.");
    }

    triggerFileLoad() {
        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.startGame(data);
                } catch (err) {
                    console.error("Invalid JSON", err);
                    AudioSys.speak("Invalid File");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    showGameModeSelect() {
        this.state = 'MODE_SELECT';
        this.items = [
            { text: 'Casual', action: () => { this.game.setGameMode('CASUAL'); this.showLevelSelect(); } },
            { text: 'Challenge', action: () => { this.game.setGameMode('CHALLENGE'); this.showLevelSelect(); } },
            { text: 'Multiplayer', action: () => { this.game.setGameMode('MULTIPLAYER'); this.showMultiplayerSetup(); } },
            { text: 'Back', action: () => this.showMainMenu() }
        ];
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak("Select Game Mode");
    }

    showMultiplayerSetup() {
        this.state = 'MP_SETUP';
        this.items = [
            { text: '2 Players', action: () => { this.startMultiplayerSetup(2); } },
            { text: '3 Players', action: () => { this.startMultiplayerSetup(3); } },
            { text: '4 Players', action: () => { this.startMultiplayerSetup(4); } },
            { text: 'Back', action: () => this.showGameModeSelect() }
        ];
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak("How many players?");
    }

    startMultiplayerSetup(count) {
        this.mpSetup = {
            count: count,
            colors: [],
            candidate: null
        };
        this.showColorSelect(0);
    }

    showColorSelect(playerIndex) {
        this.state = `PLAYER ${playerIndex + 1} COLOR`;
        const availableColors = Utils.BALL_COLORS.filter(c => !this.mpSetup.colors.includes(c));
        
        // Initialize candidate if needed
        if (!this.mpSetup.candidate || !availableColors.includes(this.mpSetup.candidate)) {
            this.mpSetup.candidate = availableColors[0];
        }
        
        this.items = [
            {
                text: () => {
                    const c = this.mpSetup.candidate;
                    return `<span style="color:${c === 'white' ? 'white' : c}">●</span> ${c.toUpperCase()}`;
                },
                action: () => {
                    // Cycle color
                    let idx = availableColors.indexOf(this.mpSetup.candidate);
                    idx = (idx + 1) % availableColors.length;
                    this.mpSetup.candidate = availableColors[idx];
                    this.render();
                    AudioSys.speak(this.mpSetup.candidate);
                }
            },
            {
                text: 'Select',
                action: () => {
                    this.mpSetup.colors.push(this.mpSetup.candidate);
                    AudioSys.speak("Selected");
                    this.mpSetup.candidate = null; // Reset for next player
                    
                    if (this.mpSetup.colors.length < this.mpSetup.count) {
                        this.showColorSelect(this.mpSetup.colors.length);
                    } else {
                        this.game.setupMultiplayer(this.mpSetup.colors);
                        this.showLevelSelect();
                    }
                }
            },
            { 
                text: 'Back', 
                action: () => {
                    if (playerIndex > 0) {
                        this.mpSetup.colors.pop();
                        this.mpSetup.candidate = null;
                        this.showColorSelect(playerIndex - 1);
                    } else {
                        this.showMultiplayerSetup();
                    }
                }
            }
        ];
        
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak(`Player ${playerIndex + 1}, choose color`);
    }

    async showLevelSelect() {
        this.state = 'LEVEL_SELECT';
        
        let courses = [];
        try {
            // Load from manifest file
            const response = await fetch('courses/course_list.json');
            if (response.ok) {
                const files = await response.json();
                // Convert filenames to course objects
                courses = files.map(filename => ({
                    name: filename.replace('.json', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    file: `courses/${filename}`
                }));
            } else {
                throw new Error('Manifest not found');
            }
        } catch (e) {
            console.warn("Could not load course list.", e);
            // Fallback if manifest fails
            courses = [
                { name: "Benny's Backyard", file: "courses/bennys_backyard.json" }
            ];
        }

        // Store courses for toggling
        this.availableCourses = courses;
        if (this.selectedCourseIndex === undefined || this.selectedCourseIndex >= courses.length) {
            this.selectedCourseIndex = 0;
        }

        this.items = [
            {
                text: () => this.availableCourses[this.selectedCourseIndex].name,
                action: () => {
                    this.selectedCourseIndex = (this.selectedCourseIndex + 1) % this.availableCourses.length;
                    this.render();
                    AudioSys.speak(this.availableCourses[this.selectedCourseIndex].name);
                }
            },
            {
                text: "Play",
                action: () => {
                    const course = this.availableCourses[this.selectedCourseIndex];
                    this.startGame(course.file);
                }
            },
            {
                text: "Load Custom Course...",
                action: () => this.loadCustomCourse()
            },
            {
                text: 'Back',
                action: () => this.showMainMenu()
            }
        ];
        
        this.selectedIndex = 0;
        this.render();
        AudioSys.speak("Select Course. " + this.availableCourses[this.selectedCourseIndex].name);
    }

    startGame(courseFile) {
        this.active = false;
        this.uiLayer.innerHTML = ''; // Clear menu
        this.game.loadCourse(courseFile);
    }

    exitGame() {
        AudioSys.speak("Goodbye");
        try {
            // Try to message parent window to focus the back button
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ action: 'focusBackButton' }, '*');
            }
            // Navigate to parent directory (Access-Hub root)
            location.href = '../../../index.html';
        } catch(err) {
            // Fallback: try relative navigation
            try {
                 window.location.replace('../../../index.html');
            } catch(_) {
                 // Last resort: go up one level
                 window.location.href = '..';
            }
        }
    }

    render() {
        if (!this.active) {
            this.uiLayer.innerHTML = '';
            return;
        }

        let html = `<div class="menu-overlay">`;
        html += `<div class="menu-title">${this.state.replace('_', ' ')}</div>`;
        
        // Use grid for Settings to fit more items
        const isGrid = this.state === 'SETTINGS';
        const containerClass = isGrid ? 'menu-items-grid' : 'menu-items-list';
        
        html += `<div class="${containerClass}">`;

        this.items.forEach((item, index) => {
            const text = typeof item.text === 'function' ? item.text() : item.text;
            const isSelectable = item.selectable !== false;
            
            let selectedClass = '';
            if (isSelectable && index === this.selectedIndex) {
                selectedClass = 'selected';
            }
            
            const extraClass = isSelectable ? '' : 'info-text';
            // Add style for info text if needed, or just rely on class
            const style = isSelectable ? '' : 'style="font-size: 0.8em; color: #aaa; margin-bottom: 10px;"';
            
            html += `<div class="menu-item ${selectedClass} ${extraClass}" ${style}>${text}</div>`;
        });

        html += `</div></div>`;
        this.uiLayer.innerHTML = html;
    }
}
