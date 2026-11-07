import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  generatePlans,
  isMediaSourceAllowed,
  isMigrationSourceAllowed
} from '../lib/ai.mjs';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/scan-mini.json', import.meta.url));
const DRIVES = [
  { id: 'C:', freeGB: 40, totalGB: 100 },
  { id: 'D:', freeGB: 500, totalGB: 700 }
];

async function fixture() {
  return JSON.parse(await fs.readFile(FIXTURE_PATH, 'utf8'));
}

test('generatePlans creates cleanup plans from junk candidates', async () => {
  const scan = await fixture();
  const plans = generatePlans(scan, DRIVES);
  const ids = plans.map((plan) => plan.id);
  assert.deepEqual(ids, ['clean-safe', 'clean-confirm']);
  assert.equal(plans[0].params.paths.length, 1);
  assert.equal(plans[0].risk, 'low');
  assert.equal(plans[1].risk, 'high');
  assert.equal(plans[0].category, 'cache');
  assert.equal(plans[1].category, 'cache');
});

test('generatePlans picks another drive for media archives', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Migration: [],
    Media: {
      PhotoGB: 0,
      VideoGB: 12,
      MediaFolders: [{ Drive: 'E:', Folder: 'Videos', SizeGB: 12, Files: 4 }]
    }
  };
  const plans = generatePlans(scan, [
    { id: 'C:', freeGB: 10, totalGB: 100 },
    { id: 'E:', freeGB: 20, totalGB: 700 },
    { id: 'D:', freeGB: 500, totalGB: 700 }
  ]);
  const media = plans.find((plan) => plan.id === 'media-video');
  assert.ok(media);
  assert.equal(media.params.source, 'E:\\Videos');
  assert.equal(media.params.destination, 'D:\\Media\\Videos');
  assert.equal(media.risk, 'medium');
  assert.equal(media.category, 'media');
});

test('generic media roots use preview sizing instead of global totals', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Migration: [],
    Media: {
      PhotoGB: 143.8,
      VideoGB: 165,
      MediaFolders: [{ Drive: 'E:', Folder: 'Photos', SizeGB: 215.66, Files: 5428 }]
    }
  };
  const plans = generatePlans(scan, DRIVES);
  const video = plans.find((plan) => plan.id === 'media-video');
  const photo = plans.find((plan) => plan.id === 'media-photo');
  assert.ok(video);
  assert.equal(video.params.source, 'E:\\Photos');
  assert.equal(video.estimatedGB, 0);
  assert.match(video.summary, /待预览/);
  assert.ok(photo);
  assert.equal(photo.estimatedGB, 215.66);
});

test('archive-like roots are not treated as media folders', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Migration: [],
    Media: {
      PhotoGB: 143.8,
      VideoGB: 165,
      MediaFolders: [{ Drive: 'E:', Folder: 'Photos', SizeGB: 90.87, Files: 8 }]
    }
  };
  const plans = generatePlans(scan, DRIVES);
  assert.equal(plans.some((plan) => plan.category === 'media'), false);
});

test('generatePlans creates migrate plans from scan migration candidates', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Media: { PhotoGB: 0, VideoGB: 0, MediaFolders: [] },
    Migration: [{
      Name: 'CUDA',
      Path: 'C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA',
      SizeGB: 8,
      SuggestedTarget: 'D:\\CUDA',
      Reason: 'Move it'
    }]
  };
  const plans = generatePlans(scan, DRIVES);
  const migrate = plans.find((plan) => plan.type === 'migrate');
  assert.ok(migrate);
  assert.equal(migrate.params.destination, 'D:\\CUDA');
  assert.equal(migrate.category, 'engineering');
});

test('generatePlans turns audit findings into advisory plans', async () => {
  const scan = await fixture();
  scan.Audit = {
    HealthScore: 66,
    Findings: [
      {
        Id: 'large-archives',
        Severity: 'P1',
        Category: 'review',
        Title: 'Large compressed archives need verification',
        Detail: 'Two archives total 100 GB.',
        Evidence: 'E:\\Photos\\归档\\新疆.zip (90.5 GB)',
        Action: 'Verify contents and keep one copy.'
      }
    ]
  };
  const plans = generatePlans(scan, DRIVES);
  const advisory = plans.find((plan) => plan.type === 'advisory');
  assert.ok(advisory);
  assert.equal(advisory.category, 'media');
  assert.equal(advisory.risk, 'medium');
  assert.match(advisory.summary, /P1/);
  assert.match(advisory.evidence, /新疆\.zip/);
});

test('audit findings are grouped into media, engineering, and cache', async () => {
  const scan = await fixture();
  scan.Audit = {
    HealthScore: 50,
    Findings: [
      { Id: 'media-system', Severity: 'P1', Category: 'media', Title: 'Media on system drive' },
      { Id: 'workspace-scattered', Severity: 'P1', Category: 'path', Title: 'Workspaces scattered' },
      { Id: 'junk-high', Severity: 'P1', Category: 'cleanup', Title: 'Junk above budget' }
    ]
  };
  const plans = generatePlans(scan, DRIVES);
  const groups = plans.filter((plan) => plan.type === 'advisory').map((plan) => plan.category);
  assert.deepEqual(groups, ['media', 'engineering', 'cache']);
});

const SINGLE_DRIVE = [{ id: 'C:', freeGB: 400, totalGB: 950 }];

test('single-drive media plans organize on C: and explain no space is freed', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Migration: [],
    Media: {
      PhotoGB: 0,
      VideoGB: 12,
      MediaFolders: [{ Drive: 'C:', Folder: 'Videos', SizeGB: 12, Files: 4 }]
    }
  };
  const plans = generatePlans(scan, SINGLE_DRIVE);
  const media = plans.find((plan) => plan.id === 'media-video');
  assert.ok(media);
  assert.equal(media.params.destination, 'C:\\Users\\tester\\Videos');
  assert.match(media.description, /同盘整理/);
  assert.match(media.description, /不新建 Media/);
  assert.equal(media.params.destination.startsWith('D:'), false);
});

test('single-drive migration candidates become advisories instead of D: moves', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Media: { PhotoGB: 0, VideoGB: 0, MediaFolders: [] },
    Migration: [{
      Name: 'wsl',
      Path: 'C:\\Users\\tester\\AppData\\Local\\Docker\\wsl',
      SizeGB: 18,
      SuggestedTarget: 'D:\\Docker\\wsl',
      Reason: 'Docker WSL disk image'
    }],
    Audit: { HealthScore: 85, Findings: [] }
  };
  const plans = generatePlans(scan, SINGLE_DRIVE);
  const migration = plans.find((plan) => plan.id === 'migrate-0');
  assert.ok(migration);
  assert.equal(migration.type, 'advisory');
  assert.equal(migration.params.destination, undefined);
  assert.match(migration.summary, /单盘/);
  assert.match(migration.description, /没有第二块内置盘/);
  assert.ok(plans.some((plan) => plan.id === 'single-drive-strategy'));
});

test('desktop media roots are derived from scanned large files and allowed', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Migration: [],
    Media: { PhotoGB: 0, VideoGB: 0, MediaFolders: [] },
    Drives: [{
      Id: 'C:',
      LargeFiles: [{ Path: 'C:\\Users\\tester\\Desktop\\Wedding\\clip.mp4', SizeMB: 2048 }]
    }]
  };
  const plans = generatePlans(scan, SINGLE_DRIVE);
  const media = plans.find((plan) => plan.id === 'media-video');
  assert.ok(media);
  assert.equal(media.params.source, 'C:\\Users\\tester\\Desktop\\Wedding');
  assert.equal(isMediaSourceAllowed(scan, media.params.source), true);
  assert.equal(isMediaSourceAllowed(scan, 'C:\\Users\\tester\\AppData\\Local'), false);
});

test('desktop media roots are not derived from cloud placeholders', () => {
  const scan = {
    User: 'tester',
    Junk: [],
    Migration: [],
    Media: { PhotoGB: 0, VideoGB: 0, MediaFolders: [] },
    Drives: [{
      Id: 'C:',
      Cloud: [{ Path: 'C:\\Users\\tester\\OneDrive' }],
      LargeFiles: [{ Path: 'C:\\Users\\tester\\OneDrive\\Camera Roll\\clip.mp4', SizeMB: 2048 }]
    }]
  };
  const plans = generatePlans(scan, SINGLE_DRIVE);
  assert.equal(plans.some((plan) => plan.id === 'media-video'), false);
  assert.equal(isMediaSourceAllowed(scan, 'C:\\Users\\tester\\OneDrive\\Camera Roll'), false);
});

test('media and migration source allowlists match the scan', () => {
  const scan = {
    User: 'tester',
    Media: { MediaFolders: [{ Drive: 'E:', Folder: 'Videos', SizeGB: 1 }] },
    Migration: [{ Path: 'C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA' }]
  };
  assert.equal(isMediaSourceAllowed(scan, 'E:\\Videos'), true);
  assert.equal(isMediaSourceAllowed(scan, 'E:\\Videos\\2024'), true);
  assert.equal(isMediaSourceAllowed(scan, 'C:\\Windows\\System32'), false);
  assert.equal(isMigrationSourceAllowed(scan, 'C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA'), true);
  assert.equal(isMigrationSourceAllowed(scan, 'C:\\Windows'), false);
});
