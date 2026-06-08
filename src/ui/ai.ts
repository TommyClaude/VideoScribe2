// Optional AI modules: script generation (Anthropic), image generation and TTS
// (user-configured endpoints). All require a user-supplied key and are no-ops
// without one. Network/CORS behaviour needs verification on a real device; the
// response parsers handle a few common shapes.

import { newId } from "../engine/factory";
import { buildScriptPrompt } from "../engine/script";
import type { Asset } from "../engine/types";
import type { AiSettings } from "../state/settings";
import { loadImageSize } from "./assets";
import { decodeAudioAsset } from "./audioEngine";

/** Generate a voiceover script for a topic via the Anthropic Messages API. */
export async function generateScript(topic: string, s: AiSettings): Promise<string> {
  if (!s.anthropicKey) throw new Error("Chưa có Anthropic API key (mở Settings).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": s.anthropicKey,
      "anthropic-version": "2023-06-01",
      // allow direct calls from the webview
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: s.scriptModel || "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildScriptPrompt(topic) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  return text.trim();
}

/** Extract a data URL from a few common image-API response shapes. */
function imageDataUrlFrom(data: unknown): string | null {
  const d = data as Record<string, unknown>;
  if (typeof d?.url === "string") return d.url;
  if (typeof d?.image_base64 === "string") return `data:image/png;base64,${d.image_base64}`;
  const arr = (d?.data ?? d?.images) as unknown;
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0] as unknown;
    if (typeof first === "string") {
      return first.startsWith("data:") ? first : `data:image/png;base64,${first}`;
    }
    const obj = first as Record<string, unknown>;
    if (typeof obj?.b64_json === "string") return `data:image/png;base64,${obj.b64_json}`;
    if (typeof obj?.url === "string") return obj.url;
  }
  return null;
}

/** Generate an image from a prompt via a user-configured endpoint. */
export async function generateImage(prompt: string, s: AiSettings): Promise<Asset> {
  if (!s.imageEndpoint) throw new Error("Chưa cấu hình Image endpoint (Settings).");
  const res = await fetch(s.imageEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(s.imageKey ? { authorization: `Bearer ${s.imageKey}` } : {}),
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`Image API ${res.status}: ${await res.text()}`);
  const dataUrl = imageDataUrlFrom(await res.json());
  if (!dataUrl) throw new Error("Không đọc được ảnh từ phản hồi API.");
  const size = await loadImageSize(dataUrl);
  return { id: newId("asset"), type: "image", name: `AI: ${prompt.slice(0, 24)}`, src: dataUrl, ...size };
}

/** Generate voiceover audio from text via a user-configured TTS endpoint. */
export async function generateTTS(text: string, s: AiSettings): Promise<Asset> {
  if (!s.ttsEndpoint) throw new Error("Chưa cấu hình TTS endpoint (Settings).");
  const res = await fetch(s.ttsEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(s.ttsKey ? { authorization: `Bearer ${s.ttsKey}` } : {}),
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`TTS API ${res.status}: ${await res.text()}`);

  const ct = res.headers.get("content-type") ?? "";
  let url: string;
  if (ct.includes("application/json")) {
    const data = (await res.json()) as Record<string, unknown>;
    const b64 = (data.audio_base64 ?? data.audio) as string | undefined;
    if (!b64) throw new Error("Không đọc được audio từ phản hồi API.");
    url = b64.startsWith("data:") ? b64 : `data:audio/mpeg;base64,${b64}`;
  } else {
    const blob = await res.blob();
    url = URL.createObjectURL(blob);
  }
  const asset: Asset = { id: newId("asset"), type: "audio", name: "AI voiceover", src: url };
  try {
    asset.duration = (await decodeAudioAsset(asset)).duration;
  } catch {
    /* duration optional */
  }
  return asset;
}
