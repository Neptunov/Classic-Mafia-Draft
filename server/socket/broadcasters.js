import { state } from '../core/state.js';

let io;

/**
 * Initializes the broadcasters by capturing the Socket.io instance
 * and overriding the global emit prototypes for encryption interceptors.
 */
export function setupBroadcasters(ioInstance) {
  io = ioInstance;
  
  // --- GLOBAL ENCRYPTION OVERRIDES ---
  io.to = function(target) {
    return {
      emit: function(event, ...args) {
        const room = io.sockets.adapter.rooms.get(target);
        if (room) {
          for (const socketId of room) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) socket.emit(event, ...args); 
          }
        } else {
          const socket = io.sockets.sockets.get(target);
          if (socket) socket.emit(event, ...args);
        }
      }
    };
  };

  io.emit = function(event, ...args) {
    io.sockets.sockets.forEach(socket => socket.emit(event, ...args));
  };
}

export function broadcastState(roomId) {
  if (!roomId || !state.rooms[roomId]) return;
  const gs = state.rooms[roomId].gameState;
  
  const cleanState = { ...gs, isDebugMode: state.globalDebugMode };
  
  if (!state.globalDebugMode) {
    cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}"; 
  }

  io.to(roomId).emit('STATE_UPDATE', cleanState);
  broadcastToAdmins(); 
}

export function broadcastToAdmins() {
  const adminSockets = Object.values(state.clients).filter(c => c.role === 'ADMIN').map(c => c.id);
  if (adminSockets.length === 0) return;

  const sanitizedRooms = {};
  for (const [roomId, roomData] of Object.entries(state.rooms)) {
    const cleanState = { ...roomData.gameState };
    if (!state.globalDebugMode) {
      cleanState.slots = "{HIDDEN_FOR_TOURNAMENT_INTEGRITY}";
    }
    sanitizedRooms[roomId] = { gameState: cleanState };
  }

  const fullRegistry = Object.values(state.clients).map(c => ({
    ...c,
    assignedSeat: state.sessions[c.deviceId]?.assignedSeat || null
  }));

  for (const [deviceId, session] of Object.entries(state.sessions)) {
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

export function broadcastAvailableRooms() {
  io.emit('AVAILABLE_ROOMS', Object.keys(state.rooms));
}

export function updateClientCounts(roomId) {
  if (!roomId || !state.rooms[roomId]) return;
  const counts = { PLAYER: 0, JUDGE: 0, STREAM: 0, UNASSIGNED: 0, PENDING_STREAM: 0 };
  
  Object.values(state.clients).forEach(client => {
    if (client.roomId === roomId && counts[client.role] !== undefined) counts[client.role]++;
  });
  
  state.rooms[roomId].gameState.clientCounts = counts;
  io.to(roomId).emit('STATE_UPDATE', state.rooms[roomId].gameState);
  broadcastToAdmins(); 
}