const $ = (id) => document.getElementById(id);

const state = {
  health: null,
  drives: [],
  scans: [],
  scanId: null,
  scan: null,
  activeTab: 'overview',
  system: null,
  selection: new Set(),
  filters: { safety: 'all', category: 'all', query: '', sort: 'size' },
  appQuery: '',
  appLimit: 60,
  appFilter: 'all',
  appSelection: new Set(),
  appInsights: null,
  appInsightsScanId: null,
  appInsightsLoading: false,
  appInsightsRequest: 0,
  aiPlans: null,
  aiPlansScanId: null,
  aiLoading: false,
  aiRequest: 0,
  aiPrompts: {},
  ignoredAi: new Set(),
  currentJob: null,
  jobSnapshotApplied: false,
  job: null,
  jobModal: null,
  jobBarHidden: false
};

const SAFETY_LABELS = {
  safe: '安全',
  elevated: '需管理员',
  confirm: '需确认',
  review: '仅查看'
};

const CATEGORY_LABELS = {
  cache: '缓存',
  updater: '更新缓存',
  system: '系统',
  recycle: '回收站',
  installer: '安装包',
  orphan: '孤立残留'
};

const KIND_LABELS = {
  photo: '图片',
  video: '视频',
  audio: '音频',
  document: '文档',
  archive: '压缩包',
  installer: '安装包',
  dev: '代码',
  other: '其他'
};

const STATUS_LABELS = {
  'would-clean': '可清理',
  cleaned: '已清理',
  skipped: '已跳过',
  failed: '失败',
  'would-move': '待移动',
  moved: '已移动',
  planned: '待移动',
  updated: '已更新',
  'up-to-date': '已是最新',
  started: '已启动',
  completed: '已完成'
};

const AI_CATEGORY_ORDER = ['media', 'engineering', 'cache'];

const AI_CATEGORY_LABELS = {
  media: '媒体文件建议',
  engineering: '工程文件建议',
  cache: '缓存管理文件建议'
};

const AI_CATEGORY_HINTS = {
  media: '照片、视频、素材与媒体压缩包归档',
  engineering: '项目工作区、代码仓库、开发工具与目录迁移',
  cache: '缓存、临时文件、日志、安装包与回收站'
};

const AI_RISK_LABELS = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
};

const DETAIL_TEXT = {
  'Path not found': '路径不存在',
  'Protected system path': '受保护的系统路径，已拒绝',
  'Needs manual review': '需要人工复核',
  'Needs elevation': '需要管理员权限',
  'Path is not readable': '无法读取路径',
  Cleaned: '已清理'
};

function detailText(detail) {
  if (!detail) return '';
  if (DETAIL_TEXT[detail]) return DETAIL_TEXT[detail];
  if (detail.startsWith('Would clean with mode')) {
    const mode = detail.includes("'contents'") ? '仅清空内容' : detail.includes("'recycle'") ? '清空回收站' : '删除整个目录';
    return `可清理（${mode}）`;
  }
  if (detail.startsWith('Unknown mode')) return '未知的清理模式';
  return detail;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const ICONS = {
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  refresh: 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  shield: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
  storage: 'M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  apps: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
  ai: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
  analytics: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  folder: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  memory: 'M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2z',
  board: 'M22 9V7h-2V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2v-2h-2V9h2zm-4 10H4V5h14v14zM6 7h5v5H6V7zm6 0h4v2h-4V7zm0 4h4v2h-4v-2z',
  videocam: 'M17 10.5V7c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z',
  computer: 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
  speed: 'M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z',
  calendar: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10z'
};

function icon(name, size = 18) {
  const path = ICONS[name] || ICONS.analytics;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtGB(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  if (parsed >= 100) return parsed.toFixed(0);
  if (parsed >= 10) return parsed.toFixed(1);
  return parsed.toFixed(2);
}

function fmtMB(value) {
  const mb = Number(value);
  if (!Number.isFinite(mb) || mb < 0) return '—';
  if (mb >= 1024) return `${fmtGB(mb / 1024)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  if (mb > 0) return `${mb.toFixed(2)} MB`;
  return '0 MB';
}

function fmtCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return parsed.toLocaleString('zh-CN');
}

function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function sumBy(list, selector) {
  return list.reduce((total, entry) => total + num(selector(entry)), 0);
}

function junkGB(item) {
  const gb = Number(item?.SizeGB);
  if (Number.isFinite(gb) && gb > 0) return gb;
  return num(item?.SizeMB) / 1024;
}

function selectedItems() {
  if (!state.scan) return [];
  return [...state.selection]
    .map((index) => state.scan.Junk[index])
    .filter(Boolean);
}

async function api(path, options = {}) {
  const { method = 'GET', body } = options;
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new Error(data?.error || `请求失败 (HTTP ${response.status})`);
  }
  return data;
}

function toast(message, kind = 'info', timeout = 4200) {
  const host = $('toasts');
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => node.remove(), timeout);
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  wireEvents();
  renderEmptyState('正在加载…');

  const [healthResult, drivesResult, systemResult] = await Promise.allSettled([
    api('/api/health'),
    api('/api/drives'),
    api('/api/system')
  ]);

  if (healthResult.status === 'fulfilled') {
    state.health = healthResult.value;
    renderAdminBadge();
  } else {
    toast(`无法连接后端：${healthResult.reason?.message || '未知错误'}`, 'error', 8000);
  }

  if (drivesResult.status === 'fulfilled') {
    state.drives = Array.isArray(drivesResult.value.drives) ? drivesResult.value.drives : [];
  }
  if (systemResult.status === 'fulfilled') {
    state.system = systemResult.value.system || null;
  }

  await loadScans();
}

async function loadDrives() {
  try {
    const data = await api('/api/drives');
    state.drives = Array.isArray(data.drives) ? data.drives : [];
  } catch {
    // keep the last known list
  }
}

async function loadSystem(force = false) {
  try {
    const data = await api(`/api/system${force ? '?refresh=1' : ''}`);
    state.system = data.system || null;
  } catch {
    // keep the last known system info
  }
  if (state.activeTab === 'overview') renderView();
}

function ignoredAiKey(scanId) {
  return `pc-manager:ignored-ai:${scanId || 'none'}`;
}

function loadIgnoredAi(scanId) {
  try {
    const raw = localStorage.getItem(ignoredAiKey(scanId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set();
  }
}

function saveIgnoredAi() {
  try {
    localStorage.setItem(ignoredAiKey(state.scanId), JSON.stringify([...state.ignoredAi]));
  } catch {
    // ignore storage failures
  }
}

function visibleAiPlans() {
  return (state.aiPlans || []).filter((plan) => !state.ignoredAi.has(plan.id));
}

async function loadScans(selectId = null) {
  try {
    const data = await api('/api/scans');
    state.scans = Array.isArray(data.scans) ? data.scans : [];
    renderScanPicker();
    const preferred = selectId
      || (state.scanId && state.scans.some((scan) => scan.id === state.scanId) ? state.scanId : null)
      || state.scans[0]?.id;
    if (preferred) {
      await loadScan(preferred);
    } else {
      renderEmptyState('还没有扫描结果');
    }
  } catch (error) {
    toast(error.message, 'error');
    renderEmptyState('读取扫描结果失败');
  }
}

async function loadScan(id) {
  if (!id) return;
  try {
    const data = await api(`/api/scans/${encodeURIComponent(id)}`);
    state.scanId = data.id;
    state.scan = data.scan;
    state.selection.clear();
    state.appLimit = 60;
    state.filters = { safety: 'all', category: 'all', query: '', sort: 'size' };
    state.aiPlans = null;
    state.aiPlansScanId = null;
    state.aiPrompts = {};
    state.ignoredAi = loadIgnoredAi(id);
    state.appInsights = null;
    state.appInsightsScanId = null;
    state.appFilter = 'all';
    state.appSelection.clear();
    state.activeTab = 'overview';
    renderScanPicker();
    $('emptyState').classList.add('hidden');
    renderAll();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderAll() {
  renderTabs();
  renderView();
  updateActionBar();
  scrollContentTop();
}

function scrollContentTop() {
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/* header / overview                                                   */
/* ------------------------------------------------------------------ */

function renderAdminBadge() {
  const badge = $('adminBadge');
  if (!state.health) {
    badge.className = 'admin-chip';
    badge.innerHTML = `${icon('shield', 13)}<span>权限未知</span>`;
    badge.title = '正在检测权限';
  } else if (state.health.admin) {
    badge.className = 'admin-chip ok';
    badge.innerHTML = `${icon('shield', 13)}<span>管理员</span>`;
    badge.title = '管理员权限：可以清理系统缓存。点击切换权限模式。';
  } else {
    badge.className = 'admin-chip warn';
    badge.innerHTML = `${icon('shield', 13)}<span>普通</span>`;
    badge.title = '普通权限：系统缓存项会被跳过。点击切换权限模式。';
  }
  renderAdminMenu();
}

function renderAdminMenu() {
  const menu = $('adminMenu');
  if (!menu) return;
  if (!state.health) {
    menu.innerHTML = '<div class="popover-title">权限模式</div><p>正在检测…</p>';
    return;
  }
  const admin = Boolean(state.health.admin);
  menu.innerHTML = `
    <div class="popover-title">权限模式</div>
    <button class="mode-row ${admin ? 'active' : ''}" data-action="admin-relaunch" data-admin="true">
      <span class="mode-dot"></span><span>管理员权限</span>
    </button>
    <button class="mode-row ${admin ? '' : 'active'}" data-action="admin-relaunch" data-admin="false">
      <span class="mode-dot"></span><span>普通权限</span>
    </button>
    <p>${admin ? '当前可清理系统缓存（elevated）。' : '当前会跳过需要管理员权限的项目。'}</p>
    <button class="btn ${admin ? 'ghost' : 'primary'} small" style="width:100%;margin-top:10px" data-action="admin-relaunch" data-admin="${admin ? 'false' : 'true'}">
      ${admin ? '切换到普通权限' : '切换到管理员权限'}
    </button>
    <p>切换会重启本地 GUI 服务，可能需要确认 UAC。</p>
  `;
}

async function relaunchAdmin(admin) {
  try {
    const result = await api('/api/relaunch', {
      method: 'POST',
      body: { admin, confirm: true }
    });
    if (result.manual) {
      toast(result.message, 'info', 9000);
    } else {
      toast(result.message || '正在重启 GUI…', 'ok', 7000);
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

function scanTimeLabel(scan) {
  const raw = String(scan?.id || '').replace(/^scan-/, '').replace(/\.json$/, '');
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  return match ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}` : raw;
}

function renderScanPicker() {
  const button = $('scanPicker');
  const text = $('scanPickerText');
  const menu = $('scanMenu');

  if (state.scans.length === 0) {
    button.disabled = true;
    text.innerHTML = '<b>暂无扫描</b><small>点击右上角 + 新建扫描</small>';
    menu.innerHTML = '';
    return;
  }

  button.disabled = false;
  const current = state.scans.find((scan) => scan.id === state.scanId) || state.scans[0];
  const drives = current.drives.map((drive) => drive.id).join(' ') || '—';
  text.innerHTML = `
    <b>${esc(scanTimeLabel(current))} · ${fmtGB(current.junkGB)} GB 可清理</b>
    <small>${esc(drives)} · 扫描 ${fmtCount(current.scanSeconds)} 秒</small>
  `;

  menu.innerHTML = state.scans.map((scan) => {
    const active = scan.id === state.scanId;
    return `
      <button class="scan-menu-item ${active ? 'active' : ''}" data-scan-id="${esc(scan.id)}" role="option" aria-selected="${active}">
        <span class="scan-menu-main">
          <b>${esc(scanTimeLabel(scan))} · ${fmtGB(scan.junkGB)} GB 可清理</b>
          <small>${esc(scan.id)} · ${esc(scan.drives.map((drive) => drive.id).join(' ') || '—')} · ${fmtCount(scan.scanSeconds)}s</small>
        </span>
        ${active ? `<span class="scan-menu-check">${icon('check', 15)}</span>` : ''}
      </button>
    `;
  }).join('');
}

function toggleScanMenu(force) {
  const menu = $('scanMenu');
  const button = $('scanPicker');
  const show = force === undefined ? menu.classList.contains('hidden') : force;
  menu.classList.toggle('hidden', !show);
  button.setAttribute('aria-expanded', String(show));
}

function fmtUptime(hours) {
  const total = Number(hours) || 0;
  const days = Math.floor(total / 24);
  const rest = Math.round(total % 24);
  return days > 0 ? `${days} 天 ${rest} 小时` : `${rest} 小时`;
}

function renderOverviewPage() {
  const system = state.system;
  const scan = state.scan;
  const audit = scan?.Audit || null;
  const health = Number(audit?.HealthScore);
  const hasHealth = Number.isFinite(health);
  const healthColor = !hasHealth ? 'var(--dim)' : health >= 85 ? 'var(--green)' : health >= 70 ? 'var(--amber)' : 'var(--red)';

  const totalGB = scan ? sumBy(scan.Drives, (drive) => drive.TotalGB) : 0;
  const usedGB = scan ? sumBy(scan.Drives, (drive) => drive.UsedGB) : 0;
  const freeGB = scan ? sumBy(scan.Drives, (drive) => drive.FreeGB) : 0;
  const totalJunk = scan ? sumBy(scan.Junk, junkGB) : 0;
  const mediaGB = scan ? num(scan.Media?.PhotoGB) + num(scan.Media?.VideoGB) : 0;
  const appsGB = scan ? sumBy(scan.InstalledApps, (app) => num(app.EstimatedMB) / 1024) : 0;
  const findings = Array.isArray(audit?.Findings) ? audit.Findings : [];
  const urgent = findings.filter((finding) => finding.Severity === 'P0' || finding.Severity === 'P1').length;

  const cpu = system?.cpu;
  const memory = system?.memory;
  const gpu = system?.gpus?.[0];
  const memoryPct = memory?.totalGB > 0 ? Math.min(100, (memory.usedGB / memory.totalGB) * 100) : 0;
  const moduleSpeeds = [...new Set((memory?.modules || []).map((module) => module.speedMHz).filter(Boolean))];
  const moduleCount = memory?.modules?.length || 0;

  const tierByDrive = new Map((audit?.TierPlan || []).map((tier) => [tier.Drive, tier]));
  const topConsumers = Array.isArray(audit?.TopConsumers) && audit.TopConsumers.length > 0
    ? audit.TopConsumers.slice(0, 10)
    : (scan?.Drives || []).flatMap((drive) => (drive.TopFolders || []).slice(0, 3).map((folder) => ({
        Drive: drive.Id,
        Path: `${drive.Id}\\${folder.Name}`,
        SizeGB: folder.SizeGB,
        Files: folder.Files
      }))).sort((a, b) => num(b.SizeGB) - num(a.SizeGB)).slice(0, 10);

  const heroes = system
    ? `
      <section class="ov-hero">
        <div class="ov-hero-main">
          <div class="ov-kicker">SYSTEM OVERVIEW</div>
          <h1 class="ov-title">${esc(system.hostname)}</h1>
          <div class="ov-sub">
            ${esc(system.os.caption || 'Windows')} ${esc(system.os.build || '')}
            ${cpu ? ` · ${esc(cpu.name)}` : ''}
            ${memory ? ` · ${fmtGB(memory.totalGB)} GB RAM` : ''}
            ${gpu ? ` · ${esc(gpu.name)}` : ''}
          </div>
          <div class="ov-tags">
            ${hasHealth ? `<span class="pill ${health >= 70 ? 'ok' : 'warn'}">健康 ${health}/100 · ${esc(audit.Grade || '')}</span>` : '<span class="pill muted">暂无健康分</span>'}
            <span class="pill muted">${scan ? `${scan.Drives.length} 个磁盘 · ${fmtGB(usedGB)} / ${fmtGB(totalGB)} GB` : '尚未扫描'}</span>
            <span class="pill muted">${system.uptimeHours ? `已运行 ${fmtUptime(system.uptimeHours)}` : '运行时间未知'}</span>
            <button class="btn ghost small" data-action="refresh-system">${icon('refresh', 13)} 刷新硬件</button>
          </div>
        </div>
        <div class="health-ring" style="--score:${hasHealth ? health : 0};--ring:${healthColor}">
          <div class="health-ring-inner">
            <b>${hasHealth ? health : '—'}</b>
            <span>${hasHealth ? `/100 · ${esc(audit.Grade || '')}` : '/100'}</span>
          </div>
        </div>
      </section>
    `
    : '<section class="ov-hero"><div class="ov-hero-main"><div class="ov-kicker">SYSTEM OVERVIEW</div><h1 class="ov-title">正在读取硬件信息…</h1></div></section>';

  const quickStats = scan
    ? `
      <div class="stat-grid ov-quick-stats">
        <div class="stat-card"><div class="stat-label">可清理空间</div><div class="stat-value">${fmtGB(totalJunk)}<span class="unit">GB</span></div><div class="stat-sub">Junk ${fmtCount(scan.Junk.length)} 项</div></div>
        <div class="stat-card"><div class="stat-label">媒体库</div><div class="stat-value">${fmtGB(mediaGB)}<span class="unit">GB</span></div><div class="stat-sub">照片 ${fmtGB(scan.Media?.PhotoGB)} GB · 视频 ${fmtGB(scan.Media?.VideoGB)} GB</div></div>
        <div class="stat-card"><div class="stat-label">应用估算</div><div class="stat-value">${fmtGB(appsGB)}<span class="unit">GB</span></div><div class="stat-sub">${fmtCount(scan.InstalledApps.length)} 个应用</div></div>
        <div class="stat-card"><div class="stat-label">需要关注</div><div class="stat-value">${fmtCount(urgent)}<span class="unit">P0/P1</span></div><div class="stat-sub">${fmtCount(findings.length)} 条审计发现</div></div>
      </div>
    `
    : '';

  const systemCards = system
    ? `
      <div class="system-grid">
        <article class="system-card">
          <div class="system-card-head">${icon('memory', 17)}<span>处理器</span></div>
          <div class="system-card-body">
            <div class="ov-primary">${esc(cpu?.name || '未知')}</div>
            <div class="spec-list">
              <div class="spec-row"><span>核心 / 线程</span><b>${fmtCount(cpu?.cores)} / ${fmtCount(cpu?.logical)}</b></div>
              <div class="spec-row"><span>最高频率</span><b>${cpu?.maxClockGHz ? `${cpu.maxClockGHz} GHz` : '—'}</b></div>
              <div class="spec-row"><span>架构</span><b>${esc(system.os.arch || '—')}</b></div>
            </div>
          </div>
        </article>

        <article class="system-card">
          <div class="system-card-head">${icon('memory', 17)}<span>内存</span></div>
          <div class="system-card-body">
            <div class="ov-primary">${fmtGB(memory?.usedGB)} / ${fmtGB(memory?.totalGB)} GB</div>
            <div class="bar ov-memory-bar"><span style="width:${memoryPct.toFixed(1)}%"></span></div>
            <div class="spec-list">
              <div class="spec-row"><span>空闲</span><b>${fmtGB(memory?.freeGB)} GB</b></div>
              <div class="spec-row"><span>插槽</span><b>${fmtCount(moduleCount)} 条${moduleSpeeds.length ? ` · ${moduleSpeeds.join(' / ')} MHz` : ''}</b></div>
            </div>
          </div>
        </article>

        <article class="system-card">
          <div class="system-card-head">${icon('videocam', 17)}<span>显卡</span></div>
          <div class="system-card-body">
            <div class="ov-primary">${esc(gpu?.name || '未检测到独立显卡')}</div>
            <div class="spec-list">
              ${(system.gpus || []).slice(0, 3).map((item) => `
                <div class="spec-row"><span>${esc(item.name)}</span><b>${item.vramGB > 0 ? `${fmtGB(item.vramGB)} GB` : '—'}</b></div>
              `).join('') || '<div class="spec-row"><span>显卡</span><b>—</b></div>'}
              <div class="spec-row"><span>驱动</span><b>${esc(gpu?.driver || '—')}</b></div>
            </div>
          </div>
        </article>

        <article class="system-card">
          <div class="system-card-head">${icon('board', 17)}<span>主板 / 系统</span></div>
          <div class="system-card-body">
            <div class="ov-primary">${esc(system.board.manufacturer || '')} ${esc(system.board.product || '')}</div>
            <div class="spec-list">
              <div class="spec-row"><span>BIOS</span><b>${esc(system.bios.version || '—')}${system.bios.date ? ` · ${esc(system.bios.date)}` : ''}</b></div>
              <div class="spec-row"><span>系统</span><b>${esc(system.os.caption || '—')}</b></div>
              <div class="spec-row"><span>安装 / 运行</span><b>${esc(system.os.installDate || '—')} · ${fmtUptime(system.uptimeHours)}</b></div>
            </div>
          </div>
        </article>

        ${(system.disks || []).length > 0 ? `
          <article class="system-card">
            <div class="system-card-head">${icon('storage', 17)}<span>物理磁盘</span></div>
            <div class="system-card-body">
              <div class="ov-primary">${esc(system.disks[0].model || '—')}</div>
              <div class="spec-list">
                ${system.disks.slice(0, 4).map((disk) => `
                  <div class="spec-row"><span>${esc(disk.model || '磁盘')}</span><b>${fmtGB(disk.sizeGB)} GB${disk.interface ? ` · ${esc(disk.interface)}` : ''}</b></div>
                `).join('')}
              </div>
            </div>
          </article>
        ` : ''}
      </div>
    `
    : '';

  const storage = scan
    ? `
      <section class="ov-section">
        <div class="ov-section-head">
          <div>
            <div class="ov-section-title">存储分配</div>
            <div class="ov-section-sub">${fmtGB(usedGB)} GB 已用 · ${fmtGB(freeGB)} GB 空闲 · ${scan.Drives.length} 个磁盘</div>
          </div>
          <span class="pill muted">${scan.FastMode ? '快速扫描' : '完整扫描'} · ${fmtCount(scan.ScanSeconds)} 秒</span>
        </div>
        <div class="ov-drive-list">
          ${scan.Drives.map((drive) => {
            const total = num(drive.TotalGB);
            const used = num(drive.UsedGB);
            const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
            const freePercent = total > 0 ? (num(drive.FreeGB) / total) * 100 : 100;
            const barClass = freePercent < 5 ? 'bar danger' : freePercent < 12 ? 'bar warn' : 'bar';
            const tier = tierByDrive.get(drive.Id);
            return `
              <div class="ov-drive-row">
                <div class="ov-drive-badge">${esc(drive.Id)}</div>
                <div class="ov-drive-main">
                  <div class="ov-drive-top">
                    <span class="ov-drive-role">${esc(tier?.Role || '存储')}</span>
                    <span class="ov-drive-meta">已用 ${fmtGB(used)} / ${fmtGB(total)} GB · 空闲 ${fmtGB(drive.FreeGB)} GB</span>
                  </div>
                  <div class="${barClass}"><span style="width:${percent.toFixed(1)}%"></span></div>
                  <div class="ov-drive-foot">${fmtCount(drive.TotalFiles)} 个文件${tier?.Budget ? ` · 预算：${esc(tier.Budget)}` : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `
    : `<section class="ov-section"><div class="ov-empty">运行一次扫描后，这里会显示磁盘分配、Top 目录和空间策略。</div></section>`;

  const bottom = `
    <div class="ov-columns">
      <section class="ov-panel">
        <div class="ov-section-head"><div class="ov-section-title">Top 占用</div><span class="pill muted">按大小</span></div>
        <div class="ov-list">
          ${topConsumers.length === 0 ? '<div class="ov-empty">暂无数据</div>' : topConsumers.map((entry) => `
            <div class="ov-list-row">
              <span class="ov-list-path" title="${esc(entry.Path)}">${esc(entry.Path)}</span>
              <span class="ov-list-value">${fmtGB(entry.SizeGB)} GB</span>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="ov-panel">
        <div class="ov-section-head"><div class="ov-section-title">审计发现</div><span class="pill muted">${fmtCount(findings.length)} 条</span></div>
        <div class="ov-list">
          ${findings.length === 0 ? '<div class="ov-empty">没有发现</div>' : findings.slice(0, 8).map((finding) => `
            <div class="ov-list-row ov-finding-row">
              <span class="badge ${finding.Severity === 'P0' ? 'high' : finding.Severity === 'P1' ? 'medium' : 'low'}">${esc(finding.Severity)}</span>
              <span class="ov-finding-text" title="${esc(finding.Detail || finding.Action || '')}">${esc(finding.Title)}</span>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;

  return `${heroes}${quickStats}${systemCards}${storage}${bottom}`;
}

/* ------------------------------------------------------------------ */
/* tabs                                                                */
/* ------------------------------------------------------------------ */

function renderTabs() {
  const scan = state.scan;
  const tabs = [
    { id: 'overview', label: '概览', icon: 'dashboard', count: 0 },
    { id: 'clean', label: '清理', icon: 'delete', count: scan ? scan.Junk.length : 0 },
    { id: 'drives', label: '磁盘', icon: 'storage', count: scan ? scan.Drives.length : 0 },
    { id: 'apps', label: '应用', icon: 'apps', count: scan ? scan.InstalledApps.length : 0 },
    { id: 'ai', label: 'AI 建议', icon: 'ai', count: visibleAiPlans().length }
  ];

  $('tabs').innerHTML = tabs.map((tab) => `
    <button class="nav-item${state.activeTab === tab.id ? ' active' : ''}" data-tab="${tab.id}" title="${esc(tab.label)}">
      ${icon(tab.icon, 17)}
      <span class="nav-label">${esc(tab.label)}</span>
      ${tab.count > 0 ? `<span class="nav-count">${fmtCount(tab.count)}</span>` : ''}
    </button>
  `).join('');

  const historyBar = $('scanHistoryBar');
  if (historyBar) historyBar.classList.toggle('hidden', state.activeTab !== 'clean');
}

/* ------------------------------------------------------------------ */
/* clean view                                                          */
/* ------------------------------------------------------------------ */

function filteredJunk() {
  if (!state.scan) return [];
  const query = state.filters.query.trim().toLowerCase();
  let rows = state.scan.Junk.map((item, index) => ({ item, index }));

  if (state.filters.safety !== 'all') {
    rows = rows.filter((row) => row.item.Safety === state.filters.safety);
  }
  if (state.filters.category !== 'all') {
    rows = rows.filter((row) => row.item.Category === state.filters.category);
  }
  if (query) {
    rows = rows.filter((row) => (
      String(row.item.Name || '').toLowerCase().includes(query)
      || String(row.item.Path || '').toLowerCase().includes(query)
      || String(row.item.Reason || '').toLowerCase().includes(query)
      || String(row.item.Category || '').toLowerCase().includes(query)
    ));
  }

  if (state.filters.sort === 'name') {
    rows.sort((a, b) => String(a.item.Name).localeCompare(String(b.item.Name), 'zh-CN'));
  } else if (state.filters.sort === 'category') {
    rows.sort((a, b) => String(a.item.Category).localeCompare(String(b.item.Category)) || num(b.item.SizeMB) - num(a.item.SizeMB));
  } else if (state.filters.sort === 'size-asc') {
    rows.sort((a, b) => num(a.item.SizeMB) - num(b.item.SizeMB));
  } else {
    rows.sort((a, b) => num(b.item.SizeMB) - num(a.item.SizeMB));
  }
  return rows;
}

function renderClean() {
  const scan = state.scan;
  const rows = filteredJunk();
  const categories = [...new Set(scan.Junk.map((item) => item.Category).filter(Boolean))].sort();
  const selected = selectedItems();
  const selectedGB = sumBy(selected, junkGB);

  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">清理候选</div>
          <div class="panel-sub">
            ${fmtCount(rows.length)} / ${fmtCount(scan.Junk.length)} 项
            · 已选 ${fmtCount(selected.length)} 项 · ${fmtGB(selectedGB)} GB
          </div>
        </div>
        <div class="panel-tools">
          <button class="btn ghost small" data-action="select-safe">全选安全项</button>
          <button class="btn ghost small" data-action="clear-selection">清空</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="clean-table">
          <thead>
            <tr>
              <th class="checkbox-cell"></th>
              <th class="th-filter th-filter-search">
                <input id="cleanSearch" class="th-input" type="search" placeholder="筛选项目 / 路径" value="${esc(state.filters.query)}" aria-label="筛选项目或路径">
              </th>
              <th class="th-filter">
                <select id="cleanCategory" class="th-select" aria-label="按分类筛选" title="按分类筛选">
                  <option value="all"${state.filters.category === 'all' ? ' selected' : ''}>分类</option>
                  ${categories.map((value) => `<option value="${esc(value)}"${state.filters.category === value ? ' selected' : ''}>${esc(CATEGORY_LABELS[value] || value)}</option>`).join('')}
                </select>
              </th>
              <th class="th-filter">
                <select id="cleanSafety" class="th-select" aria-label="按安全等级筛选" title="按安全等级筛选">
                  <option value="all"${state.filters.safety === 'all' ? ' selected' : ''}>等级</option>
                  ${Object.entries(SAFETY_LABELS).map(([value, label]) => `<option value="${value}"${state.filters.safety === value ? ' selected' : ''}>${label}</option>`).join('')}
                </select>
              </th>
              <th class="th-filter num">
                <select id="cleanSort" class="th-select" aria-label="排序方式" title="排序方式">
                  <option value="size"${state.filters.sort === 'size' ? ' selected' : ''}>大小 ↓</option>
                  <option value="size-asc"${state.filters.sort === 'size-asc' ? ' selected' : ''}>大小 ↑</option>
                  <option value="name"${state.filters.sort === 'name' ? ' selected' : ''}>名称</option>
                  <option value="category"${state.filters.sort === 'category' ? ' selected' : ''}>分类</option>
                </select>
              </th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="6" class="empty-row">没有符合筛选条件的清理项</td></tr>' : rows.map(({ item, index }) => {
              const checked = state.selection.has(index);
              const disabled = item.Safety === 'review';
              return `
                <tr class="${checked ? 'selected' : ''}">
                  <td class="checkbox-cell">
                    <input type="checkbox" data-idx="${index}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="选择 ${esc(item.Name)}">
                  </td>
                  <td>
                    <div class="cell-name">${esc(item.Name)}</div>
                    <span class="cell-path" title="${esc(item.Path)}">${esc(item.Path)}</span>
                  </td>
                  <td><span class="chip ${esc(item.Category)}">${esc(CATEGORY_LABELS[item.Category] || item.Category || '其他')}</span></td>
                  <td><span class="badge ${esc(item.Safety)}">${esc(SAFETY_LABELS[item.Safety] || item.Safety)}</span></td>
                  <td class="num">${fmtMB(item.SizeMB)}</td>
                  <td class="cell-reason" title="${esc(item.Reason)}">${esc(item.Reason)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="note" style="margin:14px 18px 18px">
        清理前会先重新测量并预览。安全等级为 <b>review</b> 的项目不会出现在可执行列表中；<b>elevated</b> 项目在普通权限下会被跳过。
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* drives view                                                         */
/* ------------------------------------------------------------------ */

function renderDrives() {
  const scan = state.scan;
  return `
    <div class="drive-grid">
      ${scan.Drives.map((drive) => {
        const total = num(drive.TotalGB);
        const used = num(drive.UsedGB);
        const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
        const freePercent = total > 0 ? (num(drive.FreeGB) / total) * 100 : 100;
        const barClass = freePercent < 5 ? 'bar danger' : freePercent < 12 ? 'bar warn' : 'bar';
        const topFolders = [...(drive.TopFolders || [])].slice(0, 12);
        const maxFolder = Math.max(1, ...topFolders.map((folder) => num(folder.SizeGB)));
        const extensions = [...(drive.Extensions || [])].slice(0, 10);
        const maxExt = Math.max(1, ...extensions.map((ext) => num(ext.SizeGB)));
        const largeFiles = [...(drive.LargeFiles || [])].slice(0, 100);
        const cloud = Array.isArray(drive.Cloud) ? drive.Cloud : [];

        return `
          <div class="drive-card">
            <div class="drive-card-head">
              <div class="drive-title">${esc(drive.Id)}</div>
              <div class="drive-meta">
                <span>总容量 <b>${fmtGB(total)} GB</b></span>
                <span>已用 <b>${fmtGB(used)} GB</b></span>
                <span>空闲 <b>${fmtGB(drive.FreeGB)} GB</b></span>
                <span>文件 <b>${fmtCount(drive.TotalFiles)}</b></span>
                <span>目录 <b>${fmtCount(drive.DirCount)}</b></span>
              </div>
            </div>
            <div class="${barClass}"><span style="width:${percent.toFixed(1)}%"></span></div>

            <div class="subgrid" style="margin-top:14px">
              <div class="mini-panel">
                <div class="mini-head"><span>TOP 目录</span><span>${esc(drive.Root || '')}</span></div>
                <div class="bar-list">
                  ${topFolders.length === 0 ? '<div class="empty-row">快速模式未统计</div>' : topFolders.map((folder) => `
                    <div class="bar-row">
                      <span class="label" title="${esc(folder.Name)}">${esc(folder.Name)}</span>
                      <div class="bar"><span style="width:${(num(folder.SizeGB) / maxFolder * 100).toFixed(1)}%"></span></div>
                      <span class="value">${fmtGB(folder.SizeGB)} GB · ${fmtCount(folder.Files)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="mini-panel">
                <div class="mini-head"><span>文件类型</span><span>${fmtCount((drive.Extensions || []).length)} 类</span></div>
                ${extensions.length === 0 ? '<div class="empty-row">快速模式未统计</div>' : `
                  <div class="bar-list">
                    ${extensions.map((ext) => `
                      <div class="bar-row">
                        <span class="label" title="${esc(ext.Ext)}">${esc(ext.Ext)}</span>
                        <div class="bar"><span style="width:${(num(ext.SizeGB) / maxExt * 100).toFixed(1)}%"></span></div>
                        <span class="value">${fmtGB(ext.SizeGB)} GB · ${fmtCount(ext.Count)}</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>

            ${largeFiles.length > 0 ? `
              <details>
                <summary>大文件 · 显示前 ${largeFiles.length} 个</summary>
                <div class="list-scroll">
                  <table class="detail-table">
                    <thead><tr><th>路径</th><th class="num">大小</th><th>修改时间</th></tr></thead>
                    <tbody>
                      ${largeFiles.map((file) => `
                        <tr>
                          <td class="file-path">${esc(file.Path)}</td>
                          <td class="num">${fmtMB(file.SizeMB)}</td>
                          <td>${esc(fmtDate(file.Modified))}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </details>
            ` : ''}

            ${cloud.length > 0 ? `
              <details>
                <summary>云占位 · ${cloud.length} 个位置</summary>
                <div class="list-scroll">
                  <table class="detail-table">
                    <thead><tr><th>路径</th><th class="num">逻辑大小</th><th class="num">本地占用</th><th class="num">文件</th></tr></thead>
                    <tbody>
                      ${cloud.map((entry) => `
                        <tr>
                          <td class="file-path">${esc(entry.Path)}</td>
                          <td class="num">${fmtGB(entry.LogicalGB)} GB</td>
                          <td class="num">${fmtGB(entry.LocalGB)} GB</td>
                          <td class="num">${fmtCount(entry.Files)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </details>
            ` : ''}

            <div class="tag-row">
              <span class="chip">空目录 ${fmtCount(drive.EmptyDirCount)}</span>
              <span class="chip">Junction/符号链接 ${fmtCount(drive.ReparsePointCount)}</span>
              ${(drive.ExcludedDirs || []).slice(0, 8).map((dir) => `<span class="chip" title="${esc(dir)}">已排除 ${esc(String(dir).split('\\').pop())}</span>`).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* apps view                                                           */
/* ------------------------------------------------------------------ */

function formatLastUsed(insight) {
  if (!insight) return '—';
  if (insight.lastUsedDays === null || insight.lastUsedDays === undefined) return '未知';
  if (insight.lastUsedDays <= 0) return '今天';
  if (insight.lastUsedDays === 1) return '昨天';
  return `${insight.lastUsedDays} 天前`;
}

function updateAppsSelectionUi() {
  const insights = state.appInsightsScanId === state.scanId ? state.appInsights : null;
  const insightByIndex = new Map((insights?.apps || []).map((entry) => [entry.index, entry]));
  const selected = [...state.appSelection].filter((index) => state.scan?.InstalledApps?.[index]);
  const selectedGB = sumBy(selected, (index) => num(state.scan.InstalledApps[index]?.EstimatedMB) / 1024);
  const selectedUpdates = selected.filter((index) => insightByIndex.get(index)?.update).length;
  const selectedUninstallable = selected.filter((index) => state.scan.InstalledApps[index]?.UninstallString).length;

  const info = document.getElementById('appsBulkInfo');
  if (info) info.textContent = `已选 ${fmtCount(selected.length)} 个 · ${fmtGB(selectedGB)} GB`;

  const updateButton = document.querySelector('[data-action="update-selected-apps"]');
  if (updateButton) {
    updateButton.classList.toggle('is-disabled', selectedUpdates === 0);
    updateButton.setAttribute('aria-disabled', String(selectedUpdates === 0));
    updateButton.title = selectedUpdates > 0 ? `更新所选 ${selectedUpdates} 个应用` : '先勾选有可用更新的应用';
    updateButton.innerHTML = `${icon('refresh', 14)} 更新所选${selectedUpdates > 0 ? ` (${fmtCount(selectedUpdates)})` : ''}`;
  }
  const uninstallButton = document.querySelector('[data-action="uninstall-selected-apps"]');
  if (uninstallButton) {
    uninstallButton.classList.toggle('is-disabled', selectedUninstallable === 0);
    uninstallButton.setAttribute('aria-disabled', String(selectedUninstallable === 0));
    uninstallButton.title = selectedUninstallable > 0 ? `卸载所选 ${selectedUninstallable} 个应用` : '先勾选要卸载的应用';
    uninstallButton.innerHTML = `${icon('delete', 14)} 卸载所选${selectedUninstallable > 0 ? ` (${fmtCount(selectedUninstallable)})` : ''}`;
  }

  const boxes = [...document.querySelectorAll('input[data-app-idx]')];
  const checkedCount = boxes.filter((box) => box.checked).length;
  const selectAll = document.getElementById('appsSelectAll');
  if (selectAll) {
    selectAll.checked = boxes.length > 0 && checkedCount === boxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
  }
}

function renderApps() {
  const insights = state.appInsightsScanId === state.scanId ? state.appInsights : null;
  const insightByIndex = new Map((insights?.apps || []).map((entry) => [entry.index, entry]));
  const query = state.appQuery.trim().toLowerCase();
  let rows = state.scan.InstalledApps.map((app, index) => ({ app, index, insight: insightByIndex.get(index) || null }));

  if (state.appFilter === 'update') {
    rows = rows.filter(({ insight }) => Boolean(insight?.update));
  } else if (state.appFilter === 'suggested') {
    rows = rows.filter(({ insight }) => Boolean(insight?.uninstallSuggested));
  }
  if (query) {
    rows = rows.filter(({ app }) => (
      String(app.DisplayName || '').toLowerCase().includes(query)
      || String(app.Publisher || '').toLowerCase().includes(query)
      || String(app.InstallLocation || '').toLowerCase().includes(query)
    ));
  }
  rows.sort((a, b) => num(b.app.EstimatedMB) - num(a.app.EstimatedMB));
  const visible = rows.slice(0, state.appLimit);
  const selected = [...state.appSelection].filter((index) => state.scan.InstalledApps[index]);
  const selectedGB = sumBy(selected, (index) => num(state.scan.InstalledApps[index]?.EstimatedMB) / 1024);
  const selectedUpdates = selected.filter((index) => insightByIndex.get(index)?.update).length;
  const selectedUninstallable = selected.filter((index) => state.scan.InstalledApps[index]?.UninstallString).length;
  const allVisibleSelected = visible.length > 0 && visible.every(({ index }) => state.appSelection.has(index));
  const updates = insights?.updatesAvailable ?? null;
  const suggested = insights?.suggestedUninstall ?? null;
  const known = insights?.lastUsedKnown ?? null;
  const total = state.scan.InstalledApps.length;
  const loading = state.appInsightsLoading;
  const filterChips = [
    ['all', '全部', total],
    ['update', '可更新', updates],
    ['suggested', '建议卸载', suggested]
  ];

  return `
    <div class="stat-grid apps-summary">
      <div class="stat-card">
        <div class="stat-label">已安装应用</div>
        <div class="stat-value">${fmtCount(total)}<span class="unit">个</span></div>
        <div class="stat-sub">按估算大小排序</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">可更新</div>
        <div class="stat-value">${updates === null ? '…' : fmtCount(updates)}<span class="unit">个</span></div>
        <div class="stat-sub">${insights ? `${fmtCount(insights.updatesMatched)} 个已匹配安装项` : '正在检查 winget'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">建议卸载</div>
        <div class="stat-value">${suggested === null ? '…' : fmtCount(suggested)}<span class="unit">个</span></div>
        <div class="stat-sub">基于 1 年未使用 / 大体积</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">使用记录</div>
        <div class="stat-value">${known === null ? '…' : `${fmtCount(known)}/${fmtCount(total)}`}</div>
        <div class="stat-sub">${insights?.generatedAt ? `检查于 ${fmtDate(insights.generatedAt)}` : 'Prefetch / UserAssist 估算'}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head apps-head">
        <div class="panel-title">软件概况</div>
        <div class="panel-tools apps-tools">
          <div class="filter-row">
            ${filterChips.map(([value, label, count]) => `
              <button class="filter-chip${state.appFilter === value ? ' active' : ''}" data-action="app-filter" data-filter="${value}">
                ${esc(label)}${count !== null && count !== undefined ? ` ${fmtCount(count)}` : ''}
              </button>
            `).join('')}
          </div>
          <input id="appSearch" class="search-input" type="search" placeholder="搜索应用 / 发行商" value="${esc(state.appQuery)}">
          <button class="btn ghost small" data-action="refresh-app-insights" ${loading ? 'disabled' : ''}>${icon('refresh', 14)} 检查更新</button>
        </div>
      </div>

      <div class="apps-bulk-bar">
        <div id="appsBulkInfo" class="apps-bulk-info">已选 ${fmtCount(selected.length)} 个 · ${fmtGB(selectedGB)} GB</div>
        <div class="apps-bulk-actions">
          <button class="btn primary small${selectedUpdates > 0 ? '' : ' is-disabled'}" data-action="update-selected-apps" aria-disabled="${selectedUpdates === 0}" title="${selectedUpdates > 0 ? `更新所选 ${selectedUpdates} 个应用` : '先勾选有可用更新的应用'}">
            ${icon('refresh', 14)} 更新所选${selectedUpdates > 0 ? ` (${fmtCount(selectedUpdates)})` : ''}
          </button>
          <button class="btn danger small${selectedUninstallable > 0 ? '' : ' is-disabled'}" data-action="uninstall-selected-apps" aria-disabled="${selectedUninstallable === 0}" title="${selectedUninstallable > 0 ? `卸载所选 ${selectedUninstallable} 个应用` : '先勾选要卸载的应用'}">
            ${icon('delete', 14)} 卸载所选${selectedUninstallable > 0 ? ` (${fmtCount(selectedUninstallable)})` : ''}
          </button>
        </div>
      </div>

      <div class="table-wrap list-scroll">
        <table class="apps-table">
          <thead>
            <tr>
              <th class="checkbox-cell"><input id="appsSelectAll" type="checkbox" ${allVisibleSelected ? 'checked' : ''} ${visible.length === 0 ? 'disabled' : ''} aria-label="全选当前列表"></th>
              <th>应用</th><th>版本</th><th>发行商</th><th class="num">大小</th><th>上次使用</th><th>更新</th>
            </tr>
          </thead>
          <tbody>
            ${visible.length === 0 ? `<tr><td colspan="7" class="empty-row">${insights ? '没有匹配的应用' : '正在加载应用概况…'}</td></tr>` : visible.map(({ app, index, insight }) => {
              const update = insight?.update;
              const lastUsed = formatLastUsed(insight);
              const suggestedBadge = insight?.uninstallSuggested
                ? `<span class="badge medium app-suggest-badge" title="${esc(insight.uninstallReason)}">建议卸载</span>`
                : '';
              return `
                <tr class="${state.appSelection.has(index) ? 'selected' : ''}">
                  <td class="checkbox-cell">
                    <input type="checkbox" data-app-idx="${index}" ${state.appSelection.has(index) ? 'checked' : ''} aria-label="选择 ${esc(app.DisplayName)}">
                  </td>
                  <td>
                    <div class="app-name-line">
                      <span class="cell-name">${esc(app.DisplayName)}</span>
                      ${suggestedBadge}
                    </div>
                    <span class="cell-path" title="${esc(app.InstallLocation || '')}">${esc(app.InstallLocation || '')}</span>
                  </td>
                  <td>${esc(app.DisplayVersion || '—')}</td>
                  <td class="app-publisher">${esc(app.Publisher || '—')}</td>
                  <td class="num">${fmtMB(app.EstimatedMB)}</td>
                  <td title="${esc(insight?.lastUsed ? fmtDate(insight.lastUsed) : (insight ? '未检测到使用记录' : ''))}">
                    <span class="${insight?.lastUsedDays !== null && insight?.lastUsedDays !== undefined ? '' : 'dim'}">${esc(lastUsed)}</span>
                  </td>
                  <td>
                    ${update
                      ? `<span class="badge medium app-update-badge" title="当前 ${esc(update.version)} → ${esc(update.available)}">${esc(update.available)}</span>`
                      : `<span class="dim">${insights ? '—' : '…'}</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${rows.length > visible.length ? `
        <div class="panel-head" style="border-top:1px solid var(--line-soft);border-bottom:0">
          <button class="btn ghost small" data-action="show-more-apps">显示更多（剩余 ${fmtCount(rows.length - visible.length)}）</button>
        </div>
      ` : ''}
    </div>

    ${insights?.unmatchedUpdates?.length > 0 ? `
      <details class="panel apps-unmatched">
        <summary>${fmtCount(insights.unmatchedUpdates.length)} 个 winget 更新未匹配到已安装应用</summary>
        <div class="table-wrap">
          <table class="detail-table">
            <thead><tr><th>名称</th><th>winget ID</th><th>当前</th><th>可用</th></tr></thead>
            <tbody>
              ${insights.unmatchedUpdates.map((update) => `
                <tr>
                  <td>${esc(update.name)}</td>
                  <td class="file-path">${esc(update.id)}</td>
                  <td>${esc(update.version)}</td>
                  <td><span class="badge medium">${esc(update.available)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    ` : ''}
  `;
}

/* ------------------------------------------------------------------ */
/* apps bulk actions                                                   */
/* ------------------------------------------------------------------ */

function selectedAppIndexes() {
  return [...state.appSelection].filter((index) => state.scan?.InstalledApps?.[index]);
}

function showUpdateSelectedModal() {
  const insights = state.appInsightsScanId === state.scanId ? state.appInsights : null;
  const insightByIndex = new Map((insights?.apps || []).map((entry) => [entry.index, entry]));
  const selected = selectedAppIndexes().filter((index) => insightByIndex.get(index)?.update);
  if (selected.length === 0) {
    toast(selectedAppIndexes().length === 0 ? '请先勾选要更新的应用' : '所选应用没有可用更新', 'info');
    return;
  }

  const body = `
    <div class="note">将使用 winget 依次更新以下应用。默认静默更新；如果应用需要 UAC 或安装向导，请勾选下方的“交互模式”。</div>
    <div class="summary-box" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="summary-cell"><div class="k">更新应用</div><div class="v">${fmtCount(selected.length)} 个</div></div>
      <div class="summary-cell"><div class="k">数据来源</div><div class="v" style="font-size:12px">winget upgrade</div></div>
    </div>
    <div class="list-scroll">
      <table>
        <thead><tr><th>应用</th><th>当前</th><th>可用</th></tr></thead>
        <tbody>
          ${selected.map((index) => {
            const app = state.scan.InstalledApps[index];
            const update = insightByIndex.get(index).update;
            return `<tr>
              <td class="cell-name">${esc(app.DisplayName)}</td>
              <td>${esc(update.version || app.DisplayVersion || '—')}</td>
              <td><span class="badge medium">${esc(update.available)}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <label class="checkbox-row" style="margin-top:14px">
      <input type="checkbox" id="appsUpdateInteractive">
      <span>交互模式：显示安装向导 / 允许 UAC（适合 QQ 等需要确认的应用）。</span>
    </label>
    <label class="checkbox-row" style="margin-top:10px">
      <input type="checkbox" id="appsUpdateConfirm">
      <span>我确认更新以上 ${fmtCount(selected.length)} 个应用（勾选后“开始更新”才可用）。</span>
    </label>
  `;

  showModal({
    title: '更新所选应用',
    subtitle: 'winget 更新，失败项会保留并说明原因',
    body,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: '开始更新',
        kind: 'primary',
        disabled: true,
        onClick: async ({ close }) => {
          const interactive = Boolean(document.getElementById('appsUpdateInteractive')?.checked);
          close();
          try {
            toast(interactive ? '正在启动交互式更新，请留意安装窗口…' : '正在准备更新任务…', 'info', 3000);
            const { jobId } = await api('/api/apps/update', {
              method: 'POST',
              body: { scan: state.scanId, indexes: selected, confirm: true, interactive }
            });
            openJob(jobId, {
              title: `${interactive ? '交互更新' : '更新'} ${selected.length} 个应用`,
              onDone: async (job) => {
                if (job.status !== 'done') {
                  toast(job.error || '更新任务失败', 'error', 8000);
                  return;
                }
                const result = job.result || {};
                const needsInteractive = Array.isArray(result.NeedsInteractive) ? result.NeedsInteractive : [];
                const summary = `更新完成：成功 ${fmtCount(result.Updated || 0)}，已是最新 ${fmtCount(result.UpToDate || 0)}，失败 ${fmtCount(result.Failed || 0)}`;
                if (needsInteractive.length > 0) {
                  toast(`${summary}。${needsInteractive.join('、')} 需要交互式安装，请重新勾选并启用“交互模式”。`, 'warn', 14000);
                } else {
                  toast(summary, result.Failed > 0 ? 'warn' : 'ok', 9000);
                }
                state.appSelection.clear();
                await loadAppInsights({ force: true });
              }
            });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      }
    ],
    onMount: ({ backdrop }) => {
      const check = backdrop.querySelector('#appsUpdateConfirm');
      const start = backdrop.querySelector('[data-action-index="1"]');
      check.addEventListener('change', () => { start.disabled = !check.checked; });
    }
  });
}

function showUninstallSelectedModal() {
  const selected = selectedAppIndexes().filter((index) => state.scan.InstalledApps[index]?.UninstallString);
  if (selected.length === 0) {
    toast(selectedAppIndexes().length === 0 ? '请先勾选要卸载的应用' : '所选应用没有可用的卸载命令', 'info');
    return;
  }

  const body = `
    <div class="note warn">将依次调用所选应用自带的卸载程序。可能弹出多个卸载向导，请按提示完成；不会直接删除安装目录。</div>
    <div class="list-scroll" style="margin-top:12px">
      <table>
        <thead><tr><th>应用</th><th class="num">大小</th><th>版本</th></tr></thead>
        <tbody>
          ${selected.map((index) => {
            const app = state.scan.InstalledApps[index];
            return `<tr>
              <td class="cell-name">${esc(app.DisplayName)}</td>
              <td class="num">${fmtMB(app.EstimatedMB)}</td>
              <td>${esc(app.DisplayVersion || '—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <label class="checkbox-row" style="margin-top:14px">
      <input type="checkbox" id="appsUninstallConfirm">
      <span>我确认卸载以上 ${fmtCount(selected.length)} 个应用，并理解卸载向导可能需要手动完成（勾选后“开始卸载”才可用）。</span>
    </label>
  `;

  showModal({
    title: '卸载所选应用',
    subtitle: '调用应用自带卸载程序',
    body,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: '开始卸载',
        kind: 'danger',
        disabled: true,
        onClick: async ({ close }) => {
          close();
          try {
            toast('正在启动应用卸载程序…', 'info', 2500);
            const { jobId } = await api('/api/apps/uninstall-batch', {
              method: 'POST',
              body: { scan: state.scanId, indexes: selected, confirm: true }
            });
            openJob(jobId, {
              title: `卸载 ${selected.length} 个应用`,
              onDone: async (job) => {
                if (job.status !== 'done') {
                  toast(job.error || '卸载任务失败', 'error', 8000);
                  return;
                }
                const result = job.result || {};
                toast(`卸载任务结束：完成 ${fmtCount(result.Completed || 0)}，已启动 ${fmtCount(result.Started || 0)}，失败 ${fmtCount(result.Failed || 0)}`, 'ok', 9000);
                state.appSelection.clear();
                await loadAppInsights({ force: true });
              }
            });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      }
    ],
    onMount: ({ backdrop }) => {
      const check = backdrop.querySelector('#appsUninstallConfirm');
      const start = backdrop.querySelector('[data-action-index="1"]');
      check.addEventListener('change', () => { start.disabled = !check.checked; });
    }
  });
}

/* ------------------------------------------------------------------ */
/* migration view                                                      */
/* ------------------------------------------------------------------ */

function renderMigration() {
  const rows = state.scan.Migration;
  if (rows.length === 0) {
    return '<div class="panel"><div class="empty-row">没有达到阈值的迁移候选</div></div>';
  }
  return `
    <div class="card-grid">
      ${rows.map((item) => `
        <div class="migrate-card">
          <div class="migrate-top">
            <div class="migrate-name">${esc(item.Name)}</div>
            <div class="migrate-size">${fmtGB(item.SizeGB)} GB</div>
          </div>
          <div class="migrate-path">${esc(item.Path)}</div>
          <div class="migrate-target">→ ${esc(item.SuggestedTarget)}</div>
          <div class="migrate-reason">${esc(item.Reason)}</div>
        </div>
      `).join('')}
    </div>
    <div class="note">迁移建议只做参考。移动前请关闭相关应用，并使用 <code>pc-manager organize</code> 或应用自身的迁移功能，避免直接剪切正在使用的目录。</div>
  `;
}

/* ------------------------------------------------------------------ */
/* AI suggestions view                                                 */
/* ------------------------------------------------------------------ */

function aiCategoryRank(plan) {
  const index = AI_CATEGORY_ORDER.indexOf(plan?.category);
  return index === -1 ? AI_CATEGORY_ORDER.length : index;
}

function renderAiCard(plan) {
  const risk = plan.risk || 'medium';
  const category = plan.category || 'cache';
  const params = plan.params || {};
  const prompt = state.aiPrompts[plan.id] ?? buildAiPrompt(plan);
  const detailPath = params.source
    ? `<div class="ai-path">${esc(params.source)}${params.destination ? ` → ${esc(params.destination)}` : ''}</div>`
    : '';
  return `
    <div class="ai-card" data-plan-id="${esc(plan.id)}">
      <div class="ai-head">
        <span class="chip ${esc(category)}">${esc(AI_CATEGORY_LABELS[category] || category)}</span>
        <span class="badge ${esc(risk)}">${esc(AI_RISK_LABELS[risk] || risk)}</span>
      </div>
      <div class="ai-title">${esc(plan.title)}</div>
      <div class="ai-summary">${esc(plan.summary)}</div>
      <div class="ai-desc">${esc(plan.description)}</div>
      ${detailPath}
      <ul class="ai-steps">
        ${(plan.steps || []).map((step) => `<li>${esc(step)}</li>`).join('')}
      </ul>
      <textarea class="ai-prompt" data-prompt-id="${esc(plan.id)}" spellcheck="false" aria-label="${esc(plan.title)} 指令">${esc(prompt)}</textarea>
      <div class="ai-foot">
        <span class="ai-size">${plan.type === 'advisory' ? '策略建议' : plan.estimatedGB > 0 ? `${fmtGB(plan.estimatedGB)} GB` : '待预览'}</span>
        <div class="ai-actions">
          <button class="btn ghost small" data-action="ignore-ai" data-plan-id="${esc(plan.id)}">${icon('close', 13)} 忽略</button>
          <button class="btn primary small" data-action="copy-ai" data-plan-id="${esc(plan.id)}">${icon('copy', 13)} 复制</button>
        </div>
      </div>
    </div>
  `;
}

function renderAI() {
  const header = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">AI 建议</div>
          <div class="panel-sub">把建议复制给 AI 助手执行；这里只生成文本，不会直接操作文件。</div>
        </div>
        <div class="panel-tools">
          <button class="btn ghost small" data-action="copy-all-ai">${icon('copy', 14)} 复制全部</button>
          <button class="btn ghost small" data-action="copy-analysis-ai">${icon('ai', 14)} 复制分析提示词</button>
          ${state.ignoredAi.size > 0 ? `<button class="btn ghost small" data-action="restore-ignored-ai">${icon('refresh', 14)} 恢复忽略 ${state.ignoredAi.size}</button>` : ''}
        </div>
      </div>
      <div class="note">
        每张卡片都是一段可编辑的指令。你可以修改路径、规则或补充需求，然后复制给 agent。执行前请让 agent 先给出预览并等待确认。
      </div>
    </div>
  `;

  if (state.aiLoading) {
    return `${header}<div class="panel"><div class="empty-row">正在分析扫描结果…</div></div>`;
  }

  const plans = [...visibleAiPlans()].sort((a, b) => aiCategoryRank(a) - aiCategoryRank(b));
  if (plans.length === 0) {
    const emptyText = state.ignoredAi.size > 0
      ? `所有建议都已被忽略（${state.ignoredAi.size} 条）。`
      : '当前扫描没有生成 AI 建议。';
    return `${header}<div class="panel"><div class="empty-row">${esc(emptyText)}</div></div>`;
  }

  const grouped = new Map(AI_CATEGORY_ORDER.map((category) => [category, []]));
  for (const plan of plans) {
    const category = AI_CATEGORY_ORDER.includes(plan.category) ? plan.category : 'cache';
    grouped.get(category).push(plan);
  }

  return `
    ${header}
    ${AI_CATEGORY_ORDER.map((category) => {
      const categoryPlans = grouped.get(category);
      if (categoryPlans.length === 0) return '';
      return `
        <section class="ai-group" data-ai-group="${esc(category)}">
          <div class="ai-group-head">
            <span class="chip ${esc(category)}">${esc(AI_CATEGORY_LABELS[category])}</span>
            <span class="ai-group-count">${categoryPlans.length} 条</span>
            <span class="ai-group-hint">${esc(AI_CATEGORY_HINTS[category] || '')}</span>
          </div>
          <div class="ai-list">
            ${categoryPlans.map(renderAiCard).join('')}
          </div>
        </section>
      `;
    }).join('')}
  `;
}

function buildAiPrompt(plan) {
  const scan = state.scan || {};
  const repoRoot = state.health?.repoRoot || '当前项目目录';
  const lines = [];
  lines.push('# pc-manager 任务指令');
  lines.push('');
  lines.push(`任务：${plan.title}`);
  lines.push(`分类：${AI_CATEGORY_LABELS[plan.category] || plan.category || '任务'}`);
  lines.push(`风险：${AI_RISK_LABELS[plan.risk] || plan.risk || '未知'} · 预计 ${plan.estimatedGB > 0 ? `${fmtGB(plan.estimatedGB)} GB` : '待预览（以预览测量为准）'}`);
  lines.push(`扫描文件：reports/${state.scanId}`);
  lines.push(`电脑：${scan.Computer || '—'} / ${scan.User || '—'}`);
  lines.push('');
  lines.push('## 目标');
  lines.push(plan.description || plan.summary || '');
  lines.push('');
  if (plan.evidence) {
    lines.push('## 审计证据');
    lines.push(plan.evidence);
    lines.push('');
  }
  lines.push('## 参数');
  if (plan.params?.source) lines.push(`- 源路径：${plan.params.source}`);
  if (plan.params?.destination) lines.push(`- 目标路径：${plan.params.destination}`);
  if (plan.params?.kind) lines.push(`- 类型：${plan.params.kind}`);
  if (Array.isArray(plan.params?.paths) && plan.params.paths.length > 0) {
    lines.push(`- 清理项（${plan.params.paths.length} 项）：`);
    plan.params.paths.slice(0, 30).forEach((itemPath) => lines.push(`  - ${itemPath}`));
    if (plan.params.paths.length > 30) lines.push(`  - …其余 ${plan.params.paths.length - 30} 项见扫描文件`);
  }
  lines.push('');
  lines.push('## 执行要求');
  (plan.steps || []).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  lines.push(`${(plan.steps || []).length + 1}. 先列出将要处理的文件/项目数量、样例和最终目标位置，等待我确认后再执行。`);
  lines.push('');
  lines.push('## 安全限制');
  lines.push('- 不要处理 OneDrive/iCloud 云占位文件。');
  lines.push('- 不要处理 junction / reparse point。');
  lines.push('- 不要触碰 WinSxS、Windows\\Installer、Package Cache、pagefile/hiberfil、System Volume Information。');
  lines.push('- 不要删除个人文件；移动时保留原文件名，重名自动加序号。');
  lines.push('- 所有移动/清理都要写 CSV manifest。');
  if (plan.type === 'clean-junk') {
    lines.push('- 只处理上面列出的 Junk 路径；执行前重新测量当前大小。');
  }
  if (plan.type === 'organize-media') {
    lines.push('- 按 YYYY\\YYYY-MM 归档，使用文件拍摄时间或修改时间。');
  }
  if (plan.type === 'migrate') {
    lines.push('- 使用 robocopy 移动目录，移动完成后在原路径创建 junction。');
  }
  lines.push('');
  lines.push('## 环境');
  lines.push(`- 项目根目录：${repoRoot}`);
  lines.push('- CLI：pwsh -File pc-manager.ps1 ...');
  lines.push('- 清理/归档/迁移完成后汇报移动数、失败数、manifest 路径。');
  return lines.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function promptForPlan(plan) {
  return state.aiPrompts[plan.id] ?? buildAiPrompt(plan);
}

function buildAnalysisPrompt() {
  const scan = state.scan;
  const audit = scan?.Audit;
  const repoRoot = state.health?.repoRoot || '当前项目目录';
  const scanRef = state.scanId ? `reports/${state.scanId}` : 'reports/scan-*.json';
  const findings = (audit?.Findings || [])
    .map((finding) => `- ${finding.Severity} · ${finding.Category} · ${finding.Title}${finding.Evidence ? ` — ${finding.Evidence}` : ''}`)
    .join('\n');

  return [
    '# pc-manager AI 空间分析任务',
    '',
    '请使用 storage-strategy skill 对当前电脑做一次完整的存储空间分析。',
    '',
    '## 输入',
    `- 项目根目录：${repoRoot}`,
    `- 扫描文件：${scanRef}`,
    `- 电脑：${scan?.Computer || '—'} / ${scan?.User || '—'}`,
    `- 当前健康分：${audit?.HealthScore ?? '—'}/100 (${audit?.Grade || '—'})`,
    '',
    '## 当前审计发现',
    findings || '- 暂无',
    '',
    '## 要求',
    '1. 先读取 docs/storage-strategy.md 和扫描 JSON；',
    `2. 运行 pwsh -File pc-manager.ps1 audit -ScanPath ${scanRef} -Json，核对容量、工作负载和 Findings；`,
    '3. 按 P0/P1/P2 输出问题，每条给出证据、影响、建议动作、预计释放/迁移量、风险和权限要求；',
    '4. 分析路径/文件夹卫生：工作区、下载、媒体、空目录、junction、云占位、大文件、仓库体积；',
    '5. 给出 7/30/90 天计划；',
    '6. 对复杂动作先给只读预览和 manifest 计划，不要直接删除/移动，等待我确认。',
    '',
    '## 输出',
    '- 概览结论 3–5 条；',
    '- 容量与盘角色；',
    '- P0/P1/P2 清单；',
    '- 路径问题；',
    '- 7/30/90 天计划；',
    '- 需要我确认的执行项。'
  ].join('\n');
}

async function copyAiPlan(plan) {
  await copyText(promptForPlan(plan));
  toast(`已复制「${plan.title}」，可以粘贴给 AI 助手`, 'ok');
}

async function copyAnalysisPrompt() {
  await copyText(buildAnalysisPrompt());
  toast('已复制 AI 分析提示词，可以交给 agent 执行', 'ok');
}

async function copyAllAiPlans() {
  const plans = [...visibleAiPlans()].sort((a, b) => aiCategoryRank(a) - aiCategoryRank(b));
  if (plans.length === 0) return;
  const text = plans.map((plan) => promptForPlan(plan)).join('\n\n---\n\n');
  await copyText(text);
  toast(`已复制 ${plans.length} 条 AI 建议`, 'ok');
}

async function loadAiPlans({ force = false } = {}) {
  if (!state.scanId) return;
  if (!force && state.aiPlansScanId === state.scanId && state.aiPlans) {
    state.activeTab = 'ai';
    renderTabs();
    renderView();
    return;
  }

  const requestedScanId = state.scanId;
  const requestId = (state.aiRequest || 0) + 1;
  state.aiRequest = requestId;
  state.aiLoading = true;
  state.activeTab = 'ai';
  renderTabs();
  renderView();

  try {
    const data = await api(`/api/ai/plans/${encodeURIComponent(requestedScanId)}`);
    if (state.aiRequest !== requestId || state.scanId !== requestedScanId) return;
    state.aiPlans = Array.isArray(data.plans) ? data.plans : [];
    state.aiPlansScanId = requestedScanId;
  } catch (error) {
    if (state.aiRequest !== requestId || state.scanId !== requestedScanId) return;
    state.aiPlans = [];
    state.aiPlansScanId = requestedScanId;
    toast(error.message, 'error');
  } finally {
    if (state.aiRequest === requestId) {
      state.aiLoading = false;
      renderTabs();
      renderView();
    }
  }
}

async function loadAppInsights({ force = false } = {}) {
  if (!state.scanId) return;
  if (!force && state.appInsightsScanId === state.scanId && state.appInsights) {
    state.activeTab = 'apps';
    renderTabs();
    renderView();
    return;
  }

  const requestedScanId = state.scanId;
  const requestId = (state.appInsightsRequest || 0) + 1;
  state.appInsightsRequest = requestId;
  state.appInsightsLoading = true;
  state.activeTab = 'apps';
  renderTabs();
  renderView();

  try {
    const suffix = force ? '?refresh=1' : '';
    const data = await api(`/api/apps/insights/${encodeURIComponent(requestedScanId)}${suffix}`);
    if (state.appInsightsRequest !== requestId || state.scanId !== requestedScanId) return;
    state.appInsights = data.insights || null;
    state.appInsightsScanId = requestedScanId;
  } catch (error) {
    if (state.appInsightsRequest !== requestId || state.scanId !== requestedScanId) return;
    state.appInsights = null;
    state.appInsightsScanId = requestedScanId;
    toast(error.message, 'error', 8000);
  } finally {
    if (state.appInsightsRequest === requestId) {
      state.appInsightsLoading = false;
      renderTabs();
      renderView();
    }
  }
}

async function startAiPlan(plan) {
  try {
    const { jobId } = await api('/api/ai/preview', {
      method: 'POST',
      body: { scan: state.scanId, plan }
    });
    openJob(jobId, {
      title: `AI 预览 · ${plan.title}`,
      onDone: (job) => {
        if (job.status !== 'done') {
          toast(job.error || 'AI 预览失败', 'error', 8000);
          return;
        }
        showAiPreview(plan, job.result);
      }
    });
  } catch (error) {
    toast(error.message, 'error');
  }
}

function aiPreviewBody(plan, result) {
  if (plan.type === 'clean-junk') {
    const items = Array.isArray(result?.Items) ? result.Items : [];
    const wouldClean = items.filter((item) => item.Status === 'would-clean');
    const skipped = items.filter((item) => item.Status === 'skipped');
    const totalMB = sumBy(wouldClean, (item) => item.SizeMB);
    return {
      canExecute: wouldClean.length > 0,
      cells: [
        ['可清理', `${fmtCount(wouldClean.length)} 项`],
        ['预计释放', fmtMB(totalMB)],
        ['跳过', `${fmtCount(skipped.length)} 项`]
      ],
      body: `
        <div class="list-scroll">
          <table>
            <thead><tr><th>项目</th><th>状态</th><th class="num">大小</th><th>说明</th></tr></thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td><div class="cell-name">${esc(item.Name)}</div><span class="cell-path" title="${esc(item.Path)}">${esc(item.Path)}</span></td>
                  <td><span class="job-item-status ${esc(item.Status)}">${esc(STATUS_LABELS[item.Status] || item.Status)}</span></td>
                  <td class="num">${fmtMB(item.SizeMB)}</td>
                  <td class="cell-reason">${esc(detailText(item.Detail))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    };
  }

  if (plan.type === 'organize-media') {
    const files = Number(result?.TotalFiles) || 0;
    const totalMB = Number(result?.TotalMB) || 0;
    const items = Array.isArray(result?.Items) ? result.Items : [];
    return {
      canExecute: files > 0,
      cells: [
        ['待归档文件', `${fmtCount(files)} 个`],
        ['预计大小', fmtMB(totalMB)],
        ['目标', result?.Destination || plan.params?.destination || '—']
      ],
      body: `
        <div class="note">预览只扫描和分组，没有移动任何文件。确认后才会真正移动，并生成 manifest。</div>
        <div class="list-scroll" style="margin-top:12px">
          <table>
            <thead><tr><th>文件</th><th>月份</th><th>目标位置</th><th class="num">大小</th></tr></thead>
            <tbody>
              ${items.slice(0, 100).map((item) => `
                <tr>
                  <td class="file-path">${esc(item.Name)}</td>
                  <td>${esc(item.Month || '—')}</td>
                  <td class="file-path">${esc(item.Destination)}</td>
                  <td class="num">${fmtMB(item.SizeMB)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    };
  }

  const sizeMB = Number(result?.SizeMB) || 0;
  return {
    canExecute: result?.Status === 'would-move',
    cells: [
      ['目录大小', fmtMB(sizeMB)],
      ['源路径', result?.Source || plan.params?.source || '—'],
      ['目标路径', result?.Destination || plan.params?.destination || '—']
    ],
    body: `
      <div class="note warn">迁移会移动整个目录，并在原位置创建 junction。请确认没有程序正在使用该目录。</div>
      <div class="mono" style="margin-top:12px">${esc(result?.Source || plan.params?.source || '')}<br>→ ${esc(result?.Destination || plan.params?.destination || '')}</div>
    `
  };
}

function showAiPreview(plan, result) {
  const preview = aiPreviewBody(plan, result);
  const summary = preview.cells.map(([label, value], index) => {
    const wide = index === 2 ? ' style="grid-column:span 1"' : '';
    return `<div class="summary-cell"${wide}><div class="k">${esc(label)}</div><div class="v" style="font-size:${index === 2 ? '12px' : '17px'};overflow:hidden;text-overflow:ellipsis">${esc(value)}</div></div>`;
  }).join('');

  showModal({
    title: 'AI 计划预览',
    subtitle: plan.title,
    body: `
      <div class="summary-box">${summary}</div>
      ${preview.body}
      <label class="checkbox-row" style="margin-top:14px">
        <input type="checkbox" id="aiConfirmCheck" ${preview.canExecute ? '' : 'disabled'}>
        <span>我确认执行这个 AI 计划，并理解操作会修改磁盘内容。</span>
      </label>
      ${plan.risk === 'high' ? '<div class="note warn" style="margin-top:10px">这是高风险计划，包含需要人工确认的项目。</div>' : ''}
    `,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: '确认执行',
        kind: 'primary',
        disabled: true,
        onClick: async ({ close }) => {
          close();
          try {
            const { jobId } = await api('/api/ai/execute', {
              method: 'POST',
              body: {
                scan: state.scanId,
                plan,
                confirm: true,
                acknowledgeRisky: plan.risk === 'high'
              }
            });
            openJob(jobId, {
              title: `AI 执行 · ${plan.title}`,
              onDone: (job) => {
                if (job.status !== 'done') {
                  toast(job.error || 'AI 执行失败', 'error', 9000);
                  return;
                }
                if (plan.type === 'clean-junk') {
                  state.selection.clear();
                  renderView();
                  showCleanResult(job.result);
                } else {
                  showAiResult(plan, job.result);
                }
              }
            });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      }
    ],
    onMount: ({ backdrop }) => {
      const check = backdrop.querySelector('#aiConfirmCheck');
      const start = backdrop.querySelector('[data-action-index="1"]');
      const sync = () => {
        start.disabled = !preview.canExecute || !check.checked;
      };
      sync();
      check.addEventListener('change', sync);
    }
  });
}

function showAiResult(plan, result) {
  const manifest = result?.ManifestPath || null;
  const summary = plan.type === 'organize-media'
    ? [
        ['已移动', `${fmtCount(result?.Moved)} 个`],
        ['失败', `${fmtCount(result?.Failed)} 个`],
        ['总大小', fmtMB(result?.TotalMB)]
      ]
    : [
        ['状态', result?.Status === 'completed' ? '完成' : result?.Status || '—'],
        ['目录大小', fmtMB(result?.SizeMB)],
        ['目标', result?.Destination || '—']
      ];

  const items = Array.isArray(result?.Items) ? result.Items : [];

  showModal({
    title: 'AI 执行完成',
    subtitle: plan.title,
    body: `
      <div class="summary-box">
        ${summary.map(([label, value], index) => `<div class="summary-cell"><div class="k">${esc(label)}</div><div class="v" style="font-size:${index === 2 ? '12px' : '17px'}">${esc(value)}</div></div>`).join('')}
      </div>
      ${manifest ? `<div class="field"><label>Manifest</label><div class="mono">${esc(manifest)}</div></div>` : ''}
      ${plan.type === 'organize-media' && items.length > 0 ? `
        <div class="list-scroll" style="margin-top:12px">
          <table>
            <thead><tr><th>文件</th><th>月份</th><th>状态</th><th class="num">大小</th></tr></thead>
            <tbody>
              ${items.slice(0, 100).map((item) => `
                <tr>
                  <td class="file-path">${esc(item.Name)}</td>
                  <td>${esc(item.Month || '—')}</td>
                  <td><span class="job-item-status ${esc(item.Status)}">${esc(STATUS_LABELS[item.Status] || item.Status)}</span></td>
                  <td class="num">${fmtMB(item.SizeMB)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `,
    actions: [
      {
        label: '打开报告文件夹',
        kind: 'ghost',
        disabled: !manifest,
        onClick: async () => {
          try {
            await api('/api/open', { method: 'POST', body: { path: manifest } });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      },
      { label: '完成', kind: 'primary' }
    ]
  });
}

/* ------------------------------------------------------------------ */
/* insights view                                                       */
/* ------------------------------------------------------------------ */

function renderInsights() {
  const scan = state.scan;
  const media = scan.Media || {};
  const orphans = scan.Orphans || {};
  const uninstall = Array.isArray(orphans.UninstallEntries) ? orphans.UninstallEntries : [];
  const runKeys = Array.isArray(orphans.RunKeys) ? orphans.RunKeys : [];
  const appx = Array.isArray(orphans.AppxData) ? orphans.AppxData : [];

  return `
    <div class="panel">
      <div class="panel-head"><div class="panel-title">扫描建议</div></div>
      <div class="rec-list">
        ${scan.Recommendations.length === 0
          ? '<div class="empty-row">没有建议</div>'
          : scan.Recommendations.map((text) => `<div class="rec-item">${esc(text)}</div>`).join('')}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">照片</div>
        <div class="stat-value">${fmtGB(media.PhotoGB)}<span class="unit">GB</span></div>
        <div class="stat-sub">${fmtCount(media.PhotoCount)} 个文件</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">视频</div>
        <div class="stat-value">${fmtGB(media.VideoGB)}<span class="unit">GB</span></div>
        <div class="stat-sub">${fmtCount(media.VideoCount)} 个文件</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">音频</div>
        <div class="stat-value">${fmtGB(media.AudioGB)}<span class="unit">GB</span></div>
        <div class="stat-sub">${fmtCount(media.AudioCount)} 个文件</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">扫描信息</div>
        <div class="stat-value" style="font-size:17px">${esc(scan.Computer)} / ${esc(scan.User)}</div>
        <div class="stat-sub">${esc(scan.OS)} · ${fmtDate(scan.GeneratedAt)}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">孤立卸载记录</div>
        <div class="panel-sub">${fmtCount(uninstall.length)} 项 · 仅诊断，不会自动修改注册表</div>
      </div>
      <div class="table-wrap list-scroll">
        <table>
          <thead><tr><th>应用</th><th>版本</th><th>安装位置</th><th>卸载命令</th></tr></thead>
          <tbody>
            ${uninstall.length === 0 ? '<tr><td colspan="4" class="empty-row">没有发现</td></tr>' : uninstall.map((entry) => `
              <tr>
                <td class="cell-name">${esc(entry.DisplayName)}</td>
                <td>${esc(entry.DisplayVersion || '—')}</td>
                <td class="file-path">${esc(entry.InstallLocation || '—')}</td>
                <td class="file-path">${esc(entry.UninstallString || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">失效启动项</div>
        <div class="panel-sub">${fmtCount(runKeys.length)} 项</div>
      </div>
      <div class="table-wrap list-scroll">
        <table>
          <thead><tr><th>名称</th><th>位置</th><th>命令</th></tr></thead>
          <tbody>
            ${runKeys.length === 0 ? '<tr><td colspan="3" class="empty-row">没有发现</td></tr>' : runKeys.map((entry) => `
              <tr>
                <td class="cell-name">${esc(entry.Name)}</td>
                <td class="file-path">${esc(entry.Key)}</td>
                <td class="file-path">${esc(entry.Command)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">孤立 Store 应用数据</div>
        <div class="panel-sub">${fmtCount(appx.length)} 项</div>
      </div>
      <div class="table-wrap list-scroll">
        <table>
          <thead><tr><th>包名</th><th class="num">大小</th></tr></thead>
          <tbody>
            ${appx.length === 0 ? '<tr><td colspan="2" class="empty-row">没有发现</td></tr>' : appx.map((entry) => `
              <tr><td class="file-path">${esc(entry.Package)}</td><td class="num">${fmtMB(entry.SizeMB)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* view router                                                         */
/* ------------------------------------------------------------------ */

function renderView() {
  const host = $('view');
  if (!state.scan && state.activeTab !== 'overview') {
    host.innerHTML = '';
    return;
  }
  switch (state.activeTab) {
    case 'overview':
      host.innerHTML = renderOverviewPage();
      break;
    case 'drives':
      host.innerHTML = renderDrives();
      break;
    case 'apps':
      host.innerHTML = renderApps();
      break;
    case 'ai':
      host.innerHTML = renderAI();
      break;
    case 'clean':
    default:
      host.innerHTML = renderClean();
      break;
  }
  updateActionBar();
  if (state.activeTab === 'apps') updateAppsSelectionUi();
}

function renderViewKeepingFocus(inputId) {
  const previous = $(inputId);
  const position = previous && typeof previous.selectionStart === 'number' ? previous.selectionStart : null;
  renderView();
  const next = $(inputId);
  if (next) {
    next.focus();
    if (position !== null) {
      try { next.setSelectionRange(position, position); } catch { /* ignore */ }
    }
  }
}

function updateActionBar() {
  const bar = $('actionbar');
  const selected = selectedItems();
  if (state.activeTab !== 'clean' || selected.length === 0 || !state.scan) {
    bar.classList.add('hidden');
    return;
  }
  const totalGB = sumBy(selected, junkGB);
  $('selectionInfo').innerHTML = `已选 <b>${fmtCount(selected.length)}</b> 项 · <b>${fmtGB(totalGB)} GB</b>`;
  bar.classList.remove('hidden');
}

/* ------------------------------------------------------------------ */
/* empty state                                                         */
/* ------------------------------------------------------------------ */

function renderEmptyState(message) {
  $('tabs').innerHTML = '';
  $('view').innerHTML = '';
  $('scanHistoryBar')?.classList.add('hidden');
  $('actionbar').classList.add('hidden');
  const host = $('emptyState');
  host.classList.remove('hidden');
  host.innerHTML = `
    <div>
      <h2>${esc(message)}</h2>
      <p>运行一次扫描后，就可以在这里挑选项目并清理。</p>
      <button class="btn primary" data-action="new-scan">＋ 新建扫描</button>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* events                                                              */
/* ------------------------------------------------------------------ */

function wireEvents() {
  $('scanPicker').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleScanMenu();
  });
  $('scanMenu').addEventListener('click', (event) => {
    const item = event.target.closest('[data-scan-id]');
    if (!item) return;
    toggleScanMenu(false);
    loadScan(item.dataset.scanId);
  });
  $('adminBadge').addEventListener('click', (event) => {
    event.stopPropagation();
    $('adminMenu').classList.toggle('hidden');
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.scan-picker')) toggleScanMenu(false);
    if (!event.target.closest('.sidebar-brand')) $('adminMenu').classList.add('hidden');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      toggleScanMenu(false);
      $('adminMenu').classList.add('hidden');
    }
  });

  $('refreshBtn').addEventListener('click', () => loadScans());
  $('newScanBtn').addEventListener('click', openNewScanModal);

  const jobBar = $('jobBar');
  const showDetails = () => { if (state.job) openJobDetails(); };
  jobBar.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    showDetails();
  });
  jobBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showDetails();
    }
  });
  $('jobBarDetailsBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    showDetails();
  });
  $('jobBarCloseBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    state.jobBarHidden = true;
    renderJobBar();
  });
  $('clearSelectionBtn').addEventListener('click', () => {
    state.selection.clear();
    renderView();
  });
  $('previewBtn').addEventListener('click', startPreview);

  $('tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    state.activeTab = tab.dataset.tab;
    scrollContentTop();
    if (state.activeTab === 'ai' && state.aiPlansScanId !== state.scanId) {
      loadAiPlans();
      return;
    }
    if (state.activeTab === 'apps' && state.appInsightsScanId !== state.scanId) {
      loadAppInsights();
      return;
    }
    renderTabs();
    renderView();
  });

  $('view').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const name = action.dataset.action;

    if (name === 'select-safe') {
      state.scan.Junk.forEach((item, index) => {
        if (item.Safety === 'safe') state.selection.add(index);
      });
      renderView();
    } else if (name === 'clear-selection') {
      state.selection.clear();
      renderView();
    } else if (name === 'show-more-apps') {
      state.appLimit += 60;
      renderView();
    } else if (name === 'app-filter') {
      state.appFilter = action.dataset.filter || 'all';
      state.appLimit = 60;
      renderView();
    } else if (name === 'refresh-app-insights') {
      loadAppInsights({ force: true });
    } else if (name === 'refresh-system') {
      loadSystem(true);
      toast('正在刷新硬件信息…', 'info', 2000);
    } else if (name === 'copy-analysis-ai') {
      copyAnalysisPrompt();
    } else if (name === 'refresh-ai') {
      loadAiPlans({ force: true });
    } else if (name === 'copy-all-ai') {
      copyAllAiPlans();
    } else if (name === 'copy-ai') {
      const plan = (state.aiPlans || []).find((entry) => entry.id === action.dataset.planId);
      if (plan) copyAiPlan(plan);
    } else if (name === 'ignore-ai') {
      const planId = action.dataset.planId;
      if (planId) {
        state.ignoredAi.add(planId);
        saveIgnoredAi();
        renderTabs();
        renderView();
        toast('已忽略该建议；下次打开此扫描仍会保持忽略', 'info');
      }
    } else if (name === 'restore-ignored-ai') {
      state.ignoredAi.clear();
      saveIgnoredAi();
      renderTabs();
      renderView();
      toast('已恢复被忽略的建议', 'ok');
    } else if (name === 'reset-ai') {
      const planId = action.dataset.planId;
      delete state.aiPrompts[planId];
      renderView();
    } else if (name === 'update-selected-apps') {
      showUpdateSelectedModal();
    } else if (name === 'uninstall-selected-apps') {
      showUninstallSelectedModal();
    } else if (name === 'uninstall-app') {
      const index = Number(action.dataset.index);
      const app = state.scan?.InstalledApps?.[index];
      if (app) showUninstallConfirm(app, index);
    }
  });

  $('view').addEventListener('change', (event) => {
    const target = event.target;
    if (target.id === 'appsSelectAll') {
      const checked = target.checked;
      document.querySelectorAll('input[data-app-idx]').forEach((box) => {
        box.checked = checked;
        const index = Number(box.dataset.appIdx);
        if (checked) state.appSelection.add(index);
        else state.appSelection.delete(index);
        const row = box.closest('tr');
        if (row) row.classList.toggle('selected', checked);
      });
      updateAppsSelectionUi();
      return;
    }
    if (target.matches('input[data-app-idx]')) {
      const index = Number(target.dataset.appIdx);
      if (target.checked) state.appSelection.add(index);
      else state.appSelection.delete(index);
      const row = target.closest('tr');
      if (row) row.classList.toggle('selected', target.checked);
      updateAppsSelectionUi();
      return;
    }
    if (target.matches('input[type="checkbox"][data-idx]')) {
      const index = Number(target.dataset.idx);
      if (target.checked) state.selection.add(index);
      else state.selection.delete(index);
      const row = target.closest('tr');
      if (row) row.classList.toggle('selected', target.checked);
      updateActionBar();
      return;
    }
    if (target.id === 'cleanSafety') {
      state.filters.safety = target.value;
      renderView();
    } else if (target.id === 'cleanCategory') {
      state.filters.category = target.value;
      renderView();
    } else if (target.id === 'cleanSort') {
      state.filters.sort = target.value;
      renderView();
    }
  });

  $('view').addEventListener('input', (event) => {
    if (event.target.id === 'cleanSearch') {
      state.filters.query = event.target.value;
      renderViewKeepingFocus('cleanSearch');
    } else if (event.target.id === 'appSearch') {
      state.appQuery = event.target.value;
      renderViewKeepingFocus('appSearch');
    } else if (event.target.matches('textarea[data-prompt-id]')) {
      state.aiPrompts[event.target.dataset.promptId] = event.target.value;
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="new-scan"]')) openNewScanModal();
    const relaunch = event.target.closest('[data-action="admin-relaunch"]');
    if (relaunch) {
      relaunchAdmin(relaunch.dataset.admin === 'true');
    }
  });
}

/* ------------------------------------------------------------------ */
/* modals                                                              */
/* ------------------------------------------------------------------ */

function showModal({ title, subtitle = '', body = '', actions = [], narrow = false, onMount = null }) {
  const root = $('modalRoot');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal${narrow ? ' narrow' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-title">${esc(title)}</div>
          ${subtitle ? `<div class="modal-sub">${esc(subtitle)}</div>` : ''}
        </div>
        <button class="icon-btn" data-close title="关闭">×</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">
        ${actions.map((action, index) => `<button class="btn ${action.kind || 'ghost'}" data-action-index="${index}" ${action.disabled ? 'disabled' : ''}>${esc(action.label)}</button>`).join('')}
      </div>
    </div>
  `;

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector('[data-close]').addEventListener('click', close);

  actions.forEach((action, index) => {
    const button = backdrop.querySelector(`[data-action-index="${index}"]`);
    button.addEventListener('click', async () => {
      if (!action.onClick) {
        close();
        return;
      }
      button.disabled = true;
      try {
        await action.onClick({ close, backdrop, button });
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });

  root.appendChild(backdrop);
  if (onMount) onMount({ backdrop, close });
  return { close, backdrop };
}

function openNewScanModal() {
  const systemDrive = state.health?.systemDrive || 'C:';
  let driveList = Array.isArray(state.drives) && state.drives.length > 0
    ? state.drives
    : (state.scan?.Drives || []).map((drive) => ({
        id: drive.Id,
        totalGB: drive.TotalGB,
        freeGB: drive.FreeGB,
        system: drive.Id === systemDrive
      }));
  if (driveList.length === 0) {
    driveList = [{ id: systemDrive, totalGB: 0, freeGB: 0, system: true }];
  }

  showModal({
    title: '新建扫描',
    subtitle: '支持多盘同时扫描；扫描只读，不会修改任何文件',
    narrow: true,
    body: `
      <div class="form-grid">
        <div class="field">
          <div class="field-label-row">
            <label>选择磁盘</label>
            <div class="mini-actions">
              <button type="button" class="link-btn" data-drive-select="all">全选</button>
              <button type="button" class="link-btn" data-drive-select="none">全不选</button>
            </div>
          </div>
          <div class="drive-options">
            ${driveList.map((drive) => `
              <label class="drive-option">
                <input type="checkbox" name="drive" value="${esc(drive.id)}" checked>
                <span>
                  <b>${esc(drive.id)}</b>${drive.system ? ' · 系统盘' : ''}<br>
                  <small>${num(drive.totalGB) > 0 ? `空闲 ${fmtGB(drive.freeGB)} / ${fmtGB(drive.totalGB)} GB` : '固定磁盘'}</small>
                </span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="field">
          <label>排除目录（可选，逗号分隔）</label>
          <input type="text" name="excludes" placeholder="例如 D:\\Games,E:\\Backup">
        </div>
        <label class="checkbox-row">
          <input type="checkbox" name="fast" checked>
          <span><b>快速模式</b><br>自动跳过 WinSxS、Windows\Installer、SoftwareDistribution、Package Cache，扫描更快。</span>
        </label>
        <label class="checkbox-row">
          <input type="checkbox" name="parallel">
          <span><b>并行扫描</b><br>多盘同时扫描。不同物理磁盘时更快；同一块磁盘可能更慢。</span>
        </label>
      </div>
    `,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: '开始扫描',
        kind: 'primary',
        onClick: async ({ close, backdrop }) => {
          const checked = [...backdrop.querySelectorAll('input[name="drive"]:checked')].map((input) => input.value);
          if (checked.length === 0) {
            toast('至少选择一个磁盘', 'error');
            throw new Error('至少选择一个磁盘');
          }
          const excludes = backdrop.querySelector('input[name="excludes"]').value
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
          const fast = backdrop.querySelector('input[name="fast"]').checked;
          const parallel = backdrop.querySelector('input[name="parallel"]').checked;

          close();
          try {
            const { jobId } = await api('/api/scan', {
              method: 'POST',
              body: { drives: checked, fast, parallel, excludes }
            });
            openJob(jobId, {
              title: '正在扫描',
              onDone: async (job) => {
                if (job.status !== 'done') {
                  toast(job.error || '扫描失败', 'error', 7000);
                  return;
                }
                toast('扫描完成', 'ok');
                await loadDrives();
                await loadScans(job.result?.scanId || null);
              }
            });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      }
    ],
    onMount: ({ backdrop }) => {
      const boxes = () => [...backdrop.querySelectorAll('input[name="drive"]')];
      backdrop.querySelectorAll('[data-drive-select]').forEach((button) => {
        button.addEventListener('click', () => {
          const selectAll = button.dataset.driveSelect === 'all';
          boxes().forEach((box) => { box.checked = selectAll; });
        });
      });
    }
  });
}

function showUninstallConfirm(app, index) {
  showModal({
    title: '卸载应用',
    subtitle: `${app.DisplayName}${app.DisplayVersion ? ` · ${app.DisplayVersion}` : ''}`,
    narrow: true,
    body: `
      <div class="note warn">
        将调用应用自带的卸载程序。卸载过程中可能弹出窗口，请按提示完成。个人文件通常不会被删除，但应用配置/缓存可能被清除。
      </div>
      <div class="summary-box" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="summary-cell"><div class="k">应用</div><div class="v" style="font-size:13px">${esc(app.DisplayName)}</div></div>
        <div class="summary-cell"><div class="k">发行商</div><div class="v" style="font-size:13px">${esc(app.Publisher || '—')}</div></div>
      </div>
      <div class="field">
        <label>安装位置</label>
        <div class="mono">${esc(app.InstallLocation || '—')}</div>
      </div>
      <label class="checkbox-row" style="margin-top:14px">
        <input type="checkbox" id="uninstallCheck">
        <span>我确认卸载 <b>${esc(app.DisplayName)}</b>，并理解需要自己完成可能弹出的卸载向导。</span>
      </label>
    `,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: '开始卸载',
        kind: 'danger',
        disabled: true,
        onClick: async ({ close }) => {
          close();
          try {
            const { jobId } = await api('/api/apps/uninstall', {
              method: 'POST',
              body: { scan: state.scanId, index, confirm: true }
            });
            openJob(jobId, {
              title: `卸载 ${app.DisplayName}`,
              onDone: (job) => {
                if (job.status !== 'done') {
                  toast(job.error || '卸载失败', 'error', 9000);
                  return;
                }
                const result = job.result || {};
                if (result.Status === 'failed') {
                  toast(result.Message || '卸载程序启动失败', 'error', 9000);
                  return;
                }
                showUninstallResult(app, result);
              }
            });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      }
    ],
    onMount: ({ backdrop }) => {
      const check = backdrop.querySelector('#uninstallCheck');
      const start = backdrop.querySelector('[data-action-index="1"]');
      check.addEventListener('change', () => { start.disabled = !check.checked; });
    }
  });
}

function showUninstallResult(app, result) {
  const started = result.Status === 'started';
  showModal({
    title: started ? '卸载程序已启动' : '卸载程序已结束',
    subtitle: app.DisplayName,
    narrow: true,
    body: `
      <div class="note ${started ? 'warn' : ''}">${esc(result.Message || (started ? '请在弹出的卸载窗口中完成操作。' : '卸载程序已退出。'))}</div>
      <div class="field" style="margin-top:14px"><label>命令</label><div class="mono">${esc(result.Executable || '—')} ${esc(result.Arguments || '')}</div></div>
      <div class="note" style="margin-top:12px">应用列表来自上一次扫描，卸载完成后建议重新扫描以更新。</div>
    `,
    actions: [
      { label: '完成', kind: 'ghost' },
      {
        label: '重新扫描',
        kind: 'primary',
        onClick: ({ close }) => {
          close();
          openNewScanModal();
        }
      }
    ]
  });
}

/* ------------------------------------------------------------------ */
/* cleanup flow                                                        */
/* ------------------------------------------------------------------ */

async function startPreview() {
  const items = selectedItems();
  if (items.length === 0) {
    toast('先选择要清理的项目', 'info');
    return;
  }

  try {
    const { jobId } = await api('/api/clean/preview', {
      method: 'POST',
      body: { scan: state.scanId, paths: items.map((item) => item.Path) }
    });
    openJob(jobId, {
      title: '清理预览',
      onDone: (job) => {
        if (job.status !== 'done') {
          toast(job.error || '预览失败', 'error', 7000);
          return;
        }
        showPreviewResult(job.result);
      }
    });
  } catch (error) {
    toast(error.message, 'error');
  }
}

function showPreviewResult(result) {
  const items = Array.isArray(result?.Items) ? result.Items : [];
  const wouldClean = items.filter((item) => item.Status === 'would-clean');
  const skipped = items.filter((item) => item.Status === 'skipped');
  const failed = items.filter((item) => item.Status === 'failed');
  const totalMB = sumBy(wouldClean, (item) => item.SizeMB);

  const body = `
    <div class="summary-box">
      <div class="summary-cell"><div class="k">可清理</div><div class="v good-text">${fmtCount(wouldClean.length)} 项</div></div>
      <div class="summary-cell"><div class="k">预计释放</div><div class="v">${fmtMB(totalMB)}</div></div>
      <div class="summary-cell"><div class="k">跳过</div><div class="v warn-text">${fmtCount(skipped.length)} 项</div></div>
    </div>
    ${result.IsAdmin ? '' : '<div class="note warn">当前不是管理员权限，标记为 elevated 的系统缓存会被跳过。</div>'}
    <div class="list-scroll" style="margin-top:12px">
      <table>
        <thead><tr><th>项目</th><th>状态</th><th class="num">当前大小</th><th>说明</th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>
                <div class="cell-name">${esc(item.Name)}</div>
                <span class="cell-path" title="${esc(item.Path)}">${esc(item.Path)}</span>
              </td>
              <td><span class="job-item-status ${esc(item.Status)}">${esc(STATUS_LABELS[item.Status] || item.Status)}</span></td>
              <td class="num">${fmtMB(item.SizeMB)}</td>
              <td class="cell-reason">${esc(detailText(item.Detail))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${failed.length > 0 ? `<div class="note warn" style="margin-top:12px">${fmtCount(failed.length)} 项在预览阶段失败，请检查路径权限。</div>` : ''}
  `;

  showModal({
    title: '清理预览',
    subtitle: '实际执行前还会再次校验管理员权限与受保护路径',
    body,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: `执行清理${wouldClean.length ? `（${fmtCount(wouldClean.length)} 项）` : ''}`,
        kind: 'danger',
        disabled: wouldClean.length === 0,
        onClick: ({ close }) => {
          close();
          showExecuteConfirm(wouldClean, result);
        }
      }
    ]
  });
}

function showExecuteConfirm(items, preview) {
  const risky = items.filter((item) => item.Safety === 'confirm');
  const totalMB = sumBy(items, (item) => item.SizeMB);
  const freedBefore = num(preview?.FreeBeforeGB);

  showModal({
    title: '确认清理',
    subtitle: '此操作不可撤销，请确认选择',
    narrow: true,
    body: `
      <div class="note warn">
        即将永久删除 <b>${fmtCount(items.length)}</b> 项，预计释放 <b>${fmtMB(totalMB)}</b>。
        ${risky.length > 0 ? `其中 <b>${fmtCount(risky.length)}</b> 项标记为“需确认”，请逐项核对。` : ''}
      </div>
      <div class="summary-box" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="summary-cell"><div class="k">清理项</div><div class="v">${fmtCount(items.length)}</div></div>
        <div class="summary-cell"><div class="k">预计释放</div><div class="v">${fmtMB(totalMB)}</div></div>
      </div>
      <div class="list-scroll">
        <table>
          <thead><tr><th>项目</th><th>等级</th><th class="num">大小</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>
                  <div class="cell-name">${esc(item.Name)}</div>
                  <span class="cell-path" title="${esc(item.Path)}">${esc(item.Path)}</span>
                </td>
                <td><span class="badge ${esc(item.Safety)}">${esc(SAFETY_LABELS[item.Safety] || item.Safety)}</span></td>
                <td class="num">${fmtMB(item.SizeMB)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${risky.length > 0 ? `<div class="note warn" style="margin-top:12px">需确认项：${risky.map((item) => esc(item.Name)).join('、')}</div>` : ''}
      <div style="display:grid;gap:8px;margin-top:14px">
        <label class="checkbox-row">
          <input type="checkbox" id="confirmCheck">
          <span>我确认清理以上项目，并理解该操作无法撤销。</span>
        </label>
        ${risky.length > 0 ? `
          <label class="checkbox-row">
            <input type="checkbox" id="riskyCheck">
            <span>我已核对标记为“需确认”的项目（例如旧安装包、孤立残留、回收站）。</span>
          </label>
        ` : ''}
      </div>
      <div class="note" style="margin-top:12px">清理前系统盘空闲：${fmtGB(freedBefore)} GB。执行结果会写入 CSV manifest。</div>
    `,
    actions: [
      { label: '取消', kind: 'ghost' },
      {
        label: '开始清理',
        kind: 'danger',
        disabled: true,
        onClick: async ({ close }) => {
          close();
          try {
            const { jobId } = await api('/api/clean/execute', {
              method: 'POST',
              body: {
                scan: state.scanId,
                paths: items.map((item) => item.Path),
                confirm: true,
                acknowledgeRisky: risky.length > 0
              }
            });
            openJob(jobId, {
              title: '正在清理',
              onDone: (job) => {
                if (job.status !== 'done') {
                  toast(job.error || '清理失败', 'error', 8000);
                  return;
                }
                state.selection.clear();
                renderView();
                toast(`清理完成，释放 ${fmtMB(job.result?.CleanedMB)}`, 'ok', 6000);
                showCleanResult(job.result);
              }
            });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      }
    ],
    onMount: ({ backdrop }) => {
      const confirmCheck = backdrop.querySelector('#confirmCheck');
      const riskyCheck = backdrop.querySelector('#riskyCheck');
      const startButton = backdrop.querySelector('[data-action-index="1"]');
      const sync = () => {
        startButton.disabled = !confirmCheck.checked || (riskyCheck ? !riskyCheck.checked : false);
      };
      confirmCheck.addEventListener('change', sync);
      if (riskyCheck) riskyCheck.addEventListener('change', sync);
    }
  });
}

function showCleanResult(result) {
  const items = Array.isArray(result?.Items) ? result.Items : [];
  const cleaned = items.filter((item) => item.Status === 'cleaned');
  const failed = items.filter((item) => item.Status === 'failed');
  const skipped = items.filter((item) => item.Status === 'skipped');
  const freedDelta = num(result?.FreeAfterGB) - num(result?.FreeBeforeGB);

  showModal({
    title: '清理完成',
    subtitle: result?.ManifestPath ? '已生成 manifest.csv' : '',
    body: `
      <div class="summary-box">
        <div class="summary-cell"><div class="k">已清理</div><div class="v good-text">${fmtCount(cleaned.length)} 项</div></div>
        <div class="summary-cell"><div class="k">名义释放</div><div class="v">${fmtMB(result?.CleanedMB)}</div></div>
        <div class="summary-cell"><div class="k">系统盘实际变化</div><div class="v ${freedDelta >= 0 ? 'good-text' : 'warn-text'}">${freedDelta >= 0 ? '+' : ''}${fmtGB(freedDelta)} GB</div></div>
      </div>
      <div class="note">系统盘空闲：${fmtGB(result?.FreeBeforeGB)} GB → ${fmtGB(result?.FreeAfterGB)} GB。扫描结果中的体积不会自动更新，建议重新扫描。</div>
      ${failed.length > 0 ? `<div class="note warn" style="margin-top:10px">${fmtCount(failed.length)} 项失败：${failed.map((item) => esc(item.Name)).join('、')}</div>` : ''}
      ${skipped.length > 0 ? `<div class="note warn" style="margin-top:10px">${fmtCount(skipped.length)} 项跳过（权限或受保护路径）。</div>` : ''}
      ${result?.ManifestPath ? `<div class="field" style="margin-top:14px"><label>Manifest</label><div class="mono">${esc(result.ManifestPath)}</div></div>` : ''}
      <div class="list-scroll" style="margin-top:14px">
        <table>
          <thead><tr><th>项目</th><th>状态</th><th class="num">大小</th><th>说明</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>
                  <div class="cell-name">${esc(item.Name)}</div>
                  <span class="cell-path" title="${esc(item.Path)}">${esc(item.Path)}</span>
                </td>
                <td><span class="job-item-status ${esc(item.Status)}">${esc(STATUS_LABELS[item.Status] || item.Status)}</span></td>
                <td class="num">${fmtMB(item.SizeMB)}</td>
                <td class="cell-reason">${esc(detailText(item.Detail))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `,
    actions: [
      {
        label: '打开报告文件夹',
        kind: 'ghost',
        disabled: !result?.ManifestPath,
        onClick: async () => {
          try {
            await api('/api/open', { method: 'POST', body: { path: result.ManifestPath } });
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      },
      { label: '完成', kind: 'primary' }
    ]
  });
}

/* ------------------------------------------------------------------ */
/* job drawer                                                          */
/* ------------------------------------------------------------------ */

let activeEventSource = null;
let pollTimer = null;

function closeJobStream() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function openJob(jobId, { title, onDone }) {
  closeJobStream();
  closeJobDetails();
  state.currentJob = { id: jobId, onDone };
  state.jobSnapshotApplied = false;
  state.jobBarHidden = false;
  state.job = {
    id: jobId,
    title: title || '任务',
    kind: 'job',
    status: 'running',
    progress: { current: 0, total: 0, label: '准备中', indeterminate: true },
    logs: [],
    items: [],
    result: null,
    error: null
  };
  renderJobBar();

  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
  activeEventSource = source;

  source.addEventListener('snapshot', (event) => {
    applyJobSnapshot(JSON.parse(event.data));
  });

  source.addEventListener('log', (event) => {
    if (!state.job) return;
    state.job.logs.push(JSON.parse(event.data));
    if (state.job.logs.length > 4000) state.job.logs.splice(0, state.job.logs.length - 4000);
    renderJobDetails();
  });

  source.addEventListener('item', (event) => {
    if (!state.job) return;
    state.job.items.push(JSON.parse(event.data));
    renderJobBar();
    renderJobDetails();
  });

  source.addEventListener('progress', (event) => {
    if (!state.job) return;
    state.job.progress = { ...state.job.progress, ...JSON.parse(event.data) };
    renderJobBar();
    renderJobDetails();
  });

  source.addEventListener('done', (event) => {
    const job = JSON.parse(event.data);
    source.close();
    if (activeEventSource === source) activeEventSource = null;
    applyJobSnapshot(job);
    if (state.currentJob && state.currentJob.id === job.id && onDone) {
      const callback = onDone;
      state.currentJob = null;
      callback(job);
    }
  });

  source.addEventListener('error', () => {
    if (source.readyState === EventSource.CLOSED) {
      source.close();
      if (activeEventSource === source) activeEventSource = null;
      pollJob(jobId, onDone);
    }
  });
}

async function pollJob(jobId, onDone) {
  if (pollTimer) clearTimeout(pollTimer);
  let finished = false;
  const tick = async () => {
    if (finished) return;
    try {
      const job = await api(`/api/jobs/${encodeURIComponent(jobId)}`);
      applyJobSnapshot(job);
      if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
        finished = true;
        if (state.currentJob && state.currentJob.id === job.id && onDone) {
          const callback = onDone;
          state.currentJob = null;
          callback(job);
        }
        return;
      }
    } catch {
      // keep polling
    }
    pollTimer = setTimeout(tick, 1200);
  };
  pollTimer = setTimeout(tick, 1200);
}

function applyJobSnapshot(job) {
  state.job = {
    id: job.id,
    title: job.title || state.job?.title || '任务',
    kind: job.kind || 'job',
    status: job.status,
    progress: job.progress || state.job?.progress || { current: 0, total: 0, label: '', indeterminate: true },
    logs: Array.isArray(job.logs) ? job.logs : [],
    items: Array.isArray(job.items) ? job.items : [],
    result: job.result,
    error: job.error
  };
  renderJobBar();
  renderJobDetails();
}

function renderJobBar() {
  const bar = $('jobBar');
  const job = state.job;
  if (!job || state.jobBarHidden) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  bar.dataset.status = job.status;
  $('jobBarTitle').textContent = job.title;

  const progress = job.progress || {};
  const total = Number(progress.total) || 0;
  const current = Number(progress.current) || 0;
  const percent = job.status === 'done' ? 100 : total > 0 ? Math.min(100, (current / total) * 100) : 0;

  const fill = $('jobBarFill');
  fill.style.width = `${percent}%`;
  fill.classList.toggle('indeterminate', job.status === 'running' && total === 0);

  const meta = [];
  if (progress.label) meta.push(progress.label);
  if (total > 0) meta.push(`${fmtCount(Math.min(current, total))} / ${fmtCount(total)}`);
  if (job.status === 'done') meta.push('完成');
  if (job.status === 'cancelled') meta.push('已取消');
  if (job.status === 'failed') meta.push(`失败：${job.error || '未知错误'}`);
  $('jobBarMeta').textContent = meta.join(' · ');

  const iconHost = $('jobBarIcon');
  if (job.status === 'running') {
    iconHost.innerHTML = '<span class="spinner"></span>';
  } else if (job.status === 'done') {
    iconHost.innerHTML = icon('check', 15);
  } else {
    iconHost.innerHTML = icon('close', 15);
  }
}

function openJobDetails() {
  if (!state.job) return;
  if (state.jobModal && state.jobModal.backdrop?.isConnected) state.jobModal.close();
  state.jobModal = showModal({
    title: state.job.title,
    subtitle: '任务详情',
    body: `
      <div id="jobDetailStatus" class="job-status"></div>
      <div class="job-detail-progress"><div class="bar"><span id="jobDetailFill"></span></div></div>
      <div id="jobDetailMeta" class="job-detail-meta"></div>
      <div id="jobDetailItems" class="job-items"></div>
      <pre id="jobDetailLog" class="job-log"></pre>
      <div id="jobDetailActions" class="job-detail-actions"></div>
    `,
    actions: [{ label: '关闭', kind: 'ghost' }]
  });
  renderJobDetails();
}

function closeJobDetails() {
  if (state.jobModal) {
    if (state.jobModal.backdrop?.isConnected) state.jobModal.close();
    state.jobModal = null;
  }
}

function renderJobDetails() {
  const modal = state.jobModal;
  if (!modal || !modal.backdrop?.isConnected) {
    state.jobModal = null;
    return;
  }
  const job = state.job;
  if (!job) return;

  const statusHost = modal.backdrop.querySelector('#jobDetailStatus');
  if (statusHost) {
    if (job.status === 'running') {
      statusHost.innerHTML = '<span class="spinner"></span><span>正在运行…</span>';
    } else if (job.status === 'done') {
      statusHost.innerHTML = '<span class="good-text">完成</span>';
    } else if (job.status === 'failed') {
      statusHost.innerHTML = `<span class="danger-text">失败：${esc(job.error || '未知错误')}</span>`;
    } else {
      statusHost.innerHTML = '<span class="warn-text">已取消</span>';
    }
  }

  const progress = job.progress || {};
  const total = Number(progress.total) || 0;
  const current = Number(progress.current) || 0;
  const full = job.status === 'done' ? 100 : total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const fill = modal.backdrop.querySelector('#jobDetailFill');
  if (fill) {
    fill.style.width = `${full}%`;
    fill.classList.toggle('indeterminate', job.status === 'running' && total === 0);
  }
  const meta = modal.backdrop.querySelector('#jobDetailMeta');
  if (meta) {
    const bits = [];
    if (progress.label) bits.push(progress.label);
    if (total > 0) bits.push(`${fmtCount(Math.min(current, total))} / ${fmtCount(total)}`);
    meta.textContent = bits.join(' · ');
  }

  const itemsHost = modal.backdrop.querySelector('#jobDetailItems');
  if (itemsHost) {
    const items = job.items.slice(-300);
    itemsHost.innerHTML = items.length === 0
      ? ''
      : items.map((item) => `
          <div class="job-item">
            <span class="job-item-name" title="${esc(item.Path)}">${esc(item.Name)}</span>
            <span class="job-item-status ${esc(item.Status)}">${esc(STATUS_LABELS[item.Status] || item.Status)}</span>
            <span class="mono">${fmtMB(item.SizeMB)}</span>
          </div>
        `).join('');
  }

  const log = modal.backdrop.querySelector('#jobDetailLog');
  if (log) {
    const text = job.logs.map((entry) => `${entry.stream === 'stderr' ? '! ' : ''}${entry.line}`).join('\n');
    log.textContent = text.length > 60000 ? text.slice(-50000) : text;
    log.scrollTop = log.scrollHeight;
  }

  const actionsHost = modal.backdrop.querySelector('#jobDetailActions');
  if (actionsHost) {
    actionsHost.innerHTML = '';
    if (job.status === 'running') {
      const cancel = document.createElement('button');
      cancel.className = 'btn ghost small';
      cancel.textContent = '取消任务';
      cancel.addEventListener('click', async () => {
        cancel.disabled = true;
        try {
          await api(`/api/jobs/${encodeURIComponent(job.id)}/cancel`, { method: 'POST', body: {} });
        } catch (error) {
          toast(error.message, 'error');
          cancel.disabled = false;
        }
      });
      actionsHost.appendChild(cancel);
    }
    if (job.result?.scanId) {
      const view = document.createElement('button');
      view.className = 'btn primary small';
      view.textContent = '查看扫描结果';
      view.addEventListener('click', async () => {
        closeJobDetails();
        await loadScans(job.result.scanId);
      });
      actionsHost.appendChild(view);
    }
  }
}

init();
