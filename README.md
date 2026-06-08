# Scribely

Whiteboard‑animation app cho **macOS (Apple Silicon)** — một bản clone theo phong cách
VideoScribe. Tạo video "vẽ tay" từ SVG/ảnh, có timeline, camera pan/zoom, audio và export
MP4/GIF/MOV qua `ffmpeg`.

> Tech stack: **Tauri 2 + React + TypeScript + Vite + Zustand**, Canvas 2D compositor,
> `ffmpeg` arm64 làm Tauri sidecar.

## Yêu cầu
- macOS Apple Silicon (arm64) để build/chạy bản native và export video.
- Node.js ≥ 20, Rust (stable), Xcode Command Line Tools.

## Bắt đầu

```bash
npm install
npm run fetch-ffmpeg     # tải ffmpeg arm64 về src-tauri/binaries/ (gitignored)
npm run tauri dev        # chạy app
```

### Lệnh hữu ích
| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy riêng frontend (Vite) trong trình duyệt |
| `npm run tauri dev` | Chạy app Tauri |
| `npm run tauri build` | Build `.app` / `.dmg` arm64 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit test engine (Vitest, headless) |
| `npm run fetch-ffmpeg` | Tải ffmpeg sidecar |

## Cấu trúc
```
src/
  engine/   # logic thuần, deterministic, test được headless (geometry, drawing, timeline, camera, compositor, exporter)
  state/    # Zustand store
  ui/       # React components (stage, timeline, panels)
src-tauri/  # Rust: file IO, ffmpeg sidecar, save/load
scripts/    # fetch-ffmpeg
```

## ffmpeg sidecar
Binary KHÔNG được commit. `scripts/fetch-ffmpeg` tải bản static arm64 về
`src-tauri/binaries/ffmpeg-aarch64-apple-darwin` (đúng quy ước target-triple của Tauri).
Có thể đặt URL khác qua biến môi trường `FFMPEG_URL`.

## Trạng thái phát triển
Dự án được xây theo 10 phase (xem lịch sử commit "Phase N: ..."). Các phần phụ thuộc
macOS/GPU/ffmpeg (UI thực, export video, build .dmg) cần **QC trực quan trên máy Mac**;
phần logic engine được test tự động.
