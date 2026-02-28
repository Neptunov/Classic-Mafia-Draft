import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { encryptStorage, decryptStorage } from './crypto.js';
import { ReedSolomonErasure } from '@subspace/reed-solomon-erasure.wasm';
import { getInitialGameState } from './game.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageData = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

export const APP_VERSION = packageData.version;
export const DATA_SCHEMA_VERSION = 2;

// --- 🛡️ NEW VAULT ARCHITECTURE ---
export const STORAGE_DIR = path.join(__dirname, '../storage');
const DATA_SHARDS = 4;
const PARITY_SHARDS = 2;
const TOTAL_SHARDS = DATA_SHARDS + PARITY_SHARDS;

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export const state = {
  adminCredentials: null,
  rooms: {},
  sessions: {},
  globalDebugMode: APP_VERSION.toLowerCase().includes('dev'),
  loginAttempts: {},
  loginChallenges: {},
  ipConnectionCounts: {},
  clientKeys: {},
  clients: {},
  globalSettings: {
    language: 'en',
    customAssets: { 
      cardBack: '', 
      trayBg: '',
      cardFront: { citizen: '', sheriff: '', mafia: '', don: '' }
    }
  }
};

export const MAX_CONNECTIONS_PER_IP = 5;

// Initialize WASM Engine Synchronously
let rsEngine;
try {
  const modulePath = require.resolve('@subspace/reed-solomon-erasure.wasm');
  
  const wasmPath = path.join(path.dirname(modulePath), 'reed_solomon_erasure_bg.wasm');
  
  rsEngine = ReedSolomonErasure.fromBytes(fs.readFileSync(wasmPath));
} catch (err) {
  console.error('[STORAGE] FATAL: Failed to load Reed-Solomon WASM engine.', err);
}

/**
 * Encrypts, shards, and atomically writes the state to disk using WebAssembly.
 */
export function saveState() {
  const data = {
    version: APP_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    admin: state.adminCredentials,
    rooms: state.rooms,
    sessions: state.sessions,
    globalDebugMode: state.globalDebugMode,
	globalSettings: state.globalSettings
  };
  
  const encryptedPayload = encryptStorage(data);
  if (!encryptedPayload || !rsEngine) return;

  const payloadBuffer = Buffer.from(encryptedPayload, 'utf8');
  
  const paddedLength = Math.ceil(payloadBuffer.length / DATA_SHARDS) * DATA_SHARDS;
  const cleanBuffer = Buffer.alloc(paddedLength);
  payloadBuffer.copy(cleanBuffer);

  const shardSize = cleanBuffer.length / DATA_SHARDS;
  
  const shardsArray = new Uint8Array(shardSize * TOTAL_SHARDS);
  shardsArray.set(new Uint8Array(cleanBuffer), 0);

  try {
    const result = rsEngine.encode(shardsArray, DATA_SHARDS, PARITY_SHARDS);
    if (result !== ReedSolomonErasure.RESULT_OK) throw new Error('WASM Encoding Failed');

    for (let i = 0; i < TOTAL_SHARDS; i++) {
      const shardData = shardsArray.slice(i * shardSize, (i + 1) * shardSize);
      fs.writeFileSync(path.join(STORAGE_DIR, `shard_${i}.tmp`), shardData);
    }

    for (let i = 0; i < TOTAL_SHARDS; i++) {
      fs.renameSync(
        path.join(STORAGE_DIR, `shard_${i}.tmp`), 
        path.join(STORAGE_DIR, `shard_${i}.dat`)
      );
    }
  } catch (err) {
    console.error('[STORAGE] FATAL: Failed to encode and write storage shards!', err);
  }
}

// --- SCHEMA UPGRADE PIPELINE ---
function upgradeDataSchema(parsed) {
  const currentVersion = parsed.schemaVersion || 1;

  if (currentVersion < DATA_SCHEMA_VERSION) {
    console.log(`[STORAGE] Upgrading legacy data from Schema v${currentVersion} to v${DATA_SCHEMA_VERSION}...`);
    
    if (parsed.rooms) {
      for (const roomId in parsed.rooms) {
        const defaultState = getInitialGameState();
        const gs = parsed.rooms[roomId].gameState || {};
        
        // Merge missing root properties safely
        parsed.rooms[roomId].gameState = { ...defaultState, ...gs };
        
        // Deep merge nested objects that might have been undefined in v1
        if (!gs.settings) parsed.rooms[roomId].gameState.settings = defaultState.settings;
        if (!gs.clientCounts) parsed.rooms[roomId].gameState.clientCounts = defaultState.clientCounts;
      }
    }
    
    parsed.schemaVersion = DATA_SCHEMA_VERSION;
  }
  
  return parsed;
}

/**
 * Reads, mathematically heals (via WASM), and decrypts the state on boot.
 */
export function loadState() {
  if (!rsEngine) return;

  // Legacy Migration Check
  const legacyStore = path.join(__dirname, '../store.json');
  if (fs.existsSync(legacyStore)) {
    console.warn('[STORAGE] Legacy store.json detected. Migrating to WASM Sharded Vault...');
    try {
      const rawData = fs.readFileSync(legacyStore, 'utf8');
      let parsed = rawData.startsWith('{') ? JSON.parse(rawData) : decryptStorage(rawData);
      
      if (parsed) {
		parsed = upgradeDataSchema(parsed);
        state.adminCredentials = parsed.admin;
        state.rooms = parsed.rooms || {};
        state.sessions = parsed.sessions || {};
        saveState(); 
        fs.unlinkSync(legacyStore); 
        console.log('[STORAGE] Migration complete. Legacy file destroyed.');
        return;
      }
    } catch (err) {
      console.error('[STORAGE] Legacy migration failed.', err);
    }
  }

  const availableShards = [];
  let shardSize = 0;

  for (let i = 0; i < TOTAL_SHARDS; i++) {
    const shardPath = path.join(STORAGE_DIR, `shard_${i}.dat`);
    if (fs.existsSync(shardPath)) {
      const buffer = fs.readFileSync(shardPath);
      availableShards[i] = buffer;
      shardSize = buffer.length;
    } else {
      availableShards[i] = null;
    }
  }

  const availableCount = availableShards.filter(s => s !== null).length;
  if (availableCount === 0) return;

  if (availableCount < DATA_SHARDS) {
    console.error(`[STORAGE] CRITICAL FAILURE: Only ${availableCount} shards found. Unrecoverable data loss.`);
    return;
  }

  const shardsArray = new Uint8Array(shardSize * TOTAL_SHARDS);
  const shardsAvailable = [];

  for (let i = 0; i < TOTAL_SHARDS; i++) {
    if (availableShards[i]) {
      shardsArray.set(new Uint8Array(availableShards[i]), i * shardSize);
      shardsAvailable.push(true);
    } else {
      shardsAvailable.push(false);
    }
  }

  try {
    if (availableCount < TOTAL_SHARDS) {
      console.warn(`[STORAGE] WARNING: Missing or corrupted shards detected. Initiating WASM reconstruction...`);
      
      const result = rsEngine.reconstruct(shardsArray, DATA_SHARDS, PARITY_SHARDS, shardsAvailable);
      if (result !== ReedSolomonErasure.RESULT_OK) throw new Error('WASM Reconstruction Failed');
      
      console.log(`[STORAGE] Self-healing complete. Data fully recovered.`);
      saveState(); 
    }

    const cleanBuffer = Buffer.from(shardsArray.buffer, shardsArray.byteOffset, shardSize * DATA_SHARDS);
    const encryptedString = cleanBuffer.toString('utf8').replace(/\x00+$/, ''); 

    let parsed = decryptStorage(encryptedString);
    if (!parsed) return;
	
	parsed = upgradeDataSchema(parsed);

    if (parsed.schemaVersion === DATA_SCHEMA_VERSION) {
      state.adminCredentials = parsed.admin;
      state.rooms = parsed.rooms || {};
      state.sessions = parsed.sessions || {};
      state.globalDebugMode = APP_VERSION.toLowerCase().includes('dev') ? true : (parsed.globalDebugMode || false);
      
      console.log(`[STORAGE] Vault unlocked. Tournament state restored (Schema v${DATA_SCHEMA_VERSION}).`);
    } else {
      console.warn(`[WARNING] Data schema mismatch. Starting fresh.`);
    }
  } catch (err) {
    console.error(`[ERROR] Vault reconstruction failed.`, err);
  }
}