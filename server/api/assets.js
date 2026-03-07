/**
 * @file server/api/assets.js
 * @description Express Router handling the Custom Asset Engine's HTTP bridge.
 * Processes high-resolution image uploads, enforces strict memory limits, 
 * validates authorization tokens, optimizes images into WebP, and manages
 * the compilation and extraction of proprietary .mafpack archives.
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import AdmZip from 'adm-zip'; // <-- NEW IMPORT
import { state } from '../core/state.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- ASSET DIRECTORY ARCHITECTURE ---
export const ASSETS_DIR = path.join(__dirname, '../assets');
export const TEMP_DIR = path.join(ASSETS_DIR, 'temp');     
export const PACKS_DIR = path.join(ASSETS_DIR, 'packs');   
export const ACTIVE_DIR = path.join(ASSETS_DIR, 'active'); 

[ASSETS_DIR, TEMP_DIR, PACKS_DIR, ACTIVE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const router = express.Router();
router.use(express.json()); // Allow router to parse JSON body payloads

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

const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are permitted.'));
  }
});

// --- 1. UPLOAD TEMP IMAGE ---
router.post('/upload-temp', requireAdminToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file detected.' });

    // In a real scenario, the frontend will tell us if this is "citizen", "mafia", or "trayBg"
    // For now, we use the original filename prefix if provided, else timestamp
    const baseName = req.body.assetType || `asset_${Date.now()}`;
    const fileName = `${baseName}.webp`;
    const outputPath = path.join(TEMP_DIR, fileName);
    
    await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toFile(outputPath);

    res.json({ success: true, file: fileName });
  } catch (err) {
    console.error('[ASSETS] File processing failed:', err);
    res.status(500).json({ error: 'Image optimization failed.' });
  }
});

// --- 2. COMPILE .MAFPACK ---
router.post('/compile', requireAdminToken, (req, res) => {
  try {
    const { name, author, version } = req.body;
    if (!name) return res.status(400).json({ error: 'Pack name required.' });

    const tempFiles = fs.readdirSync(TEMP_DIR);
    if (tempFiles.length === 0) return res.status(400).json({ error: 'No files in temp directory to compile.' });

    const packId = crypto.randomBytes(6).toString('hex');
    const filename = `${packId}.mafpack`;
    
    const manifest = { 
      id: packId, 
      name, 
      author: author || 'Admin', 
      version: version || '1.0.0', 
      date: Date.now() 
    };

    const zip = new AdmZip();
    
    // Package all temporary images
    tempFiles.forEach(file => {
      zip.addLocalFile(path.join(TEMP_DIR, file));
    });

    // Generate and inject the manifest.json
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    // Write the compiled archive to the vault
    zip.writeZip(path.join(PACKS_DIR, filename));

    // Sweep the temp directory clean
    tempFiles.forEach(file => fs.unlinkSync(path.join(TEMP_DIR, file)));

    console.log(`[ASSETS] Successfully compiled ${filename}`);
    res.json({ success: true, pack: manifest });
  } catch (err) {
    console.error('[ASSETS] Compilation failed:', err);
    res.status(500).json({ error: 'Compilation failed.' });
  }
});

// --- 3. LIST INSTALLED PACKS ---
router.get('/packs', requireAdminToken, (req, res) => {
  try {
    const files = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.mafpack'));
    const packs = files.map(file => {
      const zip = new AdmZip(path.join(PACKS_DIR, file));
      const manifestEntry = zip.getEntry('manifest.json');
      if (manifestEntry) {
        return { ...JSON.parse(zip.readAsText(manifestEntry)), filename: file };
      }
      return { id: file, name: file, author: 'Unknown', filename: file };
    });
    
    res.json({ success: true, packs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read installed packs.' });
  }
});

// --- 4. ACTIVATE PACK ---
router.post('/activate/:filename', requireAdminToken, (req, res) => {
  try {
    const packPath = path.join(PACKS_DIR, req.params.filename);
    if (!fs.existsSync(packPath)) return res.status(404).json({ error: 'Pack not found.' });

    // Purge the active directory
    const activeFiles = fs.readdirSync(ACTIVE_DIR);
    activeFiles.forEach(file => fs.unlinkSync(path.join(ACTIVE_DIR, file)));

    // Unzip the selected pack directly into the active serving directory
    

//[Image of file archiving process]

    const zip = new AdmZip(packPath);
    zip.extractAllTo(ACTIVE_DIR, true);

    console.log(`[ASSETS] Activated pack: ${req.params.filename}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[ASSETS] Activation failed:', err);
    res.status(500).json({ error: 'Failed to extract pack.' });
  }
});

export default router;