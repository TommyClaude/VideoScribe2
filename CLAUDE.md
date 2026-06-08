# Dự án: Scribely — Whiteboard Animation cho macOS (Apple Silicon)

## Mục tiêu
App native macOS tạo video "vẽ tay" (whiteboard animation) như VideoScribe.

## Tech stack (KHÔNG đổi nếu chưa hỏi)
- Tauri 2 (Rust) — vỏ native, build arm64 .app/.dmg
- React + TypeScript + Vite — frontend
- Canvas 2D làm compositor; nét SVG được flatten thành polyline rồi vẽ dần trên canvas
  (hiệu ứng "vẽ tay") — xem ghi chú "Quyết định kiến trúc" bên dưới.
- Zustand cho state
- ffmpeg (binary arm64) làm Tauri sidecar để export video

## Quy ước
- TypeScript strict mode. Không dùng `any` trừ khi bắt buộc.
- Tách rõ: `src/engine/` (logic thuần, KHÔNG phụ thuộc React/DOM), `src/ui/` (React),
  `src/state/` (Zustand), `src-tauri/` (Rust).
- Engine phải deterministic: hàm `render(project, t)` nhận `(project, t)` trả về frame,
  KHÔNG dùng `Date.now()` / `Math.random()` trong đường render.
- Mỗi phase: viết code + chạy thử + tự kiểm chứng trước khi báo xong.

## Mô hình dữ liệu
`Project → scenes[] → elements[]`; mỗi element có `transform` + `anim`
(drawDuration, holdDuration, drawOrder, handId, style). Xem `src/engine/types.ts`.

## Lệnh
- `npm run dev` — chạy frontend (Vite) đơn lẻ
- `npm run tauri dev` — chạy app (Tauri)
- `npm run tauri build` — build .dmg
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — unit test engine (Vitest, headless)
- `npm run fetch-ffmpeg` — tải ffmpeg arm64 về `src-tauri/binaries/` (gitignored)
- ffmpeg gọi qua sidecar, KHÔNG giả định ffmpeg có sẵn trong PATH hệ thống.

## Tiêu chuẩn chất lượng
- Không báo "xong" nếu chưa chạy thử và chưa nêu cách kiểm chứng.
- Animation export phải khớp với preview (cùng compositor, chỉ khác cách tăng `t`).
- Trước mỗi commit: `npm run build` (gồm tsc) pass, `npm test` pass, `cargo check` pass.

## Quyết định kiến trúc (vì sao canvas, không phải SVG DOM)
Để **preview == export** và **deterministic + test được headless**, engine flatten mọi
nét SVG (`<path>`, line, rect, circle, polygon…) thành polyline (mảng điểm) bằng module
hình học thuần (`src/engine/geometry.ts`) — KHÔNG phụ thuộc `getTotalLength()`/
`getPointAtLength()` của DOM. Hiệu ứng "vẽ" = vẽ dần polyline tới `progress * totalLength`
trên Canvas 2D. Vị trí bàn tay = điểm tại `progress * totalLength`. Nhờ vậy cùng một hàm
compositor chạy được cả ở preview (Canvas), export (OffscreenCanvas) và test (Node, không DOM).

## Môi trường phát triển trên cloud (Linux) — giới hạn kiểm chứng
Repo này được phát triển một phần trên CI/cloud Linux. Những phần KHÔNG kiểm chứng được
trên Linux (UI tương tác, animation thực, export video qua ffmpeg arm64, build .dmg) được
viết theo plan và đánh dấu "cần QC trực quan trên Mac" trong commit. Phần logic engine
(timeline, geometry, camera, drawing math) được test headless bằng Vitest và PHẢI pass.

## CI
`.github/workflows/build.yml` chạy trên runner `macos-14` (Apple Silicon): cài deps,
`npm run fetch-ffmpeg`, typecheck + test, rồi `tauri build` ra `.dmg`. Tag `v*` sẽ tạo release.
