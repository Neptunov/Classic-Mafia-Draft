/**
 * @file server/index.js
 * @description Core backend server for the Classic Mafia Draft App.
 * Handles WebSocket routing, state synchronization, persistent storage, 
 * and secure tournament administration.
 * @version 0.1.0
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

let adminCredentials = null;
let rooms = {};      

const clients = {};  
const sessions = {}; 

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
    admin: adminCredentials,
    rooms: rooms
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
    clientCounts: { PLAYER: 0, JUDGE: 0, STREAM: 0, ADMIN: 0, UNASSIGNED: 0, PENDING_STREAM: 0 }
  };
}

/**
 * Broadcasts the sanitized game state to all clients in a specific room.
 */
function broadcastState(roomId) {
  if (!roomId || !rooms[roomId]) return;
  const gs = rooms[roomId].gameState;
  const cleanState = { ...gs };
  
  if (!gs.isDebugMode) {
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
    if (!cleanState.isDebugMode) {
      cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}";
    }
    sanitizedRooms[roomId] = { gameState: cleanState };
  }

  adminSockets.forEach(adminId => {
    io.to(adminId).emit('REGISTRY_UPDATE', Object.values(clients));
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

      clients[socket.id] = { id: socket.id, deviceId, name: sessions[deviceId].name, ip: clientIp, role: sessions[deviceId].role, roomId };
      
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
    const roomId = roomCode.toUpperCase().trim();
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

    if (!sessions[deviceId]) sessions[deviceId] = { name: 'Stream Request', role: 'PENDING_STREAM', roomId };
    clients[socket.id] = { id: socket.id, deviceId, name: sessions[deviceId].name, ip: clientIp, role: sessions[deviceId].role, roomId };

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

  socket.on('ASSIGN_ROLE', ({ targetSocketId, newRole }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    
    const targetClient = clients[targetSocketId];
    if (!targetClient) return;
    
    const roomId = targetClient.roomId;
    if (!rooms[roomId] || rooms[roomId].gameState.areRolesLocked) return;
    if (targetClient.name === 'Anonymous' && newRole !== 'ADMIN' && newRole !== 'UNASSIGNED') return;
    
    targetClient.role = newRole;
    sessions[targetClient.deviceId].role = newRole; 
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
    rooms[roomId].gameState.areRolesLocked = booleanState;
    io.to(roomId).emit('STATE_UPDATE', rooms[roomId].gameState);
    broadcastToAdmins();
  });

  socket.on('TOGGLE_DEBUG_MODE', ({ roomId, booleanState }) => {
    if (clients[socket.id]?.role !== 'ADMIN' || !rooms[roomId] || rooms[roomId].gameState.status === 'IN_PROGRESS') return;
    rooms[roomId].gameState.isDebugMode = booleanState;
    io.to(roomId).emit('STATE_UPDATE', rooms[roomId].gameState);
    broadcastToAdmins();
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

    const playerSockets = Object.values(clients)
      .filter(c => c.roomId === roomId && c.role === 'PLAYER')
      .map(c => c.id);
    
    playerSockets.forEach(playerId => {
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
    rooms[roomId].gameState = getInitialGameState();
    rooms[roomId].gameState.areRolesLocked = locked;
    rooms[roomId].gameState.isDebugMode = debug;
    
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
    
    if (parsed.version === APP_VERSION) {
      adminCredentials = parsed.admin;
      rooms = parsed.rooms || {};
      console.log(`[STORAGE] Restored previous session data (v${APP_VERSION}).`);
    } else {
      console.warn(`[WARNING] Data version mismatch. App is v${APP_VERSION}, Data is v${parsed.version || 'unknown'}.`);
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
	  console.log(`=======================================\n`);
    console.log(`Type "reset" and press Enter to wipe the server state.\n`);
  });

  rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'reset') {
      rl.question('WARNING: Enter Admin Password to confirm factory reset: ', (pass) => {
        if (verifyAdmin(pass)) {
          fs.unlinkSync(STORE_FILE);
          console.log(`\n[SUCCESS] Server wiped. Please restart the application (Ctrl+C then npm run dev).\n`);
          process.exit(0);
        } else {
          console.log(`[ERROR] Incorrect password. Reset aborted.\n`);
        }
      });
    }
  });
}

if (!adminCredentials) {
  console.log(`\n=== FIRST TIME SETUP ===`);
  rl.question('Create your master Admin password: ', (newPass) => {
    if (newPass.length < 4) {
      console.log('Password too short. Restart server and try again.');
      process.exit(1);
    }
    adminCredentials = hashPassword(newPass);
    saveState();
    console.log(`[SUCCESS] Encrypted admin credentials saved.\n`);
    startServer();
  });
} else {
  startServer();
}