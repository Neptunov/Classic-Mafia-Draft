import { io } from 'socket.io-client';

// DYNAMIC IP ROUTING: 
// Instead of hardcoding localhost, we tell the tablet to look for the Node server 
// on port 3001 of whatever IP address it used to load the website!
const serverIp = window.location.hostname;
const URL = `http://${serverIp}:3001`;

// Check if this browser already has an ID saved. If not, create one.
let deviceId = localStorage.getItem('mafia_device_id');
if (!deviceId) {
  // Generates a random string (e.g., "x8f9q2m")
  deviceId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('mafia_device_id', deviceId);
}

export const socket = io(URL, {
  autoConnect: true,
});

// Export the deviceId so we can send it to the server
export { deviceId };