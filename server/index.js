/**
 * @file server/index.js
 * @description Core backend server for the Classic Mafia Draft App.
 * Handles WebSocket routing, state synchronization, persistent storage, 
 * and secure tournament administration.
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';          
import crypto from 'crypto';  
import readline from 'readline'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const STORE_FILE = path.join(__dirname, 'store.json');
const packageJsonPath = path.join(__dirname, 'package.json');
const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const APP_VERSION = packageData.version;

// --- MANUAL DATA SCHEMA TRIGGER ---
// Increment this integer manually ONLY when you change the structure of store.json.
// The server will safely wipe old data if this doesn't match the file's schemaVersion.
const DATA_SCHEMA_VERSION = 2;

let adminCredentials = null;
let rooms = {};  
let sessions = {};
let globalDebugMode = false;    

const clients = {}; 

/**
 * Hashes a plaintext password securely using PBKDF2.
 */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Saves the current state (version, credentials, and active rooms) to disk.
 */
function saveState() {
  const data = {
    version: APP_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    admin: adminCredentials,
    rooms: rooms,
    sessions: sessions,
    globalDebugMode: globalDebugMode 
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Validates incoming plaintext passwords against the stored hash.
 */
function verifyAdmin(password) {
  if (!adminCredentials) return false;
  const { hash } = hashPassword(password, adminCredentials.salt);
  return hash === adminCredentials.hash;
}

// --- PRODUCTION FILE SERVING ---
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const INITIAL_DECK = [
  'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen',
  'Sheriff', 'Mafia', 'Mafia', 'Don'
];

/**
 * Generates a fresh game state object for a new table.
 */
function getInitialGameState() {
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
 * Broadcasts the sanitized game state to all clients in a specific room.
 */
function broadcastState(roomId) {
  if (!roomId || !rooms[roomId]) return;
  const gs = rooms[roomId].gameState;
  
  const cleanState = { ...gs, isDebugMode: globalDebugMode };
  
  if (!globalDebugMode) {
    cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}"; 
  }

  io.to(roomId).emit('STATE_UPDATE', cleanState);
  broadcastToAdmins(); 
}

/**
 * Randomizes an array in place using the Fisher-Yates algorithm.
 */
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

/**
 * Global broadcaster for Super Admins. 
 * Sends sanitized state to prevent tournament peeking via DevTools.
 */
function broadcastToAdmins() {
  const adminSockets = Object.values(clients).filter(c => c.role === 'ADMIN').map(c => c.id);
  if (adminSockets.length === 0) return;

  const sanitizedRooms = {};
  for (const [roomId, roomData] of Object.entries(rooms)) {
    const cleanState = { ...roomData.gameState };
    if (!globalDebugMode) {
      cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}";
    }
    sanitizedRooms[roomId] = { gameState: cleanState };
  }

  const fullRegistry = Object.values(clients).map(c => ({
    ...c,
    assignedSeat: sessions[c.deviceId]?.assignedSeat || null
  }));

  for (const [deviceId, session] of Object.entries(sessions)) {
    if (session.isPhantom) {
      fullRegistry.push({
        id: deviceId, 
        deviceId: deviceId,
        name: 'Phantom Player (Debug)',
        ip: 'Localhost',
        role: session.role,
        roomId: session.roomId,
        assignedSeat: session.assignedSeat
      });
    }
  }

  adminSockets.forEach(adminId => {
    io.to(adminId).emit('REGISTRY_UPDATE', fullRegistry);
    io.to(adminId).emit('ROOMS_UPDATE', sanitizedRooms); 
  });
}

function broadcastAvailableRooms() {
  io.emit('AVAILABLE_ROOMS', Object.keys(rooms));
}

function updateClientCounts(roomId) {
  if (!roomId || !rooms[roomId]) return;
  const counts = { PLAYER: 0, JUDGE: 0, STREAM: 0, UNASSIGNED: 0, PENDING_STREAM: 0 };
  
  Object.values(clients).forEach(client => {
    if (client.roomId === roomId && counts[client.role] !== undefined) counts[client.role]++;
  });
  
  rooms[roomId].gameState.clientCounts = counts;
  io.to(roomId).emit('STATE_UPDATE', rooms[roomId].gameState);
  broadcastToAdmins(); 
}

// --- WEBSOCKET LOGIC ---
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  
  if (!adminCredentials) {
    socket.emit('SETUP_REQUIRED');
  }
  
  socket.on('SETUP_ADMIN', (newPass) => {
    if (adminCredentials) return; 
    
    adminCredentials = hashPassword(newPass);
    saveState();
    
    io.emit('SETUP_COMPLETE');
    console.log(`\n[SUCCESS] Master password initialized via Web UI.\n`);
  });
  
  socket.emit('AVAILABLE_ROOMS', Object.keys(rooms));

  socket.on('IDENTIFY', (deviceId) => {
    socket.deviceId = deviceId;
    if (sessions[deviceId] && sessions[deviceId].roomId) {
      const roomId = sessions[deviceId].roomId;
      
      if (roomId !== 'GLOBAL' && !rooms[roomId] && sessions[deviceId].role !== 'ADMIN') {
        sessions[deviceId].roomId = null;
        sessions[deviceId].role = 'UNASSIGNED';
        socket.emit('ROLE_ASSIGNED', 'UNASSIGNED');
        return;
      }

      clients[socket.id] = { 
        id: socket.id, 
        deviceId, 
        name: sessions[deviceId].name, 
        ip: clientIp, 
        role: sessions[deviceId].role, 
        roomId,
        streamLayout: sessions[deviceId].streamLayout || 'CENTER' 
      };
      
      if (roomId !== 'GLOBAL') {
        socket.join(roomId);
        if (rooms[roomId]) socket.emit('STATE_UPDATE', rooms[roomId].gameState);
        updateClientCounts(roomId);
      }
      
      socket.emit('ROLE_ASSIGNED', sessions[deviceId].role);
      broadcastToAdmins();
    } 
  });

  socket.on('JOIN_ROOM', ({ name, roomCode }) => {
    if (!socket.deviceId) return;
    const roomId = roomCode.toUpperCase().trim();
    
    if (!rooms[roomId]) return; 

    socket.join(roomId);
    sessions[socket.deviceId] = { name, role: 'UNASSIGNED', roomId };
    clients[socket.id] = { id: socket.id, deviceId: socket.deviceId, name, ip: clientIp, role: 'UNASSIGNED', roomId };

    updateClientCounts(roomId);
    broadcastToAdmins();
  });

  socket.on('ADMIN_LOGIN', (password, callback) => {
    if (verifyAdmin(password)) {
      if (!clients[socket.id]) clients[socket.id] = { id: socket.id, deviceId: socket.deviceId };
      clients[socket.id].role = 'ADMIN';
      
      if (socket.deviceId) {
        sessions[socket.deviceId] = { name: 'Tournament Admin', role: 'ADMIN', roomId: 'GLOBAL' };
      }

      socket.emit('ROLE_ASSIGNED', 'ADMIN');
      broadcastToAdmins();
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ success: false, message: 'Invalid Admin Password' });
    }
  });
  
  socket.on('CHANGE_PASSWORD', ({ oldPassword, newPassword }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;

    if (verifyAdmin(oldPassword)) {
      adminCredentials = hashPassword(newPassword);
      saveState();
      
      socket.emit('PASSWORD_CHANGED_SUCCESS', 'Password updated successfully.');
      console.log(`[SECURITY] Master admin password rotated by Admin at ${new Date().toISOString()}`);
    } else {
      socket.emit('PASSWORD_CHANGED_FAILED', 'Incorrect current password.');
      console.warn(`[SECURITY] Failed password rotation attempt from Admin.`);
    }
  });
  
  socket.on('CREATE_ROOM', (roomCode) => {
    if (clients[socket.id]?.role !== 'ADMIN') {
      socket.emit('ROLE_ASSIGNED', 'UNASSIGNED'); 
      return;
    }
    const roomId = roomCode?.toUpperCase().trim();
    if (!roomId || rooms[roomId]) return; 
    
    rooms[roomId] = { gameState: getInitialGameState() };
    
    broadcastAvailableRooms();
    broadcastToAdmins();
    saveState();
  });
 
  socket.on('DELETE_ROOM', (roomId) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    if (!rooms[roomId] || rooms[roomId].gameState.areRolesLocked) return; 

    Object.values(clients).forEach(client => {
      if (client.roomId === roomId && client.role !== 'ADMIN') {
        const newRole = client.role === 'STREAM' ? 'PENDING_STREAM' : 'UNASSIGNED';
        const newRoom = client.role === 'STREAM' ? 'GLOBAL' : null;
        
        client.roomId = newRoom;
        client.role = newRole;
        sessions[client.deviceId].roomId = newRoom;
        sessions[client.deviceId].role = newRole;
        
        io.to(client.id).emit('ROLE_ASSIGNED', newRole);
        io.sockets.socketsLeave(roomId); 
      }
    });

    delete rooms[roomId];
    broadcastAvailableRooms();
    broadcastToAdmins();
	  saveState();
  });

  socket.on('REQUEST_STREAM_ACCESS', (payload) => {
    const { userAgent, deviceId } = payload;
    const roomId = 'GLOBAL'; 

    socket.join(roomId);

    if (!sessions[deviceId]) sessions[deviceId] = { name: 'Stream Request', role: 'PENDING_STREAM', roomId, streamLayout: 'CENTER' };
    
    clients[socket.id] = { 
      id: socket.id, 
      deviceId, 
      name: sessions[deviceId].name, 
      ip: clientIp, 
      role: sessions[deviceId].role, 
      roomId,
      streamLayout: sessions[deviceId].streamLayout || 'CENTER'
    };

    if (clients[socket.id].role === 'STREAM') {
      socket.join(clients[socket.id].roomId);
      io.to(socket.id).emit('ROLE_ASSIGNED', 'STREAM');
      return;
    }

    let browserType = 'Unknown Source';
    if (userAgent.includes('OBS')) browserType = 'OBS Studio';
    else if (userAgent.includes('Chrome')) browserType = 'Chrome';

    const streamName = `Stream Request (${browserType})`;
    clients[socket.id].role = 'PENDING_STREAM';
    clients[socket.id].name = streamName;
    sessions[deviceId].role = 'PENDING_STREAM';
    sessions[deviceId].name = streamName;

    io.to(socket.id).emit('ROLE_ASSIGNED', 'PENDING_STREAM');
    io.to(socket.id).emit('STREAM_IP', clientIp); 
    broadcastToAdmins();
  });

  socket.on('VERIFY_STREAM', ({ targetSocketId, targetRoomId }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    
    const targetClient = clients[targetSocketId];
    if (!targetClient || !rooms[targetRoomId]) return;

    targetClient.roomId = targetRoomId;
    targetClient.role = 'STREAM';
    sessions[targetClient.deviceId].roomId = targetRoomId;
    sessions[targetClient.deviceId].role = 'STREAM';

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.leave('GLOBAL');
      targetSocket.join(targetRoomId);
    }

    io.to(targetSocketId).emit('ROLE_ASSIGNED', 'STREAM');
    updateClientCounts(targetRoomId);
    broadcastToAdmins();
  });

  socket.on('SET_STREAM_LAYOUT', ({ targetSocketId, layout }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    
    const targetClient = clients[targetSocketId];
    if (!targetClient) return;

    targetClient.streamLayout = layout;
    if (sessions[targetClient.deviceId]) {
      sessions[targetClient.deviceId].streamLayout = layout;
	  saveState();
    }

    io.to(targetSocketId).emit('UPDATE_LAYOUT', layout);
    broadcastToAdmins();
  });

  socket.on('ASSIGN_ROLE', ({ targetSocketId, newRole }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    
    const targetClient = clients[targetSocketId];
    if (!targetClient) return;
    
    const roomId = targetClient.roomId;
    if (!rooms[roomId] || rooms[roomId].gameState.areRolesLocked) return;
    if (targetClient.name === 'Anonymous' && newRole !== 'ADMIN' && newRole !== 'UNASSIGNED') return;
    
    targetClient.role = newRole;
    sessions[targetClient.deviceId].role = newRole; 
    
    if (newRole !== 'PLAYER') {
      sessions[targetClient.deviceId].assignedSeat = null;
    }

    io.to(targetSocketId).emit('ROLE_ASSIGNED', newRole);
    updateClientCounts(roomId);
    broadcastToAdmins();
  });

  socket.on('RESET_CLIENT', (targetSocketId) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    const targetClient = clients[targetSocketId];
    if (!targetClient) return;

    const roomId = targetClient.roomId;
    targetClient.role = 'UNASSIGNED';
    sessions[targetClient.deviceId].role = 'UNASSIGNED';
    io.to(targetSocketId).emit('ROLE_ASSIGNED', 'UNASSIGNED');
    
    updateClientCounts(roomId);
    broadcastToAdmins();
  });

  socket.on('TOGGLE_ROLE_LOCK', ({ roomId, booleanState }) => {
    if (clients[socket.id]?.role !== 'ADMIN' || !rooms[roomId] || rooms[roomId].gameState.status === 'IN_PROGRESS') return;

    const room = rooms[roomId];

    if (booleanState === true && room.gameState.settings.singleMode) {
      const seatedPlayers = Object.values(sessions).filter(
        s => s.roomId === roomId && s.role === 'PLAYER' && s.assignedSeat
      );
      
      const uniqueSeats = new Set(seatedPlayers.map(s => s.assignedSeat));
      
      if (uniqueSeats.size !== 10) {
        return socket.emit('ADMIN_ERROR', 'Single Mode requires exactly 10 players to be assigned unique seats (1-10) before locking.');
      }
    }

    room.gameState.areRolesLocked = booleanState;
    io.to(roomId).emit('STATE_UPDATE', room.gameState);
    broadcastToAdmins();
  });

  socket.on('TOGGLE_GLOBAL_DEBUG', (booleanState, callback) => {
    if (clients[socket.id]?.role !== 'ADMIN') return callback?.({ success: false, message: 'Unauthorized' });
    
    const isAnyDrafting = Object.values(rooms).some(r => r.gameState.status !== 'PENDING');
    if (isAnyDrafting) {
      return callback?.({ success: false, message: 'Cannot change Debug Mode while a draft is active.' });
    }

    globalDebugMode = booleanState;
    
    if (!globalDebugMode) {
      const affectedRooms = new Set();
      for (const sessionId in sessions) {
        if (sessions[sessionId].isPhantom) {
          affectedRooms.add(sessions[sessionId].roomId);
          delete sessions[sessionId];
        }
      }
      affectedRooms.forEach(roomId => {
        if (rooms[roomId] && rooms[roomId].gameState.status === 'PENDING') {
          rooms[roomId].gameState.areRolesLocked = false;
        }
      });
    }

    saveState();
    Object.keys(rooms).forEach(roomId => broadcastState(roomId)); 
    io.emit('GLOBAL_DEBUG_UPDATE', globalDebugMode); 
    callback?.({ success: true });
  });

  socket.on('TOGGLE_SINGLE_MODE', ({ roomId, booleanState }) => {
    if (clients[socket.id]?.role !== 'ADMIN' || !rooms[roomId]) return;
    if (rooms[roomId].gameState.status !== 'PENDING') return; 
    
    rooms[roomId].gameState.settings.singleMode = booleanState;

    if (!booleanState) {
      for (const sessionId in sessions) {
        if (sessions[sessionId].isPhantom && sessions[sessionId].roomId === roomId) {
          delete sessions[sessionId];
        }
      }
    }

    saveState();
    broadcastToAdmins();
  });

  socket.on('SPAWN_PHANTOMS', (roomId, callback) => {
    if (clients[socket.id]?.role !== 'ADMIN') return callback?.({ success: false });
    if (!globalDebugMode) return callback?.({ success: false, message: 'Debug mode required' });
    
    const existingSeats = Object.values(sessions)
      .filter(s => s.roomId === roomId && s.role === 'PLAYER' && s.assignedSeat)
      .map(s => s.assignedSeat);

    for (let i = 1; i <= 10; i++) {
      if (!existingSeats.includes(i)) {
        const phantomId = `phantom_${roomId}_seat_${i}`;
        sessions[phantomId] = {
          role: 'PLAYER',
          roomId: roomId,
          assignedSeat: i,
          isPhantom: true 
        };
      }
    }
    
    saveState();
    broadcastToAdmins();
    callback?.({ success: true });
  });

  socket.on('ASSIGN_SEAT', ({ targetDeviceId, seatNumber }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    
    const session = sessions[targetDeviceId];
    if (session) {
      const roomId = session.roomId;
      if (rooms[roomId] && rooms[roomId].gameState.areRolesLocked) return;

      session.assignedSeat = seatNumber ? parseInt(seatNumber) : null;
      saveState();
      broadcastToAdmins();

      const targetClient = Object.values(clients).find(c => c.deviceId === targetDeviceId);
      if (targetClient) {
        io.to(targetClient.id).emit('SEAT_ASSIGNED', session.assignedSeat);
      }
    }
  });

  socket.on('REQUEST_PERSONAL_INFO', () => {
    const deviceId = clients[socket.id]?.deviceId;
    if (deviceId && sessions[deviceId]) {
      socket.emit('SEAT_ASSIGNED', sessions[deviceId].assignedSeat || null);
    }
  });

  socket.on('REQUEST_REGISTRY', () => {
    if (clients[socket.id]?.role === 'ADMIN') {
      broadcastToAdmins(); 
    } else {
      socket.emit('ROLE_ASSIGNED', 'UNASSIGNED');
    }
  });

  // --- GAME LOGIC ---
  socket.on('START_DRAFT', () => {
    const roomId = clients[socket.id]?.roomId;
    if ((clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') || !roomId) return;
    
    const gs = rooms[roomId].gameState;
    if (!gs.areRolesLocked) return;

    const shuffledRoles = shuffle([...INITIAL_DECK]);
    const newSlots = {};
    shuffledRoles.forEach((role, index) => { newSlots[index] = role; });

    gs.status = 'IN_PROGRESS';
    gs.slots = newSlots;
    gs.revealedSlots = [];
    gs.currentTurn = 1;
    gs.results = {};
    gs.isTrayUnlocked = false;
	gs.isCardRevealed = false;
	gs.draftStartTime = Date.now();
    
    broadcastState(roomId);
	saveState();
  });

  socket.on('UNLOCK_TRAY', () => {
    const roomId = clients[socket.id]?.roomId;
    if ((clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') || !roomId) return;
    
    if (rooms[roomId].gameState.status === 'IN_PROGRESS') {
      rooms[roomId].gameState.isTrayUnlocked = true;
      broadcastState(roomId); 
      io.to(roomId).emit('CLEAR_STREAM'); 
    }
  });

  socket.on('PICK_CARD', (slotIndex) => {
    const roomId = clients[socket.id]?.roomId;
    if (!roomId) return;
    const gs = rooms[roomId].gameState;

    if (gs.status !== 'IN_PROGRESS' || !gs.isTrayUnlocked) return;
    if (gs.revealedSlots.includes(slotIndex)) return;

    const role = gs.slots[slotIndex];
    gs.revealedSlots.push(slotIndex);
    gs.results[gs.currentTurn] = { role, slotIndex };
    gs.isTrayUnlocked = false;
	  gs.isCardRevealed = true;

    socket.emit('PRIVATE_ROLE_REVEAL', { role, slotIndex });
    io.to(roomId).emit('CARD_REVEALED', { seat: gs.currentTurn, role, cardIndex: slotIndex });

    if (gs.currentTurn >= 10) gs.status = 'COMPLETED';
    else gs.currentTurn++;
    
    broadcastState(roomId);
	  saveState();
  });

  socket.on('FORCE_PICK', () => {
    const roomId = clients[socket.id]?.roomId;
    if ((clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') || !roomId) return;
    
    const gs = rooms[roomId].gameState;
    
    if (gs.status !== 'IN_PROGRESS' || !gs.isTrayUnlocked || gs.isCardRevealed) {
      return; 
    }

    const allSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const availableSlots = allSlots.filter(s => !gs.revealedSlots.includes(s));
    
    if (availableSlots.length === 0) return;

    const randomSlotIndex = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const role = gs.slots[randomSlotIndex];

    gs.revealedSlots.push(randomSlotIndex);
    gs.results[gs.currentTurn] = { role, slotIndex: randomSlotIndex };
    gs.isTrayUnlocked = false;
    gs.isCardRevealed = true; 

    const isSingleMode = gs.settings?.singleMode;
    const activeSeat = gs.currentTurn;

    const targetSockets = Object.values(clients).filter(c => {
      if (c.roomId !== roomId || c.role !== 'PLAYER') return false;
      
      if (isSingleMode) {
        const session = sessions[c.deviceId];
        return session && session.assignedSeat === activeSeat;
      }
      
      return true;
    }).map(c => c.id);
    
    targetSockets.forEach(playerId => {
      io.to(playerId).emit('PRIVATE_ROLE_REVEAL', { role, slotIndex: randomSlotIndex });
    });

    io.to(roomId).emit('CARD_REVEALED', { seat: gs.currentTurn, role, cardIndex: randomSlotIndex });

    if (gs.currentTurn >= 10) gs.status = 'COMPLETED';
    else gs.currentTurn++;
    
    broadcastState(roomId);
    saveState();
  });

  socket.on('RESET_DRAFT', () => {
    const roomId = clients[socket.id]?.roomId;
    if ((clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') || !roomId) return;
    
    const gs = rooms[roomId].gameState;
    const locked = gs.areRolesLocked;
    const debug = gs.isDebugMode;
    const singleMode = gs.settings?.singleMode; 
    
    rooms[roomId].gameState = getInitialGameState();
    rooms[roomId].gameState.areRolesLocked = locked;
    rooms[roomId].gameState.isDebugMode = debug;
    rooms[roomId].gameState.settings.singleMode = singleMode; 
    
    updateClientCounts(roomId);
    io.to(roomId).emit('STATE_UPDATE', rooms[roomId].gameState);
  });

  socket.on('MEMORIZED_ROLE', () => {
    const roomId = clients[socket.id]?.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].gameState.isCardRevealed = false; 
      broadcastState(roomId);                         
	    saveState();
      
      io.to(roomId).emit('CLEAR_STREAM');             
      io.to(roomId).emit('CLOSE_PLAYER_REVEAL');      
    }
  });

  socket.on('disconnect', () => {
    const roomId = clients[socket.id]?.roomId;
    delete clients[socket.id]; 
    
    if (roomId) {
      updateClientCounts(roomId);
      broadcastToAdmins(); 
    }
  });
});

// --- BOOT SEQUENCE & CLI ---
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '<YOUR_IPV4_ADDRESS>'; 
}

const PORT = process.env.PORT || 3000;
const LOCAL_IP = getLocalIpAddress();

if (fs.existsSync(STORE_FILE)) {
  try {
    const rawData = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(rawData);
    
    if (parsed.schemaVersion === DATA_SCHEMA_VERSION) {
      adminCredentials = parsed.admin;
      rooms = parsed.rooms || {};
      sessions = parsed.sessions || {};
	  globalDebugMode = parsed.globalDebugMode || false;
      
      console.log(`[STORAGE] Restored previous session data (Schema v${DATA_SCHEMA_VERSION}).`);
      
      if (parsed.version !== APP_VERSION) {
        console.log(`[SYSTEM] App updated from v${parsed.version} to v${APP_VERSION}. Data structure intact.`);
        saveState();
      }
      
    } else {
      console.warn(`[WARNING] Data schema mismatch. Code expects Schema v${DATA_SCHEMA_VERSION}, Data is v${parsed.schemaVersion || '0'}.`);
      console.warn(`[WARNING] Starting with fresh state to prevent corruption.`);
    }
  } catch (err) {
    console.error(`[ERROR] store.json is corrupted. Starting fresh.`, err);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=== 🃏 MAFIA TOURNAMENT SERVER LIVE (v${APP_VERSION}) ===`);
    console.log(`1. Admin PC:   http://localhost:${PORT}`);
    console.log(`2. LAN Access: http://${LOCAL_IP}:${PORT}`);
    console.log(`=======================================`);
    console.log(`Type "status", "restart", "shutdown", or "reset" for QoL tools.\n`);
  });

  rl.on('line', (input) => {
    const command = input.trim().toLowerCase();

    switch (command) {
      case 'status':
        console.log(`\n=== 📊 SERVER STATUS ===`);
        console.log(`Version:       v${APP_VERSION}`);
        console.log(`Uptime:        ${Math.floor(process.uptime() / 60)} minutes`);
        console.log(`Active Tables: ${Object.keys(rooms).length}`);
        console.log(`Connections:   ${Object.keys(clients).length}`);
        console.log(`Memory Usage:  ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
        console.log(`========================\n`);
        break;

      case 'shutdown':
        console.log('\n[SYSTEM] Saving tournament state and shutting down gracefully...');
        saveState();
        process.exit(0);
        break;

      case 'restart':
        console.log('\n[SYSTEM] Saving tournament state and triggering restart...');
        saveState();
        process.exit(1); 
        break;

      case 'reset':
        rl.question('WARNING: Enter Admin Password to confirm factory reset (Text will be visible): ', (pass) => {
          if (verifyAdmin(pass)) {
            if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
            console.log(`\n[SUCCESS] Server wiped. Please restart the application.\n`);
            process.exit(0);
          } else {
            console.log(`[ERROR] Incorrect password. Reset aborted.\n`);
          }
        });
        break;

      default:
        if (command !== '') {
          console.log(`\n[?] Unknown command: "${command}"`);
          console.log(`Available commands: status, restart, shutdown, reset\n`);
        }
        break;
    }
  });
}

startServer();