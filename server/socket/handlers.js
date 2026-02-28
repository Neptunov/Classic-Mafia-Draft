import { state, saveState, MAX_CONNECTIONS_PER_IP } from '../core/state.js';
import { encryptPayload, decryptPayload, verifyAdmin, hashPassword, verifyPasswordPlaintext } from '../core/crypto.js';
import { validatePayload, getInitialGameState, shuffle, INITIAL_DECK } from '../core/game.js';
import { broadcastState, broadcastToAdmins, broadcastAvailableRooms, updateClientCounts } from './broadcasters.js';
import crypto from 'crypto';

export function initializeSockets(io) {
  io.use((socket, next) => {
    const clientIp = socket.handshake.address;
    if (!state.ipConnectionCounts[clientIp]) state.ipConnectionCounts[clientIp] = 0;
    if (state.ipConnectionCounts[clientIp] >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error('Connection limit exceeded.'));
    }
    state.ipConnectionCounts[clientIp]++;
    next();
  });

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;

	let messageCount = 0;
	const MAX_MESSAGES_PER_SECOND = 20;

	const throttleTimer = setInterval(() => {
	messageCount = 0;
	}, 1000);

	// --- THE OMNISCIENT DEBUGGER (BACKEND) ---
	const SENSITIVE_EVENTS = ['SETUP_ADMIN', 'ADMIN_LOGIN', 'CHANGE_PASSWORD'];

	socket.onAny((event, ...args) => {
	if (state.globalDebugMode && event !== 'ENCRYPTED_MESSAGE') {
	  const shortId = socket.id.substring(0, 5);
	  const logArgs = SENSITIVE_EVENTS.includes(event) ? ['[REDACTED_SECURITY_PAYLOAD]'] : args;
	  console.log(`\x1b[32m[IN  <- ${shortId}]\x1b[0m ${event}`, JSON.stringify(logArgs).substring(0, 150));
	}
	});

	socket.onAnyOutgoing((event, ...args) => {
	if (state.globalDebugMode && event !== 'ENCRYPTED_MESSAGE') {
	  const shortId = socket.id.substring(0, 5);
	  const logArgs = SENSITIVE_EVENTS.includes(event) ? ['[REDACTED_SECURITY_PAYLOAD]'] : args;
	  console.log(`\x1b[36m[OUT -> ${shortId}]\x1b[0m ${event}`, JSON.stringify(logArgs).substring(0, 150));
	}
	});

	// --- INITIAL STATE SYNC (THE LOBBY FIX) ---
	socket.on('IDENTIFY', () => {
	if (state.clientKeys[socket.id]) {
	  socket.emit('GLOBAL_DEBUG_UPDATE', state.globalDebugMode);
	}
	});

	// --- OUTGOING ENCRYPTION INTERCEPTOR ---
	const _emit = socket.emit;
	socket.emit = function(event, ...args) {
	const key = state.clientKeys[this.id];

	if (key && event !== 'ENCRYPTED_MESSAGE' && event !== 'KEY_EXCHANGE') {
	  let callback = undefined;
	  
	  if (args.length > 0 && typeof args[args.length - 1] === 'function') {
		callback = args.pop();
	  }

	  if (state.globalDebugMode) {
		const shortId = this.id.substring(0, 5);
		console.log(`\x1b[35m[ENCRYPTOR OUT -> ${shortId}]\x1b[0m ${event}`, JSON.stringify(args).substring(0, 150));
	  }
	  
	  const payloadStr = encryptPayload(args, key);

	  if (callback) {
		_emit.call(this, 'ENCRYPTED_MESSAGE', { event, payload: payloadStr }, callback);
	  } else {
		_emit.call(this, 'ENCRYPTED_MESSAGE', { event, payload: payloadStr });
	  }
	} else {
	  _emit.apply(this, [event, ...args]);
	}
	};

	socket.on('KEY_EXCHANGE', (clientPublicKeyHex, callback) => {
	try {
	  const serverECDH = crypto.createECDH('prime256v1');
	  serverECDH.generateKeys();
	  
	  const rawSharedSecret = serverECDH.computeSecret(clientPublicKeyHex, 'hex');
	  
	  const aesKey = crypto.createHash('sha256').update(rawSharedSecret).digest();
	  
	  state.clientKeys[socket.id] = aesKey;
	  
	  callback({ success: true, serverPublicKey: serverECDH.getPublicKey('hex') });
	} catch (err) {
	  console.error(`[SECURITY] Key exchange failed for ${clientIp}:`, err.message);
	  if (typeof callback === 'function') callback({ success: false });
	}
	});

	// --- INCOMING DECRYPTION ROUTER ---
	socket.on('ENCRYPTED_MESSAGE', (wrapper, ackCallback) => {
	if (!validatePayload(wrapper, { type: 'object', fields: { event: { type: 'string' }, payload: { type: 'string' } } })) return;

	const key = state.clientKeys[socket.id];
	if (!key) return;

	const decryptedArgs = decryptPayload(wrapper.payload, key);
	if (!Array.isArray(decryptedArgs)) return;

	if (state.globalDebugMode) {
	  const shortId = socket.id.substring(0, 5);
	  console.log(`\x1b[35m[DECRYPTOR IN <- ${shortId}]\x1b[0m ${wrapper.event}`, JSON.stringify(decryptedArgs).substring(0, 150));
	}

	if (typeof ackCallback === 'function') {
	  decryptedArgs.push(ackCallback);
	}

	socket.listeners(wrapper.event).forEach(listener => listener(...decryptedArgs));
	});

	socket.use((packet, next) => {
	messageCount++;
	if (messageCount > MAX_MESSAGES_PER_SECOND) {
	  console.warn(`[SECURITY] Event spam detected from ${clientIp}. Dropping packet.`);
	  return next(new Error('Rate limit exceeded.')); 
	}
	next();
	});

	if (!state.adminCredentials) {
	const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('127.0.0.1');

	if (!isLocalhost) {
	  console.warn(`[SECURITY] Blocked remote connection from ${clientIp} (Setup Incomplete).`);
	  socket.disconnect(true);
	  return;
	}
	socket.emit('SETUP_REQUIRED');
	}

	socket.on('SETUP_ADMIN', (newPass) => {
	if (state.adminCredentials) return; 

	state.adminCredentials = hashPassword(newPass);
	saveState();

	io.emit('SETUP_COMPLETE');
	console.log(`\n[SUCCESS] Master password initialized via Web UI.\n`);
	});

	socket.emit('AVAILABLE_ROOMS', Object.keys(state.rooms));

	socket.on('IDENTIFY', (clientDeviceId) => {
	let deviceId = clientDeviceId;

	if (!deviceId || deviceId.length !== 64) {
	  const secureToken = crypto.randomBytes(32).toString('hex');
	  socket.emit('ASSIGN_NEW_DEVICE_ID', secureToken);
	  return;
	}

	socket.deviceId = deviceId;

	if (state.sessions[deviceId] && state.sessions[deviceId].roomId) {
	  const roomId = state.sessions[deviceId].roomId;
	  
	  if (roomId !== 'GLOBAL' && !state.rooms[roomId] && state.sessions[deviceId].role !== 'ADMIN') {
		state.sessions[deviceId].roomId = null;
		state.sessions[deviceId].role = 'UNASSIGNED';
		socket.emit('ROLE_ASSIGNED', 'UNASSIGNED');
		return;
	  }

	  state.clients[socket.id] = { 
		id: socket.id, 
		deviceId, 
		name: state.sessions[deviceId].name, 
		ip: clientIp, 
		role: state.sessions[deviceId].role, 
		roomId,
		streamLayout: state.sessions[deviceId].streamLayout || 'CENTER' 
	  };
	  
	  if (roomId !== 'GLOBAL') {
		socket.join(roomId);
		if (state.rooms[roomId]) socket.emit('STATE_UPDATE', state.rooms[roomId].gameState);
		updateClientCounts(roomId);
	  }
	  
	  socket.emit('ROLE_ASSIGNED', state.sessions[deviceId].role);
	  broadcastToAdmins();
	} 
	});

	socket.on('JOIN_ROOM', (payload) => {
	if (!validatePayload(payload, { 
	  type: 'object', 
	  fields: { 
		name: { type: 'string', minLength: 1, maxLength: 30 }, 
		roomCode: { type: 'string', minLength: 1, maxLength: 20 } 
	  } 
	})) {
	  console.warn(`[SECURITY] Invalid JOIN_ROOM payload blocked from ${clientIp}`);
	  return; 
	}

	const { name, roomCode } = payload;

	if (!socket.deviceId) return;
	const roomId = roomCode.toUpperCase().trim();

	if (!state.rooms[roomId]) return; 

	socket.join(roomId);
	state.sessions[socket.deviceId] = { name, role: 'UNASSIGNED', roomId };
	state.clients[socket.id] = { id: socket.id, deviceId: socket.deviceId, name, ip: clientIp, role: 'UNASSIGNED', roomId };

	updateClientCounts(roomId);
	broadcastToAdmins();
	});

	socket.on('REQUEST_LOGIN_CHALLENGE', (callback) => {
	if (!state.adminCredentials) return callback({ success: false, message: 'Server not configured.' });

	const attemptData = state.loginAttempts[clientIp] || { count: 0, lockoutUntil: 0 };
	if (Date.now() < attemptData.lockoutUntil) {
	  const minutesLeft = Math.ceil((attemptData.lockoutUntil - Date.now()) / 60000);
	  return callback({ success: false, message: `Too many failed attempts. Locked out for ${minutesLeft} minutes.` });
	}

	const nonce = crypto.randomBytes(16).toString('hex');
	state.loginChallenges[socket.id] = nonce;

	callback({ success: true, salt: state.adminCredentials.salt, nonce: nonce });
	});

	socket.on('ADMIN_LOGIN', (clientHmacResponse, callback) => {
	const attemptData = state.loginAttempts[clientIp] || { count: 0, lockoutUntil: 0 };

	if (Date.now() < attemptData.lockoutUntil) {
	  return callback({ success: false, message: 'IP temporarily locked out.' });
	}

	const activeNonce = state.loginChallenges[socket.id];

	if (verifyAdmin(clientHmacResponse, activeNonce)) {
	  delete state.loginAttempts[clientIp];
	  delete state.loginChallenges[socket.id];

	  if (!state.clients[socket.id]) state.clients[socket.id] = { id: socket.id, deviceId: socket.deviceId };
	  state.clients[socket.id].role = 'ADMIN';
	  
	  if (socket.deviceId) {
		state.sessions[socket.deviceId] = { name: 'Tournament Admin', role: 'ADMIN', roomId: 'GLOBAL' };
	  }

	  socket.emit('ROLE_ASSIGNED', 'ADMIN');
	  broadcastToAdmins();
	  if (typeof callback === 'function') callback({ success: true });
	  
	} else {
	  attemptData.count += 1;
	  if (attemptData.count >= 5) {
		attemptData.lockoutUntil = Date.now() + (10 * 60 * 1000);
		console.warn(`[SECURITY] IP ${clientIp} locked out for 10 minutes (Brute Force Protection).`);
	  }
	  state.loginAttempts[clientIp] = attemptData;
	  
	  delete state.loginChallenges[socket.id]; 
	  
	  if (typeof callback === 'function') {
		const msg = attemptData.count >= 5 ? 'Too many attempts. Locked out for 10 minutes.' : 'Invalid Admin Password';
		callback({ success: false, message: msg });
	  }
	}
	});

	socket.on('CHANGE_PASSWORD', ({ oldPassword, newPassword }) => {
	if (state.clients[socket.id]?.role !== 'ADMIN') return;

	if (verifyPasswordPlaintext(oldPassword)) {
	  state.adminCredentials = hashPassword(newPassword);
	  saveState();
	  
	  socket.emit('PASSWORD_CHANGED_SUCCESS', 'Password updated successfully.');
	  console.log(`[SECURITY] Master admin password rotated by Admin at ${new Date().toISOString()}`);
	} else {
	  socket.emit('PASSWORD_CHANGED_FAILED', 'Incorrect current password.');
	  console.warn(`[SECURITY] Failed password rotation attempt from Admin.`);
	}
	});

	socket.on('CREATE_ROOM', (roomCode) => {
	if (!validatePayload(roomCode, { type: 'string', minLength: 1, maxLength: 20 })) return;

	if (state.clients[socket.id]?.role !== 'ADMIN') {
	  socket.emit('ROLE_ASSIGNED', 'UNASSIGNED'); 
	  return;
	}
	const roomId = roomCode.toUpperCase().trim();
	if (!roomId || state.rooms[roomId]) return; 

	state.rooms[roomId] = { gameState: getInitialGameState() };

	broadcastAvailableRooms();
	broadcastToAdmins();
	saveState();
	});

	socket.on('DELETE_ROOM', (roomId) => {
	if (!validatePayload(roomId, { type: 'string', minLength: 1, maxLength: 20 })) return;
	if (state.clients[socket.id]?.role !== 'ADMIN') return;
	if (!state.rooms[roomId] || state.rooms[roomId].gameState.areRolesLocked) return; 

	Object.values(state.clients).forEach(client => {
	  if (client.roomId === roomId && client.role !== 'ADMIN') {
		const newRole = client.role === 'STREAM' ? 'PENDING_STREAM' : 'UNASSIGNED';
		const newRoom = client.role === 'STREAM' ? 'GLOBAL' : null;
		
		client.roomId = newRoom;
		client.role = newRole;
		state.sessions[client.deviceId].roomId = newRoom;
		state.sessions[client.deviceId].role = newRole;
		
		io.to(client.id).emit('ROLE_ASSIGNED', newRole);
		io.sockets.socketsLeave(roomId); 
	  }
	});

	delete state.rooms[roomId];
	broadcastAvailableRooms();
	broadcastToAdmins();
	  saveState();
	});

	socket.on('REQUEST_STREAM_ACCESS', (payload) => {
	const { userAgent, deviceId } = payload;
	const roomId = 'GLOBAL'; 

	socket.join(roomId);

	if (!state.sessions[deviceId]) state.sessions[deviceId] = { name: 'Stream Request', role: 'PENDING_STREAM', roomId, streamLayout: 'CENTER' };

	state.clients[socket.id] = { 
	  id: socket.id, 
	  deviceId, 
	  name: state.sessions[deviceId].name, 
	  ip: clientIp, 
	  role: state.sessions[deviceId].role, 
	  roomId,
	  streamLayout: state.sessions[deviceId].streamLayout || 'CENTER'
	};

	if (state.clients[socket.id].role === 'STREAM') {
	  socket.join(state.clients[socket.id].roomId);
	  io.to(socket.id).emit('ROLE_ASSIGNED', 'STREAM');
	  return;
	}

	let browserType = 'Unknown Source';
	if (userAgent.includes('OBS')) browserType = 'OBS Studio';
	else if (userAgent.includes('Chrome')) browserType = 'Chrome';

	const streamName = `Stream Request (${browserType})`;
	state.clients[socket.id].role = 'PENDING_STREAM';
	state.clients[socket.id].name = streamName;
	state.sessions[deviceId].role = 'PENDING_STREAM';
	state.sessions[deviceId].name = streamName;

	io.to(socket.id).emit('ROLE_ASSIGNED', 'PENDING_STREAM');
	io.to(socket.id).emit('STREAM_IP', clientIp); 
	broadcastToAdmins();
	});

	socket.on('VERIFY_STREAM', ({ targetSocketId, targetRoomId }) => {
	if (state.clients[socket.id]?.role !== 'ADMIN') return;

	const targetClient = state.clients[targetSocketId];
	if (!targetClient || !state.rooms[targetRoomId]) return;

	targetClient.roomId = targetRoomId;
	targetClient.role = 'STREAM';
	state.sessions[targetClient.deviceId].roomId = targetRoomId;
	state.sessions[targetClient.deviceId].role = 'STREAM';

	const targetSocket = io.sockets.sockets.get(targetSocketId);
	if (targetSocket) {
	  targetSocket.leave('GLOBAL');
	  targetSocket.join(targetRoomId);
	}

	io.to(targetSocketId).emit('ROLE_ASSIGNED', 'STREAM');
	updateClientCounts(targetRoomId);
	broadcastToAdmins();
	});

	socket.on('SET_STREAM_LAYOUT', (payload) => {
	if (!validatePayload(payload, { 
	  type: 'object', 
	  fields: { 
		targetSocketId: { type: 'string', maxLength: 100 }, 
		layout: { type: 'string', maxLength: 15 } 
	  } 
	})) return;

	const { targetSocketId, layout } = payload;
	if (state.clients[socket.id]?.role !== 'ADMIN') return;

	const targetClient = state.clients[targetSocketId];
	if (!targetClient) return;

	targetClient.streamLayout = layout;
	if (state.sessions[targetClient.deviceId]) {
	  state.sessions[targetClient.deviceId].streamLayout = layout;
	  saveState();
	}

	io.to(targetSocketId).emit('UPDATE_LAYOUT', layout);
	broadcastToAdmins();
	});

	socket.on('ASSIGN_ROLE', (payload) => {
	if (!validatePayload(payload, { 
	  type: 'object', 
	  fields: { 
		targetSocketId: { type: 'string', maxLength: 100 }, 
		newRole: { type: 'string', maxLength: 20 } 
	  } 
	})) return;

	const { targetSocketId, newRole } = payload;

	if (state.clients[socket.id]?.role !== 'ADMIN') return;

	const targetClient = state.clients[targetSocketId];
	if (!targetClient) return;

	const roomId = targetClient.roomId;
	if (!state.rooms[roomId] || state.rooms[roomId].gameState.areRolesLocked) return;
	if (targetClient.name === 'Anonymous' && newRole !== 'ADMIN' && newRole !== 'UNASSIGNED') return;

	targetClient.role = newRole;
	state.sessions[targetClient.deviceId].role = newRole; 

	if (newRole !== 'PLAYER') {
	  state.sessions[targetClient.deviceId].assignedSeat = null;
	}

	io.to(targetSocketId).emit('ROLE_ASSIGNED', newRole);
	updateClientCounts(roomId);
	broadcastToAdmins();
	});

	socket.on('RESET_CLIENT', (targetSocketId) => {
	if (state.clients[socket.id]?.role !== 'ADMIN') return;
	const targetClient = state.clients[targetSocketId];
	if (!targetClient) return;

	const roomId = targetClient.roomId;
	targetClient.role = 'UNASSIGNED';
	state.sessions[targetClient.deviceId].role = 'UNASSIGNED';
	io.to(targetSocketId).emit('ROLE_ASSIGNED', 'UNASSIGNED');

	updateClientCounts(roomId);
	broadcastToAdmins();
	});

	socket.on('TOGGLE_ROLE_LOCK', (payload) => {
	if (!validatePayload(payload, { 
	  type: 'object', 
	  fields: { 
		roomId: { type: 'string', maxLength: 20 }, 
		booleanState: { type: 'boolean' } 
	  } 
	})) return;

	const { roomId, booleanState } = payload;
	if (state.clients[socket.id]?.role !== 'ADMIN' || !state.rooms[roomId] || state.rooms[roomId].gameState.status === 'IN_PROGRESS') return;

	const room = state.rooms[roomId];

	if (booleanState === true && room.gameState.settings.singleMode) {
	  const seatedPlayers = Object.values(state.sessions).filter(
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
	if (!validatePayload(booleanState, { type: 'boolean' })) return;
	if (state.clients[socket.id]?.role !== 'ADMIN') return callback?.({ success: false, message: 'Unauthorized' });

	const isAnyDrafting = Object.values(state.rooms).some(r => r.gameState.status !== 'PENDING');
	if (isAnyDrafting) {
	  return callback?.({ success: false, message: 'Cannot change Debug Mode while a draft is active.' });
	}

	state.globalDebugMode = booleanState;

	if (!state.globalDebugMode) {
	  const affectedRooms = new Set();
	  for (const sessionId in state.sessions) {
		if (state.sessions[sessionId].isPhantom) {
		  affectedRooms.add(state.sessions[sessionId].roomId);
		  delete state.sessions[sessionId];
		}
	  }
	  affectedRooms.forEach(roomId => {
		if (state.rooms[roomId] && state.rooms[roomId].gameState.status === 'PENDING') {
		  state.rooms[roomId].gameState.areRolesLocked = false;
		}
	  });
	}

	saveState();
	Object.keys(state.rooms).forEach(roomId => broadcastState(roomId)); 
	io.emit('GLOBAL_DEBUG_UPDATE', state.globalDebugMode); 
	callback?.({ success: true });
	});

	socket.on('TOGGLE_SINGLE_MODE', ({ roomId, booleanState }) => {
	if (state.clients[socket.id]?.role !== 'ADMIN' || !state.rooms[roomId]) return;
	if (state.rooms[roomId].gameState.status !== 'PENDING') return; 

	state.rooms[roomId].gameState.settings.singleMode = booleanState;

	if (!booleanState) {
	  for (const sessionId in state.sessions) {
		if (state.sessions[sessionId].isPhantom && state.sessions[sessionId].roomId === roomId) {
		  delete state.sessions[sessionId];
		}
	  }
	}

	saveState();
	broadcastToAdmins();
	});

	socket.on('SPAWN_PHANTOMS', (roomId, callback) => {
	if (state.clients[socket.id]?.role !== 'ADMIN') return callback?.({ success: false });
	if (!state.globalDebugMode) return callback?.({ success: false, message: 'Debug mode required' });

	const existingSeats = Object.values(state.sessions)
	  .filter(s => s.roomId === roomId && s.role === 'PLAYER' && s.assignedSeat)
	  .map(s => s.assignedSeat);

	for (let i = 1; i <= 10; i++) {
	  if (!existingSeats.includes(i)) {
		const phantomId = `phantom_${roomId}_seat_${i}`;
		state.sessions[phantomId] = {
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
	if (state.clients[socket.id]?.role !== 'ADMIN') return;

	const session = state.sessions[targetDeviceId];
	if (session) {
	  const roomId = session.roomId;
	  if (state.rooms[roomId] && state.rooms[roomId].gameState.areRolesLocked) return;

	  session.assignedSeat = seatNumber ? parseInt(seatNumber) : null;
	  saveState();
	  broadcastToAdmins();

	  const targetClient = Object.values(state.clients).find(c => c.deviceId === targetDeviceId);
	  if (targetClient) {
		io.to(targetClient.id).emit('SEAT_ASSIGNED', session.assignedSeat);
	  }
	}
	});

	socket.on('REQUEST_PERSONAL_INFO', () => {
	const deviceId = state.clients[socket.id]?.deviceId;
	if (deviceId && state.sessions[deviceId]) {
	  socket.emit('SEAT_ASSIGNED', state.sessions[deviceId].assignedSeat || null);
	}
	});

	socket.on('REQUEST_REGISTRY', () => {
	if (state.clients[socket.id]?.role === 'ADMIN') {
	  broadcastToAdmins(); 
	  socket.emit('GLOBAL_DEBUG_UPDATE', state.globalDebugMode);
	} else {
	  socket.emit('ROLE_ASSIGNED', 'UNASSIGNED');
	}
	});

	// --- GAME LOGIC ---
	socket.on('START_DRAFT', () => {
	const roomId = state.clients[socket.id]?.roomId;
	if ((state.clients[socket.id]?.role !== 'JUDGE' && state.clients[socket.id]?.role !== 'ADMIN') || !roomId) return;

	const gs = state.rooms[roomId].gameState;
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
	const roomId = state.clients[socket.id]?.roomId;
	if ((state.clients[socket.id]?.role !== 'JUDGE' && state.clients[socket.id]?.role !== 'ADMIN') || !roomId) return;

	if (state.rooms[roomId].gameState.status === 'IN_PROGRESS') {
	  state.rooms[roomId].gameState.isTrayUnlocked = true;
	  broadcastState(roomId); 
	  io.to(roomId).emit('CLEAR_STREAM'); 
	}
	});

	socket.on('PICK_CARD', (slotIndex) => {
	if (!validatePayload(slotIndex, { type: 'number', min: 0, max: 9 })) {
	  console.warn(`[SECURITY] Invalid PICK_CARD payload blocked from ${clientIp}`);
	  return;
	}

	const roomId = state.clients[socket.id]?.roomId;
	if (!roomId) return;
	const gs = state.rooms[roomId].gameState;

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
	const roomId = state.clients[socket.id]?.roomId;
	if ((state.clients[socket.id]?.role !== 'JUDGE' && state.clients[socket.id]?.role !== 'ADMIN') || !roomId) return;

	const gs = state.rooms[roomId].gameState;

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

	const targetSockets = Object.values(state.clients).filter(c => {
	  if (c.roomId !== roomId || c.role !== 'PLAYER') return false;
	  
	  if (isSingleMode) {
		const session = state.sessions[c.deviceId];
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
	const roomId = state.clients[socket.id]?.roomId;
	if ((state.clients[socket.id]?.role !== 'JUDGE' && state.clients[socket.id]?.role !== 'ADMIN') || !roomId) return;

	const gs = state.rooms[roomId].gameState;
	const locked = gs.areRolesLocked;
	const debug = gs.isDebugMode;
	const singleMode = gs.settings?.singleMode; 

	state.rooms[roomId].gameState = getInitialGameState();
	state.rooms[roomId].gameState.areRolesLocked = locked;
	state.rooms[roomId].gameState.isDebugMode = debug;
	state.rooms[roomId].gameState.settings.singleMode = singleMode; 

	updateClientCounts(roomId);
	io.to(roomId).emit('STATE_UPDATE', state.rooms[roomId].gameState);
	});

	socket.on('MEMORIZED_ROLE', () => {
	const roomId = state.clients[socket.id]?.roomId;
	if (roomId && state.rooms[roomId]) {
	  state.rooms[roomId].gameState.isCardRevealed = false; 
	  broadcastState(roomId);                         
		saveState();
	  
	  io.to(roomId).emit('CLEAR_STREAM');             
	  io.to(roomId).emit('CLOSE_PLAYER_REVEAL');      
	}
	});

	socket.on('disconnect', () => {
	const roomId = state.clients[socket.id]?.roomId;
	delete state.clientKeys[socket.id];
	delete state.clients[socket.id]; 

	const clientIp = socket.handshake.address;
	if (state.ipConnectionCounts[clientIp] > 0) {
	  state.ipConnectionCounts[clientIp]--;
	}

	if (state.ipConnectionCounts[clientIp] === 0) {
	  delete state.ipConnectionCounts[clientIp];
	}

	if (roomId) {
	  updateClientCounts(roomId);
	  broadcastToAdmins(); 
	}
	});
  });
}