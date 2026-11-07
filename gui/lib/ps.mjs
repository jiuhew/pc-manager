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
export function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } catch {
      // Best effort only.
    }
    return;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Best effort only.
  }
}

export function runProcess(command, args, options = {}) {
  const { cwd, onLine, signal, env, timeoutMs } = options;

  return new Promise((resolve, reject) => {
    let child;
    let timer = null;
    let settled = false;
    let timedOut = false;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      handler(value);
    };

    const terminate = () => {
      if (!child) return;
      if (process.platform === 'win32') killProcessTree(child.pid);
      else {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }
    };

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

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        terminate();
      }, timeoutMs);
      timer.unref?.();
    }

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
      terminate();
      if (error.name === 'AbortError' || signal?.aborted) {
        finish(reject, errorWithOutput('Cancelled', stdout, stderr, null));
        return;
      }
      finish(reject, errorWithOutput(`Failed to start ${command}: ${error.message}`, stdout, stderr, null));
    });

    child.on('close', (code) => {
      if (outBuffer) emitLine(outBuffer, 'stdout');
      if (errBuffer) emitLine(errBuffer, 'stderr');

      if (timedOut) {
        finish(reject, errorWithOutput(
          `Process timed out after ${Math.round(timeoutMs / 1000)}s`,
          stdout,
          stderr,
          'timeout'
        ));
        return;
      }
      if (signal?.aborted) {
        finish(reject, errorWithOutput('Cancelled', stdout, stderr, code));
        return;
      }
      if (code === 0) {
        finish(resolve, { code, stdout, stderr });
        return;
      }
      const tail = stderr.trim().split(/\r?\n/).slice(-6).join('\n');
      finish(reject, errorWithOutput(
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
