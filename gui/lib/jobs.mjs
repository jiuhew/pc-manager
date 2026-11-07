import { randomUUID } from 'node:crypto';

const MAX_LOGS = 4000;
const MAX_JOBS = 50;

function writeEvent(response, type, data) {
  response.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export class Job {
  constructor({ kind, title }) {
    this.id = randomUUID();
    this.kind = kind;
    this.title = title;
    this.status = 'queued';
    this.createdAt = new Date().toISOString();
    this.startedAt = null;
    this.endedAt = null;
    this.exitCode = null;
    this.error = null;
    this.logs = [];
    this.items = [];
    this.result = null;
    this.progress = { current: 0, total: 0, label: '', indeterminate: true };
    this.subscribers = new Set();
    this.controller = new AbortController();
  }

  get signal() {
    return this.controller.signal;
  }

  get terminal() {
    return this.status === 'done' || this.status === 'failed' || this.status === 'cancelled';
  }

  log(stream, line) {
    const entry = { t: Date.now(), stream, line: String(line) };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) this.logs.splice(0, this.logs.length - MAX_LOGS);
    this.publish('log', entry);
  }

  addItem(item) {
    this.items.push(item);
    this.publish('item', item);
  }

  setProgress(progress) {
    const current = progress?.current !== undefined ? Number(progress.current) || 0 : this.progress.current;
    const total = progress?.total !== undefined ? Number(progress.total) || 0 : this.progress.total;
    const label = progress?.label !== undefined ? String(progress.label) : this.progress.label;
    const indeterminate = progress?.indeterminate !== undefined ? Boolean(progress.indeterminate) : total === 0;
    this.progress = { current, total, label, indeterminate };
    this.publish('progress', this.progress);
  }

  publish(type, data) {
    for (const response of this.subscribers) {
      try {
        writeEvent(response, type, data);
      } catch {
        this.subscribers.delete(response);
      }
    }
  }

  subscribe(response) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    response.write('retry: 2000\n\n');
    writeEvent(response, 'snapshot', this.toJSON());

    if (this.terminal) {
      writeEvent(response, 'done', this.toJSON());
      response.end();
      return () => {};
    }

    this.subscribers.add(response);
    const heartbeat = setInterval(() => {
      try {
        response.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        this.subscribers.delete(response);
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.subscribers.delete(response);
    };
    response.on('close', cleanup);
    return cleanup;
  }

  finish(status, { result = null, error = null, exitCode = null } = {}) {
    if (this.terminal) return;
    this.status = status;
    this.endedAt = new Date().toISOString();
    if (result !== null) this.result = result;
    if (error !== null) this.error = error;
    if (exitCode !== null) this.exitCode = exitCode;

    const snapshot = this.toJSON();
    for (const response of this.subscribers) {
      try {
        writeEvent(response, 'done', snapshot);
        response.end();
      } catch {
        // ignore a disconnected client
      }
    }
    this.subscribers.clear();
  }

  cancel() {
    if (this.terminal) return false;
    this.controller.abort();
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      kind: this.kind,
      title: this.title,
      status: this.status,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      exitCode: this.exitCode,
      error: this.error,
      logs: this.logs,
      items: this.items,
      progress: this.progress,
      result: this.result
    };
  }
}

export class JobManager {
  constructor() {
    this.jobs = new Map();
  }

  create({ kind, title, run }) {
    const job = new Job({ kind, title });
    this.jobs.set(job.id, job);
    this.prune();

    job.status = 'running';
    job.startedAt = new Date().toISOString();

    queueMicrotask(async () => {
      try {
        const result = await run(job);
        job.finish('done', { result });
      } catch (error) {
        if (job.signal.aborted) {
          job.finish('cancelled', { error: 'Cancelled' });
        } else {
          job.finish('failed', {
            error: error?.message || String(error),
            exitCode: error?.exitCode ?? null
          });
        }
      }
    });

    return job;
  }

  get(id) {
    return this.jobs.get(id) ?? null;
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    return job.cancel();
  }

  prune() {
    const finished = [...this.jobs.values()]
      .filter((job) => job.terminal)
      .sort((a, b) => new Date(a.endedAt) - new Date(b.endedAt));
    while (this.jobs.size > MAX_JOBS && finished.length > 0) {
      const old = finished.shift();
      this.jobs.delete(old.id);
    }
  }
}
