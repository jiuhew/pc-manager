import path from 'node:path';

const MEDIA_VIDEO_RE = /video|movie|视频|影片|素材|dcim|camera/i;
const MEDIA_PHOTO_RE = /photo|picture|image|dcim|camera|相册|照片|图片/i;
const MEDIA_ANY_RE = /video|movie|photo|picture|image|dcim|camera|视频|影片|相册|照片|图片|素材/i;

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
    .filter((drive) => String(drive.id).toUpperCase() !== sourceId)
    .sort((a, b) => num(b.freeGB) - num(a.freeGB));
  return candidates[0] || (Array.isArray(drives) ? drives[0] : null) || { id: systemDrive(), freeGB: 0 };
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

function makeMediaPlan(scan, drives, kind) {
  const isVideo = kind === 'video';
  const totalGB = round2(isVideo ? scan.Media?.VideoGB : scan.Media?.PhotoGB);
  if (totalGB < 0.5) return null;

  const matcher = isVideo ? MEDIA_VIDEO_RE : MEDIA_PHOTO_RE;
  const rawFolders = (Array.isArray(scan.Media?.MediaFolders) ? scan.Media.MediaFolders : [])
    .sort((a, b) => num(b.SizeGB) - num(a.SizeGB));
  const allFolders = rawFolders.filter((folder) => !isArchiveLikeFolder(folder));
  const folders = allFolders.filter((folder) => matcher.test(String(folder?.Folder || '')));

  let source = '';
  let knownSize = false;
  let sourceGB = 0;
  if (folders[0]) {
    source = mediaFolderPath(folders[0]);
    knownSize = true;
    sourceGB = num(folders[0].SizeGB);
  } else if (allFolders[0]) {
    // The scan does not split a generic media root by file type. Point at the
    // largest media root and measure the real files during preview.
    source = mediaFolderPath(allFolders[0]);
  } else if (rawFolders.length === 0) {
    // No media roots were detected at all; use the standard user folders.
    if (!scan.User) return null;
    source = `${systemDrive()}\\Users\\${scan.User}\\${isVideo ? 'Videos' : 'Pictures'}`;
  } else {
    // Only archive-like roots remain (for example a large ZIP folder). Do not
    // pretend the global media total belongs to them.
    return null;
  }

  const target = pickTargetDrive(source, drives);
  const destination = `${String(target.id).toUpperCase()}\\Media\\${isVideo ? 'Videos' : 'Photos'}`;
  const kindLabel = isVideo ? '视频' : '照片';
  const targetFreeGB = num(target.freeGB);
  const lowSpace = knownSize && targetFreeGB > 0 && sourceGB > targetFreeGB;
  const sizeLabel = knownSize ? `${round2(sourceGB)} GB` : '待预览';
  const measuredNote = knownSize
    ? ''
    : ' 扫描没有按文件类型拆分这个目录，实际文件数量/大小会在预览时测量。';

  return {
    id: `media-${kind}`,
    type: 'organize-media',
    category: 'media',
    title: `按年月归档${kindLabel}`,
    summary: `${kindLabel} ${sizeLabel} · ${source} → ${destination}`,
    description: `把 ${source} 中的${kindLabel}按拍摄/修改时间整理到 ${destination}\\YYYY\\YYYY-MM。保留原文件名，重名自动加序号，并生成 manifest。${measuredNote}${lowSpace ? ` 目标盘当前空闲 ${round2(targetFreeGB)} GB，可能不足。` : ''}`,
    risk: lowSpace ? 'high' : 'medium',
    estimatedGB: knownSize ? round2(sourceGB) : 0,
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

function makeMigratePlan(item, index) {
  const sizeGB = round2(item.SizeGB);
  if (sizeGB < 1) return null;
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

/**
 * Generate structured, reviewable plans from an existing scan.
 * This is a deterministic local planner; no data leaves the machine.
 */
export function generatePlans(scan, drives = []) {
  if (!scan) return [];
  const plans = [];

  const videoPlan = makeMediaPlan(scan, drives, 'video');
  if (videoPlan) plans.push(videoPlan);
  const photoPlan = makeMediaPlan(scan, drives, 'photo');
  if (photoPlan) plans.push(photoPlan);

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
    const plan = makeMigratePlan(item, index);
    if (plan) plans.push(plan);
  });

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
        finding.Action || 'Review the finding and propose a safe plan.',
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
  const target = String(source || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
  if (!target) return false;

  const media = (scan.Media?.MediaFolders || []).map(mediaFolderPath).filter(Boolean);
  for (const folder of media) {
    const base = folder.toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
    if (target === base || target.startsWith(`${base}\\`)) return true;
  }

  if (scan.User) {
    const userRoot = `${systemDrive()}\\Users\\${scan.User}`.toLowerCase();
    if (target === `${userRoot}\\videos` || target === `${userRoot}\\pictures`) return true;
  }
  return false;
}

export function isMigrationSourceAllowed(scan, source) {
  const target = String(source || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '');
  return (scan.Migration || []).some((item) => String(item.Path || '').toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '') === target);
}

export { MEDIA_ANY_RE };
