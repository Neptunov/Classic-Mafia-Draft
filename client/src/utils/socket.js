/**
 * @file socket.js
 * @description WebSocket connection configuration and device tracking.
 * Bypasses Vite environment variables to ensure compatibility with compiled Express serving.
 */
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.port === '5173' 
  ? 'http://localhost:3000' 
  : window.location.origin;

export const socket = io(SOCKET_URL);

let deviceId = localStorage.getItem('mafia_device_id');
if (!deviceId) {
  deviceId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('mafia_device_id', deviceId);
}

export { deviceId };