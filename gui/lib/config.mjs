import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));

export const GUI_ROOT = path.resolve(LIB_DIR, '..');
export const REPO_ROOT = path.resolve(GUI_ROOT, '..');
export const PUBLIC_DIR = path.join(GUI_ROOT, 'public');
export const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
export const BRIDGE_SCRIPT = path.join(GUI_ROOT, 'bridge.ps1');
export const CLI_SCRIPT = path.join(REPO_ROOT, 'pc-manager.ps1');
export const START_GUI_SCRIPT = path.join(REPO_ROOT, 'scripts', 'start-gui.ps1');

export const GUI_VERSION = '0.1.0';
export const DEFAULT_PORT = 7788;
export const DEFAULT_HOST = '127.0.0.1';
