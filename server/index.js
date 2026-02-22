const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"]
  }
});

// --- SECURITY & REGISTRY ---
// In a production app, use environment variables (.env) for this.
const ADMIN_PASSWORD = "mafia"; 

// Tracks every connected device: socket.id -> { id, name, ip, role }
const clients = {}; 

// Tracks persistent memory: deviceId -> { name, role }
const sessions = {};

// --- GAME STATE DEFINITION ---
const INITIAL_DECK = ['Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Sheriff', 'Mafia', 'Mafia', 'Don'];

let gameState = {
  status: 'PENDING',
  deck: [],
  currentTurn: 1,
  results: {},
  availableCards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  isTrayUnlocked: false,
  isDebugMode: false,
  areRolesLocked: false, // NEW: Locks the lobby assignments
  clientCounts: { PLAYER: 0, JUDGE: 0, STREAM: 0, ADMIN: 0, UNASSIGNED: 0 }
};

// --- UTILITIES ---
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function resetGame(preserveConfig = true) {
  const currentDebugState = gameState.isDebugMode;
  const currentLockState = gameState.areRolesLocked;
  gameState = {
    ...gameState,
    status: 'PENDING',
    deck: [],
    currentTurn: 1,
    results: {},
    availableCards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    isTrayUnlocked: false,
    isDebugMode: preserveConfig ? currentDebugState : false,
    areRolesLocked: preserveConfig ? currentLockState : false
  };
}

function getPublicState() {
  if (gameState.isDebugMode) return gameState; 
  const { deck, ...safeState } = gameState;
  return safeState;
}

// Recalculates how many of each role are connected
function updateClientCounts() {
  const counts = { PLAYER: 0, JUDGE: 0, STREAM: 0, ADMIN: 0, UNASSIGNED: 0 };
  Object.values(clients).forEach(client => {
    if (counts[client.role] !== undefined) counts[client.role]++;
  });
  gameState.clientCounts = counts;
  io.emit('STATE_UPDATE', getPublicState());
}

function broadcastRegistryToAdmins() {
  const adminSockets = Object.values(clients).filter(c => c.role === 'ADMIN').map(c => c.id);
  adminSockets.forEach(adminId => {
    io.to(adminId).emit('REGISTRY_UPDATE', Object.values(clients));
  });
}

// --- WEBSOCKET LOGIC ---
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;

  // 1. The client sends its permanent Device ID
  socket.on('IDENTIFY', (deviceId) => {
    socket.deviceId = deviceId; // Tag the socket with this ID for easy reference

    // If this device has never connected before, create a blank session memory
    if (!sessions[deviceId]) {
      sessions[deviceId] = { name: 'Anonymous', role: 'UNASSIGNED' };
    }

    // Register the active connection using the saved session data
    clients[socket.id] = { 
      id: socket.id, 
      deviceId: deviceId,
      name: sessions[deviceId].name, 
      ip: clientIp, 
      role: sessions[deviceId].role 
    };
    
    console.log(`Client Identified: ${sessions[deviceId].name} (${clientIp})`);
    
    // Instantly teleport the client back to whatever screen they were on before refreshing!
    socket.emit('ROLE_ASSIGNED', sessions[deviceId].role);
    socket.emit('STATE_UPDATE', getPublicState());
    
    updateClientCounts();
    broadcastRegistryToAdmins();
  });

  socket.on('SET_NAME', (name) => {
    if (socket.deviceId) {
      sessions[socket.deviceId].name = name; // Save to permanent memory
      clients[socket.id].name = name;        // Update active display
      broadcastRegistryToAdmins();
    }
  });

  // NEW: Dedicated stream connection flow
  // NEW: Dedicated stream connection flow (Race-condition proof)
  socket.on('REQUEST_STREAM_ACCESS', (payload) => {
    const userAgent = payload.userAgent;
    const reqDeviceId = payload.deviceId;

    // Force-initialize the client if the global IDENTIFY event hasn't finished yet
    if (!clients[socket.id]) {
      if (!sessions[reqDeviceId]) {
        sessions[reqDeviceId] = { name: 'Anonymous', role: 'UNASSIGNED' };
      }
      clients[socket.id] = { 
        id: socket.id, 
        deviceId: reqDeviceId,
        name: sessions[reqDeviceId].name, 
        ip: socket.handshake.address, 
        role: sessions[reqDeviceId].role 
      };
    }

    const client = clients[socket.id];

    // If this stream device was already verified, keep it verified!
    if (client.role === 'STREAM') {
      io.to(socket.id).emit('ROLE_ASSIGNED', 'STREAM');
      return;
    }

    // Parse a clean name for the Admin console
    let browserType = 'Unknown Source';
    if (userAgent.includes('OBS')) browserType = 'OBS Studio';
    else if (userAgent.includes('Chrome')) browserType = 'Chrome';
    else if (userAgent.includes('Firefox')) browserType = 'Firefox';
    else if (userAgent.includes('Safari')) browserType = 'Safari';

    const streamName = `Stream Request (${browserType})`;

    // Put them in the waiting room
    client.role = 'PENDING_STREAM';
    client.name = streamName;
    sessions[client.deviceId].role = 'PENDING_STREAM';
    sessions[client.deviceId].name = streamName;

    io.to(socket.id).emit('ROLE_ASSIGNED', 'PENDING_STREAM');
    updateClientCounts();
    broadcastRegistryToAdmins();
  });

  socket.on('ADMIN_LOGIN', (password, callback) => {
    if (password === ADMIN_PASSWORD && socket.deviceId) {
      clients[socket.id].role = 'ADMIN';
      sessions[socket.deviceId].role = 'ADMIN';
      clients[socket.id].name = 'Admin Console'; 
      callback({ success: true });
      updateClientCounts();
      broadcastRegistryToAdmins(); 
    } else {
      callback({ success: false, message: 'Invalid password' });
    }
  });

  socket.on('ASSIGN_ROLE', ({ targetSocketId, newRole }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    if (gameState.areRolesLocked) return; // FEATURE 2: Cannot assign if roles are locked
    
    const targetClient = clients[targetSocketId];
    if (targetClient) {
      // FEATURE 1: Prevent assigning roles to unnamed clients (except Admins)
      if (targetClient.name === 'Anonymous' && newRole !== 'ADMIN' && newRole !== 'UNASSIGNED') return;

      targetClient.role = newRole;
      sessions[targetClient.deviceId].role = newRole; 
      io.to(targetSocketId).emit('ROLE_ASSIGNED', newRole);
      updateClientCounts();
      broadcastRegistryToAdmins();
    }
  });

  // FEATURE 2: Role Lock Toggle
  socket.on('TOGGLE_ROLE_LOCK', (booleanState) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    if (gameState.status === 'IN_PROGRESS') return; // Cannot unlock while draft is active
    gameState.areRolesLocked = booleanState;
    io.emit('STATE_UPDATE', getPublicState());
  });

  socket.on('TOGGLE_DEBUG_MODE', (booleanState) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    if (gameState.status === 'IN_PROGRESS') return; // FEATURE 2: Cannot toggle debug while draft is active
    gameState.isDebugMode = booleanState;
    io.emit('STATE_UPDATE', getPublicState()); 
  });

  socket.on('START_DRAFT', () => {
    if (clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') return;
    if (!gameState.areRolesLocked) return; // FEATURE 2: Cannot start until roles are locked

    resetGame(true);
    gameState.deck = shuffle([...INITIAL_DECK]);
    gameState.status = 'IN_PROGRESS';
    io.emit('STATE_UPDATE', getPublicState());
  });

  socket.on('UNLOCK_TRAY', () => {
    if (clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') return;
    if (gameState.status === 'IN_PROGRESS') {
      gameState.isTrayUnlocked = true;
      io.emit('STATE_UPDATE', getPublicState());
    }
  });

  socket.on('PICK_CARD', (cardIndex) => {
    if (gameState.status !== 'IN_PROGRESS' || !gameState.isTrayUnlocked) return;
    if (!gameState.availableCards.includes(cardIndex)) return;

    const assignedRole = gameState.deck.pop();
    gameState.results[gameState.currentTurn] = assignedRole;
    gameState.availableCards = gameState.availableCards.filter(index => index !== cardIndex);
    gameState.isTrayUnlocked = false;

    io.emit('CARD_REVEALED', { seat: gameState.currentTurn, role: assignedRole, cardIndex });

    if (gameState.currentTurn >= 10) {
      gameState.status = 'COMPLETED';
    } else {
      gameState.currentTurn++;
    }
    io.emit('STATE_UPDATE', getPublicState());
  });

  // FEATURE 3: Judge Reset Button
  socket.on('RESET_DRAFT', () => {
    if (clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') return;
    resetGame(true);
    io.emit('STATE_UPDATE', getPublicState());
  });

  // FEATURE 4: Judge Force Reveal
  socket.on('FORCE_PICK', () => {
    if (clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') return;
    if (gameState.status !== 'IN_PROGRESS') return;

    // Automatically select a random card from the remaining tray
    const randomAvailIndex = Math.floor(Math.random() * gameState.availableCards.length);
    const cardIndex = gameState.availableCards[randomAvailIndex];

    const assignedRole = gameState.deck.pop();
    gameState.results[gameState.currentTurn] = assignedRole;
    gameState.availableCards = gameState.availableCards.filter(index => index !== cardIndex);
    gameState.isTrayUnlocked = false;

    io.emit('CARD_REVEALED', { seat: gameState.currentTurn, role: assignedRole, cardIndex });

    if (gameState.currentTurn >= 10) gameState.status = 'COMPLETED';
    else gameState.currentTurn++;
    
    io.emit('STATE_UPDATE', getPublicState());
  });

  socket.on('REQUEST_REGISTRY', () => {
    if (clients[socket.id]?.role === 'ADMIN') {
      socket.emit('REGISTRY_UPDATE', Object.values(clients));
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket Disconnected: ${socket.id}`);
    delete clients[socket.id]; // Remove the active connection, but leave `sessions` memory intact!
    updateClientCounts();
    broadcastRegistryToAdmins();
  });

  // 5. Existing Game Logic (Start, Unlock, Pick, Toggle Debug)
  socket.on('START_DRAFT', () => {
    // SECURITY: Only allow Judges or Admins to start the draft
    if (clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') return;

    resetGame();
    gameState.deck = shuffle([...INITIAL_DECK]);
    gameState.status = 'IN_PROGRESS';
    io.emit('STATE_UPDATE', getPublicState());
  });

  socket.on('UNLOCK_TRAY', () => {
    // SECURITY: Only allow Judges or Admins to unlock the tray
    if (clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') return;

    if (gameState.status === 'IN_PROGRESS') {
      gameState.isTrayUnlocked = true;
      io.emit('STATE_UPDATE', getPublicState());
    }
  });

  socket.on('PICK_CARD', (cardIndex) => {
    if (gameState.status !== 'IN_PROGRESS' || !gameState.isTrayUnlocked) return;
    if (!gameState.availableCards.includes(cardIndex)) return;

    const assignedRole = gameState.deck.pop();
    gameState.results[gameState.currentTurn] = assignedRole;
    gameState.availableCards = gameState.availableCards.filter(index => index !== cardIndex);
    gameState.isTrayUnlocked = false;

    io.emit('CARD_REVEALED', { seat: gameState.currentTurn, role: assignedRole, cardIndex });

    if (gameState.currentTurn >= 10) {
      gameState.status = 'COMPLETED';
    } else {
      gameState.currentTurn++;
    }
    io.emit('STATE_UPDATE', getPublicState());
  });

  socket.on('TOGGLE_DEBUG_MODE', (booleanState) => {
    if (clients[socket.id]?.role !== 'ADMIN') return; // Only admins can toggle
    gameState.isDebugMode = booleanState;
    io.emit('STATE_UPDATE', getPublicState()); 
  });

  // 6. Handle Disconnects
  socket.on('disconnect', () => {
    console.log(`Client Disconnected: ${socket.id}`);
    delete clients[socket.id];
    updateClientCounts();
    broadcastRegistryToAdmins();
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Mafia Draft Server running on port ${PORT}`);
});