/**
 * @file server/core/game.js
 * @description Core game logic, state initialization, and payload validation.
 * Contains pure functions for managing the tournament ruleset, deck manipulation,
 * and ensuring incoming network payloads match expected schemas.
 */

export const INITIAL_DECK = [
  'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen',
  'Sheriff', 'Mafia', 'Mafia', 'Don'
];

/**
 * Validates an incoming payload against a defined strict schema to prevent injection attacks.
 * @param {any} payload - The raw data received from the client.
 * @param {Object} rules - The schema definition (type, min/max length, nested fields).
 * @returns {boolean} True if the payload matches the rules, false otherwise.
 */
export function validatePayload(payload, rules) {
  if (payload === null || payload === undefined) return false;
  
  if (rules.type === 'number') {
    if (typeof payload !== 'number' || Number.isNaN(payload)) return false;
    if (rules.min !== undefined && payload < rules.min) return false;
    if (rules.max !== undefined && payload > rules.max) return false;
    return true;
  }
  
  if (rules.type === 'string') {
    if (typeof payload !== 'string') return false;
    if (rules.maxLength && payload.length > rules.maxLength) return false;
    if (rules.minLength && payload.length < rules.minLength) return false;
    return true;
  }

  if (rules.type === 'object') {
    if (typeof payload !== 'object' || Array.isArray(payload)) return false;
    
    for (const key in rules.fields) {
      if (!validatePayload(payload[key], rules.fields[key])) return false;
    }
    return true;
  }
  
  if (rules.type === 'boolean') {
    return typeof payload === 'boolean';
  }
  
  return false;
}


/**
 * Generates a fresh, sanitized game state object for a new tournament room.
 * @returns {Object} The default game state schema.
 */
export function getInitialGameState() {
  return {
    status: 'PENDING',
    slots: {}, 
    revealedSlots: [], 
    currentTurn: 1,
    results: {}, 
    isTrayUnlocked: false,
    isCardRevealed: false, 
    isDebugMode: false, 
    areRolesLocked: false,
    draftStartTime: null,
    settings: {          
      singleMode: false 
    },
    clientCounts: { PLAYER: 0, JUDGE: 0, STREAM: 0, ADMIN: 0, UNASSIGNED: 0, PENDING_STREAM: 0 }
  };
}


/**
 * Cryptographically shuffles an array using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle (e.g., the role deck).
 * @returns {Array} The shuffled array.
 */
export function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}