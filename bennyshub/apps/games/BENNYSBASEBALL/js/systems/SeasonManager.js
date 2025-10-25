class SeasonManager {
    constructor() {
        this.data = {
            active: false,
            teamColor: '',
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            totalGames: 8, // 8 regular season games
            currentOpponent: '',
            currentGame: null,
            gameInProgress: false,
            // Track opponents and outcomes
            opponentSchedule: [], // Predetermined order of opponents for regular season
            opponentResults: {}, // Track wins/losses vs each opponent
            currentScheduleIndex: 0, // Track which opponent we're facing
            inPlayoffs: false,
            inChampionship: false,
            playoffOpponent: null,
            championshipOpponent: null,
            seasonFailed: false // Track if season failed to qualify for playoffs
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
            totalGames: 8,
            currentOpponent: '',
            currentGame: null,
            gameInProgress: false,
            opponentSchedule: [],
            opponentResults: {},
            currentScheduleIndex: 0,
            inPlayoffs: false,
            inChampionship: false,
            playoffOpponent: null,
            championshipOpponent: null,
            seasonFailed: false
        };
        this.save();
    }

    startSeason(teamColor) {
        // Get all available opponent colors (excluding player's team)
        const availableOpponents = GAME_CONSTANTS.COLOR_OPTIONS
            .filter(color => color.name !== teamColor)
            .map(color => color.name);
        
        // For 8-game season, play each opponent once in random order
        const schedule = [...availableOpponents].sort(() => Math.random() - 0.5);
        
        // Initialize opponent results tracking
        const opponentResults = {};
        availableOpponents.forEach(opponent => {
            opponentResults[opponent] = { wins: 0, losses: 0 };
        });
        
        this.data = {
            active: true,
            teamColor: teamColor,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            totalGames: 8,
            currentOpponent: '',
            currentGame: null,
            gameInProgress: false,
            opponentSchedule: schedule,
            opponentResults: opponentResults,
            currentScheduleIndex: 0,
            inPlayoffs: false,
            inChampionship: false,
            playoffOpponent: null,
            championshipOpponent: null,
            seasonFailed: false
        };
        this.save();
    }

    selectOpponent() {
        // If in championship, use the championship opponent
        if (this.data.inChampionship && this.data.championshipOpponent) {
            return GAME_CONSTANTS.COLOR_OPTIONS.find(c => c.name === this.data.championshipOpponent);
        }
        
        // If in playoffs, use the playoff opponent
        if (this.data.inPlayoffs && this.data.playoffOpponent) {
            return GAME_CONSTANTS.COLOR_OPTIONS.find(c => c.name === this.data.playoffOpponent);
        }
        
        // Regular season - check if we've completed all scheduled games
        if (this.data.currentScheduleIndex >= this.data.opponentSchedule.length) {
            // Regular season complete
            // Check if player won all 8 games (perfect season)
            if (this.data.wins === 8 && this.data.losses === 0) {
                // Perfect season! Skip playoffs, go straight to championship
                this.data.inChampionship = true;
                
                // Select random championship opponent
                const availableOpponents = GAME_CONSTANTS.COLOR_OPTIONS
                    .filter(c => c.name !== this.data.teamColor);
                const championshipOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
                this.data.championshipOpponent = championshipOpponent.name;
                this.save();
                
                return championshipOpponent;
            } else if (this.data.wins >= 5) {
                // Qualified for playoffs with at least 5 wins
                this.data.inPlayoffs = true;
                
                // Select random playoff opponent
                const availableOpponents = GAME_CONSTANTS.COLOR_OPTIONS
                    .filter(c => c.name !== this.data.teamColor);
                const playoffOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
                this.data.playoffOpponent = playoffOpponent.name;
                this.save();
                
                return playoffOpponent;
            } else {
                // Did not qualify for playoffs (less than 5 wins)
                // Season ends, need to indicate this somehow
                this.data.seasonFailed = true;
                this.save();
                return null; // Will be handled in startGameWithSettings
            }
        }
        
        // Get the next scheduled opponent
        const opponentName = this.data.opponentSchedule[this.data.currentScheduleIndex];
        this.data.currentScheduleIndex++;
        this.save();
        
        return GAME_CONSTANTS.COLOR_OPTIONS.find(c => c.name === opponentName);
    }

    // Save current game state when game is in progress
    saveCurrentGame(gameState) {
        if (!this.data.active) return;
        
        // Determine the opponent team name based on player's team
        const playerColorData = GAME_CONSTANTS.COLOR_OPTIONS.find(c => c.color === gameState.playerSelectedColor);
        const opponentTeam = gameState.homeTeam === playerColorData?.name ? gameState.awayTeam : gameState.homeTeam;
        
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
        this.data.currentOpponent = opponentTeam; // Save who we're currently playing against
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
        this.data.currentOpponent = ''; // Clear current opponent when game ends
        this.save();
    }

    // Check if there's a game in progress
    hasGameInProgress() {
        return this.data.gameInProgress && this.data.currentGame !== null;
    }

    updateProgress(playerWon) {
        if (!this.data.active) return;
        
        // Check if this was a championship game win BEFORE updating anything
        const wasChampionshipWin = this.data.inChampionship && playerWon;
        
        // Update overall record
        this.data.gamesPlayed++;
        if (playerWon) {
            this.data.wins++;
        } else {
            this.data.losses++;
        }
        
        // Update record vs specific opponent
        if (this.data.currentOpponent && this.data.opponentResults[this.data.currentOpponent]) {
            if (playerWon) {
                this.data.opponentResults[this.data.currentOpponent].wins++;
            } else {
                this.data.opponentResults[this.data.currentOpponent].losses++;
            }
        }
        
        // Check if playoffs just ended (need to move to championship)
        if (this.data.inPlayoffs && !this.data.inChampionship && playerWon) {
            // Won playoff game, move to championship
            // Select a DIFFERENT random opponent for championship (must be different from playoff opponent)
            const availableOpponents = GAME_CONSTANTS.COLOR_OPTIONS
                .filter(c => c.name !== this.data.teamColor && c.name !== this.data.playoffOpponent);
            
            if (availableOpponents.length > 0) {
                const championshipOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
                this.data.championshipOpponent = championshipOpponent.name;
            } else {
                // Fallback: if somehow no other opponents available, use any opponent except player's team
                const fallbackOpponents = GAME_CONSTANTS.COLOR_OPTIONS.filter(c => c.name !== this.data.teamColor);
                const championshipOpponent = fallbackOpponents[Math.floor(Math.random() * fallbackOpponents.length)];
                this.data.championshipOpponent = championshipOpponent.name;
            }
            
            this.data.inChampionship = true;
            this.data.inPlayoffs = false; // Clear playoffs flag
        }
        
        // If lost in playoffs or championship, end the season
        if ((this.data.inPlayoffs || this.data.inChampionship) && !playerWon) {
            // Season ends on a loss in playoffs/championship
            // Keep the season active but clear the current opponent so they can restart
        }
        
        // Clear current game when game ends
        this.clearCurrentGame();
        this.save();
        
        // Return championship victory status
        return wasChampionshipWin;
    }

    // Get championship victory data for the victory screen
    getChampionshipVictoryData() {
        return {
            teamColor: this.data.teamColor,
            wins: this.data.wins,
            losses: this.data.losses,
            finalRecord: `${this.data.wins}-${this.data.losses}`
        };
    }

    getSeasonStatus() {
        if (this.data.inChampionship) {
            return "Championship Game!";
        } else if (this.data.inPlayoffs) {
            return "Playoffs";
        } else if (this.data.seasonFailed) {
            return "Season Failed to Qualify for Playoffs";
        } else if (this.data.active) {
            return `Season: ${this.data.wins}-${this.data.losses} (${this.data.gamesPlayed}/${this.data.totalGames})`;
        }
        return "No Active Season";
    }
    
    // Get record vs specific opponent
    getRecordVsOpponent(opponentName) {
        const record = this.data.opponentResults[opponentName];
        if (!record) return "0-0";
        return `${record.wins}-${record.losses}`;
    }
}
