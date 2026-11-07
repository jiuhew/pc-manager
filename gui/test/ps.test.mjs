import test from 'node:test';
import assert from 'node:assert/strict';

import { runProcess, stripAnsi } from '../lib/ps.mjs';

test('runProcess returns stdout and exit code', async () => {
  const result = await runProcess(process.execPath, ['-e', 'process.stdout.write("ok")'], { timeoutMs: 10000 });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'ok');
});

test('runProcess rejects with timeout and terminates the child', async () => {
  const started = Date.now();
  await assert.rejects(
    runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { timeoutMs: 400 }),
    (error) => {
      assert.equal(error.exitCode, 'timeout');
      assert.match(error.message, /timed out/i);
      return true;
    }
  );
  assert.ok(Date.now() - started < 15000, 'timeout should not wait for the child process');
});

test('stripAnsi removes color escapes', () => {
  assert.equal(stripAnsi('\u001b[32mOK\u001b[0m'), 'OK');
});
