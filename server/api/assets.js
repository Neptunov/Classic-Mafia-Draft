/**
 * @file server/api/assets.js
 * @description Express Router handling the Custom Asset Engine's HTTP bridge.
 * Processes high-resolution image uploads, enforces strict memory limits, 
 * validates authorization tokens issued by the WebSocket server, and uses 
 * WebAssembly (sharp) to optimize images into the WebP format.
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { state } from '../core/state.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- ASSET DIRECTORY ARCHITECTURE ---
export const ASSETS_DIR = path.join(__dirname, '../storage/assets');
export const TEMP_DIR = path.join(ASSETS_DIR, 'temp');     // Holds raw uploads before pack compilation
export const PACKS_DIR = path.join(ASSETS_DIR, 'packs');   // Holds compiled .mafpack archive files
export const ACTIVE_DIR = path.join(ASSETS_DIR, 'active'); // The statically served live texture directory

// Ensure the vault structure exists on server boot
[ASSETS_DIR, TEMP_DIR, PACKS_DIR, ACTIVE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const router = express.Router();

/**
 * Express Middleware: Validates the HTTP Bearer token against the in-memory 
 * WebSocket state map to ensure only actively authenticated admins can upload files.
 */
const requireAdminToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!state.uploadTokens[token]) {
    return res.status(403).json({ error: 'Token expired or invalid.' });
  }
  next();
};

/**
 * Multer Configuration: Processes multipart/form-data.
 * Holds files in RAM (memoryStorage) to prevent writing malicious or oversized
 * payloads to the physical disk before they are processed by Sharp.
 */
const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // Enforce 10MB physical limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are permitted.'));
  }
});

/**
 * POST /api/assets/upload-temp
 * Ingests a raw image, optimizes it to WebP, and saves it to the temporary vault.
 */
router.post('/upload-temp', requireAdminToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file detected.' });

    const fileName = `temp_${Date.now()}.webp`;
    const outputPath = path.join(TEMP_DIR, fileName);
    
    // Process image buffer synchronously: Convert to 85% quality WebP
    await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toFile(outputPath);

    res.json({ success: true, file: fileName });
  } catch (err) {
    console.error('[ASSETS] File processing failed:', err);
    res.status(500).json({ error: 'Image optimization failed.' });
  }
});

export default router;