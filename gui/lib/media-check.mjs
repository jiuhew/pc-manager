import fs from 'node:fs/promises';
import path from 'node:path';

const PHOTO_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.bmp', '.gif',
  '.tif', '.tiff', '.avif', '.raw', '.cr2', '.cr3', '.nef', '.arw',
  '.dng', '.orf', '.rw2', '.raf', '.srw', '.pef'
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.3gp', '.flv',
  '.ts', '.mts', '.m2ts', '.webm'
]);

function matchesKind(extension, kind) {
  if (kind === 'video') return VIDEO_EXTENSIONS.has(extension);
  if (kind === 'photo') return PHOTO_EXTENSIONS.has(extension);
  return PHOTO_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension);
}

/**
 * Bounded recursive scan used to suppress AI media plans whose source no
 * longer contains any matching media. Returns true when the scan limit is
 * reached, so an unusually large tree keeps its plan instead of being
 * silently dropped.
 */
export async function folderHasMedia(root, kind = 'all', options = {}) {
  const limit = options.limit ?? 20000;
  let seen = 0;
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      seen++;
      if (seen > limit) return true;
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (matchesKind(path.extname(entry.name).toLowerCase(), kind)) {
        return true;
      }
    }
  }

  return false;
}
