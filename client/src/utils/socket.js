/**
 * @file socket.js
 * @description WebSocket connection configuration and device tracking.
 */
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.port === '5173' 
  ? 'http://localhost:3000' 
  : window.location.origin;

export const socket = io(SOCKET_URL);

// Export getters and setters so React can manage the ID securely
export const getDeviceId = () => localStorage.getItem('mafia_device_id');
export const setDeviceId = (id) => localStorage.setItem('mafia_device_id', id);