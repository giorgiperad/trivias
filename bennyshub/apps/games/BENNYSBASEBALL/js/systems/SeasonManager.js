class SeasonManager {
    constructor() {
        this.data = {
            active: false,
            teamColor: '',
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            totalGames: 162,
            currentOpponent: '',
            // Add current game state tracking
            currentGame: null,
            gameInProgress: false
        };
        this.load();
    }

    load() {
        const saved = localStorage.getItem(GAME_CONSTANTS.STORAGE_KEYS.SEASON);
        if (saved) {
            Object.assign(this.data, JSON.parse(saved));
        }
    }

    save() {
        localStorage.setItem(GAME_CONSTANTS.STORAGE_KEYS.SEASON, JSON.stringify(this.data));
    }

    reset() {
        this.data = {
            active: false,
            teamColor: '',
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            totalGames: 162,
            currentOpponent: '',
            currentGame: null,
            gameInProgress: false
        };
        this.save();
    }

    startSeason(teamColor) {
        this.data = {
            active: true,
            teamColor: teamColor,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            totalGames: 162,
            currentOpponent: '',
            currentGame: null,
            gameInProgress: false
        };
        this.save();
    }

    selectOpponent() {
        // Select a random opponent color that hasn't been played yet
        const availableColors = GAME_CONSTANTS.COLOR_OPTIONS.filter(color => 
            color.name !== this.data.teamColor && 
            !this.data.playedTeams.includes(color.name)
        );

        if (availableColors.length === 0) {
            // All teams played, enter playoffs
            this.data.inPlayoffs = true;
            const allColors = GAME_CONSTANTS.COLOR_OPTIONS.filter(color => color.name !== this.data.teamColor);
            return allColors[Math.floor(Math.random() * allColors.length)];
        }

        const opponent = availableColors[Math.floor(Math.random() * availableColors.length)];
        this.data.playedTeams.push(opponent.name);
        return opponent;
    }

    // Save current game state when game is in progress
    saveCurrentGame(gameState) {
        if (!this.data.active) return;
        
        this.data.currentGame = {
            currentInning: gameState.currentInning,
            half: gameState.half,
            outs: gameState.outs,
            score: { ...gameState.score },
            bases: { ...gameState.bases },
            balls: gameState.balls,
            strikes: gameState.strikes,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            playerSelectedColor: gameState.playerSelectedColor,
            samePitchCount: gameState.samePitchCount,
            lastPitchType: gameState.lastPitchType,
            savedAt: Date.now()
        };
        this.data.gameInProgress = true;
        this.save();
    }

    // Load and restore current game state
    loadCurrentGame() {
        return this.data.currentGame;
    }

    // Clear current game when game ends
    clearCurrentGame() {
        this.data.currentGame = null;
        this.data.gameInProgress = false;
        this.save();
    }

    // Check if there's a game in progress
    hasGameInProgress() {
        return this.data.gameInProgress && this.data.currentGame !== null;
    }

    updateProgress(playerWon) {
        if (!this.data.active) return;
        
        this.data.gamesPlayed++;
        if (playerWon) {
            this.data.wins++;
        } else {
            this.data.losses++;
        }
        
        // Clear current game when game ends
        this.clearCurrentGame();
        this.save();
    }

    getSeasonStatus() {
        if (this.data.inChampionship) {
            return "Championship Season!";
        } else if (this.data.inPlayoffs) {
            return "Playoffs";
        } else if (this.data.active) {
            return `Season: ${this.data.wins}-${this.data.losses}`;
        }
        return "No Active Season";
    }
}