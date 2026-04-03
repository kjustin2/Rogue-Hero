// MetaProgress.js — Persistent unlock system using localStorage

const STORAGE_KEY = 'rogue_hero_meta';

const DEFAULT_STATE = {
  // Characters
  unlockedCharacters: ['blade'], // blade always unlocked
  
  // Difficulty tiers per character (0 = normal, 1 = hard, 2 = brutal)
  difficultyTiers: { blade: 0, frost: 0, shadow: 0 },
  
  // Bonus cards unlocked via achievements
  unlockedBonusCards: [],
  
  // Stats
  totalRuns: 0,
  totalWins: 0,
  bestFloor: 0,
  
  // Achievement flags
  achievements: {}
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
        // Merge with defaults to handle new fields
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

  isCharacterUnlocked(charId) {
    return this.state.unlockedCharacters.includes(charId);
  }

  unlockCharacter(charId) {
    if (!this.state.unlockedCharacters.includes(charId)) {
      this.state.unlockedCharacters.push(charId);
      console.log(`[Meta] Unlocked character: ${charId}`);
      this.save();
      return true;
    }
    return false;
  }

  getMaxDifficulty(charId) {
    return this.state.difficultyTiers[charId] || 0;
  }

  unlockDifficulty(charId, tier) {
    const current = this.state.difficultyTiers[charId] || 0;
    if (tier > current) {
      this.state.difficultyTiers[charId] = tier;
      console.log(`[Meta] Character "${charId}" unlocked difficulty tier ${tier}`);
      this.save();
      return true;
    }
    return false;
  }

  isBonusCardUnlocked(cardId) {
    return this.state.unlockedBonusCards.includes(cardId);
  }

  unlockBonusCard(cardId) {
    if (!this.state.unlockedBonusCards.includes(cardId)) {
      this.state.unlockedBonusCards.push(cardId);
      console.log(`[Meta] Unlocked bonus card: ${cardId}`);
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

  hasAchievement(key) {
    return !!this.state.achievements[key];
  }

  resetAll() {
    this.state = { ...DEFAULT_STATE };
    this.save();
    console.log('[Meta] Progress reset');
  }
}
