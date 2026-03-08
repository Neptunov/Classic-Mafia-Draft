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
import AdmZip from 'adm-zip'; 
import { state } from '../core/state.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- ASSET DIRECTORY ARCHITECTURE ---
export const ASSETS_DIR = path.join(__dirname, '../assets');
export const TEMP_DIR = path.join(ASSETS_DIR, 'temp');     
export const PACKS_DIR = path.join(ASSETS_DIR, 'packs');   
export const ACTIVE_DIR = path.join(ASSETS_DIR, 'active'); 
export const DEFAULT_DIR = path.join(ASSETS_DIR, 'default_packs');
export const DEFAULT_PACK = 'fiimdefault.mafpack';  //default pack name

[ASSETS_DIR, TEMP_DIR, PACKS_DIR, ACTIVE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const router = express.Router();
router.use(express.json());
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
    
    tempFiles.forEach(file => {
      zip.addLocalFile(path.join(TEMP_DIR, file));
    });

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    zip.writeZip(path.join(PACKS_DIR, filename));

    tempFiles.forEach(file => fs.unlinkSync(path.join(TEMP_DIR, file)));

    console.log(`[ASSETS] Successfully compiled ${filename}`);
    res.json({ success: true, pack: manifest });
  } catch (err) {
    console.error('[ASSETS] Compilation failed:', err);
    res.status(500).json({ error: 'Compilation failed.' });
  }
});

// --- 3. LIST ALL INSTALLED PACKS (Default & Custom) ---
router.get('/packs', requireAdminToken, (req, res) => {
  try {
    const customFiles = fs.readdirSync(PACKS_DIR).filter(f => f.endsWith('.mafpack'));
    const customPacks = customFiles.map(file => {
      try {
        const zip = new AdmZip(path.join(PACKS_DIR, file));
        const manifestEntry = zip.getEntry('manifest.json');
        if (manifestEntry) {
          return { ...JSON.parse(zip.readAsText(manifestEntry)), filename: file, isDefault: false };
        }
      } catch (e) { 
        console.error(`[ASSETS] Warning: Could not parse manifest for custom pack: ${file}`); 
      }
      return { id: file, name: file, author: 'Unknown', version: '1.0.0', filename: file, isDefault: false };
    });

    let defaultPacks = [];
    if (fs.existsSync(DEFAULT_DIR)) {
      const defaultFiles = fs.readdirSync(DEFAULT_DIR).filter(f => f.endsWith('.mafpack'));
      defaultPacks = defaultFiles.map(file => {
        try {
          const zip = new AdmZip(path.join(DEFAULT_DIR, file));
          const manifestEntry = zip.getEntry('manifest.json');
          if (manifestEntry) {
            return { ...JSON.parse(zip.readAsText(manifestEntry)), filename: file, isDefault: true };
          }
        } catch (e) { 
          console.error(`[ASSETS] Warning: Could not parse manifest for default pack: ${file}`); 
        }
        return { id: file, name: file, author: 'Official', version: '1.0.0', filename: file, isDefault: true };
      });
    }
    
    res.json({ success: true, customPacks, defaultPacks });
  } catch (err) {
    console.error('[ASSETS] Fatal error reading packs:', err);
    res.status(500).json({ error: 'Failed to read installed packs.', customPacks: [], defaultPacks: [] });
  }
});

// --- 4. ACTIVATE PACK ---
router.post('/activate/:filename', requireAdminToken, (req, res) => {
  try {
    const filename = req.params.filename;
    let packPath = path.join(PACKS_DIR, filename);

    if (!fs.existsSync(packPath)) {
      packPath = path.join(DEFAULT_DIR, filename);
    }

    if (!fs.existsSync(packPath)) {
      return res.status(404).json({ error: 'Pack not found in custom or default vaults.' });
    }

    const activeFiles = fs.readdirSync(ACTIVE_DIR);
    activeFiles.forEach(file => fs.unlinkSync(path.join(ACTIVE_DIR, file)));

    const zip = new AdmZip(packPath);
    zip.extractAllTo(ACTIVE_DIR, true);

    console.log(`[ASSETS] Activated pack: ${filename}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[ASSETS] Activation failed:', err);
    res.status(500).json({ error: 'Failed to extract pack.' });
  }
});

// --- 5. IMPORT .MAFPACK ---
const packUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

router.post('/import', requireAdminToken, packUpload.single('pack'), (req, res) => {
  try {
    if (!req.file || !req.file.originalname.endsWith('.mafpack')) {
      return res.status(400).json({ error: 'Invalid file. Must be a .mafpack archive.' });
    }
    
    const outputPath = path.join(PACKS_DIR, req.file.originalname);
    fs.writeFileSync(outputPath, req.file.buffer);
    
    console.log(`[ASSETS] Successfully imported pack: ${req.file.originalname}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[ASSETS] Import failed:', err);
    res.status(500).json({ error: 'Import failed.' });
  }
});

// --- 6. EXPORT / DOWNLOAD .MAFPACK ---
router.get('/download/:filename', requireAdminToken, (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(PACKS_DIR, safeFilename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Pack not found in vault.' });
    }
    
    res.download(filePath);
  } catch (err) {
    console.error('[ASSETS] Download failed:', err);
    res.status(500).json({ error: 'Download failed.' });
  }
});

export default router;