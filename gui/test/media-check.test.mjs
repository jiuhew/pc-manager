import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { folderHasMedia } from '../lib/media-check.mjs';

test('folderHasMedia detects nested photo/video files and ignores non-media', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-manager-media-check-'));
  try {
    await fs.mkdir(path.join(dir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(dir, 'notes.txt'), 'x', 'utf8');
    await fs.writeFile(path.join(dir, 'nested', 'photo.JPG'), 'x', 'utf8');
    await fs.writeFile(path.join(dir, 'nested', 'clip.MP4'), 'x', 'utf8');

    assert.equal(await folderHasMedia(dir, 'photo'), true);
    assert.equal(await folderHasMedia(dir, 'video'), true);
    assert.equal(await folderHasMedia(dir, 'all'), true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('folderHasMedia returns false for non-media and empty folders', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-manager-media-check-'));
  try {
    await fs.writeFile(path.join(dir, 'notes.txt'), 'x', 'utf8');
    assert.equal(await folderHasMedia(dir, 'photo'), false);
    assert.equal(await folderHasMedia(dir, 'video'), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
