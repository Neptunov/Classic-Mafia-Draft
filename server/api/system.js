/**
 * @file server/api/system.js
 * @description Handles version checking, GitHub API polling, and OS-level auto-updating.
 */
import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { INTERNAL_ROOT, isCompiled } from '../core/paths.js';

const router = express.Router();
const REPO_URL = 'https://api.github.com/repos/Neptunov/Classic-Mafia-Draft/releases/latest';

const getAppVersion = () => {
  try {
    const pkgPath = path.join(INTERNAL_ROOT, 'server/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version.replace('v', '');
  } catch (e) {
    return '0.0.0';
  }
};

// --- 1. CHECK FOR UPDATES ---
router.get('/update-check', (req, res) => {
  if (!isCompiled) {
    return res.json({ hasUpdate: false, isDev: true });
  }
	
  const options = {
    headers: { 'User-Agent': 'Classic-Mafia-Draft-Server' }
  };

  https.get(REPO_URL, options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    
    response.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latestVersion = release.tag_name.replace('v', '');
        const currentVersion = getAppVersion();

        const hasUpdate = latestVersion !== currentVersion;

        res.json({
          hasUpdate,
          currentVersion,
          latestVersion,
          releaseNotes: release.body,
          url: release.html_url,
          platform: process.platform
        });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse GitHub response.' });
      }
    });
  }).on('error', (e) => {
    res.status(500).json({ error: 'Failed to reach GitHub.' });
  });
});

// --- 2. APPLY UPDATE (WINDOWS ONLY) ---
router.post('/apply-update', (req, res) => {
  if (!isCompiled) {
    return res.status(403).json({ error: 'Auto-update is disabled in the development environment.' });
  }
	
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Auto-update is only supported on Windows.' });
  }

  const INSTALLER_URL = 'https://github.com/Neptunov/Classic-Mafia-Draft/releases/download/Installer/ClassicMafiaDraft_Setup.exe';
  const tempPath = path.join(os.tmpdir(), 'ClassicMafiaDraft_Update.exe');

  console.log(`[SYSTEM] Downloading update to ${tempPath}...`);

  const file = fs.createWriteStream(tempPath);
  
  https.get(INSTALLER_URL, (response) => {
    if (response.statusCode === 301 || response.statusCode === 302) {
      https.get(response.headers.location, (redirectRes) => {
        redirectRes.pipe(file);
        file.on('finish', () => file.close(prepareExecution)); 
      });
    } else {
      response.pipe(file);
      file.on('finish', () => file.close(prepareExecution));
    }
  });

  function prepareExecution() {
    console.log('[SYSTEM] Download complete. Waiting for Windows OS file locks to clear...');
    
    setTimeout(executeUpdate, 1500);
  }

  function executeUpdate() {
    console.log('[SYSTEM] Spawning silent installer...');
    res.json({ success: true, message: 'Server shutting down for update...' });

    try {
      const child = spawn(tempPath, ['/SILENT'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      
      setTimeout(() => process.exit(0), 1000); 
    } catch (err) {
      console.error('[SYSTEM] Failed to spawn updater:', err);
    }
  }
});

export default router;