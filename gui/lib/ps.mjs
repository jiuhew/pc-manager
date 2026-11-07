import { spawn } from 'node:child_process';

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const PWSH = process.env.PC_MANAGER_PWSH || 'pwsh';

export function stripAnsi(value) {
  return String(value).replace(ANSI_RE, '');
}

function errorWithOutput(message, stdout, stderr, exitCode) {
  const error = new Error(message);
  error.exitCode = exitCode;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
}

/**
 * Run a child process, split stdout/stderr into lines, and reject on a
 * non-zero exit code. Supports AbortSignal cancellation.
 */
export function runProcess(command, args, options = {}) {
  const { cwd, onLine, signal, env } = options;

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: '1', TERM: 'dumb', ...env },
        signal
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let outBuffer = '';
    let errBuffer = '';

    const emitLine = (line, stream) => {
      if (!onLine) return;
      try {
        onLine(stripAnsi(line), stream);
      } catch {
        // A subscriber error must never kill the child process handling.
      }
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
      outBuffer += chunk;
      let index = outBuffer.indexOf('\n');
      while (index >= 0) {
        const line = outBuffer.slice(0, index).replace(/\r$/, '');
        outBuffer = outBuffer.slice(index + 1);
        emitLine(line, 'stdout');
        index = outBuffer.indexOf('\n');
      }
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
      errBuffer += chunk;
      let index = errBuffer.indexOf('\n');
      while (index >= 0) {
        const line = errBuffer.slice(0, index).replace(/\r$/, '');
        errBuffer = errBuffer.slice(index + 1);
        emitLine(line, 'stderr');
        index = errBuffer.indexOf('\n');
      }
    });

    child.on('error', (error) => {
      if (error.name === 'AbortError') {
        reject(errorWithOutput('Cancelled', stdout, stderr, null));
        return;
      }
      reject(errorWithOutput(`Failed to start ${command}: ${error.message}`, stdout, stderr, null));
    });

    child.on('close', (code) => {
      if (outBuffer) emitLine(outBuffer, 'stdout');
      if (errBuffer) emitLine(errBuffer, 'stderr');

      if (signal?.aborted) {
        reject(errorWithOutput('Cancelled', stdout, stderr, code));
        return;
      }
      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }
      const tail = stderr.trim().split(/\r?\n/).slice(-6).join('\n');
      reject(errorWithOutput(
        tail || `Process exited with code ${code}`,
        stdout,
        stderr,
        code
      ));
    });
  });
}

export function runPowerShellFile(scriptPath, args, options = {}) {
  return runProcess(
    PWSH,
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
    options
  );
}

let adminPromise = null;

export function detectAdmin() {
  if (!adminPromise) {
    adminPromise = runProcess(
      PWSH,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
      ],
      { timeout: undefined }
    )
      .then((result) => result.stdout.trim().toLowerCase() === 'true')
      .catch(() => false);
  }
  return adminPromise;
}

export { PWSH };
