/**
 * @file server/index.js
 * @description Core backend server for the Classic Mafia Draft App.
 * Handles WebSocket routing, state synchronization, persistent storage, 
 * and secure tournament administration.
 */

import AdmZip from 'adm-zip';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import readline from 'readline';
import notifier from 'node-notifier';
import open from 'open';
import { spawn } from 'child_process';

import { state, APP_VERSION, DATA_SCHEMA_VERSION, saveState, loadState, STORAGE_DIR } from './core/state.js';
import { verifyPasswordPlaintext } from './core/crypto.js';
import { initializeSockets } from './socket/handlers.js';
import { setupBroadcasters } from './socket/broadcasters.js';
import assetRouter, { ACTIVE_DIR, DEFAULT_DIR, DEFAULT_PACK } from './api/assets.js';
import { INTERNAL_ROOT } from './core/paths.js';

const __dirname = INTERNAL_ROOT;

const app = express();
app.use('/api/assets', assetRouter);
app.use('/api/assets/active', express.static(ACTIVE_DIR));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] }, maxHttpBufferSize: 8192 });

// Initialize modularized socket architecture
setupBroadcasters(io);
initializeSockets(io);

// --- PRODUCTION FILE SERVING ---

const isDevBuild = APP_VERSION.toLowerCase().includes('dev');

app.use((req, res, next) => {
  if (req.url.endsWith('.map') && !isDevBuild) {
    console.warn(`[SECURITY] Blocked source map request from ${req.ip} (Release Build).`);
    return res.status(404).send('Not Found');
  }
  next();
});

const clientBuildPath = path.join(__dirname, 'client/dist');
app.use(express.static(clientBuildPath));

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
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

loadState();

// --- PRELOAD DEFAULT ASSETS ---
const activeFiles = fs.readdirSync(ACTIVE_DIR);
if (activeFiles.length === 0) {
  console.log('[ASSETS] Active directory is empty. Preloading default assets...');
  const defaultPackPath = path.join(DEFAULT_DIR, DEFAULT_PACK);
  
  if (fs.existsSync(defaultPackPath)) {
    try {
      const zip = new AdmZip(defaultPackPath);
      zip.extractAllTo(ACTIVE_DIR, true);
      console.log('[ASSETS] Default classic pack extracted and ready.');
    } catch (err) {
      console.error('[ASSETS] Failed to extract default pack:', err);
    }
  } else {
    console.warn(`[ASSETS] WARNING: fiimdefault.mafpack not found at ${defaultPackPath}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function startServer() {
  server.listen(PORT, '0.0.0.0', async () => {
	const isProd = process.argv.includes('--prod');

	if (isProd) {
	  console.log('\x1Bc');
	  console.log('\x1b[36m%s\x1b[0m', `
	  =======================================================
	       CLASSIC MAFIA DRAFT - TOURNAMENT SERVER 
	  =======================================================
	  `);
	  console.log(`      Status:      ONLINE (v${APP_VERSION})`);
	  console.log(`      Admin PC:    http://localhost:${PORT}`);
	  console.log(`      LAN Access:  http://${LOCAL_IP}:${PORT}`);
	  console.log(`\n      [ INFO ] Type "status", "restart", "shutdown", or "reset"`);
	  console.log(`               and press Enter to use QoL tools.`);
	  console.log('\x1b[36m%s\x1b[0m', `\n      =======================================================\n`);

	  notifier.notify({
	    title: 'Classic Mafia Draft',
	    message: 'Server is live! Opening Admin Dashboard...',
	    sound: true,
	    wait: false
	  });

	  try {
	    await open(`http://localhost:${PORT}/admin`);
	  } catch (err) {
	    console.log('      [WARN] Could not auto-open browser.');
	  }
	  } else {
	    console.log(`\n=== 🃏 MAFIA TOURNAMENT SERVER LIVE (v${APP_VERSION} - DEV) ===`);
	    console.log(`1. Admin PC:   http://localhost:${PORT}`);
		console.log(`2. LAN Access: http://${LOCAL_IP}:${PORT}`);
		console.log(`=======================================`);
		console.log(`Type "status", "restart", "shutdown", or "reset" for QoL tools.\n`);
	  }

	  rl.on('line', (input) => {
		const command = input.trim().toLowerCase();

		switch (command) {
		  case 'status':
			console.log(`\n=== 📊 SERVER STATUS ===`);
			console.log(`Version:       v${APP_VERSION}`);
			console.log(`Uptime:        ${Math.floor(process.uptime() / 60)} minutes`);
			console.log(`Active Tables: ${Object.keys(state.rooms || {}).length}`);
			console.log(`Connections:   ${Object.keys(state.clients || {}).length}`);
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

			const isProd = process.argv.includes('--prod');

			if (isProd) {
			  const args = process.argv.slice(1);
			  const child = spawn('cmd.exe', ['/c', 'start', '""', process.execPath, ...args], {
				detached: true,
				stdio: 'ignore'
			  });
			  
			  child.unref();
			  
			  process.exit(0);
			} else {
			  process.exit(1); 
			}
			break;

		  case 'reset':
			rl.question('WARNING: Enter Admin Password to confirm factory reset (Text will be visible): ', (pass) => {
			  if (verifyPasswordPlaintext(pass)) {
				
				if (fs.existsSync(STORAGE_DIR)) {
				  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
				}
				
				const legacyStorePath = path.join(APP_ROOT, 'server/store.json');
				if (fs.existsSync(legacyStorePath)) {
				  fs.unlinkSync(legacyStorePath);
				}

				console.log(`\n[SUCCESS] Server wiped. All shards and data destroyed. Please restart the application.\n`);
				process.exit(0);
			  } else {
				console.log(`[ERROR] Incorrect password. Reset aborted.\n`);
			  }
			});
			break;
			
		  default:
			if (command) console.log(`[ERROR] Unknown command: "${command}"`);
			break;
		}
	  });
});
}

startServer();