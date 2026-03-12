/**
 * @file server/core/paths.js
 * @description Path resolution for both Development and Compiled Executable environments.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const isCompiled = process.argv.includes('--prod');

export const INTERNAL_ROOT = isCompiled ? path.join(__dirname, '../../') : path.join(__dirname, '../../');

	const getAppRoot = () => {
		if (!isCompiled) return path.join(__dirname, '../../');
		
		if (process.platform === 'darwin') {
			return path.join(os.homedir(), 'Library', 'Application Support', 'ClassicMafiaDraft');
		}
		
		return 'C:/Users/' + os.userInfo().username + '/AppData/Roaming/ClassicMafiaDraft';
	};

export const APP_ROOT = getAppRoot();