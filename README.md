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

## Build `.dmg` (arm64) & ký (signing)

```bash
npm install
npm run fetch-ffmpeg                 # ffmpeg-aarch64-apple-darwin (gitignored)
npm run tauri icon src-tauri/icons/icon-source.png   # (chỉ cần khi đổi icon)
npm run tauri build -- --target aarch64-apple-darwin
```

Output:
- `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Scribely_0.1.0_aarch64.dmg`
- `…/bundle/macos/Scribely.app`

### Ký để dùng cá nhân
- **Ad‑hoc (chạy trên chính máy build):** Tauri tự ký ad‑hoc; nếu Gatekeeper chặn,
  chuột phải → *Open*, hoặc:
  ```bash
  xattr -dr com.apple.quarantine "/Applications/Scribely.app"
  ```
- **Ký bằng Developer ID + notarize (chia sẻ):** đặt biến môi trường trước khi build:
  ```bash
  export APPLE_SIGNING_IDENTITY="Developer ID Application: Tên Bạn (TEAMID)"
  export APPLE_ID="you@example.com"
  export APPLE_PASSWORD="app-specific-password"
  export APPLE_TEAM_ID="TEAMID"
  npm run tauri build -- --target aarch64-apple-darwin
  ```
  Xem thêm: https://v2.tauri.app/distribute/sign/macos/

CI (`.github/workflows/build.yml`) build `.dmg` trên runner `macos-14`; đẩy tag `v*`
sẽ tạo GitHub Release kèm `.dmg`.

## Trạng thái phát triển
Dự án được xây theo 10 phase (xem lịch sử commit "Phase N: ..."). Các phần phụ thuộc
macOS/GPU/ffmpeg (UI thực, export video, build .dmg) cần **QC trực quan trên máy Mac**;
phần logic engine được test tự động.
