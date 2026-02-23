import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const ADMIN_PASSWORD = 'mafia';
const INITIAL_DECK = [
  'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen', 'Citizen',
  'Sheriff', 'Mafia', 'Mafia', 'Don'
];

// --- MULTI-TABLE DATA STRUCTURES ---
const clients = {};  // socket.id -> { id, deviceId, name, ip, role, roomId }
const sessions = {}; // deviceId -> { name, role, roomId }
const rooms = {};    // roomId -> { gameState: {...} }

// Helper to create a fresh room state
function getInitialGameState() {
  return {
    status: 'PENDING',
    slots: {}, 
    revealedSlots: [], 
    currentTurn: 1,
    results: {}, 
    isTrayUnlocked: false,
    isCardRevealed: false, // <-- NEW STATE FLAG
    isDebugMode: false,
    areRolesLocked: false,
    clientCounts: { PLAYER: 0, JUDGE: 0, STREAM: 0, ADMIN: 0, UNASSIGNED: 0, PENDING_STREAM: 0 }
  };
}

function broadcastState(roomId) {
  if (!roomId || !rooms[roomId]) return;
  const gs = rooms[roomId].gameState;
  const cleanState = { ...gs };
  
  if (!gs.isDebugMode) {
    cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}"; 
  }

  io.to(roomId).emit('STATE_UPDATE', cleanState);
  broadcastToAdmins(); // Admins receive the same sanitized state to prevent accidental peeking
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// NEW: Global broadcaster for Super Admins
function broadcastToAdmins() {
  const adminSockets = Object.values(clients).filter(c => c.role === 'ADMIN').map(c => c.id);
  if (adminSockets.length === 0) return;

  // We must build a clean copy of the entire rooms dictionary
  const sanitizedRooms = {};
  
  for (const [roomId, roomData] of Object.entries(rooms)) {
    const cleanState = { ...roomData.gameState };
    
    // If debug is OFF for this specific room, hide its deck
    if (!cleanState.isDebugMode) {
      cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}";
    }
    
    sanitizedRooms[roomId] = { gameState: cleanState };
  }

  adminSockets.forEach(adminId => {
    io.to(adminId).emit('REGISTRY_UPDATE', Object.values(clients));
    io.to(adminId).emit('ROOMS_UPDATE', sanitizedRooms); // Send the scrubbed data!
  });
}

// NEW: Broadcasts the list of active rooms to players in the lobby
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
  broadcastToAdmins(); // Update the Admin dashboard
}

// --- WEBSOCKET LOGIC ---
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;

  // Send the room list immediately when anyone connects
  socket.emit('AVAILABLE_ROOMS', Object.keys(rooms));

  socket.on('IDENTIFY', (deviceId) => {
    socket.deviceId = deviceId;
    
    if (sessions[deviceId] && sessions[deviceId].roomId) {
      const roomId = sessions[deviceId].roomId;
      
      // If the room was deleted while they were disconnected, wipe their session
      if (!rooms[roomId] && sessions[deviceId].role !== 'ADMIN') {
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

  // UPDATED: No longer auto-creates rooms. Fails if room doesn't exist.
  socket.on('JOIN_ROOM', ({ name, roomCode }) => {
    if (!socket.deviceId) return;
    const roomId = roomCode.toUpperCase().trim();
    
    if (!rooms[roomId]) return; // Fails silently if room doesn't exist

    socket.join(roomId);
    sessions[socket.deviceId] = { name, role: 'UNASSIGNED', roomId };
    clients[socket.id] = { id: socket.id, deviceId: socket.deviceId, name, ip: clientIp, role: 'UNASSIGNED', roomId };

    updateClientCounts(roomId);
    broadcastToAdmins();
  });

  // UPDATED: Admin is now a Global entity
  socket.on('ADMIN_LOGIN', (password, callback) => {
    if (password === ADMIN_PASSWORD && socket.deviceId) {
      sessions[socket.deviceId] = { name: 'Super Admin', role: 'ADMIN', roomId: 'GLOBAL' };
      clients[socket.id] = { id: socket.id, deviceId: socket.deviceId, name: 'Super Admin', ip: clientIp, role: 'ADMIN', roomId: 'GLOBAL' };
      
      callback({ success: true });
      broadcastToAdmins();
    } else {
      callback({ success: false, message: 'Invalid password' });
    }
  });

  // NEW: Admin creates a room
  socket.on('CREATE_ROOM', (roomCode) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    const roomId = roomCode.toUpperCase().trim();
    if (!roomId || rooms[roomId]) return; // Don't overwrite existing rooms
    
    rooms[roomId] = { gameState: getInitialGameState() };
    broadcastAvailableRooms();
    broadcastToAdmins();
  });

  // UPDATED: Admin deletes a room (Now handles streams properly)
  socket.on('DELETE_ROOM', (roomId) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    if (!rooms[roomId] || rooms[roomId].gameState.areRolesLocked) return; 

    Object.values(clients).forEach(client => {
      if (client.roomId === roomId && client.role !== 'ADMIN') {
        // If it was a stream, send it back to the global pending pool. Otherwise, to the lobby.
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
  });

  // UPDATED: Streams now park in the GLOBAL room and grab their IP
  socket.on('REQUEST_STREAM_ACCESS', (payload) => {
    const { userAgent, deviceId } = payload;
    const roomId = 'GLOBAL'; // Streams no longer guess the room!

    socket.join(roomId);

    if (!sessions[deviceId]) sessions[deviceId] = { name: 'Stream Request', role: 'PENDING_STREAM', roomId };
    clients[socket.id] = { id: socket.id, deviceId, name: sessions[deviceId].name, ip: clientIp, role: sessions[deviceId].role, roomId };

    if (clients[socket.id].role === 'STREAM') {
      // Re-join their actual assigned room if they refresh
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
    io.to(socket.id).emit('STREAM_IP', clientIp); // Send IP to the tablet/OBS
    
    broadcastToAdmins();
  });

  // NEW: Admin officially assigns a pending stream to a specific room
  socket.on('VERIFY_STREAM', ({ targetSocketId, targetRoomId }) => {
    if (clients[socket.id]?.role !== 'ADMIN') return;
    
    const targetClient = clients[targetSocketId];
    if (!targetClient || !rooms[targetRoomId]) return;

    // Move the stream from GLOBAL to the active room
    targetClient.roomId = targetRoomId;
    targetClient.role = 'STREAM';
    sessions[targetClient.deviceId].roomId = targetRoomId;
    sessions[targetClient.deviceId].role = 'STREAM';

    // Move their socket connection to the new room
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.leave('GLOBAL');
      targetSocket.join(targetRoomId);
    }

    io.to(targetSocketId).emit('ROLE_ASSIGNED', 'STREAM');
    updateClientCounts(targetRoomId);
    broadcastToAdmins();
  });

  // UPDATED: Admin actions now read the target's roomId
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

  // UPDATED: Admin toggles require the UI to tell the server WHICH room to target
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
      socket.emit('REGISTRY_UPDATE', Object.values(clients));
      socket.emit('ROOMS_UPDATE', rooms);
    }
  });

  // 6. Game Logic (Room-Isolated)
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
  });

  socket.on('UNLOCK_TRAY', () => {
    const roomId = clients[socket.id]?.roomId;
    if ((clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') || !roomId) return;
    
    if (rooms[roomId].gameState.status === 'IN_PROGRESS') {
      rooms[roomId].gameState.isTrayUnlocked = true;
      
      broadcastState(roomId); // Use our sanitized state broadcaster
      io.to(roomId).emit('CLEAR_STREAM'); // Explicitly command the stream to close any lingering cards
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

    // Send the secret role ONLY to the tablet that clicked it
    socket.emit('PRIVATE_ROLE_REVEAL', { role, slotIndex });
    
    // Broadcast the public action to everyone else
    io.to(roomId).emit('CARD_REVEALED', { seat: gs.currentTurn, role, cardIndex: slotIndex });

    if (gs.currentTurn >= 10) gs.status = 'COMPLETED';
    else gs.currentTurn++;
    
    broadcastState(roomId);
  });

  socket.on('FORCE_PICK', () => {
    const roomId = clients[socket.id]?.roomId;
    if ((clients[socket.id]?.role !== 'JUDGE' && clients[socket.id]?.role !== 'ADMIN') || !roomId) return;
    
    const gs = rooms[roomId].gameState;
    
    // CRITICAL GUARDRAIL: Reject the force pick if the game isn't active,
    // if the tray is already locked, or if a card is already on the screen!
    if (gs.status !== 'IN_PROGRESS' || !gs.isTrayUnlocked || gs.isCardRevealed) {
      return; 
    }

    // 1. Find available slots
    const allSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const availableSlots = allSlots.filter(s => !gs.revealedSlots.includes(s));
    
    if (availableSlots.length === 0) return;

    // 2. Pick randomly
    const randomSlotIndex = availableSlots[Math.floor(Math.random() * availableSlots.length)];
    const role = gs.slots[randomSlotIndex];

    // 3. Update the tracking arrays
    gs.revealedSlots.push(randomSlotIndex);
    gs.results[gs.currentTurn] = { role, slotIndex: randomSlotIndex };
    
    // 4. CRITICAL FIX: Lock the tray AND tell the UI a card is actively being viewed
    gs.isTrayUnlocked = false;
    gs.isCardRevealed = true; 

    // 5. Trigger animations on the Player tablet
    const playerSockets = Object.values(clients)
      .filter(c => c.roomId === roomId && c.role === 'PLAYER')
      .map(c => c.id);
    
    playerSockets.forEach(playerId => {
      io.to(playerId).emit('PRIVATE_ROLE_REVEAL', { role, slotIndex: randomSlotIndex });
    });

    // 6. Tell the Stream and Admin
    io.to(roomId).emit('CARD_REVEALED', { seat: gs.currentTurn, role, cardIndex: randomSlotIndex });

    // 7. Advance Turn
    if (gs.currentTurn >= 10) gs.status = 'COMPLETED';
    else gs.currentTurn++;
    
    // 8. Broadcast the updated flags
    broadcastState(roomId);
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

  // NEW: Relay the player's "I Memorized It" button to the Stream overlay
  socket.on('MEMORIZED_ROLE', () => {
    const roomId = clients[socket.id]?.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].gameState.isCardRevealed = false; // Mark the card as closed
      broadcastState(roomId);                         // Update the Judge UI immediately
      
      io.to(roomId).emit('CLEAR_STREAM');             // Close the OBS overlay
      io.to(roomId).emit('CLOSE_PLAYER_REVEAL');      // Close the Player tablet overlay
    }
  });

  socket.on('disconnect', () => {
    const roomId = clients[socket.id]?.roomId;
    delete clients[socket.id]; 
    
    if (roomId) {
      updateClientCounts(roomId);
      broadcastToAdmins(); // <-- FIXED: Now uses the new global dashboard updater!
    }
  });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Multi-Table Mafia Server running on port ${PORT}`);
});