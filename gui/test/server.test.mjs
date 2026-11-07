import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../server.mjs';

const GUI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = path.join(GUI_ROOT, 'test', 'fixtures', 'scan-mini.json');
const PUBLIC_DIR = path.join(GUI_ROOT, 'public');
const SCAN_ID = 'scan-20260101-000000.json';

async function withServer(run) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-manager-gui-http-'));
  await fs.writeFile(path.join(reportsDir, SCAN_ID), await fs.readFile(FIXTURE_PATH, 'utf8'), 'utf8');

  const { server } = createApp({ repoRoot: GUI_ROOT, reportsDir, publicDir: PUBLIC_DIR });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await run(base, reportsDir);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(reportsDir, { recursive: true, force: true });
  }
}

test('health and scan endpoints respond', async () => {
  await withServer(async (base) => {
    const health = await fetch(`${base}/api/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(typeof health.admin, 'boolean');

    const list = await fetch(`${base}/api/scans`).then((response) => response.json());
    assert.equal(list.scans.length, 1);
    assert.equal(list.scans[0].id, SCAN_ID);
    assert.equal(list.scans[0].junkCount, 2);

    const detail = await fetch(`${base}/api/scans/${SCAN_ID}`).then((response) => response.json());
    assert.equal(detail.scan.Computer, 'TEST-PC');
    assert.equal(detail.scan.Drives[0].EmptyDirs, undefined);
  });
});

test('clean endpoints reject missing confirmation and unknown paths', async () => {
  await withServer(async (base) => {
    const execute = await fetch(`${base}/api/clean/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan: SCAN_ID, paths: ['C:\\Users\\tester\\AppData\\Local\\Temp'] })
    });
    assert.equal(execute.status, 400);
    const executeBody = await execute.json();
    assert.match(executeBody.error, /confirmation/i);

    const preview = await fetch(`${base}/api/clean/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan: SCAN_ID, paths: ['C:\\Windows\\System32\\cmd.exe'] })
    });
    assert.equal(preview.status, 400);
    const previewBody = await preview.json();
    assert.match(previewBody.error, /not part of this scan/i);
  });
});

test('drives and AI plan endpoints respond', async () => {
  await withServer(async (base) => {
    const drives = await fetch(`${base}/api/drives`).then((response) => response.json());
    assert.equal(Array.isArray(drives.drives), true);

    const system = await fetch(`${base}/api/system`).then((response) => response.json());
    assert.equal(typeof system.system, 'object');
    assert.equal(typeof system.system.hostname, 'string');

    const plans = await fetch(`${base}/api/ai/plans/${SCAN_ID}`).then((response) => response.json());
    assert.equal(plans.plans.length, 2);
    assert.deepEqual(plans.plans.map((plan) => plan.id), ['clean-safe', 'clean-confirm']);
  });
});

test('AI and uninstall endpoints require confirmation and guard paths', async () => {
  await withServer(async (base) => {
    const execute = await fetch(`${base}/api/ai/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scan: SCAN_ID,
        plan: { type: 'clean-junk', params: { paths: ['C:\\Users\\tester\\AppData\\Local\\Temp'] } }
      })
    });
    assert.equal(execute.status, 400);
    assert.match((await execute.json()).error, /confirmation/i);

    const uninstall = await fetch(`${base}/api/apps/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan: SCAN_ID, index: 0 })
    });
    assert.equal(uninstall.status, 400);
    assert.match((await uninstall.json()).error, /confirmation/i);

    const protectedMedia = await fetch(`${base}/api/ai/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scan: SCAN_ID,
        plan: {
          type: 'organize-media',
          params: { source: 'C:\\Windows\\System32', destination: 'D:\\Media', kind: 'video' }
        }
      })
    });
    assert.equal(protectedMedia.status, 400);
  });
});

test('static index is served with a CSP', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-security-policy')?.includes("default-src 'self'"), true);
    const html = await response.text();
    assert.match(html, /pc-manager/);
  });
});
