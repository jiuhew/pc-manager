# Naming conventions

## Photos and videos

```
2024\
  2024-11_日本旅行\
  2024-12_圣诞派对\
2025\
  2025-01_年会\
2026\
  2026-08_婚礼\
  2026-09_科莫多\
  2026-09_DJI航拍\
归档\
素材\
精修\
```

Rules:

- `YYYY-MM_EventOrPlace`.
- Use one language per level; Chinese event names are fine.
- Replace spaces with `_` or `-`.
- Keep camera filenames (`IMG_xxxx.CR3`, `DJI_xxxx.MP4`).
- Inside an event: `RAW/`, `JPG/`, `VIDEO/`, `精修/`, `素材/`.
- Move archives to `归档/`; extract and verify before deleting a zip.
- Group sidecar files by basename (CR3 + JPG + LRF) when moving.

## Documents and study material

```
学习\
  研一下_数字系统测试\
    课件\
    作业\
    参考\
电子书\
  摄影\
  计算机\
项目\
  pc-manager\
归档\
```

Rules:

- Course: `学期_课程名`.
- Ebook: `主题_书名`.
- Project: `项目名_状态`.
- Keep original filenames; add a prefix only for exports.

## Downloads

```
Downloads\
  2026\
    2026-11_安装包\
    2026-11_素材\
```

Rules:

- Separate installers, archives, and media.
- Delete installers older than 30 days after confirming the app is installed.
- Never delete personal downloads without confirmation.

## General

- Avoid `新建文件夹`, `New folder`, `未命名`, `copy`, `副本`, `(1)`.
- Avoid trailing spaces and special characters `\ / : * ? " < > |`.
- Prefer lowercase for technical folders (`src`, `docs`, `assets`).
- Keep depth reasonable (<= 4 levels for media, <= 5 for projects).
