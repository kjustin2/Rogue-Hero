// MetaProgress.js — Persistent unlock + leaderboard system using localStorage

const STORAGE_KEY = 'rogue_hero_meta';

const DEFAULT_STATE = {
  unlockedCharacters: ['blade'],
  difficultyTiers: { blade: 0, frost: 0, shadow: 0 },
  unlockedBonusCards: [],
  totalRuns: 0,
  totalWins: 0,
  bestFloor: 0,
  achievements: {},
  // Leaderboard: top 10 scores
  leaderboard: []
};

export class MetaProgress {
  constructor() {
    this.state = this.load();
    console.log('[Meta] Loaded progress:', JSON.stringify(this.state));
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...DEFAULT_STATE, ...saved };
      }
    } catch (e) {
      console.warn('[Meta] Failed to load save data, using defaults');
    }
    return { ...DEFAULT_STATE };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[Meta] Failed to save progress');
    }
  }

  isCharacterUnlocked(charId) { return this.state.unlockedCharacters.includes(charId); }

  unlockCharacter(charId) {
    if (!this.state.unlockedCharacters.includes(charId)) {
      this.state.unlockedCharacters.push(charId);
      console.log(`[Meta] Unlocked character: ${charId}`);
      this.save();
      return true;
    }
    return false;
  }

  getMaxDifficulty(charId) { return this.state.difficultyTiers[charId] || 0; }

  unlockDifficulty(charId, tier) {
    const current = this.state.difficultyTiers[charId] || 0;
    if (tier > current) {
      this.state.difficultyTiers[charId] = tier;
      this.save();
      return true;
    }
    return false;
  }

  isBonusCardUnlocked(cardId) { return this.state.unlockedBonusCards.includes(cardId); }

  unlockBonusCard(cardId) {
    if (!this.state.unlockedBonusCards.includes(cardId)) {
      this.state.unlockedBonusCards.push(cardId);
      this.save();
      return true;
    }
    return false;
  }

  recordRun(won, floor) {
    this.state.totalRuns++;
    if (won) this.state.totalWins++;
    if (floor > this.state.bestFloor) this.state.bestFloor = floor;
    this.save();
  }

  setAchievement(key) {
    if (!this.state.achievements[key]) {
      this.state.achievements[key] = true;
      this.save();
      return true;
    }
    return false;
  }

  hasAchievement(key) { return !!this.state.achievements[key]; }

  // ── SCORE / LEADERBOARD ──

  submitScore(entry) {
    // entry: { score, character, floor, difficulty, seed, date }
    if (!this.state.leaderboard) this.state.leaderboard = [];
    this.state.leaderboard.push(entry);
    this.state.leaderboard.sort((a, b) => b.score - a.score);
    this.state.leaderboard = this.state.leaderboard.slice(0, 10);
    this.save();
    console.log(`[Meta] Score submitted: ${entry.score}`);
  }

  getLeaderboard() {
    return this.state.leaderboard || [];
  }

  resetAll() {
    this.state = { ...DEFAULT_STATE };
    this.save();
    console.log('[Meta] Progress reset');
  }
}

// ── SCORE CALCULATOR ──

export function calculateScore(stats) {
  let score = 0;
  score += (stats.kills || 0) * 10;
  score += (stats.roomsCleared || 0) * 50;
  score += (stats.perfectDodges || 0) * 100;
  score += (stats.cardsPlayed || 0) * 5;
  score += (stats.manualCrashes || 0) * 75;
  score += (stats.highestCombo || 0) * 25;
  score += (stats.itemsCollected || 0) * 30;
  // Time bonus: faster = more points (base 300, minus elapsed seconds)
  const timeBonus = Math.max(0, 300 - Math.floor(stats.elapsedTime || 0));
  score += timeBonus;
  // Floor bonus
  score += (stats.floor || 0) * 200;
  // Win bonus
  if (stats.won) score += 1000;
  // Difficulty multiplier
  const diffMults = [1.0, 1.5, 2.5];
  score = Math.round(score * (diffMults[stats.difficulty || 0] || 1.0));
  return score;
}
