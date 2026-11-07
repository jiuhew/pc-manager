import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasRiskyItems,
  isProtectedPath,
  normalizePath,
  resolveCandidates
} from '../lib/safety.mjs';

const ENV = {
  SystemRoot: 'C:\\Windows',
  ProgramData: 'C:\\ProgramData',
  SystemDrive: 'C:',
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  USERPROFILE: 'C:\\Users\\tester',
  LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local',
  APPDATA: 'C:\\Users\\tester\\AppData\\Roaming'
};

const SCAN = {
  Junk: [
    { Name: 'Cache', Path: 'C:\\Users\\tester\\AppData\\Local\\Temp\\', SizeMB: 10, Safety: 'safe' },
    { Name: 'Confirm', Path: 'C:\\Users\\tester\\Downloads\\old.exe', SizeMB: 20, Safety: 'confirm' },
    { Name: 'Review', Path: 'C:\\Users\\tester\\unknown', SizeMB: 30, Safety: 'review' }
  ]
};

test('normalizePath normalizes separators, case and trailing slashes', () => {
  assert.equal(normalizePath('C:/Users/Tester/AppData/Local/Temp/'), 'c:\\users\\tester\\appdata\\local\\temp');
  assert.equal(normalizePath('C:\\'), 'c:\\');
  assert.equal(normalizePath('relative\\path'), '');
  assert.equal(normalizePath(''), '');
});

test('isProtectedPath blocks system-critical paths and dangerous roots', () => {
  assert.equal(isProtectedPath('C:\\Windows\\WinSxS\\Temp', ENV), true);
  assert.equal(isProtectedPath('C:\\Windows\\Installer\\foo.msi', ENV), true);
  assert.equal(isProtectedPath('C:\\ProgramData\\Package Cache\\setup.exe', ENV), true);
  assert.equal(isProtectedPath('C:\\pagefile.sys', ENV), true);
  assert.equal(isProtectedPath('C:\\', ENV), true);
  assert.equal(isProtectedPath('C:\\Windows', ENV), true);
  assert.equal(isProtectedPath('C:\\Users', ENV), true);
  assert.equal(isProtectedPath('C:\\Users\\tester', ENV), true);
  assert.equal(isProtectedPath('C:\\Users\\tester\\AppData\\Local', ENV), true);
  assert.equal(isProtectedPath('C:\\Recovery\\file', ENV), true);
});

test('isProtectedPath allows normal cache folders', () => {
  assert.equal(isProtectedPath('C:\\Users\\tester\\AppData\\Local\\Temp', ENV), false);
  assert.equal(isProtectedPath('C:\\Users\\tester\\Downloads\\old.exe', ENV), false);
});

test('resolveCandidates only accepts paths that exist in the scan junk list', () => {
  const selected = resolveCandidates(SCAN, ['C:\\Users\\tester\\AppData\\Local\\Temp'], ENV);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].Name, 'Cache');
  assert.equal(hasRiskyItems(selected), false);

  const risky = resolveCandidates(SCAN, ['C:\\Users\\tester\\Downloads\\old.exe'], ENV);
  assert.equal(hasRiskyItems(risky), true);

  assert.throws(
    () => resolveCandidates(SCAN, ['C:\\Windows\\System32\\cmd.exe'], ENV),
    /not part of this scan/i
  );
  assert.throws(
    () => resolveCandidates(SCAN, ['C:\\Users\\tester\\unknown'], ENV),
    /manual review/i
  );
  assert.throws(() => resolveCandidates(SCAN, [], ENV), /No cleanup items/i);
});
