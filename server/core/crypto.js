import crypto from 'crypto';
import { state } from './state.js';
import os from 'os';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export function verifyAdmin(clientHmacResponse, nonce) {
  if (!state.adminCredentials || !nonce) return false;
  
  const expectedHmac = crypto.createHmac('sha256', nonce)
                             .update(state.adminCredentials.hash)
                             .digest('hex');
                             
  return crypto.timingSafeEqual(Buffer.from(clientHmacResponse, 'hex'), Buffer.from(expectedHmac, 'hex'));
}

export function verifyPasswordPlaintext(password) {
  if (!state.adminCredentials || !password) return false;
  
  const testHash = crypto.pbkdf2Sync(password, state.adminCredentials.salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(state.adminCredentials.hash, 'hex'));
}

export function encryptPayload(payloadArgs, aesKeyBuffer) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKeyBuffer, iv);
    let encrypted = cipher.update(JSON.stringify(payloadArgs), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const hmac = crypto.createHmac('sha256', aesKeyBuffer).update(`${iv.toString('hex')}:${encrypted}`).digest('hex');
    return `${iv.toString('hex')}:${encrypted}:${hmac}`;
  } catch (err) { return null; }
}

export function decryptPayload(encryptedString, aesKeyBuffer) {
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, ciphertext, hmacHex] = parts;

    const expectedHmac = crypto.createHmac('sha256', aesKeyBuffer).update(`${ivHex}:${ciphertext}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmacHex, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      console.warn('[SECURITY] HMAC Tampering Detected.');
      return null;
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKeyBuffer, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) { 
    console.error('[SECURITY] Backend Decryption failed:', err.message);
    return null; 
  }
}

// --- STORAGE ENCRYPTION (HARDWARE-BOUND AES-GCM) ---

/**
 * Derives a consistent, 256-bit AES key bound to the host machine's physical hardware.
 */
function getHardwareStorageKey() {
  const interfaces = os.networkInterfaces();
  let hardwareFingerprint = 'fallback_fingerprint_if_no_nic';
  
  // Extract the physical MAC address of the primary network interface
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name].find(details => !details.internal && details.mac !== '00:00:00:00:00:00');
    if (iface) {
      hardwareFingerprint = iface.mac + os.hostname() + os.arch();
      break;
    }
  }

  // Hash the fingerprint into a perfect 32-byte (256-bit) buffer
  return crypto.createHash('sha256').update(hardwareFingerprint).digest();
}

/**
 * Encrypts the entire state object using AES-256-GCM.
 */
export function encryptStorage(stateObject) {
  try {
    const key = getHardwareStorageKey();
    const iv = crypto.randomBytes(12); // GCM requires a 12-byte IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(stateObject), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex'); // 16-byte authentication tag
    
    // Package it together: IV + AuthTag + Ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[STORAGE] FATAL: Failed to encrypt state data!', err);
    return null;
  }
}

/**
 * Decrypts the state object, aborting instantly if tampering is detected.
 */
export function decryptStorage(encryptedString) {
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) throw new Error('Invalid file format');
    
    const [ivHex, authTagHex, ciphertext] = parts;
    const key = getHardwareStorageKey();
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('[STORAGE] FATAL: File decryption failed! (Tampering, Corruption, or Hardware Mismatch)');
    return null;
  }
}