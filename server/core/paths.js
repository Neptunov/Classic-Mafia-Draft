/**
 * @file server/core/paths.js
 * @description Path resolution for both Development and Compiled Executable environments.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const isCompiled = process.argv.includes('--caxa');

export const APP_ROOT = isCompiled ? process.cwd() : path.join(__dirname, '../../');
export const INTERNAL_ROOT = isCompiled ? path.join(__dirname, '../../') : path.join(__dirname, '../../');