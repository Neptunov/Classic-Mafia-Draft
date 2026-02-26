/**
 * @file socket.js
 * @description WebSocket connection configuration and device tracking.
 */
import { io } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import { p256 } from '@noble/curves/nist.js';

// --- CRYPTOGRAPHIC HELPERS ---
const toHex = (bytes) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
const hexToBytes = (hexString) => {
  if (!hexString) return new Uint8Array();
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  return bytes;
};

// Mobile-friendly network routing
const SOCKET_URL = window.location.port === '5173' 
  ? `http://${window.location.hostname}:3000` 
  : window.location.origin;

export const socket = io(SOCKET_URL);
export const getDeviceId = () => localStorage.getItem('mafia_device_id');
export const setDeviceId = (id) => localStorage.setItem('mafia_device_id', id);

let sharedAesKey = null; 

// --- THE OMNISCIENT DEBUGGER (FRONTEND) ---
let isGlobalDebug = false;
const SENSITIVE_EVENTS = ['SETUP_ADMIN', 'ADMIN_LOGIN', 'CHANGE_PASSWORD'];

socket.on('GLOBAL_DEBUG_UPDATE', (state) => isGlobalDebug = state);
socket.on('STATE_UPDATE', (state) => { 
  if (state && state.isDebugMode !== undefined) isGlobalDebug = state.isDebugMode; 
});

socket.onAny((event, ...args) => {
  if (isGlobalDebug && event !== 'ENCRYPTED_MESSAGE') {
    const logArgs = SENSITIVE_EVENTS.includes(event) ? ['[REDACTED_SECURITY_PAYLOAD]'] : args;
    console.log(`%c[INCOMING] ${event}`, 'color: #4CAF50; font-weight: bold;', logArgs);
  }
});

socket.onAnyOutgoing((event, ...args) => {
  if (isGlobalDebug && event !== 'ENCRYPTED_MESSAGE') {
    const logArgs = SENSITIVE_EVENTS.includes(event) ? ['[REDACTED_SECURITY_PAYLOAD]'] : args;
    console.log(`%c[OUTGOING] ${event}`, 'color: #2196F3; font-weight: bold;', logArgs);
  }
});

// --- OUTGOING ENCRYPTION INTERCEPTOR ---
const originalEmit = socket.emit;
socket.emit = function(event, ...args) {
  if (sharedAesKey && event !== 'KEY_EXCHANGE' && event !== 'IDENTIFY') {
    let callback = undefined;
    
    if (args.length > 0 && typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }

    if (isGlobalDebug) {
      console.log(`%c[ENCRYPTOR] Cloaking -> ${event}`, 'color: #E91E63; font-weight: bold;', args);
    }

    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(args), sharedAesKey, { iv, mode: CryptoJS.mode.CBC }).ciphertext.toString(CryptoJS.enc.Hex);
    const hmac = CryptoJS.HmacSHA256(`${iv.toString(CryptoJS.enc.Hex)}:${encrypted}`, sharedAesKey).toString(CryptoJS.enc.Hex);
    
    const payloadStr = `${iv.toString(CryptoJS.enc.Hex)}:${encrypted}:${hmac}`;

    if (callback) {
      originalEmit.call(this, 'ENCRYPTED_MESSAGE', { event, payload: payloadStr }, callback);
    } else {
      originalEmit.call(this, 'ENCRYPTED_MESSAGE', { event, payload: payloadStr });
    }
  } else {
    originalEmit.apply(this, [event, ...args]);
  }
};

// --- INCOMING DECRYPTION ROUTER ---
socket.on('ENCRYPTED_MESSAGE', (wrapper) => {
  if (!sharedAesKey) return;
  try {
    const parts = wrapper.payload.split(':');
    const [ivHex, ciphertext, hmacHex] = parts;
    
    const expectedHmac = CryptoJS.HmacSHA256(`${ivHex}:${ciphertext}`, sharedAesKey).toString(CryptoJS.enc.Hex);
    if (hmacHex !== expectedHmac) return; 
    
    const ciphertextBase64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(ciphertext));
    
    const decrypted = CryptoJS.AES.decrypt(
       ciphertextBase64, 
       sharedAesKey, 
       { iv: CryptoJS.enc.Hex.parse(ivHex), mode: CryptoJS.mode.CBC }
    ).toString(CryptoJS.enc.Utf8);
    
    const argsArray = JSON.parse(decrypted);

    if (Array.isArray(argsArray)) {
      if (isGlobalDebug) {
        console.log(`%c[DECRYPTOR] Unpacked <- ${wrapper.event}`, 'color: #9C27B0; font-weight: bold;', argsArray);
      }
      socket.listeners(wrapper.event).forEach(fn => fn(...argsArray));
    }
  } catch (err) { 
    console.error('[SECURITY] Frontend Decryption failed:', err.message); 
  }
});

// --- ECDH HANDSHAKE ---
socket.on('connect', () => {
  try {
    const privKey = p256.utils.randomSecretKey();
    const pubKeyBytes = p256.getPublicKey(privKey, false);
    const pubKeyHex = toHex(pubKeyBytes);

    socket.emit('KEY_EXCHANGE', pubKeyHex, (response) => {
      if (response.success) {
        const serverPubKeyBytes = hexToBytes(response.serverPublicKey);
        const sharedPointBytes = p256.getSharedSecret(privKey, serverPubKeyBytes);
        
        const sharedSecretBytes = sharedPointBytes.slice(1, 33);
        
        const sharedSecretHex = toHex(sharedSecretBytes).padStart(64, '0');
        const hashHex = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(sharedSecretHex)).toString(CryptoJS.enc.Hex);
        
        sharedAesKey = CryptoJS.enc.Hex.parse(hashHex);
        console.log('%c[SECURITY] Shared secret established.', 'color: #FFD700; font-weight: bold;');
        
        socket.emit('IDENTIFY', getDeviceId());
      }
    });
  } catch (err) { console.error('ECDH Handshake failed:', err); }
});