import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compactScan, getScan, isScanId, listScans, scanMeta } from '../lib/scans.mjs';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/scan-mini.json', import.meta.url));

async function loadFixture() {
  return JSON.parse(await fs.readFile(FIXTURE_PATH, 'utf8'));
}

test('compactScan drops EmptyDirs and ReparsePoints but keeps counts', async () => {
  const raw = await loadFixture();
  const scan = compactScan(raw);
  assert.equal(scan.Drives.length, 1);
  assert.equal(scan.Drives[0].EmptyDirCount, 2);
  assert.equal(scan.Drives[0].ReparsePointCount, 1);
  assert.equal(scan.Junk.length, 2);
  assert.equal(scan.Drives[0].EmptyDirs, undefined);
});

test('compactScan keeps the storage audit object', async () => {
  const raw = await loadFixture();
  raw.Audit = { HealthScore: 80, Grade: 'B', Findings: [] };
  const scan = compactScan(raw);
  assert.equal(scan.Audit.HealthScore, 80);
  assert.equal(scan.Audit.Grade, 'B');
});

test('scanMeta reports junk totals and drive ids', async () => {
  const raw = await loadFixture();
  const scan = compactScan(raw);
  const meta = scanMeta('scan-20260101-000000.json', scan, { size: 1234, mtime: new Date('2026-01-01T00:00:00Z') });
  assert.equal(meta.junkCount, 2);
  assert.equal(meta.junkGB, 0.3);
  assert.deepEqual(meta.drives.map((drive) => drive.id), ['C:']);
});

test('isScanId rejects path traversal', () => {
  assert.equal(isScanId('scan-20260101-000000.json'), true);
  assert.equal(isScanId('../scan-20260101-000000.json'), false);
  assert.equal(isScanId('scan-x/../../evil.json'), false);
});

test('getScan reads a scan file and listScans finds it', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-manager-gui-test-'));
  try {
    await fs.writeFile(path.join(dir, 'scan-20260101-000000.json'), await fs.readFile(FIXTURE_PATH, 'utf8'), 'utf8');
    const scan = await getScan(dir, 'scan-20260101-000000.json');
    assert.equal(scan.Computer, 'TEST-PC');

    const scans = await listScans(dir);
    assert.equal(scans.length, 1);
    assert.equal(scans[0].junkCount, 2);
    assert.equal(scans[0].junkGB, 0.3);

    await assert.rejects(() => getScan(dir, 'scan-missing.json'), /not found/i);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
