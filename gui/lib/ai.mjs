import path from 'node:path';

const MEDIA_VIDEO_RE = /video|movie|视频|影片|素材|dcim|camera/i;
const MEDIA_PHOTO_RE = /photo|picture|image|dcim|camera|相册|照片|图片/i;
const MEDIA_ANY_RE = /video|movie|photo|picture|image|dcim|camera|视频|影片|相册|照片|图片|素材/i;
const MEDIA_EXT_RE = /\.(mp4|mov|avi|mkv|wmv|m4v|flv|webm|jpg|jpeg|png|heic|heif|cr3|cr2|nef|arw|dng|tif|tiff)$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|avi|mkv|wmv|m4v|flv|webm)$/i;
const BLOCKED_MEDIA_ROOT_RE = /^(appdata|onedrive|iclouddrive|xwechat_files|wechat files|program files|program files \(x86\)|windows|programdata)$/i;

/**
 * AI suggestions are always grouped into these three buckets, in this order.
 * Keep the labels in sync with gui/public/app.js.
 */
export const AI_CATEGORY_ORDER = ['media', 'engineering', 'cache'];

export const AI_CATEGORY_META = {
  media: { label: '媒体文件建议', skill: 'photo-organizer' },
  engineering: { label: '工程文件建议', skill: 'storage-strategy' },
  cache: { label: '缓存管理文件建议', skill: 'disk-cleanup' }
};

const MEDIA_FINDING_IDS = new Set([
  'media-system',
  'media-unorganized',
  'media-scattered',
  'large-archives'
]);

const ENGINEERING_FINDING_IDS = new Set([
  'workspace-scattered',
  'workspace-large',
  'large-files',
  'reparse-many'
]);

const CACHE_FINDING_IDS = new Set([
  'junk-high',
  'installer-stale',
  'confirm-review',
  'hiberfil-large',
  'temp-large-folders',
  'empty-dirs',
  'downloads-scattered',
  'downloads-large',
  'apps-large',
  'orphans'
]);

function categoryRank(category) {
  const index = AI_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? AI_CATEGORY_ORDER.length : index;
}

function findingCategory(finding) {
  const id = String(finding?.Id || '');
  if (MEDIA_FINDING_IDS.has(id) || id.startsWith('media-')) return 'media';
  if (ENGINEERING_FINDING_IDS.has(id) || id.startsWith('workspace-')) return 'engineering';
  if (CACHE_FINDING_IDS.has(id) || id.startsWith('free-')) return 'cache';
  if (id.startsWith('cloud-')) return 'engineering';

  const raw = String(finding?.Category || '').toLowerCase();
  if (raw === 'media') return 'media';
  if (raw === 'path' || raw === 'review') return 'engineering';
  return 'cache';
}

const AUDIT_TITLES = {
  'free-system': '系统盘空间低于预算',
  'free-C:': '系统盘空间低于预算',
  'free-D:': '数据盘空间低于预算',
  'free-E:': '数据盘空间低于预算',
  'junk-high': '可清理数据超过预算',
  'installer-stale': '旧安装包占用',
  'confirm-review': '待确认清理项',
  'media-system': '媒体文件在系统盘',
  'media-unorganized': '媒体库未按年月归档',
  'media-scattered': '媒体目录分散',
  'workspace-scattered': '项目工作区分散',
  'workspace-large': '项目工作区体积偏大',
  'downloads-scattered': '下载目录分散',
  'downloads-large': '下载目录体积偏大',
  'large-archives': '大压缩包需要核对',
  'hiberfil-large': '休眠文件占用偏大',
  'temp-large-folders': '临时/重复命名的大目录',
  'empty-dirs': '空目录过多',
  'reparse-many': 'Junction / 符号链接过多',
  'large-files': '大文件需要定期复核',
  'apps-large': '应用占用偏高',
  orphans: '孤立应用记录'
};

function auditTitle(finding) {
  if (finding?.Id && AUDIT_TITLES[finding.Id]) return AUDIT_TITLES[finding.Id];
  if (finding?.Id?.startsWith('cloud-')) return '云占位目录';
  if (finding?.Id?.startsWith('free-')) return '磁盘空间低于预算';
  return finding?.Title || '空间策略建议';
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

function junkGB(item) {
  const gb = num(item?.SizeGB);
  if (gb > 0) return gb;
  return num(item?.SizeMB) / 1024;
}

function systemDrive() {
  return (process.env.SystemDrive || 'C:').toUpperCase();
}

function sourceDriveId(source) {
  const root = path.win32.parse(String(source || '')).root;
  return root.replace(/\\$/, '').toUpperCase();
}

function pickTargetDrive(source, drives) {
  const sourceId = sourceDriveId(source);
  const candidates = (Array.isArray(drives) ? drives : [])
    .filter((drive) => String(drive.id).toUpperCase() !== sourceId && num(drive.freeGB) > 0)
    .sort((a, b) => num(b.freeGB) - num(a.freeGB));
  return candidates[0] || null;
}

function systemFreeGB(scan, drives) {
  const id = systemDrive();
  const match = (Array.isArray(drives) ? drives : []).find((drive) => String(drive.id).toUpperCase() === id);
  if (match) return num(match.freeGB);
  const drive = (scan?.Drives || []).find((item) => String(item.Id).toUpperCase() === id);
  return num(drive?.FreeGB);
}

function isSingleDrive(drives) {
  return !(Array.isArray(drives) ? drives : []).some(
    (drive) => String(drive.id).toUpperCase() !== systemDrive() && num(drive.freeGB) > 0
  );
}

function mediaFolderPath(folder) {
  if (!folder?.Drive || !folder?.Folder) return '';
  return `${folder.Drive}\\${folder.Folder}`;
}

function isArchiveLikeFolder(folder) {
  const files = num(folder?.Files);
  const sizeGB = num(folder?.SizeGB);
  return files >= 2 && files < 50 && sizeGB >= 5 && (sizeGB / files) >= 5;
}

function normalizePathKey(value) {
  return String(value || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
}

/**
 * Collect media roots from the existing scan.
 *
 * `scan.Media.MediaFolders` only looks at top-level folder names. On machines
 * where photos/videos live under Desktop or localized folders that list is
 * empty, so we also derive roots from large media files that were already
 * scanned. Keeping this tied to scan data is important: the server uses the
 * same list as an execution allowlist.
 */
function collectMediaSources(scan) {
  const sources = new Map();
  const userRoot = scan?.User ? `${systemDrive()}\\Users\\${scan.User}` : '';
  const cloudPrefixes = [];
  for (const drive of scan?.Drives || []) {
    for (const cloud of drive.Cloud || []) {
      if (cloud?.Path) cloudPrefixes.push(normalizePathKey(cloud.Path));
    }
  }

  const add = (root, kind, sizeGB, knownSize, derived) => {
    if (!root) return;
    const key = normalizePathKey(root);
    let entry = sources.get(key);
    if (!entry) {
      entry = { path: root, sizeGB: 0, videoGB: 0, photoGB: 0, knownSize: false, derived: false };
      sources.set(key, entry);
    }
    if (kind === 'video' || kind === 'all') entry.videoGB += num(sizeGB);
    if (kind === 'photo' || kind === 'all') entry.photoGB += num(sizeGB);
    entry.sizeGB += num(sizeGB);
    entry.knownSize = entry.knownSize || Boolean(knownSize);
    entry.derived = entry.derived || Boolean(derived);
  };

  for (const folder of scan?.Media?.MediaFolders || []) {
    const root = mediaFolderPath(folder);
    if (!root) continue;
    const name = String(folder.Folder || '');
    const kind = MEDIA_VIDEO_RE.test(name) ? 'video' : MEDIA_PHOTO_RE.test(name) ? 'photo' : 'all';
    add(root, kind, folder.SizeGB, true, false);
  }

  if (!userRoot) return [...sources.values()].sort((a, b) => b.sizeGB - a.sizeGB);

  const userPrefix = `${normalizePathKey(userRoot)}\\`;
  for (const drive of scan?.Drives || []) {
    for (const file of drive.LargeFiles || []) {
      const filePath = String(file.Path || '');
      if (!MEDIA_EXT_RE.test(filePath)) continue;
      const normalized = normalizePathKey(filePath);
      if (!normalized.startsWith(userPrefix)) continue;
      if (cloudPrefixes.some((prefix) => normalized.startsWith(prefix))) continue;

      const parts = filePath.slice(userRoot.length + 1).split('\\');
      let rootRel = '';
      if (/^(pictures|videos)$/i.test(parts[0])) {
        rootRel = parts[0];
      } else if (/^desktop$/i.test(parts[0]) && parts.length >= 3) {
        rootRel = parts.slice(0, 2).join('\\');
      } else {
        continue;
      }
      if (BLOCKED_MEDIA_ROOT_RE.test(rootRel.split('\\')[0])) continue;

      const kind = VIDEO_EXT_RE.test(filePath) ? 'video' : 'photo';
      add(`${userRoot}\\${rootRel}`, kind, num(file.SizeMB) / 1024, false, true);
    }
  }

  return [...sources.values()].sort((a, b) => b.sizeGB - a.sizeGB);
}

function mediaCandidates(scan, kind) {
  const isVideo = kind === 'video';
  const matcher = isVideo ? MEDIA_VIDEO_RE : MEDIA_PHOTO_RE;
  const rawFolders = [...(Array.isArray(scan?.Media?.MediaFolders) ? scan.Media.MediaFolders : [])]
    .sort((a, b) => num(b.SizeGB) - num(a.SizeGB));
  const allFolders = rawFolders.filter((folder) => !isArchiveLikeFolder(folder));
  const folders = allFolders.filter((folder) => matcher.test(String(folder?.Folder || '')));

  if (folders[0]) {
    return [{ path: mediaFolderPath(folders[0]), sizeGB: num(folders[0].SizeGB), knownSize: true, derived: false }];
  }
  if (allFolders[0]) {
    // The scan does not split a generic media root by file type. Point at the
    // largest media root and measure the real files during preview.
    return [{ path: mediaFolderPath(allFolders[0]), sizeGB: 0, knownSize: false, derived: false }];
  }
  if (rawFolders.length > 0) {
    // Only archive-like roots remain (for example a large ZIP folder). Do not
    // pretend the global media total belongs to them.
    return [];
  }

  const derived = collectMediaSources(scan)
    .filter((source) => (isVideo ? source.videoGB : source.photoGB) >= 1)
    .sort((a, b) => num(isVideo ? b.videoGB : b.photoGB) - num(isVideo ? a.videoGB : a.photoGB))
    .slice(0, 3)
    .map((source) => ({
      path: source.path,
      sizeGB: num(isVideo ? source.videoGB : source.photoGB),
      knownSize: false,
      derived: true
    }));
  if (derived.length > 0) return derived;

  if (!scan.User) return [];
  return [{
    path: `${systemDrive()}\\Users\\${scan.User}\\${isVideo ? 'Videos' : 'Pictures'}`,
    sizeGB: 0,
    knownSize: false,
    derived: false
  }];
}

function makeMediaPlan(scan, drives, kind, candidate, index = 0) {
  const isVideo = kind === 'video';
  const source = String(candidate?.path || '');
  if (!source) return null;
  const kindTotalGB = num(isVideo ? scan.Media?.VideoGB : scan.Media?.PhotoGB);
  if (kindTotalGB < 0.5 && !candidate.derived) return null;

  const knownSize = Boolean(candidate.knownSize) && num(candidate.sizeGB) > 0;
  const sourceGB = round2(candidate.sizeGB);
  const target = pickTargetDrive(source, drives);
  const singleDrive = !target;
  if (singleDrive && !scan.User) return null;

  const destination = singleDrive
    ? `${systemDrive()}\\Users\\${scan.User}\\${isVideo ? 'Videos' : 'Pictures'}`
    : `${String(target.id).toUpperCase()}\\Media\\${isVideo ? 'Videos' : 'Photos'}`;
  const targetFreeGB = singleDrive ? systemFreeGB(scan, drives) : num(target.freeGB);
  const kindLabel = isVideo ? '视频' : '照片';
  const lowSpace = knownSize && targetFreeGB > 0 && sourceGB > targetFreeGB;
  const sizeLabel = knownSize ? `${sourceGB} GB` : '待预览';
  const measuredNote = knownSize
    ? ''
    : candidate.derived
      ? ' 扫描只统计了这个目录里的大文件，实际文件数量/大小会在预览时测量。'
      : ' 扫描没有按文件类型拆分这个目录，实际文件数量/大小会在预览时测量。';
  const singleDriveNote = singleDrive
    ? ` 本机只有 ${systemDrive()} 一块磁盘：直接归档到现有 ${isVideo ? 'Videos' : 'Pictures'} 目录，不新建 Media；这是同盘整理，不会释放磁盘空间；需要释放空间时，请先备份到外置盘或云，再删除本地副本。`
    : '';
  const id = index === 0 ? `media-${kind}` : `media-${kind}-${index + 1}`;

  return {
    id,
    type: 'organize-media',
    category: 'media',
    title: `按年月归档${kindLabel}`,
    summary: `${kindLabel} ${sizeLabel} · ${source} → ${destination}`,
    description: `把 ${source} 中的${kindLabel}按拍摄/修改时间整理到 ${destination}\\YYYY\\YYYY-MM。保留原文件名，重名自动加序号，并生成 manifest。${measuredNote}${singleDriveNote}${lowSpace ? ` 目标位置当前空闲 ${round2(targetFreeGB)} GB，可能不足。` : ''}`,
    risk: lowSpace ? 'high' : 'medium',
    estimatedGB: knownSize ? sourceGB : 0,
    params: { source, destination, kind },
    editable: ['source', 'destination'],
    steps: [
      '扫描源目录中的媒体文件',
      '按拍摄时间/修改时间归入 YYYY\\YYYY-MM',
      '移动文件并处理重名',
      '写入 CSV manifest'
    ]
  };
}

function makeCleanPlan(scan, items, { id, title, category, description, risk }) {
  const selected = (items || []).filter((item) => junkGB(item) > 0);
  if (selected.length === 0) return null;
  const totalGB = round2(selected.reduce((sum, item) => sum + junkGB(item), 0));
  const important = risk === 'high';
  return {
    id,
    type: 'clean-junk',
    category: category || 'cache',
    title,
    summary: `${selected.length} 项 · ${totalGB} GB`,
    description,
    risk,
    estimatedGB: totalGB,
    params: { paths: selected.map((item) => item.Path) },
    steps: [
      '重新测量每个项目',
      '跳过受保护路径/需要复核的项目',
      '清理并写入 manifest',
      outerAcknowledge(important)
    ].filter(Boolean)
  };
}

function outerAcknowledge(important) {
  return important ? '执行前需要额外确认标记为“需确认”的项目' : null;
}

function makeSingleDriveMigrationAdvisory(item, index, sizeGB) {
  const isDocker = /docker|wsl/i.test(`${item.Name || ''} ${item.Path || ''}`);
  const steps = isDocker
    ? [
        '关闭 Docker Desktop 和 WSL（wsl --shutdown），确认 vhdx 未被占用',
        '先运行 docker system prune -a --volumes 清理未使用的镜像/容器/卷',
        '如仍不足，用 Docker Desktop 的磁盘镜像压缩或 Hyper-V Optimize-VHD 压缩 vhdx（需管理员）',
        '如要迁移，把 Disk image location 指向外置 SSD；本机没有第二块内置盘',
        '不要直接删除 docker_data.vhdx；执行前备份并写 manifest'
      ]
    : [
        '确认应用支持更改安装位置或数据目录',
        '先清理可再生缓存，再备份到外置盘或云并校验',
        '确认有副本后，使用官方卸载/重装或迁移工具处理',
        '写入 CSV manifest，并保留回滚说明'
      ];
  const targetNote = item.SuggestedTarget ? `无法迁移到 ${item.SuggestedTarget}` : '建议清理/压缩或外置';
  return {
    id: `migrate-${index}`,
    type: 'advisory',
    category: 'engineering',
    title: `压缩或外置 ${item.Name}`,
    summary: `${sizeGB} GB · 单盘环境 · ${targetNote}`,
    description: `${item.Path} 占用 ${sizeGB} GB。本机只有系统盘 ${systemDrive()}，没有第二块内置盘。${isDocker ? '优先清理/压缩 Docker WSL 镜像，或把镜像位置改到外置 SSD。' : '优先清理可再生数据，必要时备份到外置盘或云后再删除本地副本。'}`,
    risk: 'medium',
    estimatedGB: sizeGB,
    params: { source: item.Path },
    evidence: item.Reason || '',
    steps,
    auditCode: 'single-drive-migration'
  };
}

function makeMigratePlan(item, index, drives = []) {
  const sizeGB = round2(item.SizeGB);
  if (sizeGB < 1) return null;

  const sourceId = sourceDriveId(item.Path);
  const suggestedId = sourceDriveId(item.SuggestedTarget);
  const suggestedDrive = (Array.isArray(drives) ? drives : []).find(
    (drive) => String(drive.id).toUpperCase() === suggestedId && num(drive.freeGB) > 0
  );

  if (!suggestedDrive || suggestedId === sourceId) {
    const other = pickTargetDrive(item.Path, drives);
    if (!other) return makeSingleDriveMigrationAdvisory(item, index, sizeGB);
    const leaf = item.SuggestedTarget
      ? path.win32.basename(String(item.SuggestedTarget))
      : path.win32.basename(String(item.Path));
    return {
      id: `migrate-${index}`,
      type: 'migrate',
      category: 'engineering',
      title: `迁移 ${item.Name}`,
      summary: `${sizeGB} GB · ${item.Path} → ${other.id}\\${leaf}`,
      description: `${item.Reason || '把大目录移动到其他磁盘，并在原位置创建 junction。'} 已按当前磁盘列表把目标改为可用的 ${other.id}。`,
      risk: 'medium',
      estimatedGB: sizeGB,
      params: { source: item.Path, destination: `${other.id}\\${leaf}` },
      editable: ['destination'],
      steps: [
        '检查目标位置是否已存在',
        'robocopy 移动目录',
        '在原路径创建 junction',
        '写入 CSV manifest'
      ]
    };
  }

  return {
    id: `migrate-${index}`,
    type: 'migrate',
    category: 'engineering',
    title: `迁移 ${item.Name}`,
    summary: `${sizeGB} GB · ${item.Path} → ${item.SuggestedTarget}`,
    description: item.Reason || '把大目录移动到其他磁盘，并在原位置创建 junction。',
    risk: 'medium',
    estimatedGB: sizeGB,
    params: { source: item.Path, destination: item.SuggestedTarget },
    editable: ['destination'],
    steps: [
      '检查目标位置是否已存在',
      'robocopy 移动目录',
      '在原路径创建 junction',
      '写入 CSV manifest'
    ]
  };
}

function findingActionFor(finding, singleDrive) {
  const action = String(finding?.Action || 'Review the finding and propose a safe plan.');
  if (!singleDrive) return action;

  const id = String(finding?.Id || '');
  if (id === 'workspace-scattered') {
    return `选择 ${systemDrive()}\\Workspace 或 ${systemDrive()}\\Projects 之一作为唯一工作区根，把不活跃仓库归档；本机没有第二块盘，不要建议 D:\\Work。`;
  }
  if (id === 'media-system') {
    return '媒体在系统盘：先同盘归档到用户媒体根；需要释放空间时备份到外置盘或云，再删除本地副本。';
  }
  if (id === 'media-scattered') {
    return '选择一个媒体根做同盘整理；需要分层时使用外置盘或云归档。';
  }
  if (id === 'large-files' || id === 'large-archives') {
    return '先备份到外置盘或云并校验；确认有副本后再删除本地大文件。';
  }
  return action
    .replace(/D:\\/gi, `${systemDrive()}\\`)
    .replace(/another drive/gi, 'external storage')
    .replace(/data drive/gi, 'external drive');
}

/**
 * Generate structured, reviewable plans from an existing scan.
 * This is a deterministic local planner; no data leaves the machine.
 */
export function generatePlans(scan, drives = []) {
  if (!scan) return [];
  const plans = [];
  const singleDrive = isSingleDrive(drives);

  for (const kind of ['video', 'photo']) {
    mediaCandidates(scan, kind).forEach((candidate, index) => {
      const plan = makeMediaPlan(scan, drives, kind, candidate, index);
      if (plan) plans.push(plan);
    });
  }

  const safeItems = (scan.Junk || []).filter((item) => item.Safety === 'safe');
  plans.push(makeCleanPlan(scan, safeItems, {
    id: 'clean-safe',
    title: '清理安全缓存',
    category: 'cache',
    description: '清理应用更新缓存、浏览器/着色器缓存和临时文件；这些都是可再生成的。',
    risk: 'low'
  }));

  const confirmItems = (scan.Junk || []).filter((item) => item.Safety === 'confirm');
  plans.push(makeCleanPlan(scan, confirmItems, {
    id: 'clean-confirm',
    title: '清理旧安装包与回收站',
    category: 'cache',
    description: '旧安装包通常已经安装完成；回收站中的文件仍占用磁盘。执行前请核对。',
    risk: 'high'
  }));

  (scan.Migration || []).slice(0, 4).forEach((item, index) => {
    const plan = makeMigratePlan(item, index, drives);
    if (plan) plans.push(plan);
  });

  if (singleDrive && scan.Audit) {
    const freeGB = round2(systemFreeGB(scan, drives));
    plans.push({
      id: 'single-drive-strategy',
      type: 'advisory',
      category: 'engineering',
      title: '单盘环境：用外置盘或云做归档层',
      summary: `仅 ${systemDrive()} · 空闲 ${freeGB} GB`,
      description: `本机只有一块磁盘（${systemDrive()}，当前空闲 ${freeGB} GB）。所有“迁移到 D: / 数据盘”的建议都不适用；系统盘只保留活跃数据，媒体、课程视频、Docker 镜像等大目录应先备份到外置 SSD 或云，再考虑删除本地副本。`,
      risk: 'low',
      estimatedGB: 0,
      params: {},
      steps: [
        '准备外置 SSD 或云归档位置，并确认可校验（文件数/大小/哈希）',
        '先备份高价值媒体（婚礼、课程、照片），校验后再考虑删除本地副本',
        '把 Docker/WSL、旧课程视频、归档包作为首批外移对象',
        '每次移动写 CSV manifest；跨盘迁移时才在原位置创建 junction'
      ],
      auditCode: 'single-drive-strategy'
    });
  }

  const findings = Array.isArray(scan.Audit?.Findings) ? scan.Audit.Findings : [];
  const priority = findings.filter((finding) => ['P0', 'P1'].includes(finding.Severity));
  const secondary = findings.filter((finding) => finding.Severity === 'P2');
  [...priority, ...secondary].slice(0, 5).forEach((finding, index) => {
    plans.push({
      id: `audit-${String(finding.Id || index).replace(/[^a-z0-9]+/gi, '-')}`,
      type: 'advisory',
      category: findingCategory(finding),
      title: auditTitle(finding),
      summary: `${finding.Severity} · ${finding.Category} · 健康分 ${scan.Audit?.HealthScore ?? '—'}/100`,
      description: finding.Detail || finding.Title || '',
      risk: finding.Severity === 'P0' ? 'high' : finding.Severity === 'P1' ? 'medium' : 'low',
      estimatedGB: 0,
      params: {},
      evidence: finding.Evidence || '',
      steps: [
        findingActionFor(finding, singleDrive),
        '先输出分析和执行方案，等待我确认后再执行'
      ],
      auditCode: finding.Id
    });
  });

  return plans
    .filter(Boolean)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));
}

export function isMediaSourceAllowed(scan, source) {
  const target = normalizePathKey(source);
  if (!target) return false;

  const allowed = [];
  for (const folder of scan?.Media?.MediaFolders || []) {
    const base = normalizePathKey(mediaFolderPath(folder));
    if (base) allowed.push(base);
  }
  for (const media of collectMediaSources(scan)) {
    const base = normalizePathKey(media.path);
    if (base) allowed.push(base);
  }
  if (scan?.User) {
    const userRoot = normalizePathKey(`${systemDrive()}\\Users\\${scan.User}`);
    allowed.push(`${userRoot}\\videos`, `${userRoot}\\pictures`);
  }

  for (const base of allowed) {
    if (target === base || target.startsWith(`${base}\\`)) return true;
  }
  return false;
}

export function isMigrationSourceAllowed(scan, source) {
  const target = String(source || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
  return (scan.Migration || []).some((item) => String(item.Path || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '') === target);
}

export { MEDIA_ANY_RE };
